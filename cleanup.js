// The old Splash tools (Quote Builder, Lead Tracker, Quote Follow-Up, Pricing
// Agent, Content Creator, Wash Window, Pace Gauge) have been retired. This
// removes everything they left on this device: saved customer info, their
// offline copies, and their service workers. The Scheduler's own data and
// sign-in, and the booking page, are never touched.
(function () {
  'use strict';

  var base = new URL('./', document.currentScript.src).href;
  var SCOPES = ['', 'content/', 'lead-tracker/', 'follow-up/', 'pricing-agent/', 'wash-window/', 'splash-pace-tracker/']
    .map(function (p) { return base + p; });
  var KEYS = /^splash_(pw|lt|fu|agent|ww|pace)_/;
  var CACHES = /^splash-(pw|content|followup|leads|agent|pace|weather)-v\d+$/;
  var jobs = [];

  try {
    Object.keys(localStorage).forEach(function (k) {
      if (KEYS.test(k)) localStorage.removeItem(k);
    });
  } catch (e) { /* storage blocked: nothing to remove */ }

  if (window.caches) {
    jobs.push(caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return CACHES.test(n); })
        .map(function (n) { return caches.delete(n); }));
    }).catch(function () {}));
  }

  if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
    jobs.push(navigator.serviceWorker.getRegistrations().then(function (regs) {
      return Promise.all(regs.filter(function (r) { return SCOPES.indexOf(r.scope) >= 0; })
        .map(function (r) { return r.unregister(); }));
    }).catch(function () {}));
  }

  window.splashCleanup = Promise.all(jobs);
})();
