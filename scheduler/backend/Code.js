/**
 * Splash Booking — backend (Google Apps Script)
 *
 * Powers the customer booking page (/book/) and the owner app (/scheduler/).
 * Stores links and bookings in a Google Sheet, emails you when a customer
 * books / changes / cancels, drops the job on your Google Calendar, and can
 * push an instant alert to your phone through the free ntfy app.
 *
 * Setup (about 10 minutes, on a computer — the Scheduler app's Settings tab
 * walks through it):
 *   1. Go to sheets.new  ->  Extensions  ->  Apps Script.
 *   2. Click in the code, press Ctrl+A (Cmd+A on a Mac) and Delete so the
 *      editor is completely empty, then paste this whole file. The last line
 *      must be the "END OF FILE" comment; delete anything below it.
 *   3. Change ADMIN_PASSCODE below (10+ characters). Save.
 *   4. "setup" is picked in the function menu next to Run. Press Run and
 *      approve the permissions (if Google lists checkboxes, tick "Select all").
 *   5. Deploy -> New deployment -> type "Web app"
 *        Execute as: Me    Who has access: Anyone    -> Deploy.
 *   6. Copy the Web app URL into the Scheduler app (Settings -> Connection).
 *
 * Updating to a newer version of this file: paste over the old code the same
 * way (step 2) and Save. You don't need to change the passcode or run setup
 * again. Then Deploy -> Manage deployments -> Edit (pencil) -> Version: New
 * version -> Deploy. The URL stays the same. Opening the URL in a browser shows
 * the version that's live.
 *
 * The same file also runs in the browser for the apps' demo mode, so all the
 * Apps Script-only calls live inside functions.
 */

// ---- Your settings ---------------------------------------------------------

// Passcode for the Scheduler app (10+ characters). Running `setup` stores it in
// Script Properties; after that you can change it from the app. Forgot it?
// Put a new one here and run `setup` again (that also signs out every device).
const ADMIN_PASSCODE = 'CHANGE-ME';

// Decides what "today" is and which day calendar events land on.
const TIME_ZONE = 'America/New_York';


// Run this once from the editor: it asks for permissions, adds the sheet tabs
// and saves your passcode. It's the first function in this file so the editor's
// Run menu has it picked already. Running it again is safe; it also lifts a
// wrong-passcode lockout.
function setup() {
  var props = props_();
  var min = BookingCore.minPasscode;
  var fromCode = ADMIN_PASSCODE !== 'CHANGE-ME' ? String(ADMIN_PASSCODE) : '';
  if (fromCode && fromCode.length < min) {
    throw new Error('ADMIN_PASSCODE needs at least ' + min + ' characters. Change it, save, then run setup again.');
  }
  var stored = props.getProperty('ADMIN_PASSCODE');
  if (!stored && !fromCode) {
    throw new Error('First change ADMIN_PASSCODE at the top of this file (' + min + '+ characters), save, then run setup again.');
  }
  if (fromCode && fromCode !== stored) {
    props.setProperty('ADMIN_PASSCODE', fromCode);
    props.deleteProperty('TOKENS'); // a new passcode signs out every device
  }

  var ss = spreadsheet_();
  ensureSheet_(ss, 'Links', LINK_COLS_);
  ensureSheet_(ss, 'Activity', ACTIVITY_COLS_);
  var blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
  if (!props.getProperty('CONFIG')) props.setProperty('CONFIG', JSON.stringify(BookingCore.defaults()));

  // Touch each service so every permission is granted now, not on the first booking.
  CalendarApp.getDefaultCalendar().getName();
  MailApp.getRemainingDailyQuota();
  CacheService.getScriptCache().remove('authFails');

  Logger.log('Setup complete. Bookings sheet: ' + ss.getUrl());
  Logger.log('Next: Deploy -> New deployment -> Web app (Execute as: Me, Who has access: Anyone).');
}


// ---- Booking logic (shared with the browser demo) ---------------------------

