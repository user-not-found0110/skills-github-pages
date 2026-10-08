// Talks to the booking server (Google Apps Script) — or, when no server is set
// up yet, runs the exact same booking logic against this device's storage so
// the pages can be tried end to end (demo mode).
(function () {
  'use strict';

  var LOCAL_URL_KEY = 'splashBooking.apiUrl';
  var DEMO_KEY = 'splashBooking.demo.v1';
  var SCRIPT_URL = /^https:\/\/script\.google\.com\/(?:a\/macros\/[^/\s]+|macros)\/s\/([A-Za-z0-9_-]{20,150})\/exec$/;
  var thisScript = document.currentScript && document.currentScript.src;
  // The Scheduler marks its <script> tag. Decided by the page, not the address,
  // which can be disguised (sch%65duler is the same folder to the web server).
  var ownerApp = !!(document.currentScript && document.currentScript.hasAttribute('data-owner-app'));

  function readLocal(key) {
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }

  // Customer links may carry the server id (?s=) until it's in config.js. The
  // owner app never takes it from the URL: a crafted link must not be able to
  // point the Scheduler (and its sign-in) at someone else's script.
  function fromParam() {
    if (ownerApp) return '';
    var path;
    try { path = decodeURIComponent(location.pathname); } catch (e) { return ''; }
    if (/\/scheduler\//i.test(path)) return '';
    var s = new URLSearchParams(location.search).get('s');
    return s && /^[A-Za-z0-9_-]{20,150}$/.test(s) ? 'https://script.google.com/macros/s/' + s + '/exec' : '';
  }

  var configured = ((window.SPLASH_BOOKING || {}).apiUrl || '').trim();
  if (configured && !SCRIPT_URL.test(configured)) configured = '';
  var localUrl = readLocal(LOCAL_URL_KEY);
  if (!SCRIPT_URL.test(localUrl)) localUrl = '';
  var apiUrl = configured || fromParam() || localUrl;

  // ---- Shared booking logic (scheduler/backend/Code.js) ----
  var corePromise = null;
  function loadCore() {
    if (window.BookingCore) return Promise.resolve(window.BookingCore);
    if (!corePromise) {
      corePromise = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = new URL('../scheduler/backend/Code.js', thisScript || location.href).href;
        s.onload = function () {
          // Top-level `var` in a classic script lands on window.
          if (window.BookingCore) resolve(window.BookingCore);
          else reject(new Error('Booking logic failed to load.'));
        };
        s.onerror = function () {
          corePromise = null;
          reject(netError());
        };
        document.head.appendChild(s);
      });
    }
    return corePromise;
  }

  function netError() {
    var e = new Error("Couldn't reach the booking server. Check your connection and try again.");
    e.code = 'network';
    return e;
  }

  // ---- Live server ----
  function callLive(req) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 30000);
    return fetch(apiUrl, {
      method: 'POST',
      // text/plain keeps this a "simple" request: Apps Script can't answer CORS preflights.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(req),
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'follow',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw netError();
      return res.json();
    }, function () {
      throw netError();
    }).then(function (data) {
      clearTimeout(timer);
      return data;
    }, function (err) {
      clearTimeout(timer);
      throw err && err.code ? err : netError();
    });
  }

  // ---- Demo: same logic, stored in this browser ----
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function randomId(core) {
    var bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    return core.idFromBytes(Array.prototype.slice.call(bytes));
  }

  function readDemo(core) {
    var raw = readLocal(DEMO_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) { /* reseed */ }
    }
    return seedDemo(core);
  }

  function writeDemo(state) {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(state)); } catch (e) { /* private mode: lives in memory */ }
  }

  // A couple of sample records so the Scheduler doesn't open empty.
  function seedDemo(core) {
    var D = core.date, t = today(), now = new Date().toISOString();
    var cfg = core.defaults();
    var day = D.addDays(t, 3);
    while (!core.isWorkingDay(cfg, day)) day = D.addDays(day, 1);
    var monthEnd = D.fromMs(Date.UTC(+t.slice(0, 4), +t.slice(5, 7), 0));
    var next = D.addDays(monthEnd, 1);
    var nextEnd = D.fromMs(Date.UTC(+next.slice(0, 4), +next.slice(5, 7), 0));
    var a = core.blankLink();
    Object.assign(a, {
      id: randomId(core), customer: 'Sarah Johnson (sample)', service: 'House wash + driveway',
      start: t.slice(0, 8) + '01', end: day > monthEnd ? nextEnd : monthEnd, created: now, views: 2, lastViewed: now,
      status: 'booked', date: day, name: 'Sarah Johnson', phone: '(757) 555-0142',
      address: '418 Cedar Lakes Dr, Chesapeake, VA', bookedAt: now, updatedAt: now,
      history: [{ at: now, type: 'booked', date: day, from: '', by: 'customer' }]
    });
    var b = core.blankLink();
    Object.assign(b, {
      id: randomId(core), customer: 'Mike Reynolds (sample)', service: 'Roof soft wash',
      start: next, end: nextEnd, created: now
    });
    var state = {
      config: cfg,
      links: [a, b],
      activity: [{ at: now, linkId: a.id, type: 'booked', date: day, from: '', name: a.name, by: 'customer' }]
    };
    writeDemo(state);
    return state;
  }

  function demoEnv(core) {
    var state = readDemo(core);
    var clone = function (x) { return JSON.parse(JSON.stringify(x)); };
    var save = function () { writeDemo(state); };
    return {
      store: {
        getConfig: function () { return clone(state.config || null); },
        setConfig: function (c) { state.config = clone(c); save(); },
        listLinks: function () { return clone(state.links); },
        putLink: function (link) {
          var i = state.links.findIndex(function (l) { return l.id === link.id; });
          if (i >= 0) state.links[i] = clone(link); else state.links.push(clone(link));
          save();
        },
        patchLink: function (id, patch) {
          var l = state.links.find(function (x) { return x.id === id; });
          if (l) { Object.assign(l, clone(patch)); save(); }
        },
        addActivity: function (a) {
          state.activity.push(clone(a));
          state.activity = state.activity.slice(-200);
          save();
        },
        listActivity: function (n) { return clone(state.activity.slice(-n).reverse()); }
      },
      today: today,
      now: function () { return new Date().toISOString(); },
      newId: function () { return randomId(core); },
      lock: function (fn) { return fn(); },
      checkAdmin: function () {},
      checkToken: function () { return true; },
      issueToken: function () { return 'demo'; },
      revokeToken: function () {},
      setPasscode: function () { return 'demo'; },
      notify: function () { return {}; },
      account: function () { return ''; },
      log: function (e) { console.error(e); }
    };
  }

  function callDemo(req) {
    return loadCore().then(function (core) {
      return new Promise(function (resolve) {
        // A short pause so the demo feels like the real thing.
        setTimeout(function () { resolve(core.handle(JSON.parse(JSON.stringify(req)), demoEnv(core))); }, 280 + Math.random() * 220);
      });
    });
  }

  function call(action, payload) {
    var req = Object.assign({}, payload || {}, { action: action });
    return (apiUrl ? callLive(req) : callDemo(req)).then(function (data) {
      if (!data || !data.ok) {
        var e = new Error((data && data.error) || 'Something went wrong. Please try again.');
        e.code = (data && data.code) || 'error';
        throw e;
      }
      return data;
    });
  }

  window.SplashApi = {
    mode: apiUrl ? 'live' : 'demo',
    apiUrl: apiUrl,
    configured: !!configured,
    call: call,
    core: loadCore,
    isScriptUrl: function (u) { return SCRIPT_URL.test(String(u || '').trim()); },
    // Deployment id for links when the URL is only saved on this device, not in config.js.
    scriptId: function () { var m = SCRIPT_URL.exec(apiUrl); return m ? m[1] : ''; },
    setLocalUrl: function (u) {
      try {
        if (u) localStorage.setItem(LOCAL_URL_KEY, u.trim()); else localStorage.removeItem(LOCAL_URL_KEY);
      } catch (e) { /* ignore */ }
    },
    resetDemo: function () { try { localStorage.removeItem(DEMO_KEY); } catch (e) { /* ignore */ } }
  };
})();
