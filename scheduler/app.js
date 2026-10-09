// Splash Scheduler — owner app: bookings, availability, booking links, settings.
(function () {
  'use strict';

  var Core = window.BookingCore;
  var D = Core.date;
  var Api = window.SplashApi;
  var $ = function (id) { return document.getElementById(id); };

  var store = {
    get: function (k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
    set: function (k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  var KEY_AUTH = 'scheduler.auth';
  var KEY_SEEN = 'scheduler.seenAt';
  var KEY_TAB = 'scheduler.tab';
  store.set('scheduler.key', ''); // older builds kept the passcode itself on the device

  // The sign-in token only counts for the server it was issued by.
  function readAuth() {
    try {
      var a = JSON.parse(store.get(KEY_AUTH) || '{}');
      return a.url === Api.apiUrl && /^[0-9a-f]{64}$/.test(a.token || '') ? a.token : '';
    } catch (e) { return ''; }
  }
  function saveAuth(token) {
    store.set(KEY_AUTH, token ? JSON.stringify({ url: Api.apiUrl, token: token }) : '');
  }

  // The server answers 'bad_action' to requests it doesn't know: it's running older code.
  var OUTDATED = 'Your Google Apps Script is running older code. On a computer, open it, select all the code and ' +
    'paste in the new server code (scheduler/backend/Code.js), save, then Deploy \u2192 Manage deployments \u2192 ' +
    'Edit \u2192 Version: New version \u2192 Deploy.';
  function errText(err) { return err.code === 'bad_action' ? OUTDATED : err.message; }

  var S = {
    token: Api.mode === 'live' ? readAuth() : 'demo',
    cfg: null,
    base: null,       // config as last received from the server; saves send only what changed since
    mutSeq: 0,        // bumps after every successful change, so loads that started earlier are thrown away
    links: [],
    activity: [],
    today: localToday(),
    account: '',
    loaded: false,
    refreshing: null,
    aMonth: '',
    range: '',
    linkFilter: 'active',
    actLimit: 8,
    seenAt: store.get(KEY_SEEN),
    cfgDirty: false,
    settingsDirty: false,
    filled: null,     // Settings form values as last filled in from the config
    twoStep: false,   // two-step sign-in is on for this server
    saving: false,
    savePending: false,
    saveTimer: null
  };

  // ---------- Utilities ----------
  function localToday() {
    var d = new Date();
    return d.getFullYear() + '-' + D.pad(d.getMonth() + 1) + '-' + D.pad(d.getDate());
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function md(ds) { var p = ds.split('-'); return D.MONTHS[+p[1] - 1].slice(0, 3) + ' ' + +p[2]; }
  function shortDate(ds) { return D.pretty(ds, 'short'); }
  function monthAdd(ym, n) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + D.pad(m + 1);
  }
  function lastOfMonth(ym) { return D.fromMs(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)); }
  function relDay(ds) {
    var n = D.diffDays(S.today, ds);
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    if (n > 1 && n < 7) return 'In ' + n + ' days';
    return '';
  }
  function ago(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return '';
    var s = (Date.now() - t) / 1000;
    if (s < 60) return 'Just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    var d = new Date(t);
    if (d.toDateString() === new Date().toDateString()) return Math.floor(s / 3600) + 'h ago';
    var y = new Date();
    y.setDate(y.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return D.MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate();
  }
  function agoInline(iso) {
    var t = ago(iso);
    return t === 'Just now' || t === 'Yesterday' ? t.toLowerCase() : t;
  }
  function firstName(s) {
    var f = String(s || '').replace(/\(.*?\)/g, '').trim().split(/\s+/)[0] || '';
    return /^[A-Za-z][A-Za-z'.-]{0,20}$/.test(f) ? f : '';
  }
  function digits(p) { return String(p || '').replace(/[^\d+]/g, ''); }
  function smsHref(phone, body) { return 'sms:' + digits(phone) + '?body=' + encodeURIComponent(body); }
  function mapsHref(addr) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr); }
  function siteUrl() {
    var u = new URL('../', location.href).href;
    return /^https:/.test(u) ? u : '';
  }
  function linkUrl(id, preview) {
    var u = new URL('../book/', location.href);
    u.searchParams.set('l', id);
    // URL only saved on this phone (not in book/config.js yet): the link carries the server id.
    if (Api.mode === 'live' && !Api.configured && Api.scriptId()) u.searchParams.set('s', Api.scriptId());
    if (preview) u.searchParams.set('preview', '1');
    return u.href;
  }
  function icon(name) {
    var p = {
      phone: '<path d="M5 4h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 6.3 6.3l1.4-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z"/>',
      text: '<path d="M4 5h16v11H9l-5 4V5z"/>',
      map: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
      more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
      copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
      eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
      share: '<path d="M12 15V3M7.5 7.5L12 3l4.5 4.5M5 12v7.5h14V12"/>',
      check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      swap: '<path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"/>',
      x: '<path d="M6 6l12 12M18 6L6 18"/>',
      trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4h6v3"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (p[name] || '') + '</svg>';
  }

  var toastTimer;
  function toast(msg, actionLabel, onAction) {
    $('toastText').textContent = msg;
    var b = $('toastAction');
    b.hidden = !actionLabel;
    b.textContent = actionLabel || '';
    b.onclick = function () { $('toast').classList.remove('show'); if (onAction) onAction(); };
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $('toast').classList.remove('show'); }, actionLabel ? 5500 : 3200);
  }
  function busy(btn, on) { btn.classList.toggle('busy', on); btn.disabled = on; }
  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      return ok;
    }
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, fallback);
    }
    return Promise.resolve(fallback());
  }

  // ---------- Sheet ----------
  function openSheet(html, mount) {
    $('sheetBody').innerHTML = html;
    $('sheet').hidden = false;
    if (mount) mount($('sheetBody'));
  }
  // Emptied on close so nothing shown in a sheet (like a two-step setup key) stays in the page.
  function closeSheet() { $('sheet').hidden = true; $('sheetBody').innerHTML = ''; }
  $('sheet').addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closeSheet();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('sheet').hidden) closeSheet(); });

  function confirmSheet(opts) {
    openSheet(
      '<h3>' + esc(opts.title) + '</h3><p>' + esc(opts.text) + '</p>' +
      '<div class="sheet-actions two"><button class="btn btn-soft" data-close>' + esc(opts.cancel || 'Keep') + '</button>' +
      '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" id="sheetOk"><span class="btn-text">' + esc(opts.ok) + '</span><span class="spinner"></span></button></div>',
      function () {
        $('sheetOk').addEventListener('click', function () {
          var btn = $('sheetOk');
          busy(btn, true);
          Promise.resolve(opts.onOk()).then(function () { busy(btn, false); }, function (err) {
            busy(btn, false);
            toast(err && err.message ? err.message : 'Something went wrong.');
          });
        });
      }
    );
  }

  // ---------- Tabs ----------
  function goTab(name) {
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t.id === 'tab-' + name); });
    document.querySelectorAll('.tb').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === name); });
    store.set(KEY_TAB, name);
    window.scrollTo({ top: 0 });
    if (name === 'bookings') markSeenSoon();
  }
  document.querySelectorAll('.tb').forEach(function (b) {
    b.addEventListener('click', function () { goTab(b.getAttribute('data-tab')); });
  });
  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-goto]');
    if (g) goTab(g.getAttribute('data-goto'));
  });

  // ---------- Loading data ----------
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function applyLoad(data) {
    S.today = D.isDate(data.today) ? data.today : localToday();
    S.links = data.links || [];
    S.activity = data.activity || [];
    S.account = data.account || '';
    S.twoStep = !!data.twoStep;
    if (!S.cfg || !S.cfgDirty) {
      S.cfg = data.config;
      S.base = clone(data.config);
    }
    if (!S.aMonth) S.aMonth = S.today.slice(0, 7);
    if (!S.seenAt) {
      S.seenAt = latestActivity() || new Date().toISOString();
      store.set(KEY_SEEN, S.seenAt);
    }
    S.loaded = true;
    renderAll();
    if ($('tab-bookings').classList.contains('active')) markSeenSoon();
  }

  function refresh(opts) {
    opts = opts || {};
    if (S.refreshing) return S.refreshing;
    $('refreshBtn').classList.add('spin');
    var seq = S.mutSeq, token = S.token;
    S.refreshing = Api.call('admin.load', { token: token, site: siteUrl() }).then(function (data) {
      S.refreshing = null;
      // Something was saved while this was loading: its data may predate that, so load again.
      if (seq !== S.mutSeq) return refresh(opts);
      $('refreshBtn').classList.remove('spin');
      applyLoad(data);
      if (opts.toast) toast('Up to date');
    }).catch(function (err) {
      S.refreshing = null;
      $('refreshBtn').classList.remove('spin');
      if (err.code === 'signed_out') {
        // Only sign out if the token that failed is still the current one. A
        // passcode change here, or a sign-in in another tab, replaces it mid-load.
        var stored = readAuth();
        if (S.token !== token || (stored && stored !== token)) {
          if (S.token === token) S.token = stored;
          return refresh(opts);
        }
        S.token = '';
        saveAuth('');
        showLock(err.message);
        return;
      }
      if (err.code === 'not_setup' || err.code === 'bad_action') {
        showLock(errText(err));
        return;
      }
      if (!opts.quiet) toast(err.message, 'Retry', function () { refresh(); });
      if (!S.loaded) {
        $('upcoming').innerHTML = '<div class="empty">' + esc(err.message) + '</div>';
      }
    });
    return S.refreshing;
  }

  function latestActivity() {
    return S.activity.reduce(function (m, a) { return a.at > m ? a.at : m; }, '');
  }

  function renderAll() {
    $('topSub').textContent = S.cfg.businessName;
    renderBookings();
    renderActivity();
    renderAvailability();
    renderRangeChips();
    renderLinks();
    if (!S.settingsDirty) fillSettings();
    renderConnection();
    renderTwoStep();
  }

  // ---------- Bookings ----------
  function bookedUpcoming() {
    return S.links.filter(function (l) { return l.status === 'booked' && l.date >= S.today; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.bookedAt < b.bookedAt ? -1 : 1); });
  }

  function renderBookings() {
    var up = bookedUpcoming();
    var weekEnd = D.addDays(S.today, 6);
    $('statUpcoming').textContent = up.length;
    $('statWeek').textContent = up.filter(function (l) { return l.date <= weekEnd; }).length;
    $('statWaiting').textContent = S.links.filter(function (l) { return l.status !== 'booked' && l.end >= S.today; }).length;

    if (!up.length) {
      $('upcoming').innerHTML = '<div class="activity"><div class="empty">No upcoming jobs yet.<br>Send a customer your calendar and their pick lands here.' +
        '<br><button class="btn btn-primary" data-goto="send">' + icon('plus') + 'Send a booking link</button></div></div>';
    } else {
      $('upcoming').innerHTML = up.map(function (l) { return bookingCard(l, false); }).join('');
    }

    var past = S.links.filter(function (l) {
      return l.date && ((l.status === 'booked' && l.date < S.today) || l.status === 'cancelled');
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 40);
    $('pastWrap').hidden = !past.length;
    $('past').innerHTML = past.map(function (l) { return bookingCard(l, true); }).join('');
  }

  function bookingCard(l, muted) {
    var p = l.date.split('-');
    var rel = muted ? '' : relDay(l.date);
    var tags = '';
    var hist = l.history || [];
    var lastSet = hist.filter(function (h) { return h.type === 'booked' || h.type === 'changed'; }).pop();
    var lastMove = lastSet && lastSet.type === 'changed' ? lastSet : null;
    if (l.status === 'cancelled') {
      var last = hist[hist.length - 1] || {};
      tags += '<span class="tag tag-red">' + (last.by === 'owner' ? 'You cancelled' : 'Customer cancelled') + '</span>';
    } else if (lastMove && lastMove.from) {
      tags += '<span class="tag tag-amber">Moved from ' + esc(md(lastMove.from)) + '</span>';
    }
    if (l.service) tags += '<span class="tag tag-blue">' + esc(l.service) + '</span>';
    var actions = '';
    if (!muted) {
      if (l.phone) {
        actions += '<a class="act-btn" href="tel:' + esc(digits(l.phone)) + '">' + icon('phone') + 'Call</a>';
        actions += '<a class="act-btn" href="' + esc(smsHref(l.phone, confirmText(l))) + '">' + icon('text') + 'Text</a>';
      }
      if (l.address) actions += '<a class="act-btn" href="' + esc(mapsHref(l.address)) + '" target="_blank" rel="noopener">' + icon('map') + 'Map</a>';
      actions += '<button class="act-btn icon-only" data-booking="' + esc(l.id) + '" aria-label="More options">' + icon('more') + '</button>';
    }
    return '<div class="bk' + (rel === 'Today' || rel === 'Tomorrow' ? ' soon' : '') + (muted ? ' muted' : '') + '">' +
      '<div class="bk-date"><span class="m">' + D.MONTHS[+p[1] - 1].slice(0, 3).toUpperCase() + '</span><span class="d">' + +p[2] +
      '</span><span class="w">' + D.WEEKDAYS[D.weekday(l.date)].slice(0, 3).toUpperCase() + '</span></div>' +
      '<div class="bk-main">' +
      '<div class="bk-top"><div class="bk-name">' + esc(l.name || l.customer || 'Customer') + '</div>' +
      (rel ? '<div class="bk-when">' + rel + '</div>' : '') + '</div>' +
      (l.address ? '<div class="bk-line">' + esc(l.address) + '</div>' : '') +
      (l.phone ? '<div class="bk-line">' + esc(l.phone) + '</div>' : '') +
      (!l.phone && !l.address && !muted ? '<div class="bk-line dim">No phone or address given</div>' : '') +
      (tags ? '<div>' + tags + '</div>' : '') +
      '</div>' + (actions ? '<div class="bk-actions">' + actions + '</div>' : '') + '</div>';
  }

  function ownerIntro() {
    var biz = S.cfg.businessName;
    return S.cfg.ownerName ? "it's " + S.cfg.ownerName + ' with ' + biz : 'this is ' + biz;
  }
  function confirmText(l) {
    var f = firstName(l.name);
    return 'Hi' + (f ? ' ' + f : '') + ', ' + ownerIntro() + '. Confirming your service on ' + D.pretty(l.date, 'day') + '. ';
  }

  $('upcoming').addEventListener('click', onBookingMore);
  function onBookingMore(e) {
    var b = e.target.closest('[data-booking]');
    if (!b) return;
    var l = S.links.find(function (x) { return x.id === b.getAttribute('data-booking'); });
    if (!l) return;
    openSheet(
      '<h3>' + esc(l.name) + '</h3><p>' + esc(D.pretty(l.date, 'long')) + (l.service ? ' · ' + esc(l.service) : '') + '</p>' +
      '<div class="sheet-list">' +
      '<button class="btn btn-soft" id="bmCopy">' + icon('copy') + 'Copy their booking link</button>' +
      '<a class="btn btn-soft" href="' + esc(linkUrl(l.id, true)) + '" target="_blank" rel="noopener">' + icon('eye') + 'See what they see</a>' +
      '<button class="btn btn-soft btn-danger-text" id="bmCancel">' + icon('x') + 'Cancel this booking</button>' +
      '</div>',
      function () {
        $('bmCopy').onclick = function () {
          copyText(linkUrl(l.id)).then(function () { closeSheet(); toast('Link copied'); });
        };
        $('bmCancel').onclick = function () { cancelBooking(l); };
      }
    );
  }

  function cancelBooking(l) {
    confirmSheet({
      title: 'Cancel ' + (firstName(l.name) || 'this customer') + "'s booking?",
      text: D.pretty(l.date, 'day') + ' opens back up. They see the cancellation the next time they open their link, so let them know.' +
        (S.cfg.addToCalendar ? ' The calendar event is removed.' : ''),
      ok: 'Cancel booking', cancel: 'Keep it', danger: true,
      onOk: function () {
        return Api.call('admin.cancelBooking', { token: S.token, id: l.id }).then(function () {
          S.mutSeq++;
          var name = firstName(l.name);
          var day = D.pretty(l.date, 'day');
          return refresh({ quiet: true }).then(function () {
            if (l.phone) {
              var body = 'Hi' + (name ? ' ' + name : '') + ', ' + ownerIntro() + '. I have to cancel your service on ' + day +
                ', sorry about that. Pick a new day here: ' + linkUrl(l.id);
              openSheet(
                '<div class="success-burst">' + icon('check') + '</div><h3>Booking cancelled</h3>' +
                '<p>Let ' + esc(name || 'them') + ' know so they can pick a new day:</p>' +
                '<textarea class="msg-box" id="cxMsg">' + esc(body) + '</textarea>' +
                '<div class="sheet-actions two"><button class="btn btn-soft" data-close>Done</button>' +
                '<a class="btn btn-primary" id="cxText">' + icon('text') + 'Text ' + esc(name || 'them') + '</a></div>',
                function () {
                  var sync = function () { $('cxText').href = smsHref(l.phone, $('cxMsg').value); };
                  $('cxMsg').addEventListener('input', sync);
                  sync();
                }
              );
            } else {
              closeSheet();
              toast('Booking cancelled');
            }
          });
        });
      }
    });
  }

  // ---------- Activity ----------
  function activityText(a) {
    var who = '<strong>' + esc(a.name || 'A customer') + '</strong>';
    var day = '<strong>' + esc(a.date ? shortDate(a.date) : '') + '</strong>';
    if (a.type === 'booked') return who + ' booked ' + day;
    if (a.type === 'changed') return who + ' moved ' + (a.from ? 'from ' + esc(md(a.from)) + ' ' : '') + 'to ' + day;
    if (a.type === 'cancelled') return a.by === 'owner' ? 'You cancelled ' + who + ' on ' + day : who + ' cancelled ' + day;
    if (a.type === 'updated') return who + ' updated their details';
    return who + ' ' + esc(a.type);
  }
  function renderActivity() {
    var list = S.activity;
    var fresh = list.filter(function (a) { return a.by === 'customer' && a.at > S.seenAt; }).length;
    $('badge').hidden = !fresh;
    $('badge').textContent = fresh;
    $('newCount').hidden = !fresh;
    $('newCount').textContent = fresh + ' new';
    if (!list.length) {
      $('activity').innerHTML = '<div class="empty">Nothing yet. Every time a customer books, changes, or cancels, it shows up here' +
        (Api.mode === 'live' ? ' and you get an alert.' : '.') + '</div>';
      $('moreActivity').hidden = true;
      return;
    }
    var marks = { booked: 'check', changed: 'swap', cancelled: 'x', updated: 'text' };
    $('activity').innerHTML = list.slice(0, S.actLimit).map(function (a) {
      var isNew = a.by === 'customer' && a.at > S.seenAt;
      return '<div class="act act-' + esc(a.type) + (isNew ? ' new' : '') + '"><div class="act-dot">' + icon(marks[a.type] || 'text') + '</div>' +
        '<div class="act-text">' + activityText(a) + '<div class="act-time">' + esc(ago(a.at)) + '</div></div></div>';
    }).join('');
    $('moreActivity').hidden = list.length <= S.actLimit;
  }
  $('moreActivity').addEventListener('click', function () { S.actLimit += 20; renderActivity(); });

  var seenTimer;
  function markSeenSoon() {
    clearTimeout(seenTimer);
    seenTimer = setTimeout(function () {
      if (document.hidden || !$('tab-bookings').classList.contains('active')) return;
      var latest = latestActivity();
      if (latest && latest > S.seenAt) {
        S.seenAt = latest;
        store.set(KEY_SEEN, latest);
        $('badge').hidden = true;
        $('newCount').hidden = true;
      }
    }, 2500);
  }

  // ---------- Availability ----------
  function renderAvailability() {
    var cfg = S.cfg;
    var names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    $('weekdays').innerHTML = names.map(function (n, i) {
      var on = cfg.workDays.indexOf(i) >= 0;
      return '<button class="wd' + (on ? ' on' : '') + '" data-wd="' + i + '" aria-pressed="' + on + '" aria-label="' + D.WEEKDAYS[i] + '">' + n + '</button>';
    }).join('');
    $('capVal').textContent = cfg.capacity;
    var sel = $('minNotice');
    if (![].some.call(sel.options, function (o) { return +o.value === cfg.minNotice; })) {
      var o = document.createElement('option');
      o.value = cfg.minNotice;
      o.textContent = cfg.minNotice + ' days out';
      sel.appendChild(o);
    }
    sel.value = String(cfg.minNotice);
    renderMonth();
  }

  function renderMonth(flashDate) {
    var cfg = S.cfg, ym = S.aMonth;
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1;
    $('aMonth').innerHTML = D.MONTHS[m] + '<span>' + y + '</span>';
    var thisMonth = S.today.slice(0, 7);
    $('aPrev').disabled = ym <= thisMonth;
    $('aNext').disabled = ym >= monthAdd(thisMonth, 12);
    var counts = Core.bookedCounts(S.links);
    var blocked = {}, opened = {};
    cfg.blocked.forEach(function (d) { blocked[d] = true; });
    cfg.opened.forEach(function (d) { opened[d] = true; });
    var html = '';
    var lead = new Date(Date.UTC(y, m, 1)).getUTCDay();
    for (var i = 0; i < lead; i++) html += '<div class="ad void"></div>';
    var n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    for (var day = 1; day <= n; day++) {
      var ds = ym + '-' + D.pad(day);
      var work = cfg.workDays.indexOf(D.weekday(ds)) >= 0;
      var state = blocked[ds] ? 'blocked' : (opened[ds] || work) ? 'open' + (opened[ds] && !work ? ' extra' : '') : 'off';
      var cnt = counts[ds] || 0;
      var full = state.indexOf('open') === 0 && cnt >= cfg.capacity;
      var label = D.pretty(ds, 'day') + ', ' + (state === 'off' ? 'day off' : state.split(' ')[0]) +
        (cnt ? ', ' + cnt + ' booked' : '');
      // Past days are plain divs: nothing to change there.
      var tag = ds < S.today ? 'div' : 'button';
      html += '<' + tag + ' class="ad ' + state + (ds < S.today ? ' past' : '') + (ds === S.today ? ' today' : '') +
        (full ? ' full' : '') + (ds === flashDate ? ' flash' : '') + '" data-date="' + ds + '" aria-label="' + label + '">' +
        '<span class="n">' + day + '</span>' + (cnt ? '<span class="cnt">' + cnt + '</span>' : '') + '</' + tag + '>';
    }
    $('adays').innerHTML = html;
  }

  function cfgChanged() {
    S.cfgDirty = true;
    setSaveState('saving');
    clearTimeout(S.saveTimer);
    S.saveTimer = setTimeout(saveConfig, 700);
    renderRangePreview();
  }

  function setSaveState(state) {
    var el = $('saveState');
    el.className = 'save-state' + (state === 'ok' ? ' ok' : state === 'err' ? ' err' : '');
    el.textContent = state === 'saving' ? 'Saving…' : state === 'ok' ? '✓ Saved' : state === 'err' ? 'Not saved' : '';
  }

  function saveConfig() {
    clearTimeout(S.saveTimer);
    S.saveTimer = null;
    if (S.saving) {
      S.savePending = true;
      return S.savingPromise;
    }
    S.saving = true;
    setSaveState('saving');
    var sent = JSON.stringify(S.cfg);
    S.savingPromise = Api.call('admin.saveConfig', { token: S.token, config: S.cfg, base: S.base }).then(function (res) {
      S.saving = false;
      S.mutSeq++;
      if (S.savePending || JSON.stringify(S.cfg) !== sent) {
        S.savePending = false;
        // The server has merged everything up to `sent`, so only edits made since
        // then are new. Reusing the old base would make an edit that put a value
        // back (Undo, + then -) look like no change and the server would keep the first save.
        S.base = JSON.parse(sent);
        return saveConfig();
      }
      S.cfg = res.config;
      S.base = clone(res.config);
      S.cfgDirty = false;
      setSaveState('ok');
      // Show what the server kept, including changes made on another device.
      $('topSub').textContent = S.cfg.businessName;
      renderAvailability();
      renderRangePreview();
      if (!S.settingsDirty) fillSettings();
      return res;
    }, function (err) {
      S.saving = false;
      S.savePending = false;
      setSaveState('err');
      toast(err.message, 'Retry', saveConfig);
      throw err;
    });
    return S.savingPromise;
  }

  $('weekdays').addEventListener('click', function (e) {
    var b = e.target.closest('[data-wd]');
    if (!b) return;
    var i = +b.getAttribute('data-wd');
    var set = S.cfg.workDays.slice();
    var at = set.indexOf(i);
    if (at >= 0) set.splice(at, 1); else set.push(i);
    S.cfg.workDays = set.sort();
    b.classList.toggle('on', at < 0);
    b.setAttribute('aria-pressed', at < 0);
    renderMonth();
    cfgChanged();
  });
  $('capDown').addEventListener('click', function () { setCap(S.cfg.capacity - 1); });
  $('capUp').addEventListener('click', function () { setCap(S.cfg.capacity + 1); });
  function setCap(n) {
    n = Math.max(1, Math.min(20, n));
    if (n === S.cfg.capacity) return;
    S.cfg.capacity = n;
    $('capVal').textContent = n;
    renderMonth();
    cfgChanged();
  }
  $('minNotice').addEventListener('change', function () {
    S.cfg.minNotice = +this.value;
    cfgChanged();
  });
  $('aPrev').addEventListener('click', function () { S.aMonth = monthAdd(S.aMonth, -1); renderMonth(); });
  $('aNext').addEventListener('click', function () { S.aMonth = monthAdd(S.aMonth, 1); renderMonth(); });

  function snapshot() { return { blocked: S.cfg.blocked.slice(), opened: S.cfg.opened.slice() }; }
  // Undo takes back only what that one tap or range changed. Days another device
  // blocked or opened since then are left alone.
  function undoChange(before, after) {
    ['blocked', 'opened'].forEach(function (k) {
      var was = {}, now = {};
      before[k].forEach(function (d) { was[d] = true; });
      after[k].forEach(function (d) { now[d] = true; });
      var list = S.cfg[k].filter(function (d) { return !(now[d] && !was[d]); });
      before[k].forEach(function (d) { if (!now[d] && list.indexOf(d) < 0) list.push(d); });
      S.cfg[k] = list.sort();
    });
  }
  function without(arr, d) { return arr.filter(function (x) { return x !== d; }); }
  function closeDay(d) {
    S.cfg.opened = without(S.cfg.opened, d);
    if (S.cfg.workDays.indexOf(D.weekday(d)) >= 0 && S.cfg.blocked.indexOf(d) < 0) S.cfg.blocked = S.cfg.blocked.concat([d]).sort();
  }
  // Range blocks cover days off too, so turning a weekday on later can't open a vacation day.
  function blockDay(d) {
    S.cfg.opened = without(S.cfg.opened, d);
    if (S.cfg.blocked.indexOf(d) < 0) S.cfg.blocked = S.cfg.blocked.concat([d]).sort();
  }
  function openDay(d, extra) {
    S.cfg.blocked = without(S.cfg.blocked, d);
    if (extra && S.cfg.workDays.indexOf(D.weekday(d)) < 0 && S.cfg.opened.indexOf(d) < 0) S.cfg.opened = S.cfg.opened.concat([d]).sort();
  }

  $('adays').addEventListener('click', function (e) {
    var b = e.target.closest('button.ad[data-date]');
    if (!b) return;
    var d = b.getAttribute('data-date');
    var before = snapshot();
    var wasOpen = Core.isWorkingDay(S.cfg, d);
    var wasBlocked = S.cfg.blocked.indexOf(d) >= 0;
    // Unblocking a day only lifts the block: a range-blocked day off goes back to off.
    if (wasOpen) closeDay(d); else openDay(d, !wasBlocked);
    var after = snapshot();
    renderMonth(d);
    cfgChanged();
    var cnt = Core.bookedCounts(S.links)[d] || 0;
    var msg = (wasOpen ? 'Blocked ' : wasBlocked ? 'Unblocked ' : 'Opened ') + shortDate(d) +
      (wasOpen && cnt ? ' · ' + cnt + ' booking kept' : '');
    toast(msg, 'Undo', function () { undoChange(before, after); renderMonth(d); cfgChanged(); });
  });

  $('blockRangeBtn').addEventListener('click', function () {
    var from = S.today > S.aMonth + '-01' ? S.today : S.aMonth + '-01';
    openSheet(
      '<h3>Block a date range</h3><p>Vacation, equipment down, a rainy week — customers won’t see these days. Existing bookings stay put.</p>' +
      '<div class="custom-range"><label>From<input class="inp" type="date" id="brFrom" min="' + esc(S.today) + '" value="' + esc(from) + '"></label>' +
      '<label>To<input class="inp" type="date" id="brTo" min="' + esc(S.today) + '" value="' + esc(D.addDays(from, 6)) + '"></label></div>' +
      '<div class="sheet-actions two"><button class="btn btn-soft" id="brOpen">Unblock range</button>' +
      '<button class="btn btn-primary" id="brBlock">Block range</button></div>',
      function () {
        function apply(block) {
          var a = $('brFrom').value, b = $('brTo').value;
          if (!D.isDate(a) || !D.isDate(b)) { toast('Pick both dates.'); return; }
          if (b < a) { var t = a; a = b; b = t; }
          if (a < S.today) a = S.today;
          if (D.diffDays(a, b) > 366) { toast('Keep it under a year.'); return; }
          var before = snapshot();
          for (var d = a; d <= b; d = D.addDays(d, 1)) { if (block) blockDay(d); else openDay(d, false); }
          var after = snapshot();
          S.aMonth = a.slice(0, 7);
          renderMonth();
          cfgChanged();
          closeSheet();
          toast((block ? 'Blocked ' : 'Unblocked ') + md(a) + ' – ' + md(b), 'Undo', function () { undoChange(before, after); renderMonth(); cfgChanged(); });
        }
        $('brBlock').onclick = function () { apply(true); };
        $('brOpen').onclick = function () { apply(false); };
      }
    );
  });

  // ---------- Send a link ----------
  var SERVICES = ['House wash', 'Driveway', 'House + driveway', 'Roof soft wash', 'Gutters', 'Deck / fence'];
  $('serviceQuick').innerHTML = SERVICES.map(function (s) { return '<button type="button">' + esc(s) + '</button>'; }).join('');
  $('serviceQuick').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b) { $('lnService').value = b.textContent; }
  });

  function rangeOptions() {
    var t = S.today, ym = t.slice(0, 7), opts = [];
    for (var i = 0; i < 4; i++) {
      var m = monthAdd(ym, i);
      opts.push({
        key: 'm' + m,
        label: D.MONTHS[+m.slice(5, 7) - 1] + (m.slice(0, 4) !== t.slice(0, 4) ? ' ’' + m.slice(2, 4) : ''),
        start: m + '-01', end: lastOfMonth(m)
      });
    }
    opts.push({ key: '2w', label: 'Next 2 weeks', start: t, end: D.addDays(t, 13) });
    opts.push({ key: '30d', label: 'Next 30 days', start: t, end: D.addDays(t, 29) });
    opts.push({ key: 'custom', label: 'Custom' });
    return opts;
  }

  function currentRange() {
    var o = rangeOptions().find(function (x) { return x.key === S.range; });
    if (!o) return null;
    if (o.key === 'custom') {
      var a = $('customStart').value, b = $('customEnd').value;
      if (!D.isDate(a) || !D.isDate(b)) return null;
      return b < a ? { start: b, end: a } : { start: a, end: b };
    }
    return o;
  }

  function renderRangeChips() {
    var opts = rangeOptions();
    if (!opts.some(function (o) { return o.key === S.range; })) {
      // Default: this month, unless it's nearly over.
      var thisMonth = opts[0];
      var left = Core.openDays(S.cfg, S.links, thisMonth.start, thisMonth.end, S.today).length;
      S.range = left >= 3 ? thisMonth.key : opts[1].key;
    }
    $('rangeChips').innerHTML = opts.map(function (o) {
      return '<button type="button" class="chip' + (o.key === S.range ? ' on' : '') + '" data-range="' + o.key + '">' + esc(o.label) + '</button>';
    }).join('');
    $('customRange').hidden = S.range !== 'custom';
    if (!$('customStart').value) {
      $('customStart').value = S.today;
      $('customEnd').value = D.addDays(S.today, 20);
    }
    $('customStart').min = S.today;
    $('customEnd').min = S.today;
    renderRangePreview();
  }

  function renderRangePreview() {
    var el = $('rangePreview');
    if (!S.cfg) return;
    var r = currentRange();
    if (!r) { el.className = 'range-preview warn'; el.textContent = 'Pick a start and end date.'; return; }
    var from = Core.firstBookable(S.cfg, S.today);
    if (from < r.start) from = r.start;
    var open = Core.openDays(S.cfg, S.links, r.start, r.end, S.today);
    var label = '<strong>' + esc(md(r.start)) + ' – ' + esc(md(r.end)) + '</strong>';
    if (r.end < S.today) {
      el.className = 'range-preview warn';
      el.innerHTML = label + ' is in the past.';
      return;
    }
    if (!open.length) {
      el.className = 'range-preview warn';
      el.innerHTML = label + ' has no open days. Open some on the Availability tab first.';
      return;
    }
    var set = {};
    open.forEach(function (d) { set[d] = true; });
    var dots = '';
    for (var d = from, k = 0; d <= r.end && k < 42; d = D.addDays(d, 1), k++) dots += '<i' + (set[d] ? ' class="o"' : '') + '></i>';
    el.className = 'range-preview';
    el.innerHTML = '<span>' + label + ' · ' + open.length + ' open day' + (open.length === 1 ? '' : 's') + '</span><span class="rp-dots">' + dots + '</span>';
  }

  $('rangeChips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-range]');
    if (!b) return;
    S.range = b.getAttribute('data-range');
    document.querySelectorAll('#rangeChips .chip').forEach(function (c) { c.classList.toggle('on', c === b); });
    $('customRange').hidden = S.range !== 'custom';
    renderRangePreview();
  });
  $('customStart').addEventListener('change', renderRangePreview);
  $('customEnd').addEventListener('change', renderRangePreview);

  $('createLinkBtn').addEventListener('click', function () {
    var r = currentRange();
    if (!r) { toast('Pick the days they can see.'); return; }
    var btn = $('createLinkBtn');
    busy(btn, true);
    Api.call('admin.createLink', {
      token: S.token, customer: $('lnCustomer').value.trim(), service: $('lnService').value.trim(), start: r.start, end: r.end
    }).then(function (res) {
      busy(btn, false);
      S.mutSeq++;
      S.links.unshift(res.link);
      $('lnCustomer').value = '';
      $('lnService').value = '';
      renderLinks();
      renderBookings();
      shareSheet(res.link, true);
    }).catch(function (err) {
      busy(btn, false);
      toast(err.message);
    });
  });

  function linkMessage(l) {
    var f = firstName(l.customer);
    var what = l.service ? 'your ' + l.service.toLowerCase() : 'your service';
    return 'Hi' + (f ? ' ' + f : '') + ', ' + ownerIntro() + '. Here’s my calendar — tap the link and pick the day that works best for ' +
      what + ':\n' + linkUrl(l.id);
  }

  function shareSheet(l, fresh) {
    var url = linkUrl(l.id);
    var who = firstName(l.customer) || l.customer;
    openSheet(
      (fresh ? '<div class="success-burst">' + icon('check') + '</div>' : '') +
      '<h3>' + (fresh ? 'Link ready' : 'Share link') + (who ? ' for ' + esc(who) : '') + '</h3>' +
      '<p>They’ll see ' + esc(md(l.start)) + ' – ' + esc(md(l.end)) + ' and can pick any open day. No login needed.</p>' +
      '<div class="link-box">' + esc(url) + '</div>' +
      '<textarea class="msg-box" id="shMsg" aria-label="Message">' + esc(linkMessage(l)) + '</textarea>' +
      '<div class="sheet-actions two">' +
      '<a class="btn btn-primary" id="shText">' + icon('text') + 'Text it</a>' +
      '<button class="btn btn-soft" id="shShare">' + icon('share') + 'Share…</button>' +
      '<button class="btn btn-soft" id="shCopyLink">' + icon('copy') + 'Copy link</button>' +
      '<button class="btn btn-soft" id="shCopyMsg">' + icon('copy') + 'Copy message</button>' +
      '</div>' +
      '<div class="sheet-actions"><a class="btn btn-soft" href="' + esc(linkUrl(l.id, true)) + '" target="_blank" rel="noopener">' + icon('eye') + 'Preview what they see</a></div>',
      function () {
        var sync = function () { $('shText').href = 'sms:?body=' + encodeURIComponent($('shMsg').value); };
        $('shMsg').addEventListener('input', sync);
        sync();
        if (!navigator.share) $('shShare').hidden = true;
        $('shShare').onclick = function () {
          navigator.share({ text: $('shMsg').value }).catch(function () { /* dismissed */ });
        };
        $('shCopyLink').onclick = function () { copyText(url).then(function () { toast('Link copied'); }); };
        $('shCopyMsg').onclick = function () { copyText($('shMsg').value).then(function () { toast('Message copied'); }); };
      }
    );
  }

  function linkStatus(l) {
    if (l.status === 'booked' && l.date >= S.today) return '<span class="tag tag-green">Booked · ' + esc(shortDate(l.date)) + '</span>';
    if (l.status === 'booked') return '<span class="tag tag-grey">Done · ' + esc(md(l.date)) + '</span>';
    if (l.end < Core.firstBookable(S.cfg, S.today)) return '<span class="tag tag-grey">Expired</span>';
    if (l.status === 'cancelled') return '<span class="tag tag-red">Cancelled</span>';
    if (l.views > 0) return '<span class="tag tag-blue">Opened</span>';
    return '<span class="tag tag-grey">Not opened yet</span>';
  }

  function renderLinks() {
    var list = S.links.filter(function (l) {
      if (S.linkFilter === 'all') return true;
      return l.end >= S.today || (l.status === 'booked' && l.date >= S.today);
    });
    if (!list.length) {
      $('linkList').innerHTML = '<div class="activity"><div class="empty">' +
        (S.linkFilter === 'all' ? 'No links yet.' : 'No active links. Create one above and text it to a customer.') + '</div></div>';
      return;
    }
    $('linkList').innerHTML = list.map(function (l) {
      var meta = ['Created ' + agoInline(l.created)];
      if (l.views) meta.push('opened ' + l.views + '×' + (l.lastViewed ? ', last ' + agoInline(l.lastViewed) : ''));
      return '<div class="ln"><div class="ln-top"><div>' +
        '<div class="ln-name">' + esc(l.customer || l.name || 'Booking link') + '</div>' +
        '<div class="ln-sub">' + (l.service ? esc(l.service) + ' · ' : '') + esc(md(l.start)) + ' – ' + esc(md(l.end)) + '</div>' +
        '</div>' + linkStatus(l) + '</div>' +
        '<div class="ln-sub">' + esc(meta.join(' · ')) + '</div>' +
        '<div class="bk-actions">' +
        '<button class="act-btn" data-lnshare="' + esc(l.id) + '">' + icon('share') + 'Send</button>' +
        '<button class="act-btn" data-lncopy="' + esc(l.id) + '">' + icon('copy') + 'Copy</button>' +
        '<a class="act-btn" href="' + esc(linkUrl(l.id, true)) + '" target="_blank" rel="noopener">' + icon('eye') + 'Preview</a>' +
        '<button class="act-btn icon-only" data-lndel="' + esc(l.id) + '" aria-label="Delete link">' + icon('trash') + '</button>' +
        '</div></div>';
    }).join('');
  }

  $('linkFilter').addEventListener('click', function (e) {
    var b = e.target.closest('[data-f]');
    if (!b) return;
    S.linkFilter = b.getAttribute('data-f');
    document.querySelectorAll('#linkFilter button').forEach(function (x) { x.classList.toggle('on', x === b); });
    renderLinks();
  });

  $('linkList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-lnshare],[data-lncopy],[data-lndel]');
    if (!b) return;
    var id = b.getAttribute('data-lnshare') || b.getAttribute('data-lncopy') || b.getAttribute('data-lndel');
    var l = S.links.find(function (x) { return x.id === id; });
    if (!l) return;
    if (b.hasAttribute('data-lnshare')) shareSheet(l, false);
    else if (b.hasAttribute('data-lncopy')) copyText(linkUrl(l.id)).then(function () { toast('Link copied'); });
    else deleteLink(l);
  });

  function deleteLink(l) {
    var booked = l.status === 'booked' && l.date >= S.today;
    confirmSheet({
      title: 'Delete this link?',
      text: (l.customer ? l.customer + ' won’t' : 'The customer won’t') + ' be able to use it anymore.' +
        (booked ? ' This also cancels their ' + D.pretty(l.date, 'day') + ' booking.' : ''),
      ok: 'Delete link', cancel: 'Keep', danger: true,
      onOk: function () {
        return Api.call('admin.archiveLink', { token: S.token, id: l.id }).then(function () {
          S.mutSeq++;
          S.links = S.links.filter(function (x) { return x.id !== l.id; });
          closeSheet();
          renderLinks();
          renderBookings();
          renderMonth();
          toast('Link deleted');
        });
      }
    });
  }

  // ---------- Settings ----------
  var SETTINGS_FIELDS = { businessName: 'sBiz', tagline: 'sTag', phone: 'sPhone', ownerName: 'sOwner',
    notifyEmail: 'sEmail', ntfyTopic: 'sNtfy', addToCalendar: 'sCal' };
  function readForm() {
    var out = {};
    Object.keys(SETTINGS_FIELDS).forEach(function (k) {
      var el = $(SETTINGS_FIELDS[k]);
      out[k] = el.type === 'checkbox' ? el.checked : el.value.trim();
    });
    return out;
  }
  function fillSettings() {
    var c = S.cfg;
    $('sBiz').value = c.businessName;
    $('sTag').value = c.tagline;
    $('sPhone').value = c.phone;
    $('sOwner').value = c.ownerName;
    $('sEmail').value = c.notifyEmail;
    $('sEmail').placeholder = S.account ? S.account + ' (default)' : 'Your Google account email';
    $('sNtfy').value = c.ntfyTopic;
    $('sCal').checked = c.addToCalendar;
    S.filled = readForm();
  }
  ['sBiz', 'sTag', 'sPhone', 'sOwner', 'sEmail', 'sNtfy', 'sCal'].forEach(function (id) {
    $(id).addEventListener('input', function () { S.settingsDirty = true; });
    $(id).addEventListener('change', function () { S.settingsDirty = true; });
  });
  $('genTopic').addEventListener('click', function () {
    var bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    var abc = 'abcdefghijkmnpqrstuvwxyz23456789';
    $('sNtfy').value = 'splash-' + Array.prototype.map.call(bytes, function (b) { return abc[b % abc.length]; }).join('');
    S.settingsDirty = true;
  });

  // Only fields changed on the form are saved. A field left alone keeps whatever
  // the server has, even if another device changed it after this form was filled.
  function collectSettings() {
    var now = readForm(), was = S.filled || {};
    Object.keys(now).forEach(function (k) {
      if (now[k] === was[k] || (k === 'businessName' && !now[k])) return;
      S.cfg[k] = now[k];
    });
  }

  function saveSettings() {
    var email = $('sEmail').value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Promise.reject(new Error('That email address doesn’t look right.'));
    var topic = $('sNtfy').value.trim();
    if (topic && !/^[A-Za-z0-9_-]{1,64}$/.test(topic)) return Promise.reject(new Error('Push topic: letters, numbers, - and _ only.'));
    collectSettings();
    S.cfgDirty = true;
    return saveConfig().then(function (res) {
      S.settingsDirty = false;
      fillSettings();
      return res;
    });
  }

  $('saveSettingsBtn').addEventListener('click', function () {
    var btn = $('saveSettingsBtn');
    busy(btn, true);
    saveSettings().then(function () {
      busy(btn, false);
      toast('Settings saved');
      renderLinks();
    }, function (err) {
      busy(btn, false);
      toast(err.message);
    });
  });

  $('testAlertBtn').addEventListener('click', function () {
    if (Api.mode !== 'live') {
      toast('Alerts go out once you’re live. Finish the setup steps below.');
      return;
    }
    var btn = $('testAlertBtn');
    busy(btn, true);
    var first = S.settingsDirty ? saveSettings() : Promise.resolve();
    first.then(function () {
      return Api.call('admin.testNotify', { token: S.token });
    }).then(function (res) {
      busy(btn, false);
      var r = res.results || {};
      var parts = [];
      if (r.email) parts.push('email ' + (r.email === 'sent' ? 'sent' : 'failed'));
      if (r.push) parts.push('push ' + (r.push === 'sent' ? 'sent' : 'failed'));
      toast(parts.length ? 'Test alert: ' + parts.join(', ') + '.' : 'Nothing to send. Add an email or push topic.');
    }).catch(function (err) {
      busy(btn, false);
      toast(err.message);
    });
  });

  // ---------- Connection ----------
  function renderConnection() {
    var live = Api.mode === 'live';
    $('conn').classList.toggle('live', live);
    $('connText').textContent = live ? 'Live' : 'Demo';
    $('demoBanner').hidden = live;
    $('demoPanel').hidden = live;
    $('liveOnly').hidden = !live;
    var line = $('connLine');
    line.className = 'conn-line' + (live ? ' live' : '');
    if (!live) {
      line.innerHTML = '<span class="dot"></span><span>Demo mode. Data lives only on this device, and nothing is emailed.</span>';
    } else if (Api.configured) {
      line.innerHTML = '<span class="dot"></span><span>Live, connected to your Google Apps Script' + (S.account ? ' (' + esc(S.account) + ')' : '') + '.</span>';
    } else {
      line.innerHTML = '<span class="dot"></span><span>Live, using the URL saved on this device. Customer links stay long until the URL is added to <code>book/config.js</code>.</span>';
    }
    $('urlBox').hidden = Api.configured;
    $('disconnectBtn').hidden = !(live && !Api.configured);
    $('setupPanel').hidden = live && Api.configured;
  }

  $('connectBtn').addEventListener('click', function () {
    var u = $('sUrl').value.trim();
    if (!Api.isScriptUrl(u)) {
      toast('Paste the Web app URL. It starts with https://script.google.com/ and ends with /exec');
      return;
    }
    saveAuth('');
    Api.setLocalUrl(u);
    location.reload();
  });
  $('disconnectBtn').addEventListener('click', function () {
    saveAuth('');
    Api.setLocalUrl('');
    location.reload();
  });
  $('signOutBtn').addEventListener('click', function () {
    var token = S.token;
    S.token = '';
    saveAuth('');
    Api.call('admin.logout', { token: token }).catch(function () { /* already signed out */ });
    showLock();
  });
  $('passBtn').addEventListener('click', function () { openPassSheet(); });
  function openPassSheet() {
    openSheet(
      '<h3>Change passcode</h3><p>Used to unlock the Scheduler on your devices. Use ' + Core.minPasscode +
      ' or more characters that aren\u2019t a word, name, date, or phone number.</p>' +
      '<label class="lbl" for="pw1">New passcode</label><input class="inp" id="pw1" type="password" autocomplete="new-password">' +
      '<label class="lbl" for="pw2">Type it again</label><input class="inp" id="pw2" type="password" autocomplete="new-password">' +
      '<div class="sheet-actions two"><button class="btn btn-soft" data-close>Cancel</button>' +
      '<button class="btn btn-primary" id="pwSave"><span class="btn-text">Save</span><span class="spinner"></span></button></div>',
      function () {
        $('pwSave').onclick = function () {
          var a = $('pw1').value, b = $('pw2').value;
          if (a.length < Core.minPasscode) { toast('Use at least ' + Core.minPasscode + ' characters.'); return; }
          if (a !== b) { toast('Those don’t match.'); return; }
          busy($('pwSave'), true);
          Api.call('admin.setPasscode', { token: S.token, newKey: a }).then(function (res) {
            S.token = res.token;
            saveAuth(res.token);
            closeSheet();
            toast('Passcode changed. Other devices will need it to sign in again.');
          }, function (err) {
            busy($('pwSave'), false);
            toast(errText(err));
          });
        };
      }
    );
  }
  $('copyCodeBtn').addEventListener('click', function () {
    fetch('backend/Code.js', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error();
      return r.text();
    }).then(copyText).then(function (ok) {
      toast(ok ? 'Server code copied. Paste it into Apps Script.' : 'Couldn’t copy. Use View code instead.');
    }).catch(function () { toast('Couldn’t load the code. Use View code instead.'); });
  });
  $('resetDemoBtn').addEventListener('click', function () {
    confirmSheet({
      title: 'Reset demo data?', text: 'Removes the sample links and bookings on this device.',
      ok: 'Reset', cancel: 'Cancel', danger: true,
      onOk: function () {
        Api.resetDemo();
        store.set(KEY_SEEN, '');
        location.reload();
      }
    });
  });

  // ---------- Two-step sign-in ----------
  function renderTwoStep() {
    var on = S.twoStep;
    document.querySelector('.twostep').classList.toggle('on', on);
    $('twoStepState').textContent = on
      ? 'On. Signing in on a new device needs your passcode and a code from your authenticator app.'
      : 'Off. Signing in only needs your passcode.';
    $('twoStepBtn').textContent = on ? 'Turn off' : 'Turn on';
  }

  // The QR code library is only loaded when it's needed.
  var qrLoad = null;
  function loadQr() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (!qrLoad) {
      qrLoad = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'vendor/qrcode.js';
        s.onload = function () { if (window.qrcode) resolve(window.qrcode); else reject(new Error('QR')); };
        s.onerror = function () { qrLoad = null; reject(new Error('QR')); };
        document.head.appendChild(s);
      });
    }
    return qrLoad;
  }
  function codeField(id) {
    return '<input class="inp code-entry" id="' + id + '" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" ' +
      'autocomplete="one-time-code" placeholder="000000" aria-label="6-digit code">';
  }
  function readCode(id) { return $(id).value.replace(/\s+/g, ''); }

  $('twoStepBtn').addEventListener('click', function () {
    if (S.twoStep) openTwoStepOff(); else startTwoStep();
  });

  function startTwoStep() {
    var btn = $('twoStepBtn');
    busy(btn, true);
    Api.call('admin.twoStepStart', { token: S.token }).then(function (res) {
      busy(btn, false);
      openSheet(
        '<h3>Turn on two-step sign-in</h3>' +
        '<p>Signing in on a new device will need your passcode and a 6-digit code from an app on your phone.</p>' +
        '<ol class="steps">' +
        '<li>Install a free authenticator app, such as <strong>Google Authenticator</strong> or <strong>Microsoft Authenticator</strong>.</li>' +
        '<li>In the app, add an account: scan this code, or on this phone tap <strong>Open in app</strong>, or type the setup key.</li>' +
        '<li>Type the 6-digit code the app shows, then tap <strong>Turn on</strong>.</li>' +
        '</ol>' +
        '<div class="qr" id="tsQr" role="img" aria-label="QR code for your authenticator app"></div>' +
        '<div class="link-box setup-key" id="tsKey">' + esc(res.secret.replace(/(.{4})/g, '$1 ').trim()) + '</div>' +
        '<div class="sheet-actions two"><a class="btn btn-soft" id="tsOpen" href="' + esc(res.uri) + '">Open in app</a>' +
        '<button class="btn btn-soft" id="tsCopy">' + icon('copy') + 'Copy key</button></div>' +
        '<label class="lbl" for="tsCode">6-digit code from the app</label>' + codeField('tsCode') +
        '<div class="sheet-actions two"><button class="btn btn-soft" data-close>Cancel</button>' +
        '<button class="btn btn-primary" id="tsConfirm"><span class="btn-text">Turn on</span><span class="spinner"></span></button></div>' +
        '<p class="hint">Keep that phone safe. If you lose it, open Apps Script on a computer, pick <strong>turnOffTwoStepSignIn</strong> next to Run, and press Run.</p>',
        function () {
          loadQr().then(function (qrcode) {
            var qr = qrcode(0, 'M');
            qr.addData(res.uri);
            qr.make();
            $('tsQr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
          }).catch(function () { $('tsQr').hidden = true; });
          $('tsCopy').onclick = function () { copyText(res.secret).then(function () { toast('Setup key copied'); }); };
          $('tsConfirm').onclick = function () {
            var code = readCode('tsCode');
            if (!/^\d{6}$/.test(code)) { toast('Type the 6-digit code from the app.'); return; }
            busy($('tsConfirm'), true);
            Api.call('admin.twoStepConfirm', { token: S.token, code: code }).then(function () {
              S.twoStep = true;
              renderTwoStep();
              closeSheet();
              toast('Two-step sign-in is on. Other devices will need a code to sign in again.');
            }, function (err) {
              busy($('tsConfirm'), false);
              $('tsCode').value = '';
              toast(errText(err));
            });
          };
        }
      );
    }, function (err) {
      busy(btn, false);
      toast(errText(err));
    });
  }

  function openTwoStepOff() {
    openSheet(
      '<h3>Turn off two-step sign-in?</h3>' +
      '<p>Signing in will only need your passcode again. Type the current code from your authenticator app to confirm.</p>' +
      '<label class="lbl" for="tsOffCode">6-digit code from the app</label>' + codeField('tsOffCode') +
      '<div class="sheet-actions two"><button class="btn btn-soft" data-close>Keep it on</button>' +
      '<button class="btn btn-danger" id="tsOff"><span class="btn-text">Turn off</span><span class="spinner"></span></button></div>',
      function () {
        $('tsOff').onclick = function () {
          var code = readCode('tsOffCode');
          if (!/^\d{6}$/.test(code)) { toast('Type the 6-digit code from the app.'); return; }
          busy($('tsOff'), true);
          Api.call('admin.twoStepOff', { token: S.token, code: code }).then(function () {
            S.twoStep = false;
            renderTwoStep();
            closeSheet();
            toast('Two-step sign-in is off.');
          }, function (err) {
            busy($('tsOff'), false);
            $('tsOffCode').value = '';
            toast(errText(err));
          });
        };
      }
    );
  }

  // ---------- Lock ----------
  var LOCK_TEXT = $('lockText').textContent;
  function showLock(message) {
    $('lock').hidden = false;
    $('lockErr').textContent = message || '';
    $('lockDemo').hidden = Api.configured;
    $('lockCode').hidden = true;
    $('lockCode').value = '';
    $('lockText').textContent = LOCK_TEXT;
    setTimeout(function () { $('lockInput').focus(); }, 200);
  }
  $('lockForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var key = $('lockInput').value;
    if (!key) return;
    var codeBox = $('lockCode');
    var code = codeBox.hidden ? '' : codeBox.value.replace(/\s+/g, '');
    if (!codeBox.hidden && !/^\d{6}$/.test(code)) {
      $('lockErr').textContent = 'Type the 6-digit code from your authenticator app.';
      codeBox.focus();
      return;
    }
    var btn = $('lockBtn');
    busy(btn, true);
    $('lockErr').textContent = '';
    Api.call('admin.login', { key: key, code: code, site: siteUrl() }).then(function (data) {
      busy(btn, false);
      S.token = data.token;
      saveAuth(data.token);
      $('lock').hidden = true;
      $('lockInput').value = '';
      codeBox.hidden = true;
      codeBox.value = '';
      applyLoad(data);
      if (key.length < Core.minPasscode) {
        toast('Your passcode is short and easier to guess. Use ' + Core.minPasscode + '+ characters.', 'Change', openPassSheet);
      }
    }, function (err) {
      busy(btn, false);
      // Two-step sign-in is on: ask for the code too. Both are checked together.
      if (err.code === 'need_code') {
        codeBox.hidden = false;
        codeBox.value = '';
        $('lockText').textContent = 'Two-step sign-in is on. Enter your passcode and the 6-digit code from your authenticator app.';
        codeBox.focus();
        return;
      }
      codeBox.value = '';
      $('lockErr').textContent = errText(err);
      var card = document.querySelector('.lock-card');
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
    });
  });
  $('lockDemo').addEventListener('click', function () {
    Api.setLocalUrl('');
    location.reload();
  });

  // ---------- Chrome ----------
  $('refreshBtn').addEventListener('click', function () { refresh({ toast: true }); });

  var installEvt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    installEvt = e;
    $('installBtn').hidden = false;
  });
  $('installBtn').addEventListener('click', function () {
    if (!installEvt) return;
    installEvt.prompt();
    installEvt.userChoice.finally(function () { installEvt = null; $('installBtn').hidden = true; });
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline cache is optional */ });
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && S.loaded && $('lock').hidden) {
      refresh({ quiet: true });
      if ($('tab-bookings').classList.contains('active')) markSeenSoon();
    }
  });
  setInterval(function () {
    if (!document.hidden && S.loaded && $('lock').hidden && !S.saving) refresh({ quiet: true });
  }, 45000);

  // ---------- Start ----------
  renderConnection();
  if (Api.mode === 'live' && !Api.configured) $('sUrl').value = Api.apiUrl;
  var lastTab = store.get(KEY_TAB);
  if (lastTab && $('tab-' + lastTab)) goTab(lastTab);
  if (Api.mode === 'live' && !S.token) showLock();
  else refresh();
})();
