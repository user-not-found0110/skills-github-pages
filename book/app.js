// Customer booking page: see the days the link allows, pick one, confirm.
(function () {
  'use strict';

  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var S = {
    id: params.get('l') || '',
    preview: params.get('preview') === '1',
    data: null,
    month: '',        // 'YYYY-MM' being shown
    selected: '',
    mode: 'new',      // 'new' | 'change'
    busy: false
  };

  // ---------- Date helpers (calendar dates as 'YYYY-MM-DD', no time zones) ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parts(s) { var p = s.split('-'); return { y: +p[0], m: +p[1] - 1, d: +p[2] }; }
  function wd(s) { var p = parts(s); return new Date(Date.UTC(p.y, p.m, p.d)).getUTCDay(); }
  function daysIn(y, m) { return new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }
  function monthOf(s) { return s.slice(0, 7); }
  function shiftMonth(ym, n) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + pad(m + 1);
  }
  function fmt(s, style) {
    var p = parts(s), w = WEEKDAYS[wd(s)];
    if (style === 'short') return w.slice(0, 3) + ', ' + MONTHS[p.m].slice(0, 3) + ' ' + p.d;
    if (style === 'md') return MONTHS[p.m].slice(0, 3) + ' ' + p.d;
    if (style === 'day') return w + ', ' + MONTHS[p.m] + ' ' + p.d;
    return w + ', ' + MONTHS[p.m] + ' ' + p.d + ', ' + p.y;
  }
  function compact(s) { return s.replace(/-/g, ''); }
  function nextDay(s) {
    var p = parts(s), d = new Date(Date.UTC(p.y, p.m, p.d + 1));
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }

  // ---------- Small UI helpers ----------
  var toastTimer;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3800);
  }
  function busy(btn, on) {
    S.busy = on;
    btn.classList.toggle('busy', on);
    btn.disabled = on;
  }
  function show(view, opts) {
    ['loading', 'calendar', 'details', 'done', 'message'].forEach(function (v) {
      var el = $('view-' + v);
      if (v === view) {
        el.hidden = false;
        el.classList.toggle('quiet', !!(opts && opts.quiet));
        // Restart the entrance animation.
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = '';
      } else {
        el.hidden = true;
      }
    });
    $('card').classList.toggle('focus', view === 'done' || view === 'message');
    if (opts && opts.scroll !== false && window.innerWidth < 880) {
      var top = $('card').getBoundingClientRect().top + window.pageYOffset - 12;
      if (window.pageYOffset > top) window.scrollTo({ top: top, behavior: 'smooth' });
    }
  }
  function firstName(s) {
    s = (s || '').replace(/\(.*?\)/g, '').trim();
    var f = s.split(/\s+/)[0] || '';
    return /^[A-Za-z][A-Za-z'.-]{0,20}$/.test(f) ? f : '';
  }
  function telHref(p) { return 'tel:' + String(p || '').replace(/[^\d+]/g, ''); }
  function icon(name) {
    var paths = {
      calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
      clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
      link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
      wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1"/>',
      check: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
      phone: '<path d="M5 4h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 6.3 6.3l1.4-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (paths[name] || '') + '</svg>';
  }

  // ---------- Loading ----------
  (function skeleton() {
    var html = '';
    for (var i = 0; i < 35; i++) html += '<div class="sk sk-day"></div>';
    $('skGrid').innerHTML = html;
  })();
  if (window.SplashApi && SplashApi.mode === 'demo') $('demoPill').hidden = false;

  function load(opts) {
    if (!S.id) {
      showMessage({ icon: 'link', title: 'This link is incomplete', text: 'It looks like part of the link got cut off. Please open the full link you were sent.' });
      return Promise.resolve();
    }
    if (!opts || !opts.silent) show('loading', { scroll: false });
    return SplashApi.call('link.get', { id: S.id, preview: S.preview }).then(function (data) {
      apply(data, opts);
    }).catch(function (err) {
      if (err.code === 'not_found') {
        showMessage({ icon: 'link', title: 'Link not active', text: err.message });
      } else {
        showMessage({
          icon: 'wifi', title: "Couldn't load the calendar", text: err.message,
          actions: [{ label: 'Try again', primary: true, onClick: function () { load(); } }]
        });
      }
    });
  }

  // ---------- Render from server data ----------
  function brand(data) {
    var b = data.business || {};
    document.title = 'Book your day · ' + (b.name || 'Scheduling');
    $('bizName').textContent = b.name || '';
    $('bizTag').textContent = b.tagline || '';
    $('bizTag').hidden = !b.tagline;
    $('footName').textContent = b.name ? '© ' + new Date().getFullYear() + ' ' + b.name : '';
    document.querySelectorAll('.biz-inline').forEach(function (el) { el.textContent = b.name || 'us'; });
    if (b.phone) {
      $('sideCall').href = telHref(b.phone);
      $('sideCallNum').textContent = b.phone;
      $('sideCall').hidden = false;
      $('footCall').href = telHref(b.phone);
      $('footCall').textContent = 'Questions? Call ' + b.phone;
      $('footCall').hidden = false;
    }
    var l = data.link;
    var first = firstName(l.customer);
    $('greeting').textContent = first ? 'Hi ' + first + ',' : 'Online scheduling';
    $('serviceChip').hidden = !l.service;
    $('serviceText').textContent = l.service || '';
    $('windowText').textContent = windowText(l.start, l.end, data.firstBookable);
    if (!$('fName').value && l.customer) {
      $('fName').value = l.customer.replace(/\(.*?\)/g, '').trim();
    }
  }

  function windowText(start, end, firstBookable) {
    var from = start > firstBookable ? start : firstBookable;
    if (from > end) return 'This scheduling window has closed';
    var s = parts(start), e = parts(end);
    if (monthOf(start) === monthOf(end) && s.d === 1 && e.d === daysIn(e.y, e.m)) {
      return 'Open days in ' + MONTHS[e.m] + ' ' + e.y;
    }
    return 'Open days ' + fmt(from, 'md') + ' – ' + fmt(end, 'md');
  }

  function apply(data, opts) {
    S.data = data;
    brand(data);
    var l = data.link;
    if (l.status === 'booked') {
      if (l.date < data.today) {
        showMessage({ icon: 'check', title: 'Thanks for choosing us!',
          text: 'Your service day was ' + fmt(l.date, 'day') + '. Need another one? Just reach out.', call: true });
        return;
      }
      renderDone(opts && opts.fresh);
      return;
    }
    if (data.closed) {
      showMessage({ icon: 'clock', title: 'This scheduling window has closed',
        text: 'The days on this link have passed. Reach out and we’ll send you a fresh one.', call: true });
      return;
    }
    if (!data.open.length) {
      showMessage({ icon: 'calendar', title: 'All booked up',
        text: 'Every day in this window has been taken. Reach out and we’ll find you a day.', call: true });
      return;
    }
    S.mode = 'new';
    if (data.open.indexOf(S.selected) < 0) S.selected = '';
    var notice = '';
    if (l.status === 'cancelled' && l.date) {
      notice = l.cancelledBy === 'owner'
        ? data.business.name + ' cancelled your ' + fmt(l.date, 'short') + ' booking. Pick a new day below.'
        : 'Your ' + fmt(l.date, 'short') + ' booking is cancelled. Changed your mind? Pick a new day below.';
    }
    openCalendar(notice);
  }

  // ---------- Calendar ----------
  function months() {
    var d = S.data, out = [], m = monthOf(d.link.start), last = monthOf(d.link.end);
    // Never show months that are entirely in the past.
    var first = monthOf(d.today);
    while (m <= last) { if (m >= first) out.push(m); m = shiftMonth(m, 1); }
    return out;
  }

  var SIDE_DEFAULT = {
    title: 'Pick your service day',
    text: "Choose any open day \u2014 no account, no time slots. We'll take it from there."
  };
  function setSide(title, text) {
    $('sideTitle').textContent = title;
    $('sideText').textContent = text;
  }

  function openCalendar(notice) {
    var d = S.data;
    var change = S.mode === 'change';
    if (change) setSide('Need a different day?', 'Pick any other open day. Your current day stays booked until you confirm the move.');
    else setSide(SIDE_DEFAULT.title, SIDE_DEFAULT.text);
    $('calEyebrow').textContent = change ? 'Change your day' : 'Step 1 of 2';
    $('calTitle').textContent = change ? 'Pick a new day' : 'Choose your day';
    $('calNotice').hidden = !notice;
    $('calNotice').textContent = notice || '';
    $('legendCurrent').hidden = !change;
    $('keepBtn').hidden = !change;
    var target = S.selected || (change ? d.link.date : d.open[0]);
    var list = months();
    S.month = list.indexOf(monthOf(target)) >= 0 ? monthOf(target) : list[0];
    renderMonth(0);
    updatePick();
    show('calendar');
  }

  function renderMonth(direction) {
    var d = S.data, list = months(), idx = list.indexOf(S.month);
    var y = +S.month.slice(0, 4), m = +S.month.slice(5, 7) - 1;
    $('monthLabel').innerHTML = MONTHS[m] + '<span>' + y + '</span>';
    var single = list.length <= 1;
    $('prevMonth').classList.toggle('invisible', single);
    $('nextMonth').classList.toggle('invisible', single);
    $('prevMonth').disabled = idx <= 0;
    $('nextMonth').disabled = idx >= list.length - 1;

    var open = {};
    d.open.forEach(function (x) { open[x] = true; });
    var current = S.mode === 'change' ? d.link.date : '';
    var lead = new Date(Date.UTC(y, m, 1)).getUTCDay();
    var html = '';
    for (var i = 0; i < lead; i++) html += '<div class="day void"></div>';
    for (var day = 1, n = daysIn(y, m); day <= n; day++) {
      var ds = S.month + '-' + pad(day);
      var inWindow = ds >= d.link.start && ds <= d.link.end;
      if (!inWindow) { html += '<div class="day void"></div>'; continue; }
      var cls = 'day' + (ds === d.today ? ' today' : '') + (ds === current ? ' current' : '');
      if (open[ds]) {
        var sel = ds === S.selected;
        html += '<button type="button" class="' + cls + ' open' + (sel ? ' selected' : '') + '" data-date="' + ds +
          '" aria-pressed="' + sel + '" aria-label="' + fmt(ds, 'long') + (ds === current ? ', your current day' : ', available') + '">' + day + '</button>';
      } else {
        html += '<div class="' + cls + ' na" aria-label="' + fmt(ds, 'long') + ', unavailable">' + day + '</div>';
      }
    }
    var grid = $('days');
    grid.innerHTML = html;
    grid.classList.remove('slide-next', 'slide-prev');
    if (direction) {
      void grid.offsetWidth;
      grid.classList.add(direction > 0 ? 'slide-next' : 'slide-prev');
    }
  }

  function selectDay(ds) {
    S.selected = ds;
    document.querySelectorAll('#days .day.open').forEach(function (b) {
      var on = b.getAttribute('data-date') === ds;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', on);
    });
    updatePick();
  }

  function updatePick() {
    var ds = S.selected, change = S.mode === 'change';
    var same = change && ds === S.data.link.date;
    var ready = !!ds && !same;
    $('pickBar').classList.toggle('ready', ready);
    $('pickBarLabel').textContent = change ? (same ? 'Current day' : 'New day') : 'Selected';
    $('pickBarDate').textContent = ds ? fmt(ds, window.innerWidth < 480 ? 'short' : 'day') : 'Tap an open day';
    $('continueBtn').disabled = !ready;
    $('continueText').textContent = change ? (ready ? 'Move to ' + fmt(ds, 'md') : 'Choose a day') : 'Continue';
    $('sidePick').hidden = !ds;
    $('sidePickLabel').textContent = change && !same ? 'New day' : 'Your day';
    $('sidePickDate').textContent = ds ? fmt(ds, 'long') : '';
  }

  $('days').addEventListener('click', function (e) {
    var b = e.target.closest('.day.open');
    if (b) selectDay(b.getAttribute('data-date'));
  });

  // Arrow keys move between days; Enter/Space selects.
  $('days').addEventListener('keydown', function (e) {
    var b = e.target.closest('.day.open');
    if (!b) return;
    var step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    e.preventDefault();
    var p = parts(b.getAttribute('data-date'));
    for (var i = 1; i <= 42; i++) {
      var t = new Date(Date.UTC(p.y, p.m, p.d + step * i));
      var ds = t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
      var next = document.querySelector('#days [data-date="' + ds + '"]');
      if (next) { next.focus(); return; }
      if (monthOf(ds) !== S.month) return;
    }
  });

  $('prevMonth').addEventListener('click', function () {
    var list = months(), i = list.indexOf(S.month);
    if (i > 0) { S.month = list[i - 1]; renderMonth(-1); }
  });
  $('nextMonth').addEventListener('click', function () {
    var list = months(), i = list.indexOf(S.month);
    if (i < list.length - 1) { S.month = list[i + 1]; renderMonth(1); }
  });

  // Swipe between months on phones.
  (function swipe() {
    var x0 = null, y0 = null;
    $('days').addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    $('days').addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) $(dx < 0 ? 'nextMonth' : 'prevMonth').click();
    });
  })();

  $('continueBtn').addEventListener('click', function () {
    if (!S.selected || S.busy) return;
    if (S.mode === 'change') { submitChange(); return; }
    openDetails();
  });
  $('keepBtn').addEventListener('click', function () {
    S.mode = 'new';
    S.selected = '';
    renderDone(false);
  });

  // ---------- Details ----------
  function openDetails() {
    var ds = S.selected, p = parts(ds);
    $('pickedMon').textContent = MONTHS[p.m].slice(0, 3).toUpperCase();
    $('pickedDay').textContent = p.d;
    $('pickedDate').textContent = fmt(ds, 'day');
    $('confirmText').textContent = 'Confirm ' + fmt(ds, 'short');
    $('nameField').classList.remove('invalid');
    show('details');
    if (window.innerWidth >= 880 && !$('fName').value) setTimeout(function () { $('fName').focus(); }, 350);
  }
  $('backBtn').addEventListener('click', function () { openCalendar(''); });
  $('changePicked').addEventListener('click', function () { openCalendar(''); });

  $('fName').addEventListener('input', function () { $('nameField').classList.remove('invalid'); });

  // (757) 555-0100 as they type, for 10-digit US numbers.
  $('fPhone').addEventListener('input', function (e) {
    var el = e.target, v = el.value;
    if (/^\+/.test(v) || e.inputType === 'deleteContentBackward') return;
    var digits = v.replace(/\D/g, '');
    if (digits.length === 11 && digits[0] === '1') digits = digits.slice(1);
    if (digits.length > 10) return;
    var out = digits;
    if (digits.length > 6) out = '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
    else if (digits.length > 3) out = '(' + digits.slice(0, 3) + ') ' + digits.slice(3);
    el.value = out;
  });

  $('detailsForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (S.busy) return;
    var name = $('fName').value.trim();
    if (!name) {
      var f = $('nameField');
      f.classList.add('invalid');
      f.classList.remove('shake');
      void f.offsetWidth;
      f.classList.add('shake');
      $('fName').focus();
      return;
    }
    var btn = $('confirmBtn');
    busy(btn, true);
    $('confirmText').textContent = 'Confirming…';
    SplashApi.call('link.book', {
      id: S.id, date: S.selected, name: name,
      phone: $('fPhone').value.trim(), address: $('fAddress').value.trim()
    }).then(function (data) {
      busy(btn, false);
      S.selected = '';
      apply(data, { fresh: true });
    }).catch(function (err) {
      busy(btn, false);
      $('confirmText').textContent = 'Confirm ' + fmt(S.selected, 'short');
      handleBookError(err);
    });
  });

  function handleBookError(err) {
    if (err.code === 'unavailable') {
      S.selected = '';
      toast(err.message);
      load({ silent: true });
    } else {
      toast(err.message);
    }
  }

  // ---------- Change / cancel ----------
  function submitChange() {
    var btn = $('continueBtn'), ds = S.selected;
    busy(btn, true);
    $('continueText').textContent = 'Saving…';
    SplashApi.call('link.book', { id: S.id, date: ds }).then(function (data) {
      busy(btn, false);
      S.mode = 'new';
      S.selected = '';
      apply(data, { fresh: true, changed: true });
      toast('Moved to ' + fmt(ds, 'day') + '.');
    }).catch(function (err) {
      busy(btn, false);
      updatePick();
      if (err.code === 'unavailable') {
        S.selected = '';
        toast(err.message);
        SplashApi.call('link.get', { id: S.id, preview: true }).then(function (data) {
          S.data = data;
          S.mode = 'change';
          openCalendar('');
        }).catch(function () {});
      } else {
        toast(err.message);
      }
    });
  }

  $('changeBtn').addEventListener('click', function () {
    S.mode = 'change';
    S.selected = S.data.link.date;
    openCalendar('');
  });

  $('cancelBtn').addEventListener('click', function () {
    $('cancelText').textContent = 'Your ' + fmt(S.data.link.date, 'day') + ' booking will be released. You can pick a new day afterward if you like.';
    $('cancelModal').hidden = false;
  });
  $('cancelModal').addEventListener('click', function (e) {
    if (e.target.hasAttribute('data-close') && !S.busy) $('cancelModal').hidden = true;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('cancelModal').hidden && !S.busy) $('cancelModal').hidden = true;
  });
  $('cancelConfirm').addEventListener('click', function () {
    var btn = $('cancelConfirm');
    busy(btn, true);
    SplashApi.call('link.cancel', { id: S.id }).then(function (data) {
      busy(btn, false);
      $('cancelModal').hidden = true;
      apply(data);
    }).catch(function (err) {
      busy(btn, false);
      $('cancelModal').hidden = true;
      toast(err.message);
    });
  });

  // ---------- Done ----------
  function renderDone(fresh) {
    var d = S.data, l = d.link, p = parts(l.date);
    var first = firstName(l.name);
    $('doneTitle').textContent = fresh ? (first ? "You're all set, " + first + '!' : "You're all set!") : "You're booked" + (first ? ', ' + first : '') + '.';
    $('doneSub').textContent = fresh
      ? d.business.name + ' has been notified and will reach out before your service day to confirm the details.'
      : 'Here’s your service day. Need a different day? You can change or cancel below.';
    $('ticketMon').textContent = MONTHS[p.m].slice(0, 3).toUpperCase();
    $('ticketDay').textContent = p.d;
    $('ticketWd').textContent = WEEKDAYS[wd(l.date)].slice(0, 3);
    $('ticketDate').textContent = fmt(l.date, 'long');
    $('ticketWho').textContent = [l.name, l.service].filter(Boolean).join(' · ');
    $('gcalBtn').href = googleCalUrl();
    $('sidePick').hidden = true;
    setSide('Your day is booked', 'Plans change? Reopen this link any time to move or cancel \u2014 no account needed.');
    show('done', { quiet: !fresh });
  }

  function manageUrl() {
    var u = new URL(location.href);
    u.searchParams.delete('preview');
    return u.href;
  }
  function eventText() {
    var d = S.data, b = d.business;
    return {
      title: b.name + (d.link.service ? ' — ' + d.link.service : ' — service day'),
      details: 'Your service day with ' + b.name + '.' + (b.phone ? ' Questions: ' + b.phone + '.' : '') + '\nChange or cancel: ' + manageUrl()
    };
  }
  function googleCalUrl() {
    var d = S.data, t = eventText();
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      '&text=' + encodeURIComponent(t.title) +
      '&dates=' + compact(d.link.date) + '/' + compact(nextDay(d.link.date)) +
      '&details=' + encodeURIComponent(t.details);
  }
  $('icsBtn').addEventListener('click', function () {
    var d = S.data, t = eventText();
    var esc = function (s) { return String(s).replace(/\\/g, '\\\\').replace(/[,;]/g, '\\$&').replace(/\n/g, '\\n'); };
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Splash Booking//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + S.id + '-' + compact(d.link.date) + '@splash-booking',
      'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + compact(d.link.date),
      'DTEND;VALUE=DATE:' + compact(nextDay(d.link.date)),
      'SUMMARY:' + esc(t.title),
      'DESCRIPTION:' + esc(t.details),
      'URL:' + manageUrl(),
      'TRANSP:TRANSPARENT',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    var url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    var a = document.createElement('a');
    a.href = url;
    a.download = 'service-day-' + d.link.date + '.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  });

  // ---------- Messages ----------
  function showMessage(m) {
    if (!S.data) {
      $('bizName').textContent = 'Online Scheduling';
      $('bizTag').hidden = true;
    }
    setSide('Online scheduling', 'Questions about your service? We\u2019re happy to help.');
    $('msgIcon').innerHTML = icon(m.icon);
    $('msgTitle').textContent = m.title;
    $('msgText').textContent = m.text;
    var box = $('msgActions');
    box.innerHTML = '';
    var phone = S.data && S.data.business && S.data.business.phone;
    var actions = (m.actions || []).slice();
    if (m.call && phone) {
      var a = document.createElement('a');
      a.className = 'btn btn-primary';
      a.href = telHref(phone);
      a.innerHTML = icon('phone') + '<span>Call ' + phone.replace(/[<>&]/g, '') + '</span>';
      box.appendChild(a);
    }
    actions.forEach(function (act) {
      var b = document.createElement('button');
      b.className = 'btn ' + (act.primary ? 'btn-primary' : 'btn-soft');
      b.textContent = act.label;
      b.addEventListener('click', act.onClick);
      box.appendChild(b);
    });
    show('message');
  }

  // Back from the phone's calendar app etc.: refresh quietly if the page sat idle a while.
  var hiddenAt = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (S.data && !S.busy && Date.now() - hiddenAt > 5 * 60 * 1000 && $('view-details').hidden && $('cancelModal').hidden) {
      load({ silent: true });
    }
  });

  load();
})();