var BookingCore = (function () {
  'use strict';

  var DAY_MS = 86400000;
  var MAX_WINDOW_DAYS = 400;
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  var ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  var VERSION = 2;
  var MIN_PASSCODE = 10; // for new passcodes; one saved before this rule still works

  var DEFAULTS = {
    businessName: 'Splash Pressure Washing',
    tagline: 'Veteran & Firefighter Owned · Chesapeake, VA',
    ownerName: '',
    phone: '',
    notifyEmail: '',
    ntfyTopic: '',
    addToCalendar: true,
    workDays: [1, 2, 3, 4, 5, 6],
    capacity: 1,
    minNotice: 1,
    blocked: [],
    opened: [],
    siteUrl: ''
  };

  // ---- Errors the customer / owner should see ----
  function fail(code, message) {
    var e = new Error(message);
    e.code = code;
    e.isUserError = true;
    throw e;
  }

  // ---- Calendar-date math on 'YYYY-MM-DD' strings (no time zones involved) ----
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toMs(s) { var p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function fromMs(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function isDate(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && fromMs(toMs(s)) === s;
  }
  function addDays(s, n) { return fromMs(toMs(s) + n * DAY_MS); }
  function weekday(s) { return new Date(toMs(s)).getUTCDay(); }
  function diffDays(a, b) { return Math.round((toMs(b) - toMs(a)) / DAY_MS); }
  function prettyDate(s, style) {
    if (!isDate(s)) return '';
    var p = s.split('-'), m = +p[1] - 1, d = +p[2], wd = weekday(s);
    if (style === 'short') return WEEKDAYS[wd].slice(0, 3) + ', ' + MONTHS[m].slice(0, 3) + ' ' + d;
    if (style === 'day') return WEEKDAYS[wd] + ', ' + MONTHS[m] + ' ' + d;
    return WEEKDAYS[wd] + ', ' + MONTHS[m] + ' ' + d + ', ' + p[0];
  }

  // ---- Input cleaning ----
  function clean(v, max) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function clampInt(v, lo, hi, dflt) {
    v = parseInt(v, 10);
    return isNaN(v) ? dflt : Math.max(lo, Math.min(hi, v));
  }
  function toSet(arr) {
    var s = {};
    (arr || []).forEach(function (x) { s[x] = true; });
    return s;
  }
  function dateList(arr, minDate) {
    var seen = {};
    return (Array.isArray(arr) ? arr : []).filter(function (d) {
      if (!isDate(d) || seen[d] || (minDate && d < minDate)) return false;
      seen[d] = true;
      return true;
    }).sort();
  }
  function validEmail(v) {
    v = clean(v, 120);
    return /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(v) ? v : '';
  }
  function validSite(v) {
    v = clean(v, 200);
    return /^https:\/\/[^\s"'<>]+\/$/.test(v) ? v : '';
  }
  function idFromBytes(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i++) out += ID_CHARS[bytes[i] % ID_CHARS.length];
    return out;
  }

  // ---- Config ----
  function normalizeConfig(c, today) {
    c = c || {};
    var has = function (k) { return Object.prototype.hasOwnProperty.call(c, k); };
    var keepFrom = today ? addDays(today, -7) : '';
    var workDays = DEFAULTS.workDays.slice();
    if (has('workDays') && Array.isArray(c.workDays)) {
      var wd = toSet(c.workDays.map(Number).filter(function (d) { return d >= 0 && d <= 6; }));
      workDays = [0, 1, 2, 3, 4, 5, 6].filter(function (d) { return wd[d]; });
    }
    return {
      businessName: clean(c.businessName, 80) || DEFAULTS.businessName,
      tagline: has('tagline') ? clean(c.tagline, 120) : DEFAULTS.tagline,
      ownerName: clean(c.ownerName, 40),
      phone: clean(c.phone, 30),
      notifyEmail: validEmail(c.notifyEmail),
      ntfyTopic: /^[A-Za-z0-9_-]{1,64}$/.test(c.ntfyTopic || '') ? c.ntfyTopic : '',
      addToCalendar: has('addToCalendar') ? !!c.addToCalendar : DEFAULTS.addToCalendar,
      workDays: workDays,
      capacity: clampInt(c.capacity, 1, 20, DEFAULTS.capacity),
      minNotice: clampInt(c.minNotice, 0, 60, DEFAULTS.minNotice),
      blocked: dateList(c.blocked, keepFrom),
      opened: dateList(c.opened, keepFrom),
      siteUrl: validSite(c.siteUrl)
    };
  }
  function loadConfig(env) { return normalizeConfig(env.store.getConfig(), env.today()); }

  // ---- Availability ----
  function bookedCounts(links, excludeId) {
    var counts = {};
    links.forEach(function (l) {
      if (l.status === 'booked' && !l.archived && l.date && l.id !== excludeId) {
        counts[l.date] = (counts[l.date] || 0) + 1;
      }
    });
    return counts;
  }
  // A day the owner works, before bookings are counted. Blocked always wins.
  function isWorkingDay(cfg, d, sets) {
    sets = sets || { blocked: toSet(cfg.blocked), opened: toSet(cfg.opened), work: toSet(cfg.workDays) };
    if (sets.blocked[d]) return false;
    return !!(sets.opened[d] || sets.work[weekday(d)]);
  }
  function firstBookable(cfg, today) { return addDays(today, cfg.minNotice); }
  function openDays(cfg, links, start, end, today, excludeId) {
    var counts = bookedCounts(links, excludeId);
    var sets = { blocked: toSet(cfg.blocked), opened: toSet(cfg.opened), work: toSet(cfg.workDays) };
    var from = firstBookable(cfg, today);
    if (start > from) from = start;
    var out = [];
    for (var d = from, n = 0; d <= end && n <= MAX_WINDOW_DAYS; d = addDays(d, 1), n++) {
      if (isWorkingDay(cfg, d, sets) && (counts[d] || 0) < cfg.capacity) out.push(d);
    }
    return out;
  }

  // ---- Links ----
  function blankLink() {
    return {
      id: '', customer: '', service: '', start: '', end: '', created: '', archived: false,
      views: 0, lastViewed: '', status: 'open', date: '', name: '', phone: '', address: '',
      bookedAt: '', updatedAt: '', eventId: '', history: []
    };
  }
  function findLink(links, id) {
    id = String(id || '');
    if (!id) return null;
    for (var i = 0; i < links.length; i++) if (links[i].id === id) return links[i];
    return null;
  }
  function liveLink(links, id) {
    var link = findLink(links, id);
    if (!link || link.archived) {
      fail('not_found', "This scheduling link isn't active anymore. Please reach out to us for a new one.");
    }
    return link;
  }
  function pushHistory(link, entry) {
    link.history = (link.history || []).concat([entry]).slice(-30);
  }
  function throttle(link, nowMs) {
    var recent = (link.history || []).filter(function (h) {
      return h.by === 'customer' && nowMs - Date.parse(h.at) < 3600000;
    }).length;
    if (recent >= 8) {
      fail('slow_down', "That's a lot of changes in a short time. Please give us a call and we'll sort it out.");
    }
  }

  // Notes the owner puts in (parentheses) on a link's customer name stay private,
  // including notes with parentheses inside them, like a (757) phone number.
  function publicName(s) {
    s = String(s || '');
    for (var prev = null; prev !== s;) {
      prev = s;
      s = s.replace(/\([^()]*\)/g, ' ');
    }
    return s.replace(/\(.*$/, ' ').replace(/\)/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // What the customer's page gets. Never includes other customers' details.
  function publicLink(cfg, link, links, today) {
    var history = link.history || [];
    var last = history[history.length - 1] || {};
    return {
      business: { name: cfg.businessName, tagline: cfg.tagline, phone: cfg.phone },
      link: {
        id: link.id,
        customer: publicName(link.customer),
        service: link.service,
        start: link.start,
        end: link.end,
        status: link.status,
        date: link.status === 'open' ? '' : link.date,
        name: link.status === 'booked' ? link.name : '',
        cancelledBy: link.status === 'cancelled' ? (last.by || '') : ''
      },
      open: openDays(cfg, links, link.start, link.end, today, link.id),
      today: today,
      firstBookable: firstBookable(cfg, today),
      closed: link.end < firstBookable(cfg, today)
    };
  }

  // Text used by every notification channel.
  function describe(evt) {
    var l = evt.link || {};
    var who = l.name || l.customer || 'A customer';
    var day = prettyDate(l.date, 'long');
    var short = prettyDate(l.date, 'short');
    if (evt.type === 'booked') {
      return { title: 'New booking', tag: 'calendar', subject: 'New booking: ' + who + ' — ' + short,
        line: who + ' picked ' + day + '.' };
    }
    if (evt.type === 'changed') {
      return { title: 'Booking changed', tag: 'arrows_counterclockwise',
        subject: 'Changed: ' + who + ' moved to ' + short + ' (was ' + prettyDate(evt.from, 'short') + ')',
        line: who + ' moved their day from ' + prettyDate(evt.from, 'long') + ' to ' + day + '.' };
    }
    if (evt.type === 'cancelled') {
      return { title: 'Booking cancelled', tag: 'x', subject: 'Cancelled: ' + who + ' — ' + short,
        line: who + ' cancelled ' + day + '.' };
    }
    return { title: 'Test alert', tag: 'white_check_mark', subject: 'Test: booking alerts are working',
      line: 'Booking alerts are set up. You’ll get one of these every time a customer books, changes, or cancels.' };
  }

  // ---- Actions ----
  var ACTIONS = {};

  ACTIONS['link.get'] = function (req, env) {
    var links = env.store.listLinks();
    var link = liveLink(links, req.id);
    var cfg = loadConfig(env);
    if (!req.preview) {
      try {
        env.store.patchLink(link.id, { views: (+link.views || 0) + 1, lastViewed: env.now() });
      } catch (e) { /* a missed view count is fine */ }
    }
    return publicLink(cfg, link, links, env.today());
  };

  ACTIONS['link.book'] = function (req, env) {
    var date = String(req.date || '');
    if (!isDate(date)) fail('bad_date', 'Please pick a day.');
    var hasInfo = Object.prototype.hasOwnProperty.call(req, 'name');
    return env.lock(function () {
      var today = env.today(), now = env.now();
      var links = env.store.listLinks();
      var link = liveLink(links, req.id);
      var cfg = loadConfig(env);
      var wasBooked = link.status === 'booked';
      var prev = wasBooked ? link.date : '';
      if (wasBooked && prev < today) fail('past', 'This service day has already passed.');
      if (wasBooked && date === prev && !hasInfo) return publicLink(cfg, link, links, today);
      throttle(link, Date.parse(now));
      var name = clean(req.name, 80) || (wasBooked ? link.name : '');
      if (!name) fail('name_required', 'Please enter your name.');
      if (date !== prev && openDays(cfg, links, link.start, link.end, today, link.id).indexOf(date) < 0) {
        fail('unavailable', 'Sorry — that day was just taken. Please pick another day.');
      }
      var type = !wasBooked ? 'booked' : (date !== prev ? 'changed' : 'updated');
      link.name = name;
      if (hasInfo) {
        link.phone = clean(req.phone, 30) || link.phone;
        link.address = clean(req.address, 200) || link.address;
      }
      link.status = 'booked';
      link.date = date;
      link.updatedAt = now;
      if (!wasBooked) link.bookedAt = now;
      pushHistory(link, { at: now, type: type, date: date, from: prev, by: 'customer' });
      env.store.putLink(link);
      env.store.addActivity({ at: now, linkId: link.id, type: type, date: date, from: prev, name: name, by: 'customer' });
      afterChange(env, { type: type, link: link, from: prev, cfg: cfg, quiet: type === 'updated' });
      return publicLink(cfg, link, links, today);
    });
  };

  ACTIONS['link.cancel'] = function (req, env) {
    return env.lock(function () {
      var today = env.today(), now = env.now();
      var links = env.store.listLinks();
      var link = liveLink(links, req.id);
      var cfg = loadConfig(env);
      if (link.status !== 'booked') return publicLink(cfg, link, links, today);
      if (link.date < today) fail('past', 'This service day has already passed.');
      throttle(link, Date.parse(now));
      link.status = 'cancelled';
      link.updatedAt = now;
      pushHistory(link, { at: now, type: 'cancelled', date: link.date, by: 'customer' });
      env.store.putLink(link);
      env.store.addActivity({ at: now, linkId: link.id, type: 'cancelled', date: link.date, from: '', name: link.name, by: 'customer' });
      afterChange(env, { type: 'cancelled', link: link, cfg: cfg });
      return publicLink(cfg, link, links, today);
    });
  };

  // Notifications run after the booking is saved; a failed email never loses a booking.
  function afterChange(env, evt) {
    var result = {};
    try { result = env.notify(evt) || {}; } catch (e) { if (env.log) env.log(e); }
    if (result.eventId !== undefined && result.eventId !== evt.link.eventId) {
      evt.link.eventId = result.eventId;
      try { env.store.patchLink(evt.link.id, { eventId: result.eventId }); } catch (e2) { if (env.log) env.log(e2); }
    }
  }

  ACTIONS['admin.load'] = function (req, env) {
    var cfg = loadConfig(env);
    var site = validSite(req.site);
    if (site && site !== cfg.siteUrl) {
      env.lock(function () {
        var fresh = loadConfig(env);
        fresh.siteUrl = site;
        env.store.setConfig(fresh);
      }, { optional: true });
      cfg.siteUrl = site;
    }
    var today = env.today();
    var links = env.store.listLinks().filter(function (l) { return !l.archived; });
    links.sort(function (a, b) { return a.created < b.created ? 1 : -1; });
    // Keep the payload small: recent links plus anything still upcoming.
    var cutoff = addDays(today, -120);
    links = links.filter(function (l, i) {
      return i < 300 || l.end >= today || (l.status === 'booked' && l.date >= today) || l.created.slice(0, 10) >= cutoff;
    });
    return {
      config: cfg,
      links: links,
      activity: env.store.listActivity(80),
      today: today,
      account: env.account ? env.account() : ''
    };
  };

  // `base` is the config the device last loaded. Only what the device actually
  // changed since then is applied, so edits made on another phone or computer
  // in the meantime survive.
  function mergeConfig(current, base, client) {
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      if (Array.isArray(DEFAULTS[k])) {
        var b = toSet(base[k]), c = toSet(client[k]);
        var keep = current[k].filter(function (x) { return !(b[x] && !c[x]); });
        client[k].forEach(function (x) { if (!b[x] && keep.indexOf(x) < 0) keep.push(x); });
        out[k] = keep;
      } else {
        out[k] = JSON.stringify(client[k]) === JSON.stringify(base[k]) ? current[k] : client[k];
      }
    });
    return out;
  }

  ACTIONS['admin.saveConfig'] = function (req, env) {
    return env.lock(function () {
      var today = env.today();
      var current = loadConfig(env);
      var client = normalizeConfig(req.config, today);
      var next = req.base && typeof req.base === 'object'
        ? normalizeConfig(mergeConfig(current, normalizeConfig(req.base, today), client), today)
        : client;
      if (!next.siteUrl) next.siteUrl = current.siteUrl;
      env.store.setConfig(next);
      return { config: next };
    });
  };

  ACTIONS['admin.createLink'] = function (req, env) {
    var start = String(req.start || ''), end = String(req.end || '');
    if (!isDate(start) || !isDate(end)) fail('bad_date', 'Pick the first and last day the customer can see.');
    if (end < start) fail('bad_date', 'The last day has to be after the first day.');
    if (diffDays(start, end) > MAX_WINDOW_DAYS) fail('bad_date', 'Keep the window under a year.');
    if (end < env.today()) fail('bad_date', 'That window is already in the past.');
    return env.lock(function () {
      var links = env.store.listLinks();
      var id;
      do { id = env.newId(); } while (findLink(links, id));
      var link = blankLink();
      link.id = id;
      link.customer = clean(req.customer, 60);
      link.service = clean(req.service, 80);
      link.start = start;
      link.end = end;
      link.created = env.now();
      env.store.putLink(link);
      return { link: link };
    });
  };

  function ownerCancel(env, link, cfg) {
    var now = env.now();
    link.status = 'cancelled';
    link.updatedAt = now;
    pushHistory(link, { at: now, type: 'cancelled', date: link.date, by: 'owner' });
    env.store.putLink(link);
    env.store.addActivity({ at: now, linkId: link.id, type: 'cancelled', date: link.date, from: '', name: link.name, by: 'owner' });
    // quiet: you did this yourself, so no email/push — just clear the calendar event.
    afterChange(env, { type: 'cancelled', link: link, cfg: cfg, quiet: true });
  }

  ACTIONS['admin.cancelBooking'] = function (req, env) {
    return env.lock(function () {
      var link = findLink(env.store.listLinks(), req.id);
      if (!link) fail('not_found', 'That booking no longer exists.');
      if (link.status === 'booked') ownerCancel(env, link, loadConfig(env));
      return { link: link };
    });
  };

  ACTIONS['admin.archiveLink'] = function (req, env) {
    return env.lock(function () {
      var link = findLink(env.store.listLinks(), req.id);
      if (!link) return { link: null };
      if (link.status === 'booked' && link.date >= env.today()) ownerCancel(env, link, loadConfig(env));
      link.archived = true;
      env.store.putLink(link);
      return { link: link };
    });
  };

  ACTIONS['admin.testNotify'] = function (req, env) {
    return { results: env.notify({ type: 'test', cfg: loadConfig(env), link: {} }) || {} };
  };

  ACTIONS['admin.setPasscode'] = function (req, env) {
    var next = String(req.newKey || '');
    if (next.length < MIN_PASSCODE) fail('weak', 'Use at least ' + MIN_PASSCODE + ' characters.');
    // Signs out every other device; this one gets a fresh token.
    return { token: env.setPasscode(next) };
  };

  // The passcode is checked only here. A signed-in device keeps working with its
  // token even while wrong-passcode attempts have new sign-ins locked out.
  ACTIONS['admin.login'] = function (req, env) {
    env.checkAdmin(String(req.key || ''));
    var token = env.issueToken();
    var data = ACTIONS['admin.load'](req, env);
    data.token = token;
    return data;
  };

  ACTIONS['admin.logout'] = function (req, env) {
    env.revokeToken(String(req.token || ''));
    return {};
  };

  function handle(req, env) {
    req = req && typeof req === 'object' ? req : {};
    var action = String(req.action || '');
    try {
      if (!ACTIONS[action]) fail('bad_action', 'Unknown request.');
      if (action.indexOf('admin.') === 0 && action !== 'admin.login') {
        if (req.token || req.key === undefined) {
          if (!env.checkToken(String(req.token || ''))) fail('signed_out', 'Please enter your passcode again.');
        } else {
          // Schedulers from before sign-in tokens send the passcode with every
          // request. Same check and lockout as signing in.
          env.checkAdmin(String(req.key || ''));
        }
      }
      var data = ACTIONS[action](req, env) || {};
      data.ok = true;
      return data;
    } catch (e) {
      if (e && e.isUserError) return { ok: false, code: e.code, error: e.message };
      if (env.log) env.log(e && e.stack ? e.stack : String(e));
      return { ok: false, code: 'server', error: 'Something went wrong on our end. Please try again in a moment.' };
    }
  }

  return {
    version: VERSION,
    minPasscode: MIN_PASSCODE,
    handle: handle,
    fail: fail,
    describe: describe,
    defaults: function () { return normalizeConfig({}); },
    normalizeConfig: normalizeConfig,
    openDays: openDays,
    isWorkingDay: isWorkingDay,
    bookedCounts: bookedCounts,
    firstBookable: firstBookable,
    blankLink: blankLink,
    idFromBytes: idFromBytes,
    date: {
      isDate: isDate, addDays: addDays, weekday: weekday, diffDays: diffDays,
      pretty: prettyDate, toMs: toMs, fromMs: fromMs, pad: pad,
      WEEKDAYS: WEEKDAYS, MONTHS: MONTHS
    }
  };
})();


// ---- Apps Script web app -----------------------------------------------------

function doPost(e) {
  var req = {};
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { req = {}; }
  return respond_(req);
}

// GET works too (?q=<json>); handy for checking the deployment in a browser.
function doGet(e) {
  var q = e && e.parameter && e.parameter.q;
  if (!q) {
    return json_({ ok: true, service: 'Splash Booking', version: BookingCore.version,
      ready: !!storedPasscode_(), time: new Date().toISOString() });
  }
  var req = {};
  try { req = JSON.parse(q); } catch (err) { req = {}; }
  return respond_(req);
}

function respond_(req) {
  var res;
  try {
    res = BookingCore.handle(req, gasEnv_());
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    res = { ok: false, code: 'server', error: 'The booking server is having trouble. Please try again in a moment.' };
  }
  return json_(res);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Optional: run from the editor to check email (and push, if set up) without the app. */
function sendTestAlert() {
  var cfg = BookingCore.normalizeConfig(JSON.parse(props_().getProperty('CONFIG') || '{}'));
  Logger.log(JSON.stringify(gasNotify_({ type: 'test', cfg: cfg, link: {} })));
}

var LINK_COLS_ = ['id', 'customer', 'service', 'start', 'end', 'created', 'archived', 'views', 'lastViewed',
  'status', 'date', 'name', 'phone', 'address', 'bookedAt', 'updatedAt', 'eventId', 'history'];
var ACTIVITY_COLS_ = ['at', 'linkId', 'type', 'date', 'from', 'name', 'by'];

function props_() { return PropertiesService.getScriptProperties(); }

// The passcode setup() saved. If setup was never run, the one typed into this
// file works too and is saved for next time.
function storedPasscode_() {
  var props = props_();
  var p = props.getProperty('ADMIN_PASSCODE');
  if (p && p.length >= 6) return p;
  if (ADMIN_PASSCODE !== 'CHANGE-ME' && String(ADMIN_PASSCODE).length >= BookingCore.minPasscode) {
    props.setProperty('ADMIN_PASSCODE', String(ADMIN_PASSCODE));
    return String(ADMIN_PASSCODE);
  }
  return '';
}

function withLock_(fn, optional) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(optional ? 1500 : 20000)) {
    if (optional) return null;
    BookingCore.fail('busy', "We're finishing another request \u2014 please try again in a moment.");
  }
  try {
    var out = fn();
    SpreadsheetApp.flush(); // land every sheet write before the next request can read
    return out;
  } finally {
    lock.releaseLock();
  }
}

// Signed-in devices hold a random token; only its SHA-256 is stored.
function tokenHash_(token) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function readTokens_() {
  try { return JSON.parse(props_().getProperty('TOKENS') || '[]'); } catch (e) { return []; }
}
function writeTokens_(list) { props_().setProperty('TOKENS', JSON.stringify(list.slice(-25))); }
function newToken_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); }

