(function () {
  'use strict';

  const STORAGE_KEY = 'splash_pw_quotes';
  const DRAFT_KEY = 'splash_pw_current_draft';

  // --- DOM refs ---
  const tabPanels = document.querySelectorAll('.tab-panel');
  const navBtns = document.querySelectorAll('.nav-btn');
  const serviceChecks = document.querySelectorAll('.service-check');
  const saveBtn = document.getElementById('saveBtn');
  const newQuoteBtn = document.getElementById('newQuoteBtn');
  const savedList = document.getElementById('savedList');
  const emptyMsg = document.getElementById('emptyMsg');
  const toast = document.getElementById('toast');
  const installBtn = document.getElementById('installBtn');
  const detailModal = document.getElementById('detailModal');
  const modalClose = document.getElementById('modalClose');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const specialCareToggle = document.getElementById('chk-specialCare');
  const specialCareWrap = document.getElementById('specialCareWrap');
  const phoneInput = document.getElementById('phone');

  let deferredPrompt = null;
  let draftTimer = null;

  // --- Tab Navigation ---
  function switchTab(tabName) {
    tabPanels.forEach(p => p.classList.remove('active'));
    navBtns.forEach(b => b.classList.remove('active'));
    const panel = document.getElementById('tab-' + tabName);
    if (panel) panel.classList.add('active');
    const btn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
    if (btn) btn.classList.add('active');
    if (tabName === 'saved') renderSavedQuotes();
  }

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // --- Service Card Expand/Collapse ---
  serviceChecks.forEach(chk => {
    chk.addEventListener('change', () => {
      const card = chk.closest('.service-card');
      if (chk.checked) {
        card.classList.add('expanded');
      } else {
        card.classList.remove('expanded');
      }
      scheduleDraftSave();
    });
  });

  // --- Special Care Toggle ---
  specialCareToggle.addEventListener('change', () => {
    specialCareWrap.style.display = specialCareToggle.checked ? 'block' : 'none';
    scheduleDraftSave();
  });

  // --- Phone Formatting ---
  phoneInput.addEventListener('input', () => {
    let digits = phoneInput.value.replace(/\D/g, '');
    if (digits.length > 10) digits = digits.slice(0, 10);
    if (digits.length >= 7) {
      phoneInput.value = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length >= 4) {
      phoneInput.value = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else if (digits.length > 0) {
      phoneInput.value = `(${digits}`;
    }
  });

  // --- Collect Form Data ---
  function collectFormData() {
    return {
      id: 'q_' + Date.now(),
      createdAt: new Date().toISOString(),
      customer: {
        fullName: document.getElementById('fullName').value.trim(),
        address: document.getElementById('address').value.trim(),
        squareFeet: document.getElementById('homeSqft').value,
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim()
      },
      services: {
        houseWash: {
          selected: document.querySelector('.service-check[data-service="houseWash"]').checked,
          sidingType: document.getElementById('houseWash-sidingType').value,
          squareFeet: document.getElementById('houseWash-sqft').value
        },
        driveway: {
          selected: document.querySelector('.service-check[data-service="driveway"]').checked,
          size: document.getElementById('driveway-size').value,
          squareFeet: document.getElementById('driveway-sqft').value
        },
        gutterCleaning: {
          selected: document.querySelector('.service-check[data-service="gutterCleaning"]').checked,
          stories: document.getElementById('gutter-stories').value,
          linearFeet: document.getElementById('gutter-linearFeet').value
        },
        vinylFence: {
          selected: document.querySelector('.service-check[data-service="vinylFence"]').checked,
          linearFootRange: document.getElementById('fence-range').value,
          linearFeet: document.getElementById('fence-linearFeet').value
        },
        other: {
          selected: document.querySelector('.service-check[data-service="other"]').checked,
          description: document.getElementById('other-description').value.trim()
        }
      },
      quotedPrice: document.getElementById('quotedPrice').value.trim(),
      checklist: {
        exteriorSpigot: document.getElementById('chk-spigot').checked,
        moveItems: document.getElementById('chk-moveItems').checked,
        petsSecured: document.getElementById('chk-pets').checked,
        vehiclesMoved: document.getElementById('chk-vehicles').checked,
        windowsClosed: document.getElementById('chk-windows').checked,
        specialCare: document.getElementById('chk-specialCare').checked,
        specialCareDetails: document.getElementById('specialCareDetails').value.trim(),
        dayAndTime: document.getElementById('chk-dayTime').value.trim(),
        notes: document.getElementById('chk-notes').value.trim()
      }
    };
  }

  // --- Populate Form from Data ---
  function populateForm(data) {
    if (!data) return;
    const c = data.customer || {};
    document.getElementById('fullName').value = c.fullName || '';
    document.getElementById('address').value = c.address || '';
    document.getElementById('homeSqft').value = c.squareFeet || '';
    document.getElementById('email').value = c.email || '';
    document.getElementById('phone').value = c.phone || '';

    const s = data.services || {};
    // House Wash
    if (s.houseWash) {
      const chk = document.querySelector('.service-check[data-service="houseWash"]');
      chk.checked = s.houseWash.selected || false;
      if (chk.checked) chk.closest('.service-card').classList.add('expanded');
      document.getElementById('houseWash-sidingType').value = s.houseWash.sidingType || '';
      document.getElementById('houseWash-sqft').value = s.houseWash.squareFeet || '';
    }
    // Driveway
    if (s.driveway) {
      const chk = document.querySelector('.service-check[data-service="driveway"]');
      chk.checked = s.driveway.selected || false;
      if (chk.checked) chk.closest('.service-card').classList.add('expanded');
      document.getElementById('driveway-size').value = s.driveway.size || '';
      document.getElementById('driveway-sqft').value = s.driveway.squareFeet || '';
    }
    // Gutter
    if (s.gutterCleaning) {
      const chk = document.querySelector('.service-check[data-service="gutterCleaning"]');
      chk.checked = s.gutterCleaning.selected || false;
      if (chk.checked) chk.closest('.service-card').classList.add('expanded');
      document.getElementById('gutter-stories').value = s.gutterCleaning.stories || '';
      document.getElementById('gutter-linearFeet').value = s.gutterCleaning.linearFeet || '';
    }
    // Vinyl Fence
    if (s.vinylFence) {
      const chk = document.querySelector('.service-check[data-service="vinylFence"]');
      chk.checked = s.vinylFence.selected || false;
      if (chk.checked) chk.closest('.service-card').classList.add('expanded');
      document.getElementById('fence-range').value = s.vinylFence.linearFootRange || '';
      document.getElementById('fence-linearFeet').value = s.vinylFence.linearFeet || '';
    }
    // Other
    if (s.other) {
      const chk = document.querySelector('.service-check[data-service="other"]');
      chk.checked = s.other.selected || false;
      if (chk.checked) chk.closest('.service-card').classList.add('expanded');
      document.getElementById('other-description').value = s.other.description || '';
    }

    document.getElementById('quotedPrice').value = data.quotedPrice || '';

    const ch = data.checklist || {};
    document.getElementById('chk-spigot').checked = ch.exteriorSpigot || false;
    document.getElementById('chk-moveItems').checked = ch.moveItems || false;
    document.getElementById('chk-pets').checked = ch.petsSecured || false;
    document.getElementById('chk-vehicles').checked = ch.vehiclesMoved || false;
    document.getElementById('chk-windows').checked = ch.windowsClosed || false;
    document.getElementById('chk-specialCare').checked = ch.specialCare || false;
    specialCareWrap.style.display = ch.specialCare ? 'block' : 'none';
    document.getElementById('specialCareDetails').value = ch.specialCareDetails || '';
    document.getElementById('chk-dayTime').value = ch.dayAndTime || '';
    document.getElementById('chk-notes').value = ch.notes || '';
  }

  // --- Clear Form ---
  function clearForm() {
    document.getElementById('fullName').value = '';
    document.getElementById('address').value = '';
    document.getElementById('homeSqft').value = '';
    document.getElementById('email').value = '';
    document.getElementById('phone').value = '';

    serviceChecks.forEach(chk => {
      chk.checked = false;
      chk.closest('.service-card').classList.remove('expanded');
    });

    document.getElementById('houseWash-sidingType').value = '';
    document.getElementById('houseWash-sqft').value = '';
    document.getElementById('driveway-size').value = '';
    document.getElementById('driveway-sqft').value = '';
    document.getElementById('gutter-stories').value = '';
    document.getElementById('gutter-linearFeet').value = '';
    document.getElementById('fence-range').value = '';
    document.getElementById('fence-linearFeet').value = '';
    document.getElementById('other-description').value = '';
    document.getElementById('quotedPrice').value = '';

    document.getElementById('chk-spigot').checked = false;
    document.getElementById('chk-moveItems').checked = false;
    document.getElementById('chk-pets').checked = false;
    document.getElementById('chk-vehicles').checked = false;
    document.getElementById('chk-windows').checked = false;
    document.getElementById('chk-specialCare').checked = false;
    specialCareWrap.style.display = 'none';
    document.getElementById('specialCareDetails').value = '';
    document.getElementById('chk-dayTime').value = '';
    document.getElementById('chk-notes').value = '';

    localStorage.removeItem(DRAFT_KEY);
  }

  // --- Storage ---
  function loadQuotes() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveQuotesToStorage(quotes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
  }

  function deleteQuote(id) {
    const quotes = loadQuotes().filter(q => q.id !== id);
    saveQuotesToStorage(quotes);
    renderSavedQuotes();
    showToast('Quote deleted');
  }

  // --- Draft Auto-Save ---
  function scheduleDraftSave() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      const data = collectFormData();
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    }, 500);
  }

  // Listen to all inputs for draft save
  document.querySelectorAll('input, textarea, select').forEach(el => {
    el.addEventListener('input', scheduleDraftSave);
    el.addEventListener('change', scheduleDraftSave);
  });

  // --- Save Quote ---
  saveBtn.addEventListener('click', () => {
    const fullName = document.getElementById('fullName').value.trim();
    const address = document.getElementById('address').value.trim();
    if (!fullName) {
      showToast('Please enter customer name');
      switchTab('customer');
      document.getElementById('fullName').focus();
      return;
    }
    if (!address) {
      showToast('Please enter customer address');
      switchTab('customer');
      document.getElementById('address').focus();
      return;
    }
    const data = collectFormData();
    const quotes = loadQuotes();
    quotes.unshift(data);
    saveQuotesToStorage(quotes);
    localStorage.removeItem(DRAFT_KEY);
    clearForm();
    showToast('Quote saved!');
    switchTab('saved');
  });

  // --- New Quote ---
  newQuoteBtn.addEventListener('click', () => {
    clearForm();
    switchTab('customer');
    document.getElementById('fullName').focus();
  });

  // --- Render Saved Quotes ---
  function getServiceLabels(services) {
    const labels = [];
    if (services.houseWash && services.houseWash.selected) labels.push('House Wash');
    if (services.driveway && services.driveway.selected) labels.push('Driveway');
    if (services.gutterCleaning && services.gutterCleaning.selected) labels.push('Gutters');
    if (services.vinylFence && services.vinylFence.selected) labels.push('Vinyl Fence');
    if (services.other && services.other.selected) labels.push('Other');
    return labels;
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function renderSavedQuotes() {
    const quotes = loadQuotes();
    emptyMsg.style.display = quotes.length === 0 ? 'block' : 'none';
    savedList.innerHTML = '';

    quotes.forEach(q => {
      const tags = getServiceLabels(q.services || {});
      const card = document.createElement('div');
      card.className = 'quote-card';
      card.innerHTML = `
        <div class="quote-info">
          <div class="quote-name">${escHtml(q.customer.fullName)}</div>
          <div class="quote-address">${escHtml(q.customer.address)}</div>
          <div class="quote-date">${formatDate(q.createdAt)}</div>
          <div class="quote-tags">${tags.map(t => `<span class="quote-tag">${t}</span>`).join('')}</div>
        </div>
        <div class="quote-actions">
          ${q.quotedPrice ? `<div class="quote-price">$${escHtml(q.quotedPrice)}</div>` : ''}
          <button class="btn-danger delete-btn" data-id="${q.id}">Delete</button>
        </div>
      `;
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) return;
        showQuoteDetail(q);
      });
      card.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this quote?')) deleteQuote(q.id);
      });
      savedList.appendChild(card);
    });
  }

  // --- Quote Detail Modal ---
  function showQuoteDetail(q) {
    modalTitle.textContent = q.customer.fullName || 'Quote Details';
    let html = '';

    // Customer
    html += '<h3>Customer</h3>';
    html += row('Name', q.customer.fullName);
    html += row('Address', q.customer.address);
    if (q.customer.squareFeet) html += row('Home Sq Ft', q.customer.squareFeet);
    if (q.customer.phone) html += row('Phone', q.customer.phone);
    if (q.customer.email) html += row('Email', q.customer.email);

    // Services
    const s = q.services || {};
    html += '<h3>Services</h3>';
    if (s.houseWash && s.houseWash.selected) {
      html += row('House Wash', '');
      if (s.houseWash.sidingType) html += row('  Siding', capitalize(s.houseWash.sidingType));
      if (s.houseWash.squareFeet) html += row('  Sq Ft', s.houseWash.squareFeet);
    }
    if (s.driveway && s.driveway.selected) {
      html += row('Driveway', '');
      if (s.driveway.size) html += row('  Size', formatSize(s.driveway.size));
      if (s.driveway.squareFeet) html += row('  Sq Ft', s.driveway.squareFeet);
    }
    if (s.gutterCleaning && s.gutterCleaning.selected) {
      html += row('Gutter Cleaning', '');
      if (s.gutterCleaning.stories) html += row('  Stories', s.gutterCleaning.stories);
      if (s.gutterCleaning.linearFeet) html += row('  Linear Ft', s.gutterCleaning.linearFeet);
    }
    if (s.vinylFence && s.vinylFence.selected) {
      html += row('Vinyl Fence', '');
      if (s.vinylFence.linearFootRange) html += row('  Range', s.vinylFence.linearFootRange);
      if (s.vinylFence.linearFeet) html += row('  Linear Ft', s.vinylFence.linearFeet);
    }
    if (s.other && s.other.selected) {
      html += row('Other', s.other.description || '');
    }

    if (!s.houseWash?.selected && !s.driveway?.selected && !s.gutterCleaning?.selected && !s.vinylFence?.selected && !s.other?.selected) {
      html += '<div class="modal-row"><span class="label">None selected</span></div>';
    }

    if (q.quotedPrice) {
      html += '<h3>Price</h3>';
      html += row('Quoted', '$' + q.quotedPrice);
    }

    // Checklist
    const ch = q.checklist || {};
    html += '<h3>Checklist</h3>';
    html += checkRow('Exterior spigot', ch.exteriorSpigot);
    html += checkRow('Items moved', ch.moveItems);
    html += checkRow('Pets secured', ch.petsSecured);
    html += checkRow('Vehicles moved', ch.vehiclesMoved);
    html += checkRow('Windows closed', ch.windowsClosed);
    html += checkRow('Special care needed', ch.specialCare);
    if (ch.specialCare && ch.specialCareDetails) html += row('  Details', ch.specialCareDetails);
    if (ch.dayAndTime) html += row('Day & Time', ch.dayAndTime);
    if (ch.notes) html += row('Notes', ch.notes);

    modalBody.innerHTML = html;
    detailModal.style.display = 'flex';
  }

  function closeModal() { detailModal.style.display = 'none'; }
  modalClose.addEventListener('click', closeModal);
  detailModal.addEventListener('click', (e) => { if (e.target === detailModal) closeModal(); });

  function row(label, value) {
    return `<div class="modal-row"><span class="label">${escHtml(label)}</span><span class="value">${escHtml(value)}</span></div>`;
  }
  function checkRow(label, val) {
    return `<div class="modal-check">${val ? '<span class="yes">&#10003;</span>' : '<span class="no">&#10007;</span>'} ${escHtml(label)}</div>`;
  }
  function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
  function capitalize(s) {
    if (!s) return '';
    if (s === 'hardie') return 'Hardie Board';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function formatSize(s) {
    const map = { '1car': '1 Car', '2car': '2 Car', '4car': '4 Car', '6car': '6 Car', 'other': 'Other' };
    return map[s] || s;
  }

  // --- Toast ---
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  // --- PWA Install ---
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'block';
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') installBtn.style.display = 'none';
    deferredPrompt = null;
  });

  window.addEventListener('appinstalled', () => {
    installBtn.style.display = 'none';
  });

  // --- Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.error('SW registration failed:', err));
  }

  // --- Init ---
  function init() {
    // Restore draft if available
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (draft && draft.customer && draft.customer.fullName) {
        populateForm(draft);
      }
    } catch (e) { /* ignore */ }
  }

  init();
})();
