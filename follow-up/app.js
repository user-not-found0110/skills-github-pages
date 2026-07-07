(function () {
  'use strict';

  // ============ DOM REFS ============
  const $ = id => document.getElementById(id);
  const toastEl = $('toast');
  const installBtn = $('installBtn');

  // ============ STORAGE KEYS ============
  const LS_QUOTES = 'splash_fu_quotes';
  const LS_TEMPLATES = 'splash_fu_templates';
  const LS_SETTINGS = 'splash_fu_settings';
  const LS_STATS = 'splash_fu_stats';
  const LS_PENDING = 'splash_fu_pending';
  const MAX_QUOTES = 400;

  // ============ THE 6-TOUCH CADENCE ============
  // Offsets are days after the quote was SENT — the whole system hangs off sentDate.
  // 2% of sales close on touch 1; ~80% close on touch 5+. This is the 5+ machine.
  const CADENCE = [
    { key: 'check_in',  offset: 1,  label: 'Check-in',  templateKey: 'step_check_in' },
    { key: 'value',     offset: 4,  label: 'Value',     templateKey: 'step_value' },
    { key: 'urgency',   offset: 8,  label: 'Urgency',   templateKey: 'step_urgency' },
    { key: 'angle',     offset: 14, label: 'New angle', templateKey: 'step_angle' },
    { key: 'breakup',   offset: 21, label: 'Breakup',   templateKey: 'step_breakup' },
    { key: 'last_word', offset: 30, label: 'Last word', templateKey: 'step_lastword' }
  ];

  const LOST_REASONS = [
    { key: 'price',      label: 'Price' },
    { key: 'timing',     label: 'Timing' },
    { key: 'competitor', label: 'Went elsewhere' },
    { key: 'ghosted',    label: 'Ghosted' },
    { key: 'other',      label: 'Other' }
  ];
  const LOST_LABELS = {};
  LOST_REASONS.forEach(r => { LOST_LABELS[r.key] = r.label; });

  // ============ TEMPLATES ============
  const TEMPLATE_DEFS = [
    {
      key: 'step_check_in', group: 'The 6-touch sequence', name: 'Touch 1 · Day 1 — Check-in',
      text: "Hi {name}, it's {owner} with {company}. Just making sure the quote for {service} came through okay — {quote}, everything included. Any questions I can answer? Happy to walk through exactly what we'd do."
    },
    {
      key: 'step_value', group: 'The 6-touch sequence', name: 'Touch 2 · Day 4 — Social proof',
      text: "Hi {name}, {owner} at {company}. While you're thinking over the {service} quote — we're veteran and firefighter owned, licensed and insured, and our Hampton Roads neighbors say it better than I can: {review_link} — happy to text you before-and-after photos from jobs near you too."
    },
    {
      key: 'step_urgency', group: 'The 6-touch sequence', name: 'Touch 3 · Day 8 — Urgency',
      text: "Hi {name} — {owner} with {company}. Heads up: our {service} schedule for the next couple of weeks is filling in fast. I'd hate for you to be stuck waiting when you're ready. Want me to pencil in a day for you? Takes one text."
    },
    {
      key: 'step_angle', group: 'The 6-touch sequence', name: 'Touch 4 · Day 14 — New angle',
      text: "Hi {name}, still have your {service} quote on my desk. One thing worth knowing: the longer algae and grime sit, the harder they are on the surface — a wash now protects it, not just prettifies it. If it's on the to-do list anyway, let's knock it out. — {owner}, {company}"
    },
    {
      key: 'step_breakup', group: 'The 6-touch sequence', name: 'Touch 5 · Day 21 — Breakup',
      text: "Hi {name}, {owner} with {company}. I don't want to be a pest, so this is my last note about the {service} quote. If the timing's just not right, no hard feelings at all — should I close your file, or would you like to grab a spot on the schedule?"
    },
    {
      key: 'step_lastword', group: 'The 6-touch sequence', name: 'Touch 6 · Day 30 — Close the file',
      text: "Hi {name} — closing out my open quotes this week and yours for {service} is one of them. If you'd still like it done, reply here and I'll get you scheduled. Either way, thanks for considering a local veteran and firefighter owned company. — {owner}, {company}"
    },
    {
      key: 'sit_stalling', group: 'Situational', name: "They replied but they're stalling",
      text: "Totally understand, {name} — no rush on my end. So it doesn't fall through the cracks, want me to check back in a couple of weeks, or would you rather just pick a day now and have it off your plate?"
    },
    {
      key: 'sit_changes', group: 'Situational', name: 'They asked for changes',
      text: "You got it, {name} — I'll rework the quote for {service} and get the updated number to you today. Anything else you'd like me to look at while I'm pricing it?"
    },
    {
      key: 'sit_commercial', group: 'Situational', name: 'Commercial follow-up',
      text: "Hi {name}, {owner} with {company} following up on the {service} proposal — {quote}. We're licensed and insured, carry a certificate of insurance for your file, and can work around your business hours so there's zero disruption. Happy to answer any questions or adjust the scope."
    },
    {
      key: 'winback_spring', group: 'Win-back', name: 'Spring win-back',
      text: "Hi {name}, {owner} with {company}. We spoke a while back about {service} — spring's here and this is the best window all year to wash off winter grime before it bakes in. Want me to refresh your quote? Numbers may have shifted a little, but I'll have it to you same day."
    },
    {
      key: 'winback_fall', group: 'Win-back', name: 'Fall win-back',
      text: "Hi {name}, {owner} with {company}. We quoted your {service} a while back — before the holidays and the cold set in is the ideal time to get it handled (and have the place looking sharp for guests). Want me to update the quote and find you a date?"
    },
    {
      key: 'won_review', group: 'After the win', name: 'Review ask',
      text: "Hi {name}, thanks again for trusting {company} with your {service}! If you're happy with how it turned out, a quick Google review would mean the world to our small veteran and firefighter owned crew: {review_link}"
    },
    {
      key: 'won_referral', group: 'After the win', name: 'Referral ask',
      text: "Hi {name}, glad we could take care of your {service}! If any neighbors or friends could use us, passing along my number is the biggest compliment we can get: 757-752-8484. We take great care of anyone you send our way."
    }
  ];

  // ============ STATE ============
  let quotes = loadJSON(LS_QUOTES, []);
  let templates = Object.assign(defaultTemplates(), loadJSON(LS_TEMPLATES, {}));
  let settings = Object.assign(
    { owner: '', company: 'Splash Pressure Washing', reviewLink: '' },
    loadJSON(LS_SETTINGS, {})
  );
  let stats = Object.assign(
    { streak: 0, bestStreak: 0, lastClearedDate: '', lastTouchDate: '' },
    loadJSON(LS_STATS, {})
  );
  let pendingTouch = loadJSON(LS_PENDING, null);
  let currentFilter = 'all';
  let currentSort = 'next';
  const expanded = new Set();
  const flows = new Map(); // quote id -> inline flow state on its card

  function defaultTemplates() {
    const map = {};
    TEMPLATE_DEFS.forEach(t => { map[t.key] = t.text; });
    return map;
  }

  // ============ HELPERS ============
  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function saveQuotes()    { localStorage.setItem(LS_QUOTES, JSON.stringify(quotes)); }
  function saveTemplates() { localStorage.setItem(LS_TEMPLATES, JSON.stringify(templates)); }
  function saveSettings()  { localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); }
  function saveStats()     { localStorage.setItem(LS_STATS, JSON.stringify(stats)); }
  function savePending() {
    if (pendingTouch) localStorage.setItem(LS_PENDING, JSON.stringify(pendingTouch));
    else localStorage.removeItem(LS_PENDING);
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // Local-time YYYY-MM-DD (the cadence lives in the owner's day, not UTC).
  function dateStr(d) {
    const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
    return y + '-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }
  function todayStr() { return dateStr(new Date()); }
  function addDaysStr(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return dateStr(d);
  }
  function addDaysFrom(ymd, n) {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(y, m - 1, d + n);
    return dateStr(dt);
  }
  function daysSince(ymd) {
    if (!ymd) return 0;
    const [y, m, d] = ymd.split('-').map(Number);
    const then = new Date(y, m - 1, d);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((today - then) / 86400000);
  }
  function prettyDate(ymd) {
    if (!ymd) return '';
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function fmtMoney(n) {
    const num = Number(n);
    if (!num) return '';
    return '$' + num.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  function cleanPhone(phone) {
    const p = String(phone || '').trim();
    return (p.startsWith('+') ? '+' : '') + p.replace(/\D/g, '');
  }
  // Last 10 digits — the dedupe key for CSV imports and backup merges.
  function phoneKey(phone) {
    return String(phone || '').replace(/\D/g, '').slice(-10);
  }

  function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || 'there'; }
  function displayName(q) { return String(q.name || '').trim() || q.phone; }
  function serviceText(q) {
    const s = String(q.service || '').trim();
    return s ? s.toLowerCase() : 'pressure washing';
  }

  function findQuote(id) { return quotes.find(q => q.id === id); }

  function fillTemplate(key, q) {
    return (templates[key] || '')
      .replace(/\{name\}/g, firstName(q.name))
      .replace(/\{service\}/g, serviceText(q))
      .replace(/\{company\}/g, settings.company || 'Splash Pressure Washing')
      .replace(/\{owner\}/g, settings.owner || 'the owner')
      .replace(/\{review_link\}/g, settings.reviewLink || '')
      .replace(/\{quote\}/g, fmtMoney(q.amount) || 'the quoted price');
  }

  function smsHref(q, templateKey) {
    return 'sms:' + cleanPhone(q.phone) + '?body=' +
           encodeURIComponent(fillTemplate(templateKey, q));
  }

  function copyText(text, okMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showToast(okMsg),
        () => showToast('Copy failed')
      );
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); showToast(okMsg); }
      catch (e) { showToast('Copy failed'); }
      document.body.removeChild(ta);
    }
  }

  // ============ SEQUENCE ENGINE ============
  function currentStep(q) {
    return q.stepIndex < CADENCE.length ? CADENCE[q.stepIndex] : null;
  }

  // Next touch lands on the cadence day, but never in the past — an imported
  // 12-day-old quote becomes one touch due today, not a wall of overdue cards.
  function scheduleStep(q) {
    const step = currentStep(q);
    if (!step) { q.nextTouchDate = ''; return; }
    const target = addDaysFrom(q.sentDate, step.offset);
    q.nextTouchDate = target < todayStr() ? todayStr() : target;
  }

  // Where an added/imported quote enters the sequence, based on its age.
  // A quote nobody has touched enters at the latest step already owed — a 6-day-old
  // quote owes the day-4 value touch today, not silence until day 8. Old ghosts
  // (30+ days) start straight at the breakup text — exactly what they need.
  function initStepFromAge(q) {
    const age = daysSince(q.sentDate);
    if (age >= CADENCE[CADENCE.length - 1].offset) {
      q.stepIndex = 4; // breakup
    } else {
      q.stepIndex = 0;
      for (let i = 0; i < CADENCE.length; i++) {
        if (CADENCE[i].offset <= age) q.stepIndex = i;
      }
    }
    scheduleStep(q);
  }

  // The template the Text button reaches for right now.
  function textTemplateKey(q) {
    if (q.status === 'nurture') {
      return new Date().getMonth() <= 5 ? 'winback_spring' : 'winback_fall';
    }
    if (q.status === 'won') return 'won_review';
    const step = currentStep(q);
    if (!step) return 'step_breakup';
    // Commercial jobs get the COI/business-hours pitch on the early touches.
    if (q.isCommercial && (step.key === 'check_in' || step.key === 'value')) return 'sit_commercial';
    return step.templateKey;
  }

  function markTouchSent(q, templateKey) {
    q.touches.push({ at: Date.now(), stepKey: q.status === 'nurture' ? 'winback' : (currentStep(q) || {}).key || 'extra', templateKey });
    stats.lastTouchDate = todayStr();
    if (q.status === 'nurture') {
      q.winbackCount = (q.winbackCount || 0) + 1;
      q.winbackDate = addDaysStr(90);
      saveAllAfterTouch();
      showToast('Win-back sent — resurfaces in 90 days');
      return;
    }
    q.stepIndex++;
    if (q.stepIndex < CADENCE.length) {
      scheduleStep(q);
      saveAllAfterTouch();
      showToast('Touch ' + q.stepIndex + ' of 6 done — next one ' + prettyDate(q.nextTouchDate));
    } else {
      q.status = 'nurture';
      q.nextTouchDate = '';
      q.winbackDate = addDaysStr(60);
      saveAllAfterTouch();
      showToast('Sequence complete — moved to Win-Back (resurfaces in 60 days)');
    }
  }

  function saveAllAfterTouch() {
    saveQuotes();
    updateStreak();
    saveStats();
    renderAll();
  }

  function isDue(q) {
    return (q.status === 'open'    && q.nextTouchDate && q.nextTouchDate <= todayStr())
        || (q.status === 'nurture' && q.winbackDate   && q.winbackDate   <= todayStr());
  }

  function dueDate(q) { return q.status === 'nurture' ? q.winbackDate : q.nextTouchDate; }

  function setWon(q, amount) {
    q.status = 'won';
    q.wonAmount = amount;
    q.wonAt = Date.now();
    q.nextTouchDate = '';
    q.winbackDate = '';
    flows.delete(q.id);
    saveAllAfterTouch();
    const chased = q.touches.length > 0;
    showToast(chased
      ? "That's " + (fmtMoney(amount) || 'a job') + ' closed by following up.'
      : (fmtMoney(amount) || 'Job') + ' marked won.');
  }

  function setLost(q, reason) {
    q.status = 'lost';
    q.lostReason = reason;
    q.lostAt = Date.now();
    q.nextTouchDate = '';
    q.winbackDate = '';
    flows.delete(q.id);
    saveAllAfterTouch();
    showToast(displayName(q) + ' marked lost (' + (LOST_LABELS[reason] || reason) + ')');
  }

  function toNurture(q, days, reason) {
    q.status = 'nurture';
    if (reason) q.lostReason = reason;
    q.nextTouchDate = '';
    q.winbackDate = addDaysStr(days);
    flows.delete(q.id);
    saveAllAfterTouch();
    showToast(displayName(q) + ' moved to Win-Back — resurfaces ' + prettyDate(q.winbackDate));
  }

  function restoreQuote(q) {
    q.status = 'open';
    q.wonAmount = null; q.wonAt = null;
    q.lostAt = null; q.lostReason = '';
    q.winbackDate = '';
    initStepFromAge(q);
    // Don't replay touches they already got — resume after the last touch if further along.
    if (q.touches.length > q.stepIndex) {
      q.stepIndex = Math.min(q.touches.length, CADENCE.length - 1);
      scheduleStep(q);
    }
    saveQuotes();
    renderAll();
    showToast(displayName(q) + ' is back in the pipeline');
  }

  // Streak: cleared the due list on consecutive days (with at least one touch sent that day).
  function updateStreak() {
    const dueCount = quotes.filter(isDue).length;
    const today = todayStr();
    if (dueCount === 0 && stats.lastTouchDate === today && stats.lastClearedDate !== today) {
      stats.streak = (stats.lastClearedDate === addDaysStr(-1)) ? stats.streak + 1 : 1;
      stats.lastClearedDate = today;
      if (stats.streak > stats.bestStreak) stats.bestStreak = stats.streak;
    }
  }

  // ============ CARD RENDERING ============
  function agePillHTML(q) {
    const age = daysSince(q.sentDate);
    const cls = age >= 15 ? 'red' : age >= 8 ? 'amber' : '';
    return '<span class="age-pill ' + cls + '">Day ' + age + '</span>';
  }

  function stepDotsHTML(q) {
    if (q.status !== 'open') return '';
    const step = currentStep(q);
    const dots = CADENCE.map((s, i) => {
      const cls = i < q.stepIndex ? ' sent' : i === q.stepIndex ? ' current' : '';
      return '<span class="step-dot' + cls + '"></span>';
    }).join('');
    const label = step
      ? 'Touch ' + (q.stepIndex + 1) + ' of 6 — ' + step.label
      : 'Sequence done';
    return '<div class="step-row"><div class="step-dots">' + dots + '</div><span class="step-label">' + label + '</span></div>';
  }

  function flowHTML(q) {
    const flow = flows.get(q.id);
    if (!flow) return '';
    if (flow.type === 'confirm') {
      return '<div class="flow-strip confirm-strip">' +
        '<div class="flow-q">Did the text go out?</div>' +
        '<div class="flow-btns">' +
          '<button type="button" class="flow-btn yes" data-action="confirm-sent">Sent &#10003;</button>' +
          '<button type="button" class="flow-btn" data-action="confirm-no">Didn\'t send</button>' +
        '</div></div>';
    }
    if (flow.type === 'won') {
      return '<div class="flow-strip">' +
        '<div class="flow-q">How much is the job worth?</div>' +
        '<div class="won-row">' +
          '<input type="number" inputmode="decimal" class="won-amount" value="' + esc(q.amount || '') + '" placeholder="$">' +
          '<button type="button" class="flow-btn yes" data-action="won-confirm">Mark Won</button>' +
        '</div></div>';
    }
    if (flow.type === 'lost') {
      return '<div class="flow-strip">' +
        '<div class="flow-q">Why did it fall through?</div>' +
        '<div class="flow-btns">' +
          LOST_REASONS.map(r => '<button type="button" class="flow-btn" data-action="lost-reason" data-reason="' + r.key + '">' + r.label + '</button>').join('') +
        '</div></div>';
    }
    if (flow.type === 'lostConfirm') {
      return '<div class="flow-strip">' +
        '<div class="flow-q">' + (flow.reason === 'timing' ? 'Bad timing' : 'Ghosted') + ' quotes often come back. Keep it on the Win-Back list?</div>' +
        '<div class="flow-btns">' +
          '<button type="button" class="flow-btn yes" data-action="lost-nurture" data-reason="' + flow.reason + '">Win-Back list</button>' +
          '<button type="button" class="flow-btn" data-action="lost-final" data-reason="' + flow.reason + '">Lost for good</button>' +
        '</div></div>';
    }
    if (flow.type === 'snooze') {
      return '<div class="flow-strip">' +
        '<div class="flow-q">Push the next touch to&hellip;</div>' +
        '<div class="flow-btns">' +
          '<button type="button" class="flow-btn" data-action="snooze-days" data-days="1">Tomorrow</button>' +
          '<button type="button" class="flow-btn" data-action="snooze-days" data-days="3">+3 days</button>' +
          '<button type="button" class="flow-btn" data-action="snooze-days" data-days="7">+1 week</button>' +
        '</div></div>';
    }
    return '';
  }

  function quoteCardHTML(q) {
    const due = isDue(q);
    const isExpanded = expanded.has(q.id);
    const open = q.status === 'open';
    const nurture = q.status === 'nurture';
    const active = open || nurture;
    const tplKey = textTemplateKey(q);

    const metaBits = [];
    if (due) metaBits.push('<span class="due-flag">' + (nurture ? 'Win-back due' : 'Touch due') + '</span>');
    else if (open && q.nextTouchDate) metaBits.push('Next touch ' + esc(prettyDate(q.nextTouchDate)));
    else if (nurture && q.winbackDate) metaBits.push('Win-back ' + esc(prettyDate(q.winbackDate)));
    if (q.service) metaBits.push(esc(q.service));
    if (q.replied) metaBits.push('<span style="color:#1e8e4f;font-weight:600">Replied</span>');

    const statusChip = q.status === 'won' ? '<span class="status-chip q-won">Won</span>'
      : q.status === 'lost' ? '<span class="status-chip q-lost">Lost</span>'
      : nurture ? '<span class="status-chip q-nurture">Win-Back</span>'
      : '';

    const amount = fmtMoney(q.amount);

    // Quick actions live on the card face — the whole daily loop happens without expanding.
    const quickActions = active ? (
      '<div class="quick-actions">' +
        '<a class="qa-btn qa-text" data-action="text" href="' + smsHref(q, tplKey) + '">&#128172; Text</a>' +
        '<button type="button" class="qa-btn qa-won" data-action="won">Won</button>' +
        '<button type="button" class="qa-btn qa-lost" data-action="lost">Lost</button>' +
        '<button type="button" class="qa-btn qa-snooze" data-action="snooze">Zzz</button>' +
      '</div>'
    ) : '';

    const logItems = (q.touches || []).map(t => {
      const stepDef = CADENCE.find(s => s.key === t.stepKey);
      const what = t.stepKey === 'winback' ? 'Win-back text'
        : stepDef ? 'Touch ' + (CADENCE.indexOf(stepDef) + 1) + ' (' + stepDef.label + ')'
        : 'Text';
      return '<li>' + new Date(t.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' — ' + what + ' sent</li>';
    }).join('');

    return `
      <div class="lead-card q-${q.status}${due ? ' overdue' : ''}${isExpanded ? ' expanded' : ''}" data-id="${q.id}">
        <div class="lead-summary" data-action="toggle" role="button" tabindex="0">
          <div class="lead-main">
            <div class="lead-name">${esc(displayName(q))}${amount ? ' <span class="q-amount">&middot; ' + amount + '</span>' : ''}</div>
            <div class="lead-meta">${metaBits.join(' &middot; ')}</div>
          </div>
          ${statusChip}
          ${agePillHTML(q)}
          <span class="lead-chevron">&#9662;</span>
        </div>
        ${stepDotsHTML(q)}
        ${flowHTML(q)}
        ${quickActions}
        <div class="lead-detail">
          <div class="detail-row"><span class="dl">Phone:</span> ${esc(q.phone)}</div>
          ${q.address ? `<div class="detail-row"><span class="dl">Address:</span> ${esc(q.address)}</div>` : ''}
          <div class="detail-row"><span class="dl">Quote sent:</span> ${esc(prettyDate(q.sentDate))} (${daysSince(q.sentDate)} days ago)</div>
          ${q.status === 'won' ? `<div class="detail-row"><span class="dl">Won:</span> ${fmtMoney(q.wonAmount) || '—'}${q.touches.length ? ' after ' + q.touches.length + ' follow-up' + (q.touches.length > 1 ? 's' : '') : ''}</div>` : ''}
          ${q.status === 'lost' ? `<div class="detail-row"><span class="dl">Lost:</span> ${esc(LOST_LABELS[q.lostReason] || 'No reason logged')}</div>` : ''}

          <div class="detail-label">Actions</div>
          <div class="action-btns">
            <a class="action-btn a-call" href="tel:${cleanPhone(q.phone)}">&#128222; Call</a>
            <button type="button" class="action-btn a-copy" data-action="copy-msg">&#128203; Copy Message</button>
            ${q.status === 'won' ? `
            <a class="action-btn a-review" href="${smsHref(q, 'won_review')}">&#11088; Ask for Review</a>
            <a class="action-btn a-text" href="${smsHref(q, 'won_referral')}">&#128101; Ask for Referral</a>` : ''}
            ${active ? `<button type="button" class="action-btn a-copy" data-action="copy-address">&#128205; Copy Address</button>` : ''}
            ${open ? `<button type="button" class="action-btn a-copy" data-action="skip-step">&#9193; Skip This Touch</button>` : ''}
          </div>

          ${active ? `
          <div class="detail-label">If they text back&hellip;</div>
          <div class="obj-btns">
            <a class="mini-btn" href="${smsHref(q, 'sit_stalling')}">Stalling</a>
            <a class="mini-btn" href="${smsHref(q, 'sit_changes')}">Wants changes</a>
            <a class="mini-btn" href="${smsHref(q, 'sit_commercial')}">Commercial</a>
          </div>
          <div class="detail-label">Flags</div>
          <div class="toggle-row">
            <button type="button" class="toggle-btn${q.replied ? ' on' : ''}" data-action="toggle-replied">${q.replied ? '&#10003; They replied' : 'They replied?'}</button>
            <button type="button" class="toggle-btn${q.isCommercial ? ' on' : ''}" data-action="toggle-commercial">${q.isCommercial ? '&#10003; Commercial' : 'Commercial?'}</button>
          </div>` : ''}

          ${logItems ? `<div class="detail-label">Follow-up log</div><ul class="log-list">${logItems}</ul>` : ''}

          <div class="detail-label">Details</div>
          <div class="detail-fields">
            <div class="form-group">
              <label>Name</label>
              <input type="text" data-field="name" value="${esc(q.name || '')}" placeholder="Add when known">
            </div>
            <div class="form-group">
              <label>Quote $</label>
              <input type="number" inputmode="decimal" data-field="amount" value="${esc(q.amount || '')}" placeholder="0">
            </div>
            ${open ? `
            <div class="form-group">
              <label>Next touch on</label>
              <input type="date" data-field="nextTouchDate" value="${esc(q.nextTouchDate || '')}">
            </div>` : ''}
            ${nurture ? `
            <div class="form-group">
              <label>Win-back on</label>
              <input type="date" data-field="winbackDate" value="${esc(q.winbackDate || '')}">
            </div>` : ''}
            <div class="form-group">
              <label>Service</label>
              <input type="text" data-field="service" value="${esc(q.service || '')}" placeholder="House wash">
            </div>
          </div>

          <div class="detail-label">Notes</div>
          <div class="detail-notes">
            <textarea rows="2" data-field="notes" placeholder="Notes...">${esc(q.notes || '')}</textarea>
          </div>

          <div class="detail-footer">
            ${active ? '' : '<button type="button" class="mini-btn" data-action="restore">Back to Pipeline</button>'}
            <button type="button" class="mini-btn danger" data-action="delete">Delete</button>
          </div>
        </div>
      </div>`;
  }

  // ============ RENDERING ============
  function renderToday() {
    const dueQuotes = quotes.filter(isDue)
      .sort((a, b) => (dueDate(a) || '').localeCompare(dueDate(b) || ''));

    $('todayList').innerHTML = dueQuotes.map(quoteCardHTML).join('');
    $('todayEmpty').style.display = dueQuotes.length ? 'none' : 'block';

    const openQuotes = quotes.filter(q => q.status === 'open' || q.status === 'nurture');
    const dueSum = dueQuotes.reduce((s, q) => s + (Number(q.amount) || 0), 0);
    const pipeSum = openQuotes.reduce((s, q) => s + (Number(q.amount) || 0), 0);
    $('todayStats').innerHTML =
      '<div class="stat-tile"><div class="stat-num' + (dueQuotes.length ? ' alert' : '') + '">' + dueQuotes.length + '</div><div class="stat-lbl">Touches due</div></div>' +
      '<div class="stat-tile"><div class="stat-num">' + (fmtMoney(dueQuotes.length ? dueSum : pipeSum) || '$0') + '</div><div class="stat-lbl">' + (dueQuotes.length ? '$ at stake today' : '$ in pipeline') + '</div></div>';

    $('streakCard').innerHTML = stats.streak > 0
      ? '<div class="streak-card">&#128293; ' + stats.streak + '-day streak clearing your due list' +
        (stats.bestStreak > stats.streak ? ' (best: ' + stats.bestStreak + ')' : '') + '</div>'
      : '';
  }

  function pipelineFiltered() {
    const openish = q => q.status === 'open' || q.status === 'nurture';
    let list;
    switch (currentFilter) {
      case 'all':     list = quotes.filter(openish); break;
      case 'overdue': list = quotes.filter(q => openish(q) && isDue(q)); break;
      case 'fresh':   list = quotes.filter(q => q.status === 'open' && daysSince(q.sentDate) <= 7); break;
      case 'aging':   list = quotes.filter(q => q.status === 'open' && daysSince(q.sentDate) >= 8 && daysSince(q.sentDate) <= 20); break;
      case 'stale':   list = quotes.filter(q => q.status === 'open' && daysSince(q.sentDate) >= 21); break;
      case 'nurture': list = quotes.filter(q => q.status === 'nurture'); break;
      case 'won':     list = quotes.filter(q => q.status === 'won'); break;
      case 'lost':    list = quotes.filter(q => q.status === 'lost'); break;
      default:        list = quotes.filter(openish);
    }
    const sorted = list.slice();
    if (currentSort === 'next') {
      sorted.sort((a, b) => ((dueDate(a) || '9999')).localeCompare(dueDate(b) || '9999'));
    } else if (currentSort === 'oldest') {
      sorted.sort((a, b) => (a.sentDate || '').localeCompare(b.sentDate || ''));
    } else {
      sorted.sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
    }
    return sorted;
  }

  function renderPipeline() {
    const openQuotes = quotes.filter(q => q.status === 'open' || q.status === 'nurture');
    const sum = openQuotes.reduce((s, q) => s + (Number(q.amount) || 0), 0);
    $('pipeSummary').textContent = openQuotes.length
      ? openQuotes.length + ' open quote' + (openQuotes.length > 1 ? 's' : '') + ' · ' + (fmtMoney(sum) || '$0') + ' outstanding'
      : 'No open quotes yet.';

    const list = pipelineFiltered();
    $('pipelineList').innerHTML = list.map(quoteCardHTML).join('');
    $('pipelineEmpty').style.display = list.length ? 'none' : 'block';
  }

  function renderStats() {
    const won = quotes.filter(q => q.status === 'won');
    const lost = quotes.filter(q => q.status === 'lost');
    const open = quotes.filter(q => q.status === 'open' || q.status === 'nurture');
    const closed = won.length + lost.length;
    const winRate = closed ? Math.round(won.length / closed * 100) : null;
    const chasedWins = won.filter(q => (q.touches || []).length > 0);
    const chasedSum = chasedWins.reduce((s, q) => s + (Number(q.wonAmount) || Number(q.amount) || 0), 0);
    const avgTouches = chasedWins.length
      ? (chasedWins.reduce((s, q) => s + q.touches.length, 0) / chasedWins.length).toFixed(1)
      : null;
    const touched = quotes.filter(q => (q.touches || []).length > 0);
    const respRate = touched.length
      ? Math.round(quotes.filter(q => q.replied && q.touches.length > 0).length / touched.length * 100)
      : null;
    const pipeSum = open.reduce((s, q) => s + (Number(q.amount) || 0), 0);

    $('statsGrid').innerHTML =
      '<div class="stat-big hero"><div class="stat-num">' + (fmtMoney(chasedSum) || '$0') + '</div><div class="stat-lbl">Won after follow-ups — money this app chased down</div></div>' +
      '<div class="stat-big"><div class="stat-num">' + (winRate === null ? '—' : winRate + '%') + '</div><div class="stat-lbl">Win rate</div></div>' +
      '<div class="stat-big"><div class="stat-num">' + (fmtMoney(pipeSum) || '$0') + '</div><div class="stat-lbl">Open pipeline</div></div>' +
      '<div class="stat-big"><div class="stat-num">' + (avgTouches === null ? '—' : avgTouches) + '</div><div class="stat-lbl">Avg touches to close</div></div>' +
      '<div class="stat-big"><div class="stat-num">' + (respRate === null ? '—' : respRate + '%') + '</div><div class="stat-lbl">Reply rate</div></div>' +
      '<div class="stat-big"><div class="stat-num">' + stats.streak + '</div><div class="stat-lbl">Day streak</div></div>' +
      '<div class="stat-big"><div class="stat-num">' + stats.bestStreak + '</div><div class="stat-lbl">Best streak</div></div>';

    if (lost.length) {
      const counts = {};
      LOST_REASONS.forEach(r => { counts[r.key] = 0; });
      lost.forEach(q => { counts[q.lostReason] = (counts[q.lostReason] || 0) + 1; });
      const max = Math.max(...Object.values(counts), 1);
      $('lossReasons').innerHTML =
        '<h2 class="section-title">Why quotes are lost</h2><div class="card">' +
        LOST_REASONS.map(r =>
          '<div class="loss-row"><span class="loss-lbl">' + r.label + '</span>' +
          '<div class="loss-bar-wrap"><div class="loss-bar" style="width:' + Math.round(counts[r.key] / max * 100) + '%"></div></div>' +
          '<span class="loss-n">' + counts[r.key] + '</span></div>'
        ).join('') + '</div>';
    } else {
      $('lossReasons').innerHTML = '';
    }
  }

  function updateBadges() {
    const count = quotes.filter(isDue).length;
    const badge = $('dueBadge');
    badge.textContent = count;
    badge.style.display = count ? 'flex' : 'none';
    if ('setAppBadge' in navigator) {
      if (count) navigator.setAppBadge(count).catch(() => {});
      else navigator.clearAppBadge().catch(() => {});
    }
  }

  function renderAll() {
    renderToday();
    renderPipeline();
    renderStats();
    updateBadges();
  }

  // ============ CARD EVENTS (delegated) ============
  function handleListClick(e) {
    const card = e.target.closest('.lead-card');
    if (!card) return;
    const q = findQuote(card.dataset.id);
    if (!q) return;
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    switch (action) {
      case 'toggle':
        if (expanded.has(q.id)) expanded.delete(q.id);
        else expanded.add(q.id);
        card.classList.toggle('expanded');
        break;

      case 'text':
        // sms: link proceeds; remember it so we can ask "did it send?" when they come back.
        pendingTouch = { id: q.id, templateKey: textTemplateKey(q) };
        savePending();
        break;

      case 'confirm-sent': {
        const flow = flows.get(q.id);
        flows.delete(q.id);
        markTouchSent(q, (flow && flow.templateKey) || textTemplateKey(q));
        break;
      }

      case 'confirm-no':
        flows.delete(q.id);
        renderAll();
        showToast('No touch logged — it\'s still due');
        break;

      case 'won':
        flows.set(q.id, { type: 'won' });
        renderAll();
        break;

      case 'won-confirm': {
        const input = card.querySelector('.won-amount');
        setWon(q, input && input.value ? input.value : q.amount);
        break;
      }

      case 'lost':
        flows.set(q.id, { type: 'lost' });
        renderAll();
        break;

      case 'lost-reason': {
        const reason = actionEl.dataset.reason;
        if (reason === 'timing' || reason === 'ghosted') {
          flows.set(q.id, { type: 'lostConfirm', reason });
          renderAll();
        } else {
          setLost(q, reason);
        }
        break;
      }

      case 'lost-nurture':
        toNurture(q, 60, actionEl.dataset.reason);
        break;

      case 'lost-final':
        setLost(q, actionEl.dataset.reason);
        break;

      case 'snooze':
        flows.set(q.id, flows.get(q.id) && flows.get(q.id).type === 'snooze' ? null : { type: 'snooze' });
        if (!flows.get(q.id)) flows.delete(q.id);
        renderAll();
        break;

      case 'snooze-days': {
        const days = Number(actionEl.dataset.days);
        if (q.status === 'nurture') q.winbackDate = addDaysStr(days);
        else q.nextTouchDate = addDaysStr(days);
        flows.delete(q.id);
        saveQuotes();
        renderAll();
        showToast('Snoozed to ' + prettyDate(addDaysStr(days)));
        break;
      }

      case 'skip-step':
        q.stepIndex++;
        if (q.stepIndex < CADENCE.length) {
          scheduleStep(q);
          showToast('Skipped — next: ' + CADENCE[q.stepIndex].label + ' ' + prettyDate(q.nextTouchDate));
        } else {
          q.status = 'nurture';
          q.nextTouchDate = '';
          q.winbackDate = addDaysStr(60);
          showToast('Sequence complete — moved to Win-Back');
        }
        saveQuotes();
        renderAll();
        break;

      case 'toggle-replied':
        q.replied = !q.replied;
        saveQuotes();
        renderAll();
        break;

      case 'toggle-commercial':
        q.isCommercial = !q.isCommercial;
        saveQuotes();
        renderAll();
        break;

      case 'copy-msg':
        copyText(fillTemplate(textTemplateKey(q), q), 'Message copied — paste it into any app');
        break;

      case 'copy-address':
        if (q.address) copyText(q.address, 'Address copied');
        else showToast('No address on this quote');
        break;

      case 'restore':
        restoreQuote(q);
        break;

      case 'delete':
        if (confirm('Delete ' + displayName(q) + '? This cannot be undone.')) {
          quotes = quotes.filter(x => x.id !== q.id);
          expanded.delete(q.id);
          flows.delete(q.id);
          saveQuotes();
          renderAll();
          showToast('Quote deleted');
        }
        break;
    }
  }

  function handleListChange(e) {
    const card = e.target.closest('.lead-card');
    const field = e.target.dataset.field;
    if (!card || !field) return;
    const q = findQuote(card.dataset.id);
    if (!q) return;
    q[field] = e.target.value;
    saveQuotes();
    if (field !== 'notes') {
      renderAll();
      showToast('Saved');
    }
  }

  ['todayList', 'pipelineList'].forEach(id => {
    $(id).addEventListener('click', handleListClick);
    $(id).addEventListener('change', handleListChange);
  });

  // When they come back from the texting app, ask whether the touch went out.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !pendingTouch) return;
    const q = findQuote(pendingTouch.id);
    if (q) {
      flows.set(q.id, { type: 'confirm', templateKey: pendingTouch.templateKey });
      renderAll();
    }
    pendingTouch = null;
    savePending();
  });

  // Filter chips + sort
  $('filterChips').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    currentFilter = chip.dataset.filter;
    document.querySelectorAll('#filterChips .chip').forEach(c =>
      c.classList.toggle('active', c === chip));
    renderPipeline();
  });

  $('sortSeg').addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    currentSort = btn.dataset.sort;
    document.querySelectorAll('#sortSeg .seg-btn').forEach(b =>
      b.classList.toggle('active', b === btn));
    renderPipeline();
  });

  // ============ ADD QUOTE FORM ============
  let addService = '';
  $('serviceChips').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const val = chip.dataset.value;
    addService = addService === val ? '' : val;
    document.querySelectorAll('#serviceChips .chip').forEach(c =>
      c.classList.toggle('active', c.dataset.value === addService));
  });

  function buildQuoteFromForm() {
    const phone = $('qPhone').value.trim();
    if (!phone) { showToast('Enter a phone number'); return null; }
    const q = {
      id: uid(),
      createdAt: Date.now(),
      name: $('qName').value.trim(),
      phone,
      address: $('qAddress').value.trim(),
      service: addService,
      amount: $('qAmount').value.trim(),
      notes: $('qNotes').value.trim(),
      sentDate: $('qSentDate').value || todayStr(),
      status: 'open',
      stepIndex: 0,
      nextTouchDate: '',
      touches: [],
      replied: false,
      isCommercial: addService === 'Commercial',
      wonAmount: null, wonAt: null,
      lostAt: null, lostReason: '',
      winbackDate: '',
      winbackCount: 0,
      source: 'manual'
    };
    initStepFromAge(q);
    return q;
  }

  function resetForm() {
    ['qName', 'qPhone', 'qAmount', 'qAddress', 'qNotes'].forEach(id => { $(id).value = ''; });
    $('qSentDate').value = todayStr();
    addService = '';
    document.querySelectorAll('#serviceChips .chip').forEach(c => c.classList.remove('active'));
  }

  function pruneQuotes() {
    if (quotes.length <= MAX_QUOTES) return;
    // Drop oldest closed quotes first; never silently drop open pipeline.
    const closed = quotes.filter(q => q.status === 'won' || q.status === 'lost')
      .sort((a, b) => a.createdAt - b.createdAt);
    while (quotes.length > MAX_QUOTES && closed.length) {
      const drop = closed.shift();
      quotes = quotes.filter(q => q.id !== drop.id);
    }
  }

  function addQuote(q) {
    quotes.unshift(q);
    pruneQuotes();
    saveQuotes();
    resetForm();
    renderAll();
  }

  $('saveBtn').addEventListener('click', () => {
    const q = buildQuoteFromForm();
    if (!q) return;
    addQuote(q);
    switchTab('today');
    showToast('Quote saved — ' + (isDue(q) ? 'its next touch is due now' : 'next touch ' + prettyDate(q.nextTouchDate)));
  });

  $('saveTextBtn').addEventListener('click', () => {
    const q = buildQuoteFromForm();
    if (!q) return;
    const tplKey = textTemplateKey(q);
    const href = smsHref(q, tplKey);
    addQuote(q);
    pendingTouch = { id: q.id, templateKey: tplKey };
    savePending();
    switchTab('today');
    showToast('Saved — opening your texting app');
    setTimeout(() => { window.location.href = href; }, 400);
  });

  // ============ CSV IMPORT (QuoteIQ) ============
  const CSV_FIELDS = [
    { key: 'name',     label: 'Name',      aliases: ['customername', 'clientname', 'contactname', 'customer', 'client', 'fullname', 'name', 'billto'] },
    { key: 'phone',    label: 'Phone',     aliases: ['phonenumber', 'phone', 'mobilephone', 'mobile', 'cellphone', 'cell', 'contactphone', 'primaryphone'] },
    { key: 'amount',   label: 'Quote $',   aliases: ['estimatetotal', 'quotetotal', 'grandtotal', 'totalamount', 'total', 'amount', 'price', 'estimateamount'] },
    { key: 'service',  label: 'Service',   aliases: ['servicename', 'services', 'service', 'jobtype', 'estimatename', 'projectname', 'description', 'title', 'lineitems'] },
    { key: 'sentDate', label: 'Date sent', aliases: ['datesent', 'sentdate', 'estimatedate', 'quotedate', 'createddate', 'datecreated', 'created', 'issuedate', 'date'] },
    { key: 'address',  label: 'Address',   aliases: ['jobaddress', 'serviceaddress', 'propertyaddress', 'siteaddress', 'address', 'street', 'address1'] },
    { key: 'status',   label: 'Status',    aliases: ['estimatestatus', 'quotestatus', 'status'] }
  ];
  const CLOSED_STATUSES = ['accepted', 'approved', 'won', 'invoiced', 'scheduled', 'converted', 'declined', 'rejected', 'archived'];

  let csvData = null; // { headers, rows }

  function parseCSV(text) {
    // RFC-4180-ish: quoted fields, embedded commas/newlines, "" escapes, CRLF, BOM.
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field); field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.length > 1 || row[0].trim() !== '') rows.push(row);
        row = [];
      } else field += c;
    }
    row.push(field);
    if (row.length > 1 || row[0].trim() !== '') rows.push(row);
    if (!rows.length) return null;
    return { headers: rows[0].map(h => h.trim()), rows: rows.slice(1) };
  }

  function normHeader(h) { return String(h).toLowerCase().replace(/[^a-z0-9]/g, ''); }

  function guessMapping(headers) {
    const norm = headers.map(normHeader);
    const map = {};
    CSV_FIELDS.forEach(f => {
      let idx = -1;
      for (const alias of f.aliases) {
        idx = norm.indexOf(alias);
        if (idx >= 0) break;
      }
      if (idx < 0) {
        // second pass: substring match
        for (const alias of f.aliases) {
          idx = norm.findIndex(h => h.includes(alias));
          if (idx >= 0) break;
        }
      }
      map[f.key] = idx;
    });
    // Synthesize name from first+last if no single column matched.
    if (map.name < 0) {
      const fi = norm.indexOf('firstname'), la = norm.indexOf('lastname');
      if (fi >= 0) { map.name = fi; map._lastName = la; }
    }
    return map;
  }

  function parseCsvDate(v) {
    const s = String(v || '').trim();
    if (!s) return '';
    let d;
    const mdy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (mdy) {
      let yr = Number(mdy[3]);
      if (yr < 100) yr += 2000;
      d = new Date(yr, Number(mdy[1]) - 1, Number(mdy[2]));
    } else {
      const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
      else d = new Date(s);
    }
    if (!d || isNaN(d.getTime())) return '';
    return dateStr(d);
  }

  function renderMappingUI() {
    const { headers } = csvData;
    const map = guessMapping(headers);
    const options = sel => '<option value="-1">— skip —</option>' +
      headers.map((h, i) => '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + esc(h) + '</option>').join('');

    $('mapCard').innerHTML =
      '<div class="detail-label">Match the columns</div>' +
      CSV_FIELDS.map(f =>
        '<div class="map-row"><label>' + f.label + (f.key === 'phone' ? ' *' : '') + '</label>' +
        '<select data-map="' + f.key + '">' + options(map[f.key]) + '</select></div>'
      ).join('') +
      '<div id="mapPreview"></div>' +
      '<label class="import-check" id="skipClosedWrap" style="display:none">' +
        '<input type="checkbox" id="skipClosed" checked> Skip quotes already accepted / declined' +
      '</label>' +
      '<button type="button" id="runImportBtn" class="btn-primary">Import These Quotes</button>' +
      '<button type="button" id="cancelImportBtn" class="btn-outline">Cancel</button>';
    $('mapCard').style.display = 'block';
    $('importSummary').style.display = 'none';
    updateMapPreview();

    $('runImportBtn').addEventListener('click', runImport);
    $('cancelImportBtn').addEventListener('click', () => {
      csvData = null;
      $('mapCard').style.display = 'none';
      $('csvFile').value = '';
    });
  }

  // Delegated once — the mapping card's contents are re-rendered per file.
  $('mapCard').addEventListener('change', e => {
    if (e.target.matches('select[data-map]')) updateMapPreview();
  });

  function readMapping() {
    const map = {};
    document.querySelectorAll('#mapCard select[data-map]').forEach(sel => {
      map[sel.dataset.map] = Number(sel.value);
    });
    return map;
  }

  function updateMapPreview() {
    const map = readMapping();
    const rows = csvData.rows.slice(0, 3);
    const cells = f => rows.map(r => map[f.key] >= 0 ? (r[map[f.key]] || '') : '');
    const mapped = CSV_FIELDS.filter(f => map[f.key] >= 0);
    $('mapPreview').innerHTML = mapped.length
      ? '<div class="preview-wrap"><table class="preview-table"><tr>' +
        mapped.map(f => '<th>' + f.label + '</th>').join('') + '</tr>' +
        rows.map((r, i) => '<tr>' + mapped.map(f => '<td>' + esc((cells(f)[i] || '').slice(0, 28)) + '</td>').join('') + '</tr>').join('') +
        '</table></div>'
      : '';
    $('skipClosedWrap').style.display = map.status >= 0 ? 'flex' : 'none';
  }

  function runImport() {
    const map = readMapping();
    if (map.phone < 0) { showToast('Pick which column has the phone number'); return; }
    const skipClosed = map.status >= 0 && $('skipClosed').checked;
    const existing = new Set(quotes.map(q => phoneKey(q.phone)).filter(Boolean));
    const get = (row, key) => map[key] >= 0 ? String(row[map[key]] || '').trim() : '';

    let added = 0, dupes = 0, noPhone = 0, closed = 0, badDates = 0;
    csvData.rows.forEach(row => {
      const phone = get(row, 'phone');
      if (!phoneKey(phone)) { noPhone++; return; }
      if (existing.has(phoneKey(phone))) { dupes++; return; }
      if (skipClosed) {
        const st = get(row, 'status').toLowerCase();
        if (CLOSED_STATUSES.some(s => st.includes(s))) { closed++; return; }
      }
      let sent = parseCsvDate(get(row, 'sentDate'));
      if (!sent) { sent = todayStr(); if (map.sentDate >= 0) badDates++; }
      const q = {
        id: uid(),
        createdAt: Date.now(),
        name: get(row, 'name'),
        phone,
        address: get(row, 'address'),
        service: get(row, 'service').slice(0, 60),
        amount: get(row, 'amount').replace(/[$,]/g, ''),
        notes: '',
        sentDate: sent,
        status: 'open',
        stepIndex: 0,
        nextTouchDate: '',
        touches: [],
        replied: false,
        isCommercial: false,
        wonAmount: null, wonAt: null,
        lostAt: null, lostReason: '',
        winbackDate: '',
        winbackCount: 0,
        source: 'csv'
      };
      initStepFromAge(q);
      quotes.unshift(q);
      existing.add(phoneKey(phone));
      added++;
    });

    pruneQuotes();
    saveQuotes();
    renderAll();
    csvData = null;
    $('mapCard').style.display = 'none';
    $('csvFile').value = '';
    const bits = ['Imported ' + added];
    if (dupes) bits.push(dupes + ' duplicate' + (dupes > 1 ? 's' : '') + ' skipped');
    if (closed) bits.push(closed + ' already closed skipped');
    if (noPhone) bits.push(noPhone + ' with no phone skipped');
    if (badDates) bits.push(badDates + ' unreadable date' + (badDates > 1 ? 's' : '') + ' set to today');
    $('importSummary').innerHTML = '<div class="import-summary-card">' + bits.join(' · ') + '</div>';
    $('importSummary').style.display = 'block';
    if (added) { switchTab('today'); showToast(added + ' quotes in — clear that due list'); }
  }

  $('csvFile').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      csvData = parseCSV(String(reader.result || ''));
      if (!csvData || !csvData.rows.length) {
        showToast('Could not read any rows from that file');
        $('csvFile').value = '';
        return;
      }
      renderMappingUI();
    };
    reader.onerror = () => showToast('Could not read the file');
    reader.readAsText(file);
  });

  // ============ BACKUP ============
  $('exportBtn').addEventListener('click', () => {
    const payload = { version: 1, app: 'splash-quote-followup', exportedAt: new Date().toISOString(), quotes, templates, settings, stats };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'splash-followup-backup-' + todayStr() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Backup downloaded — keep it somewhere safe');
  });

  $('restoreFile').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(String(reader.result || '')); }
      catch (err) { showToast('That file isn\'t a valid backup'); return; }
      if (!data || !Array.isArray(data.quotes)) { showToast('That file isn\'t a valid backup'); return; }
      const replace = quotes.length === 0 ||
        confirm('Backup has ' + data.quotes.length + ' quotes.\n\nOK = replace everything with the backup.\nCancel = merge (keep current data, add missing quotes by phone number).');
      if (replace) {
        quotes = data.quotes;
        if (data.templates) templates = Object.assign(defaultTemplates(), data.templates);
        if (data.settings) settings = Object.assign(settings, data.settings);
        if (data.stats) stats = Object.assign(stats, data.stats);
      } else {
        const existing = new Set(quotes.map(q => phoneKey(q.phone)).filter(Boolean));
        data.quotes.forEach(q => {
          if (!existing.has(phoneKey(q.phone))) { quotes.push(q); existing.add(phoneKey(q.phone)); }
        });
      }
      pruneQuotes();
      saveQuotes(); saveTemplates(); saveSettings(); saveStats();
      loadSettingsForm();
      renderTemplates();
      renderAll();
      $('restoreFile').value = '';
      showToast(replace ? 'Backup restored' : 'Backup merged in');
    };
    reader.readAsText(file);
  });

  // ============ TEMPLATES & SETTINGS ============
  function renderTemplates() {
    let lastGroup = '';
    $('templateCards').innerHTML = TEMPLATE_DEFS.map(def => {
      const header = def.group !== lastGroup
        ? `<h3 class="tpl-group">${def.group}</h3>` : '';
      lastGroup = def.group;
      return header + `
      <div class="card template-card" data-key="${def.key}">
        <div class="tpl-head">
          <span class="tpl-name">${def.name}</span>
          <button type="button" class="tpl-copy">Copy</button>
        </div>
        <textarea rows="3">${esc(templates[def.key])}</textarea>
      </div>`;
    }).join('');
  }

  $('templateCards').addEventListener('input', e => {
    const card = e.target.closest('.template-card');
    if (!card || e.target.tagName !== 'TEXTAREA') return;
    templates[card.dataset.key] = e.target.value;
    saveTemplates();
  });

  $('templateCards').addEventListener('click', e => {
    if (!e.target.classList.contains('tpl-copy')) return;
    const card = e.target.closest('.template-card');
    copyText(templates[card.dataset.key], 'Template copied');
  });

  $('resetTemplatesBtn').addEventListener('click', () => {
    if (!confirm('Reset all templates to the built-in defaults?')) return;
    templates = defaultTemplates();
    saveTemplates();
    renderTemplates();
    showToast('Templates reset');
  });

  function loadSettingsForm() {
    $('setOwner').value = settings.owner;
    $('setCompany').value = settings.company;
    $('setReviewLink').value = settings.reviewLink;
  }

  $('saveSettingsBtn').addEventListener('click', () => {
    settings.owner = $('setOwner').value.trim();
    settings.company = $('setCompany').value.trim() || 'Splash Pressure Washing';
    settings.reviewLink = $('setReviewLink').value.trim();
    saveSettings();
    showToast('Info saved — every template uses it');
  });

  // ============ TAB NAV ============
  function switchTab(name) {
    document.querySelectorAll('.tab-panel').forEach(p =>
      p.classList.toggle('active', p.id === 'tab-' + name));
    document.querySelectorAll('.nav-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === name));
    window.scrollTo(0, 0);
  }

  document.querySelectorAll('.nav-btn').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  // ============ PWA INSTALL ============
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'block';
  });
  installBtn.addEventListener('click', () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      deferredPrompt = null;
      installBtn.style.display = 'none';
    });
  });

  // ============ SERVICE WORKER ============
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  // ============ INIT ============
  $('qSentDate').value = todayStr();
  // A touch left pending from a previous visit (e.g., the SMS app killed the page):
  // surface the confirm strip instead of losing it.
  if (pendingTouch) {
    const q = findQuote(pendingTouch.id);
    if (q) flows.set(q.id, { type: 'confirm', templateKey: pendingTouch.templateKey });
    pendingTouch = null;
    savePending();
  }
  loadSettingsForm();
  renderTemplates();
  renderAll();
})();