function gasEnv_() {
  return {
    store: sheetStore_(),
    today: function () { return Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd'); },
    now: function () { return new Date().toISOString(); },
    newId: newId_,
    lock: function (fn, opts) { return withLock_(fn, !!(opts && opts.optional)); },
    // Ten wrong passcodes pause every sign-in for 15 minutes, the right passcode
    // included, so nobody can keep guessing at full speed. Devices already
    // signed in keep working. Running setup() in the editor lifts the pause.
    checkAdmin: function (key) {
      var stored = storedPasscode_();
      if (!stored) {
        BookingCore.fail('not_setup', 'Setup isn\u2019t finished. In Apps Script, set ADMIN_PASSCODE at the top of the code ' +
          '(10+ characters), save, then pick \u201csetup\u201d next to Run and press Run.');
      }
      var cache = CacheService.getScriptCache();
      var locked = 'Too many wrong passcodes. Wait 15 minutes and try again.';
      if (+(cache.get('authFails') || 0) >= 10) BookingCore.fail('locked', locked);
      // Counted under the script lock so a burst of parallel guesses can't slip past the limit.
      var result = withLock_(function () {
        var fails = +(cache.get('authFails') || 0);
        if (fails >= 10) return 'locked';
        if (key === stored) {
          if (fails) cache.remove('authFails');
          return 'ok';
        }
        cache.put('authFails', String(fails + 1), 900);
        return 'wrong';
      });
      if (result === 'locked') BookingCore.fail('locked', locked);
      if (result !== 'ok') BookingCore.fail('bad_key', 'That passcode is not right.');
    },
    checkToken: function (token) {
      if (!/^[0-9a-f]{64}$/.test(token)) return false;
      var h = tokenHash_(token);
      return readTokens_().some(function (t) { return t.h === h; });
    },
    issueToken: function () {
      var token = newToken_();
      withLock_(function () {
        writeTokens_(readTokens_().concat([{ h: tokenHash_(token), at: new Date().toISOString() }]));
      });
      return token;
    },
    revokeToken: function (token) {
      if (!token) return;
      var h = tokenHash_(token);
      withLock_(function () { writeTokens_(readTokens_().filter(function (t) { return t.h !== h; })); });
    },
    setPasscode: function (next) {
      var token = newToken_();
      withLock_(function () {
        props_().setProperty('ADMIN_PASSCODE', next);
        writeTokens_([{ h: tokenHash_(token), at: new Date().toISOString() }]);
      });
      return token;
    },
    notify: gasNotify_,
    account: function () { return Session.getEffectiveUser().getEmail(); },
    log: function (m) { console.error(m && m.stack ? m.stack : m); }
  };
}

function newId_() {
  var hex = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  var bytes = [];
  for (var i = 0; i < hex.length && bytes.length < 10; i += 2) {
    if (i === 12 || i === 16 || i === 44 || i === 48) continue; // UUID version/variant bytes aren't random
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return BookingCore.idFromBytes(bytes);
}

// ---- Google Sheet storage ----

function spreadsheet_() {
  var props = props_();
  var id = props.getProperty('SHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* fall through and re-link */ }
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.create('Splash Bookings');
  props.setProperty('SHEET_ID', ss.getId());
  return ss;
}

function ensureSheet_(ss, name, cols) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

// Everything typed by a customer is written as text (leading apostrophe) so a
// name like "=HYPERLINK(...)" or a phone like "+1 757..." can't become a formula.
function toCell_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 'yes' : '';
  v = String(v);
  return v === '' ? '' : "'" + v;
}

function fromCell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TIME_ZONE, 'yyyy-MM-dd'); // someone typed a date into the sheet
  return v === null || v === undefined ? '' : String(v);
}

