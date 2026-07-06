(function () {
  'use strict';

  // ============ DOM REFS ============
  const $ = id => document.getElementById(id);
  const toastEl = $('toast');
  const installBtn = $('installBtn');

  // ============ STORAGE KEYS ============
  const LS_LEADS = 'splash_lt_leads';
  const LS_TEMPLATES = 'splash_lt_templates';
  const LS_SETTINGS = 'splash_lt_settings';
  const MAX_LEADS = 200;

  // ============ STATUS / TEMPLATE DEFS ============
  const STATUSES = [
    { key: 'new',       label: 'New' },
    { key: 'contacted', label: 'Contacted' },
    { key: 'quoted',    label: 'Quoted' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'done',      label: 'Done' },
    { key: 'lost',      label: 'Lost' }
  ];
  const ACTIVE_STATUSES = ['new', 'contacted', 'quoted', 'scheduled'];

  const SOURCE_LABELS = {
    'lsa-call': 'LSA Call',
    'lsa-message': 'LSA Message',
    'other': 'Other'
  };

  const TEMPLATE_DEFS = [
    {
      key: 'first_call', name: 'First response — call lead',
      text: "Hi {name}, this is {owner} with {company} — great talking with you! I'll get your free quote for {service} over shortly. Any photos of the area you can text me will help me price it fast."
    },
    {
      key: 'first_msg', name: 'First response — message lead',
      text: "Hi {name}, this is {owner} with {company} — thanks for reaching out on Google! I'd love to get you a fast free quote for {service}. What's the property address, and is there a good time to call?"
    },
    {
      key: 'after_hours', name: 'After-hours reply',
      text: "Hi {name}, this is {owner} with {company}. Sorry we missed you — we're finishing up jobs for the day. You're first on my list in the morning. If you can text me the address and what you'd like cleaned, I'll have a quote ready first thing."
    },
    {
      key: 'check_in', name: 'No-reply check-in',
      text: "Hi {name}, {owner} with {company} again — just making sure my last message reached you. Still happy to get you a free quote for {service} whenever you're ready."
    },
    {
      key: 'quote_bump', name: 'Quote follow-up',
      text: "Hi {name}, {owner} with {company} here. Just checking in on the quote I sent for {service} — happy to answer any questions or adjust anything. Our schedule is filling up, so I wanted to make sure we can hold a spot for you."
    },
    {
      key: 'schedule_confirm', name: 'Booking confirmation',
      text: "Hi {name}, you're on the schedule with {company} for {service}. We'll text you the day before as a reminder. Thanks for choosing us!"
    },
    {
      key: 'day_before', name: 'Day-before reminder',
      text: "Hi {name}, {owner} with {company} — friendly reminder we'll be out tomorrow for {service}. No need to do anything ahead of time; just make sure we can reach the areas being cleaned. See you then!"
    },
    {
      key: 'review_request', name: 'Review request',
      text: "Hi {name}, thanks again for letting {company} take care of your {service}! If you were happy with the work, a quick Google review would mean the world to a small local business like ours: {review_link}"
    }
  ];

  // Which template the Text button reaches for at each pipeline stage.
  function templateKeyFor(lead) {
    switch (lead.status) {
      case 'new':       return lead.source === 'lsa-message' ? 'first_msg' : 'first_call';
      case 'contacted': return 'check_in';
      case 'quoted':    return 'quote_bump';
      case 'scheduled': return 'day_before';
      default:          return 'review_request';
    }
  }

  // ============ STATE ============
  let leads = loadJSON(LS_LEADS, []);
  let templates = Object.assign(defaultTemplates(), loadJSON(LS_TEMPLATES, {}));
  let settings = Object.assign(
    { owner: '', company: 'Splash Pressure Washing', reviewLink: '' },
    loadJSON(LS_SETTINGS, {})
  );
  let currentFilter = 'all';
  const expanded = new Set();

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
  function saveLeads()     { localStorage.setItem(LS_LEADS, JSON.stringify(leads)); }
  function saveTemplates() { localStorage.setItem(LS_TEMPLATES, JSON.stringify(templates)); }
  function saveSettings()  { localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); }

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

  function timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return m + ' min ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' hr' + (h > 1 ? 's' : '') + ' ago';
    const d = Math.floor(h / 24);
    return d + ' day' + (d > 1 ? 's' : '') + ' ago';
  }

  // Local-time YYYY-MM-DD (leads and follow-ups live in the owner's day, not UTC).
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
  function prettyDate(ymd) {
    if (!ymd) return '';
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function isDue(lead) {
    return ACTIVE_STATUSES.includes(lead.status) &&
           lead.nextFollowUpAt && lead.nextFollowUpAt <= todayStr();
  }

  function findLead(id) { return leads.find(l => l.id === id); }

  function cleanPhone(phone) {
    const p = String(phone || '').trim();
    return (p.startsWith('+') ? '+' : '') + p.replace(/\D/g, '');
  }

  function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || 'there'; }

  function serviceText(lead) {
    return (lead.services && lead.services.length)
      ? lead.services.join(', ').toLowerCase()
      : 'pressure washing';
  }

  function fillTemplate(key, lead) {
    return (templates[key] || '')
      .replace(/\{name\}/g, firstName(lead.name))
      .replace(/\{service\}/g, serviceText(lead))
      .replace(/\{company\}/g, settings.company || 'Splash Pressure Washing')
      .replace(/\{owner\}/g, settings.owner || 'the owner')
      .replace(/\{review_link\}/g, settings.reviewLink || '');
  }

  function smsHref(lead, templateKey) {
    return 'sms:' + cleanPhone(lead.phone) + '?body=' +
           encodeURIComponent(fillTemplate(templateKey, lead));
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

  // Editable auto-suggestion so the lead never falls off the due list.
  function suggestFollowUp(status, lead) {
    switch (status) {
      case 'new':       return todayStr();          // uncontacted = due right now
      case 'contacted': return addDaysStr(1);
      case 'quoted':    return addDaysStr(3);
      case 'scheduled': return lead.scheduledDate || addDaysStr(7);
      case 'done':      return addDaysStr(1);       // review-request nudge
      default:          return '';                  // lost — nothing due
    }
  }

  function setStatus(lead, status) {
    if (lead.status === status) return;
    lead.status = status;
    lead.statusHistory.push({ status, at: Date.now() });
    lead.nextFollowUpAt = suggestFollowUp(status, lead);
    saveLeads();
    renderAll();
    const label = STATUSES.find(s => s.key === status).label;
    showToast(firstName(lead.name) + ' → ' + label +
      (lead.nextFollowUpAt ? ' · follow up ' + prettyDate(lead.nextFollowUpAt) : ''));
  }

  // ============ LEAD CARD RENDERING ============
  function leadCardHTML(lead) {
    const due = isDue(lead);
    const status = STATUSES.find(s => s.key === lead.status) || STATUSES[0];
    const isExpanded = expanded.has(lead.id);
    const active = ACTIVE_STATUSES.includes(lead.status);

    const metaBits = [];
    if (due) metaBits.push('<span class="due-flag">Follow up due</span>');
    else if (lead.nextFollowUpAt && active) metaBits.push('Follow up ' + esc(prettyDate(lead.nextFollowUpAt)));
    metaBits.push(esc(SOURCE_LABELS[lead.source] || 'Other'));
    metaBits.push(esc(timeAgo(lead.createdAt)));

    const statusBtns = STATUSES.map(s =>
      `<button type="button" class="chip${s.key === lead.status ? ' active' : ''}" data-action="status" data-status="${s.key}">${s.label}</button>`
    ).join('');

    const textLabel = lead.status === 'done' || lead.status === 'lost' ? 'Text' :
      { new: 'Send First Text', contacted: 'Send Check-In', quoted: 'Send Quote Bump', scheduled: 'Send Reminder' }[lead.status];

    return `
      <div class="lead-card s-${lead.status}${due ? ' overdue' : ''}${isExpanded ? ' expanded' : ''}" data-id="${lead.id}">
        <div class="lead-summary" data-action="toggle" role="button" tabindex="0">
          <div class="lead-main">
            <div class="lead-name">${esc(lead.name)}</div>
            <div class="lead-meta">${metaBits.join(' &middot; ')}</div>
          </div>
          <span class="status-chip s-${lead.status}">${status.label}</span>
          <span class="lead-chevron">&#9662;</span>
        </div>
        <div class="lead-detail">
          <div class="detail-row"><span class="dl">Phone:</span> ${esc(lead.phone)}</div>
          ${lead.address ? `<div class="detail-row"><span class="dl">Address:</span> ${esc(lead.address)}</div>` : ''}
          ${lead.services && lead.services.length ? `<div class="detail-row"><span class="dl">Services:</span> ${esc(lead.services.join(', '))}</div>` : ''}
          ${lead.quoteAmount ? `<div class="detail-row"><span class="dl">Quote:</span> $${esc(lead.quoteAmount)}</div>` : ''}
          ${lead.reviewRequestedAt ? `<div class="review-stamp">&#10003; Review requested ${esc(timeAgo(lead.reviewRequestedAt))}</div>` : ''}

          <div class="detail-label">Status</div>
          <div class="status-btns">${statusBtns}</div>

          <div class="detail-label">Actions</div>
          <div class="action-btns">
            <a class="action-btn a-text" data-action="text" href="${smsHref(lead, templateKeyFor(lead))}">&#128172; ${textLabel}</a>
            <a class="action-btn a-call" data-action="call" href="tel:${cleanPhone(lead.phone)}">&#128222; Call</a>
            <button type="button" class="action-btn a-copy" data-action="copy-address">&#128203; Copy Address</button>
            <a class="action-btn a-review" data-action="review" href="${smsHref(lead, 'review_request')}">&#11088; Ask for Review</a>
          </div>

          <div class="detail-label">Dates &amp; Quote</div>
          <div class="detail-fields">
            <div class="form-group">
              <label>Follow up on</label>
              <input type="date" data-field="nextFollowUpAt" value="${esc(lead.nextFollowUpAt || '')}">
            </div>
            <div class="form-group">
              <label>Job date</label>
              <input type="date" data-field="scheduledDate" value="${esc(lead.scheduledDate || '')}">
            </div>
            <div class="form-group">
              <label>Quote $</label>
              <input type="number" inputmode="decimal" data-field="quoteAmount" value="${esc(lead.quoteAmount || '')}" placeholder="0">
            </div>
          </div>

          <div class="detail-label">Notes</div>
          <div class="detail-notes">
            <textarea rows="2" data-field="notes" placeholder="Notes...">${esc(lead.notes || '')}</textarea>
          </div>

          <div class="detail-footer">
            ${active ? '' : '<button type="button" class="mini-btn" data-action="restore">Restore to Pipeline</button>'}
            <button type="button" class="mini-btn danger" data-action="delete">Delete</button>
          </div>
        </div>
      </div>`;
  }

  function renderLeads() {
    const activeLeads = leads.filter(l => ACTIVE_STATUSES.includes(l.status));
    const dueLeads = activeLeads
      .filter(isDue)
      .sort((a, b) => (a.nextFollowUpAt || '').localeCompare(b.nextFollowUpAt || ''));

    const dueSection = $('dueSection');
    if (dueLeads.length) {
      dueSection.style.display = 'block';
      $('dueList').innerHTML = dueLeads.map(leadCardHTML).join('');
    } else {
      dueSection.style.display = 'none';
      $('dueList').innerHTML = '';
    }

    const rest = activeLeads
      .filter(l => !isDue(l) && (currentFilter === 'all' || l.status === currentFilter))
      .sort((a, b) => b.createdAt - a.createdAt);
    $('leadList').innerHTML = rest.map(leadCardHTML).join('');
    $('leadsEmpty').style.display = activeLeads.length ? 'none' : 'block';
  }

  function renderDone() {
    const doneLeads = leads
      .filter(l => !ACTIVE_STATUSES.includes(l.status))
      .sort((a, b) => b.createdAt - a.createdAt);
    $('doneList').innerHTML = doneLeads.map(leadCardHTML).join('');
    $('doneEmpty').style.display = doneLeads.length ? 'none' : 'block';
  }

  function updateDueBadge() {
    const count = leads.filter(isDue).length;
    const badge = $('dueBadge');
    badge.textContent = count;
    badge.style.display = count ? 'flex' : 'none';
  }

  function renderAll() {
    renderLeads();
    renderDone();
    updateDueBadge();
  }

  // ============ LEAD LIST EVENTS (delegated) ============
  function handleListClick(e) {
    const card = e.target.closest('.lead-card');
    if (!card) return;
    const lead = findLead(card.dataset.id);
    if (!lead) return;
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    switch (action) {
      case 'toggle':
        if (expanded.has(lead.id)) expanded.delete(lead.id);
        else expanded.add(lead.id);
        card.classList.toggle('expanded');
        break;

      case 'status':
        setStatus(lead, actionEl.dataset.status);
        break;

      case 'text':
        // sms: link proceeds; advance a fresh lead so the pipeline reflects reality.
        if (lead.status === 'new') setTimeout(() => setStatus(lead, 'contacted'), 300);
        break;

      case 'review':
        lead.reviewRequestedAt = Date.now();
        saveLeads();
        setTimeout(renderAll, 300);
        break;

      case 'copy-address':
        if (lead.address) copyText(lead.address, 'Address copied — paste it into the Pricing Agent');
        else showToast('No address on this lead');
        break;

      case 'restore':
        setStatus(lead, 'contacted');
        showToast(firstName(lead.name) + ' is back in the pipeline');
        break;

      case 'delete':
        if (confirm('Delete ' + lead.name + '? This cannot be undone.')) {
          leads = leads.filter(l => l.id !== lead.id);
          expanded.delete(lead.id);
          saveLeads();
          renderAll();
          showToast('Lead deleted');
        }
        break;
    }
  }

  function handleListChange(e) {
    const card = e.target.closest('.lead-card');
    const field = e.target.dataset.field;
    if (!card || !field) return;
    const lead = findLead(card.dataset.id);
    if (!lead) return;
    lead[field] = e.target.value;
    saveLeads();
    if (field === 'nextFollowUpAt' || field === 'scheduledDate') {
      renderAll();
      showToast('Saved');
    }
  }

  ['dueList', 'leadList', 'doneList'].forEach(id => {
    $(id).addEventListener('click', handleListClick);
    $(id).addEventListener('change', handleListChange);
  });

  // Filter chips
  $('filterChips').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    currentFilter = chip.dataset.filter;
    document.querySelectorAll('#filterChips .chip').forEach(c =>
      c.classList.toggle('active', c === chip));
    renderLeads();
  });

  // ============ NEW LEAD FORM ============
  let newLeadSource = 'lsa-call';
  const newLeadServices = new Set();

  $('leadSource').addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    newLeadSource = btn.dataset.value;
    document.querySelectorAll('#leadSource .seg-btn').forEach(b =>
      b.classList.toggle('active', b === btn));
  });

  $('leadServices').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const val = chip.dataset.value;
    if (newLeadServices.has(val)) newLeadServices.delete(val);
    else newLeadServices.add(val);
    chip.classList.toggle('active');
  });

  function buildLeadFromForm() {
    const name = $('leadName').value.trim();
    const phone = $('leadPhone').value.trim();
    if (!name) { showToast('Enter the customer\'s name'); return null; }
    if (!phone) { showToast('Enter a phone number'); return null; }
    return {
      id: uid(),
      createdAt: Date.now(),
      name,
      phone,
      address: $('leadAddress').value.trim(),
      source: newLeadSource,
      services: [...newLeadServices],
      notes: $('leadNotes').value.trim(),
      status: 'new',
      statusHistory: [{ status: 'new', at: Date.now() }],
      quoteAmount: '',
      scheduledDate: '',
      nextFollowUpAt: todayStr(),
      reviewRequestedAt: null
    };
  }

  function resetForm() {
    ['leadName', 'leadPhone', 'leadAddress', 'leadNotes'].forEach(id => { $(id).value = ''; });
    newLeadServices.clear();
    document.querySelectorAll('#leadServices .chip').forEach(c => c.classList.remove('active'));
  }

  function addLead(lead) {
    leads.unshift(lead);
    if (leads.length > MAX_LEADS) leads = leads.slice(0, MAX_LEADS);
    saveLeads();
    resetForm();
    renderAll();
  }

  $('saveBtn').addEventListener('click', () => {
    const lead = buildLeadFromForm();
    if (!lead) return;
    addLead(lead);
    switchTab('leads');
    showToast('Lead saved — it\'s due for a first text now');
  });

  $('saveTextBtn').addEventListener('click', () => {
    const lead = buildLeadFromForm();
    if (!lead) return;
    const href = smsHref(lead, templateKeyFor(lead)); // picks the first-response template while status is 'new'
    lead.status = 'contacted';
    lead.statusHistory.push({ status: 'contacted', at: Date.now() });
    lead.nextFollowUpAt = addDaysStr(1);
    addLead(lead);
    switchTab('leads');
    showToast('Saved — opening your texting app');
    setTimeout(() => { window.location.href = href; }, 400);
  });

  // ============ TEMPLATES & SETTINGS ============
  function renderTemplates() {
    $('templateCards').innerHTML = TEMPLATE_DEFS.map(def => `
      <div class="card template-card" data-key="${def.key}">
        <div class="tpl-head">
          <span class="tpl-name">${def.name}</span>
          <button type="button" class="tpl-copy">Copy</button>
        </div>
        <textarea rows="3">${esc(templates[def.key])}</textarea>
      </div>`).join('');
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
    showToast('Info saved — templates will use it');
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
  loadSettingsForm();
  renderTemplates();
  renderAll();
})();