function sheetStore_() {
  var ss = spreadsheet_();
  var links = ensureSheet_(ss, 'Links', LINK_COLS_);
  var activity = ensureSheet_(ss, 'Activity', ACTIVITY_COLS_);
  var rowById = null;

  function readLinks() {
    rowById = {};
    var last = links.getLastRow();
    if (last < 2) return [];
    var values = links.getRange(2, 1, last - 1, LINK_COLS_.length).getValues();
    var out = [];
    values.forEach(function (row, i) {
      var l = BookingCore.blankLink();
      LINK_COLS_.forEach(function (k, c) { l[k] = fromCell_(row[c]); });
      if (!l.id) return;
      l.archived = l.archived === 'yes' || l.archived === 'true' || l.archived === 'TRUE';
      l.views = +l.views || 0;
      l.status = l.status || 'open';
      try { l.history = JSON.parse(l.history || '[]'); } catch (e) { l.history = []; }
      rowById[l.id] = i + 2;
      out.push(l);
    });
    return out;
  }

  function rowFor(id) {
    if (!rowById) readLinks();
    return rowById[id] || 0;
  }

  return {
    getConfig: function () {
      var raw = props_().getProperty('CONFIG');
      return raw ? JSON.parse(raw) : null;
    },
    setConfig: function (cfg) { props_().setProperty('CONFIG', JSON.stringify(cfg)); },
    listLinks: readLinks,
    putLink: function (link) {
      var row = rowFor(link.id);
      var values = [LINK_COLS_.map(function (k) {
        return toCell_(k === 'history' ? JSON.stringify(link.history || []) : link[k]);
      })];
      if (!row) {
        row = Math.max(links.getLastRow(), 1) + 1;
        rowById[link.id] = row;
      }
      links.getRange(row, 1, 1, LINK_COLS_.length).setValues(values);
    },
    patchLink: function (id, patch) {
      var row = rowFor(id);
      if (!row) return;
      Object.keys(patch).forEach(function (k) {
        var c = LINK_COLS_.indexOf(k);
        if (c >= 0) links.getRange(row, c + 1).setValue(toCell_(patch[k]));
      });
    },
    addActivity: function (a) {
      var row = Math.max(activity.getLastRow(), 1) + 1;
      activity.getRange(row, 1, 1, ACTIVITY_COLS_.length)
        .setValues([ACTIVITY_COLS_.map(function (k) { return toCell_(a[k]); })]);
    },
    listActivity: function (limit) {
      var last = activity.getLastRow();
      var n = Math.min(limit, last - 1);
      if (n <= 0) return [];
      return activity.getRange(last - n + 1, 1, n, ACTIVITY_COLS_.length).getValues().map(function (row) {
        var a = {};
        ACTIVITY_COLS_.forEach(function (k, c) { a[k] = fromCell_(row[c]); });
        return a;
      }).reverse();
    }
  };
}

// ---- Notifications: email, phone push (ntfy), Google Calendar ----

function gasNotify_(evt) {
  var out = {};
  var errors = [];
  if (!evt.quiet) {
    try { sendEmail_(evt); out.email = 'sent'; } catch (e) { errors.push('email: ' + e.message); out.email = 'failed'; }
    if (evt.cfg.ntfyTopic) {
      try { sendPush_(evt); out.push = 'sent'; } catch (e) { errors.push('push: ' + e.message); out.push = 'failed'; }
    }
  }
  if (evt.type !== 'test') {
    try {
      var id = syncCalendar_(evt);
      if (id !== undefined) out.eventId = id;
    } catch (e) { errors.push('calendar: ' + e.message); }
  }
  if (errors.length) {
    console.error(errors.join(' | '));
    out.errors = errors;
  }
  return out;
}

function schedulerUrl_(cfg) { return cfg.siteUrl ? cfg.siteUrl + 'scheduler/' : ''; }

function esc_(s) {
  return String(s || '').replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function sendEmail_(evt) {
  var cfg = evt.cfg, l = evt.link || {};
  var msg = BookingCore.describe(evt);
  var to = cfg.notifyEmail || Session.getEffectiveUser().getEmail();
  var rows = [];
  if (l.date) rows.push(['Day', BookingCore.date.pretty(l.date, 'long'), '']);
  if (evt.type === 'changed' && evt.from) rows.push(['Was', BookingCore.date.pretty(evt.from, 'long'), '']);
  if (l.name) rows.push(['Name', l.name, '']);
  if (l.phone) rows.push(['Phone', l.phone, 'tel:' + l.phone.replace(/[^\d+]/g, '')]);
  if (l.address) rows.push(['Address', l.address, 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(l.address)]);
  if (l.service) rows.push(['Service', l.service, '']);
  if (l.customer && l.customer !== l.name) rows.push(['Link sent to', l.customer, '']);

  var accent = evt.type === 'cancelled' ? '#e5484d' : (evt.type === 'changed' ? '#f5a524' : '#22c3ee');
  var html =
    '<div style="background:#eef3f9;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">' +
    '<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dbe5f0">' +
    '<div style="background:#071a3a;padding:20px 24px;border-bottom:3px solid ' + accent + '">' +
    '<div style="color:#8fb3d9;font-size:12px;letter-spacing:1.5px;text-transform:uppercase">' + esc_(cfg.businessName) + '</div>' +
    '<div style="color:#ffffff;font-size:22px;font-weight:700;margin-top:4px">' + esc_(msg.title) + '</div></div>' +
    '<div style="padding:22px 24px;color:#0b1526;font-size:15px;line-height:1.5">' +
    '<p style="margin:0 0 16px">' + esc_(msg.line) + '</p>' +
    (rows.length ? '<table style="width:100%;border-collapse:collapse;font-size:15px">' + rows.map(function (r) {
      var val = r[2] ? '<a href="' + esc_(r[2]) + '" style="color:#0a58c2;text-decoration:none">' + esc_(r[1]) + '</a>' : esc_(r[1]);
      return '<tr><td style="padding:8px 0;color:#5b6b80;width:110px;vertical-align:top;border-top:1px solid #eef2f7">' +
        esc_(r[0]) + '</td><td style="padding:8px 0;font-weight:600;border-top:1px solid #eef2f7">' + val + '</td></tr>';
    }).join('') + '</table>' : '') +
    (schedulerUrl_(cfg) ? '<p style="margin:22px 0 0"><a href="' + esc_(schedulerUrl_(cfg)) +
      '" style="display:inline-block;background:#0a58c2;color:#ffffff;padding:11px 18px;border-radius:10px;font-weight:600;text-decoration:none">Open Scheduler</a></p>' : '') +
    '</div></div></div>';

  var text = msg.line + '\n\n' + rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n') +
    (schedulerUrl_(cfg) ? '\n\nOpen Scheduler: ' + schedulerUrl_(cfg) : '');

  MailApp.sendEmail({ to: to, subject: msg.subject, body: text, htmlBody: html, name: cfg.businessName + ' Bookings' });
}

function sendPush_(evt) {
  var cfg = evt.cfg, l = evt.link || {};
  var msg = BookingCore.describe(evt);
  var body = msg.line + (l.phone ? '\n' + l.phone : '') + (l.address ? '\n' + l.address : '');
  var headers = { Title: msg.title, Tags: msg.tag, Priority: 'high' }; // header values must stay ASCII
  if (schedulerUrl_(cfg)) headers.Click = schedulerUrl_(cfg);
  var res = UrlFetchApp.fetch('https://ntfy.sh/' + encodeURIComponent(cfg.ntfyTopic), {
    method: 'post',
    contentType: 'text/plain; charset=utf-8',
    payload: body,
    headers: headers,
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) throw new Error('ntfy returned ' + res.getResponseCode());
}

// Returns the event id to store ('' once deleted), or undefined for "no change".
function syncCalendar_(evt) {
  var cfg = evt.cfg, l = evt.link;
  var cal = CalendarApp.getDefaultCalendar();
  var existing = l.eventId ? cal.getEventById(l.eventId) : null;

  if (evt.type === 'cancelled') {
    if (existing) existing.deleteEvent();
    return l.eventId ? '' : undefined;
  }
  // With calendar sync off, no new events are made, but one that already exists
  // still follows its booking so the calendar never shows a stale day.
  if (!cfg.addToCalendar && !existing) return undefined;

  var day = Utilities.parseDate(l.date + ' 12:00', TIME_ZONE, 'yyyy-MM-dd HH:mm');
  var title = (cfg.businessName.split(' ')[0] || 'Job') + ': ' + l.name + (l.service ? ' — ' + l.service : '');
  var desc = [
    l.phone ? 'Phone: ' + l.phone : '',
    l.address ? 'Address: ' + l.address : '',
    l.service ? 'Service: ' + l.service : '',
    'Booked through your scheduling link.'
  ].filter(String).join('\n');

  if (existing) {
    existing.setAllDayDate(day);
    existing.setTitle(title);
    existing.setDescription(desc);
    existing.setLocation(l.address || '');
    return existing.getId();
  }
  return cal.createAllDayEvent(title, day, { description: desc, location: l.address || '' }).getId();
}

// ---- END OF FILE (Splash Booking backend) ----
