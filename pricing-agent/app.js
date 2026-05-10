(function () {
  'use strict';

  const API_KEY_STORE = 'splash_agent_api_key';
  const RATES_KEY = 'splash_agent_rates';
  const HISTORY_KEY = 'splash_agent_history';
  const CHAT_KEY = 'splash_agent_chat';
  const HANDOFF_KEY = 'splash_pw_agent_handoff';

  const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
  const MODEL = 'claude-sonnet-4-6';

  const DEFAULT_RATES = {
    houseWashPerSqft: 0.12,
    storyMult: { '1': 1.0, '1.5': 1.15, '2': 1.25, '3+': 1.5 },
    sidingMult: { vinyl: 1.0, brick: 1.1, hardie: 1.05, stucco: 1.15, aluminum: 1.0, other: 1.1 },
    conditionMult: { good: 1.0, fair: 1.15, heavy: 1.35 },
    houseWashMin: 150,
    driveFlat: { none: 0, '1car': 75, '2car': 120, '4car': 200, large: 280 },
    driveCondMult: { good: 1.0, fair: 1.1, heavy: 1.25 },
    gutterPerFt: { '1': 1.25, '1.5': 1.40, '2': 1.60, '3+': 2.00 },
    gutterMin: 100,
    fencePerFt: 1.10,
    fenceMin: 75,
    bundleDiscount: 10
  };

  const PROPERTY_TOOL = {
    name: 'suggest_property_details',
    description: 'Submit estimated property characteristics for a pressure washing quote. Call this once with your best estimates based on the address and notes.',
    input_schema: {
      type: 'object',
      properties: {
        home_sqft: { type: 'integer', description: 'Estimated heated sq ft of the home' },
        stories: { type: 'string', enum: ['1', '1.5', '2', '3+'], description: 'Number of stories' },
        siding_type: { type: 'string', enum: ['vinyl', 'brick', 'hardie', 'stucco', 'aluminum', 'other'], description: 'Primary exterior siding' },
        driveway_type: { type: 'string', enum: ['none', '1car', '2car', '4car', 'large'], description: 'Driveway category' },
        gutter_linear_ft: { type: 'integer', description: 'Estimated gutter linear footage (0 if none/unknown)' },
        fence_linear_ft: { type: 'integer', description: 'Estimated vinyl fence linear footage (0 if none)' },
        condition: { type: 'string', enum: ['good', 'fair', 'heavy'], description: 'Surface soiling level' },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Confidence in these estimates' },
        notes: { type: 'string', description: 'Flags or unusual characteristics (access issues, steep pitch, heavy vegetation, etc.)' }
      },
      required: ['home_sqft', 'stories', 'siding_type', 'driveway_type', 'gutter_linear_ft', 'fence_linear_ft', 'condition', 'confidence']
    }
  };

  const PROPERTY_SYSTEM = `You are a property assessment assistant for Splash Pressure Washing, a veteran and firefighter owned pressure washing company in Chesapeake, VA serving Hampton Roads.

Your job: analyze a property address and any notes, then call the suggest_property_details tool with your best estimates of the property characteristics relevant to pressure washing.

CHESAPEAKE VA CONTEXT:
- Median home: 1,800–2,400 sq ft, built 1985–2005, vinyl or brick siding, 2-car driveway
- Common styles: colonial, ranch, cape cod, townhome
- Single-family homes are typically 1–2 stories; vinyl siding dominates newer construction
- A 2,000 sq ft home typically has ~150–180 linear ft of gutters
- Standard 2-car driveway is ~400–500 sq ft
- Lots are typically 0.2–0.5 acres

INSTRUCTIONS:
1. Read the address and any notes carefully
2. Call suggest_property_details with your best estimates for ALL required fields
3. Be conservative on sq ft — better to underestimate than overestimate
4. Use gutter_linear_ft = 0 only if notes say no gutters or it's clearly a flat-roof building
5. Use fence_linear_ft = 0 if no vinyl fence is indicated
6. Flag anything unusual (steep roof, heavy vegetation, limited access, oil stains, etc.) in the notes field
7. If you have no specific info, use Chesapeake median values`;

  const CHAT_SYSTEM = `You are a pricing and operations assistant for Splash Pressure Washing, a veteran and firefighter owned pressure washing company in Chesapeake, VA.

You help the owner price jobs, think through tricky situations, and answer questions about pressure washing best practices.

BUSINESS CONTEXT:
- Services: house washing (soft wash), driveway/concrete cleaning, gutter cleaning, vinyl fence cleaning
- Market: Hampton Roads, VA (Chesapeake, Virginia Beach, Suffolk, Portsmouth, Norfolk)
- Typical prices: house wash $150–$450, driveway $75–$280, gutters $100–$350, vinyl fence $75–$200
- The owner is a veteran and firefighter — emphasize quality and integrity in pricing advice

Keep responses concise and practical. Use dollar figures and specific advice. If the owner describes a job, give a concrete price recommendation with brief reasoning.`;

  // --- State ---
  let currentPropertyDetails = null;
  let currentAnalysisAddress = '';
  let currentRecommendation = null;
  let chatHistory = [];
  let chatStreaming = false;
  let deferredPrompt = null;

  // --- DOM refs ---
  const tabPanels = document.querySelectorAll('.tab-panel');
  const navBtns = document.querySelectorAll('.nav-btn');
  const toast = document.getElementById('toast');
  const installBtn = document.getElementById('installBtn');

  // Property tab
  const analyzeBtn = document.getElementById('analyzeBtn');
  const propAddress = document.getElementById('propAddress');
  const propNotes = document.getElementById('propNotes');
  const analysisStatus = document.getElementById('analysisStatus');
  const statusText = document.getElementById('statusText');
  const propertyDetailsCard = document.getElementById('propertyDetailsCard');
  const confidenceBadge = document.getElementById('confidenceBadge');
  const getPricingBtn = document.getElementById('getPricingBtn');
  const agentPropertyNotes = document.getElementById('agentPropertyNotes');
  const noKeyWarning = document.getElementById('noKeyWarning');

  const detSqft = document.getElementById('det-sqft');
  const detStories = document.getElementById('det-stories');
  const detSiding = document.getElementById('det-siding');
  const detDriveway = document.getElementById('det-driveway');
  const detGutterFt = document.getElementById('det-gutter-ft');
  const detFenceFt = document.getElementById('det-fence-ft');
  const detCondition = document.getElementById('det-condition');

  // Recommendation tab
  const startOverBtn = document.getElementById('startOverBtn');
  const recAddressCard = document.getElementById('recAddressCard');
  const recAddressText = document.getElementById('recAddressText');
  const serviceRecommendations = document.getElementById('serviceRecommendations');
  const pricingSummary = document.getElementById('pricingSummary');
  const summaryRows = document.getElementById('summaryRows');
  const summaryTotal = document.getElementById('summaryTotal');
  const rangeNote = document.getElementById('rangeNote');
  const narrativeCard = document.getElementById('narrativeCard');
  const narrativeText = document.getElementById('narrativeText');
  const narrativeLoading = document.getElementById('narrativeLoading');
  const sendToQuoteBtn = document.getElementById('sendToQuoteBtn');

  // Chat tab
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  const clearChatBtn = document.getElementById('clearChatBtn');

  // History tab
  const historyList = document.getElementById('historyList');
  const historyEmpty = document.getElementById('historyEmpty');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  // Settings tab
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveKeyBtn = document.getElementById('saveKeyBtn');
  const clearKeyBtn = document.getElementById('clearKeyBtn');
  const resetRatesBtn = document.getElementById('resetRatesBtn');

  // --- Tab Navigation ---
  function switchTab(tabName) {
    tabPanels.forEach(p => p.classList.remove('active'));
    navBtns.forEach(b => b.classList.remove('active'));
    const panel = document.getElementById('tab-' + tabName);
    if (panel) panel.classList.add('active');
    const btn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
    if (btn) btn.classList.add('active');
    if (tabName === 'history') renderHistory();
    if (tabName === 'property') updateKeyWarning();
  }

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // --- Toast ---
  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // --- API Key ---
  function getApiKey() {
    return localStorage.getItem(API_KEY_STORE) || '';
  }

  function updateKeyWarning() {
    const hasKey = !!getApiKey();
    noKeyWarning.style.display = hasKey ? 'none' : 'block';
    analyzeBtn.disabled = !hasKey;
  }

  saveKeyBtn.addEventListener('click', () => {
    const val = apiKeyInput.value.trim();
    if (!val) { showToast('Enter an API key first'); return; }
    localStorage.setItem(API_KEY_STORE, val);
    apiKeyInput.value = '';
    apiKeyInput.placeholder = '••••••••' + val.slice(-4);
    showToast('API key saved');
    updateKeyWarning();
  });

  clearKeyBtn.addEventListener('click', () => {
    localStorage.removeItem(API_KEY_STORE);
    apiKeyInput.value = '';
    apiKeyInput.placeholder = 'sk-ant-...';
    showToast('API key cleared');
    updateKeyWarning();
  });

  function loadKeyDisplay() {
    const key = getApiKey();
    if (key) {
      apiKeyInput.placeholder = '••••••••' + key.slice(-4);
    }
  }

  // --- Rates ---
  function getRates() {
    try {
      const saved = JSON.parse(localStorage.getItem(RATES_KEY));
      return saved ? Object.assign({}, DEFAULT_RATES, saved) : Object.assign({}, DEFAULT_RATES);
    } catch (e) { return Object.assign({}, DEFAULT_RATES); }
  }

  function saveRates(rates) {
    localStorage.setItem(RATES_KEY, JSON.stringify(rates));
  }

  function loadRateInputs() {
    const r = getRates();
    document.getElementById('rate-houseWash').value = r.houseWashPerSqft;
    document.getElementById('rate-drv1car').value = r.driveFlat['1car'];
    document.getElementById('rate-drv2car').value = r.driveFlat['2car'];
    document.getElementById('rate-drv4car').value = r.driveFlat['4car'];
    document.getElementById('rate-drvlarge').value = r.driveFlat['large'];
    document.getElementById('rate-gut1').value = r.gutterPerFt['1'];
    document.getElementById('rate-gut2').value = r.gutterPerFt['2'];
    document.getElementById('rate-fence').value = r.fencePerFt;
    document.getElementById('rate-bundle').value = r.bundleDiscount;
  }

  function readRateInputs() {
    const r = getRates();
    r.houseWashPerSqft = parseFloat(document.getElementById('rate-houseWash').value) || DEFAULT_RATES.houseWashPerSqft;
    r.driveFlat['1car'] = parseFloat(document.getElementById('rate-drv1car').value) || DEFAULT_RATES.driveFlat['1car'];
    r.driveFlat['2car'] = parseFloat(document.getElementById('rate-drv2car').value) || DEFAULT_RATES.driveFlat['2car'];
    r.driveFlat['4car'] = parseFloat(document.getElementById('rate-drv4car').value) || DEFAULT_RATES.driveFlat['4car'];
    r.driveFlat['large'] = parseFloat(document.getElementById('rate-drvlarge').value) || DEFAULT_RATES.driveFlat['large'];
    r.gutterPerFt['1'] = parseFloat(document.getElementById('rate-gut1').value) || DEFAULT_RATES.gutterPerFt['1'];
    r.gutterPerFt['2'] = parseFloat(document.getElementById('rate-gut2').value) || DEFAULT_RATES.gutterPerFt['2'];
    r.fencePerFt = parseFloat(document.getElementById('rate-fence').value) || DEFAULT_RATES.fencePerFt;
    r.bundleDiscount = parseFloat(document.getElementById('rate-bundle').value) || DEFAULT_RATES.bundleDiscount;
    return r;
  }

  ['rate-houseWash','rate-drv1car','rate-drv2car','rate-drv4car','rate-drvlarge',
   'rate-gut1','rate-gut2','rate-fence','rate-bundle'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      saveRates(readRateInputs());
    });
  });

  resetRatesBtn.addEventListener('click', () => {
    localStorage.removeItem(RATES_KEY);
    loadRateInputs();
    showToast('Rates reset to defaults');
  });

  // --- Anthropic API call (non-streaming) ---
  async function callClaude(messages, system, tools, toolChoice) {
    const key = getApiKey();
    if (!key) throw new Error('No API key');

    const body = { model: MODEL, max_tokens: 1024, system, messages };
    if (tools) { body.tools = tools; body.tool_choice = toolChoice || { type: 'auto' }; }

    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${res.status}`);
    }
    return res.json();
  }

  // --- Anthropic streaming call ---
  async function callClaudeStream(messages, system, onToken, onDone) {
    const key = getApiKey();
    if (!key) throw new Error('No API key');

    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system,
        messages,
        stream: true
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const evt = JSON.parse(data);
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            fullText += evt.delta.text;
            onToken(fullText);
          }
        } catch (e) { /* skip malformed events */ }
      }
    }
    onDone(fullText);
  }

  // --- Property Analysis ---
  analyzeBtn.addEventListener('click', async () => {
    const address = propAddress.value.trim();
    if (!address) { showToast('Enter a property address'); return; }
    const key = getApiKey();
    if (!key) { showToast('Add your API key in Settings'); switchTab('settings'); return; }

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    analysisStatus.style.display = 'flex';
    statusText.textContent = 'Researching property details...';
    propertyDetailsCard.style.display = 'none';

    try {
      const data = await callClaude(
        [{ role: 'user', content: `Address: ${address}\nNotes: ${propNotes.value.trim() || 'none'}` }],
        PROPERTY_SYSTEM,
        [PROPERTY_TOOL],
        { type: 'any' }
      );

      const toolUse = data.content.find(b => b.type === 'tool_use' && b.name === 'suggest_property_details');
      if (!toolUse) throw new Error('Agent did not return property details — try again');

      currentPropertyDetails = toolUse.input;
      currentAnalysisAddress = address;
      populatePropertyDetails(currentPropertyDetails);
      propertyDetailsCard.style.display = 'block';
    } catch (err) {
      showToast('Error: ' + err.message);
    } finally {
      analysisStatus.style.display = 'none';
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'Analyze Property';
    }
  });

  function populatePropertyDetails(d) {
    detSqft.value = d.home_sqft || '';
    detStories.value = d.stories || '2';
    detSiding.value = d.siding_type || 'vinyl';
    detDriveway.value = d.driveway_type || '2car';
    detGutterFt.value = d.gutter_linear_ft || 0;
    detFenceFt.value = d.fence_linear_ft || 0;
    detCondition.value = d.condition || 'fair';

    const conf = d.confidence || 'medium';
    confidenceBadge.textContent = conf.charAt(0).toUpperCase() + conf.slice(1) + ' confidence';
    confidenceBadge.className = 'confidence-badge confidence-' + conf;

    if (d.notes) {
      agentPropertyNotes.textContent = 'Agent note: ' + d.notes;
      agentPropertyNotes.style.display = 'block';
    } else {
      agentPropertyNotes.style.display = 'none';
    }
  }

  function readPropertyDetails() {
    return {
      home_sqft: parseInt(detSqft.value) || 2000,
      stories: detStories.value || '2',
      siding_type: detSiding.value || 'vinyl',
      driveway_type: detDriveway.value || '2car',
      gutter_linear_ft: parseInt(detGutterFt.value) || 0,
      fence_linear_ft: parseInt(detFenceFt.value) || 0,
      condition: detCondition.value || 'fair'
    };
  }

  // --- Pricing Calculation ---
  function calculatePricing(prop, rates) {
    const cond = prop.condition;
    const stories = prop.stories;
    const services = [];

    // House wash
    const hwBase = prop.home_sqft * rates.houseWashPerSqft
      * (rates.storyMult[stories] || 1.25)
      * (rates.sidingMult[prop.siding_type] || 1.0)
      * (rates.conditionMult[cond] || 1.0);
    const hwPrice = Math.max(hwBase, rates.houseWashMin);
    services.push({
      id: 'houseWash',
      name: 'House Wash',
      price: Math.round(hwPrice),
      recommended: true,
      reason: `${prop.home_sqft.toLocaleString()} sq ft ${prop.siding_type} siding, ${stories}-story, ${cond} condition`
    });

    // Driveway
    if (prop.driveway_type !== 'none') {
      const drvBase = (rates.driveFlat[prop.driveway_type] || 120)
        * (rates.driveCondMult[cond] || 1.0);
      services.push({
        id: 'driveway',
        name: 'Driveway Cleaning',
        price: Math.round(drvBase),
        recommended: true,
        reason: `${prop.driveway_type.replace('car', '-car')} driveway, ${cond} condition`
      });
    }

    // Gutters
    if (prop.gutter_linear_ft > 0) {
      const gutRate = rates.gutterPerFt[stories] || rates.gutterPerFt['2'];
      const gutPrice = Math.max(prop.gutter_linear_ft * gutRate, rates.gutterMin);
      services.push({
        id: 'gutterCleaning',
        name: 'Gutter Cleaning',
        price: Math.round(gutPrice),
        recommended: true,
        reason: `~${prop.gutter_linear_ft} linear ft, ${stories}-story access`
      });
    }

    // Vinyl fence
    if (prop.fence_linear_ft > 0) {
      const fencePrice = Math.max(prop.fence_linear_ft * rates.fencePerFt, rates.fenceMin);
      services.push({
        id: 'vinylFence',
        name: 'Vinyl Fence',
        price: Math.round(fencePrice),
        recommended: true,
        reason: `~${prop.fence_linear_ft} linear ft of vinyl fence`
      });
    }

    const subtotal = services.reduce((s, svc) => s + svc.price, 0);
    const applyBundle = services.length >= 3;
    const discountPct = applyBundle ? rates.bundleDiscount : 0;
    const discountAmt = Math.round(subtotal * discountPct / 100);
    const total = subtotal - discountAmt;

    return {
      services,
      subtotal,
      applyBundle,
      discountPct,
      discountAmt,
      total,
      range: { low: Math.round(total * 0.87), high: Math.round(total * 1.13) }
    };
  }

  // --- Get Pricing ---
  getPricingBtn.addEventListener('click', async () => {
    const prop = readPropertyDetails();
    const rates = getRates();
    const rec = calculatePricing(prop, rates);
    currentRecommendation = rec;

    renderRecommendation(prop, rec);
    switchTab('recommendation');

    // Fire off narrative in background
    fetchNarrative(prop, rec);

    // Save to history
    saveHistory({
      address: currentAnalysisAddress,
      timestamp: Date.now(),
      propertyDetails: prop,
      recommendation: rec
    });
  });

  function renderRecommendation(prop, rec) {
    recAddressText.textContent = currentAnalysisAddress;
    recAddressCard.style.display = 'block';

    // Service cards
    serviceRecommendations.innerHTML = '';
    rec.services.forEach(svc => {
      const low = Math.round(svc.price * 0.87);
      const high = Math.round(svc.price * 1.13);
      const card = document.createElement('div');
      card.className = 'service-rec-card recommended';
      card.innerHTML = `
        <div class="service-rec-header">
          <span class="service-rec-name">${svc.name}</span>
          <span class="service-rec-badge">Recommended</span>
        </div>
        <div class="service-rec-price">$${svc.price.toLocaleString()}</div>
        <div class="service-rec-range">Range: $${low.toLocaleString()} – $${high.toLocaleString()}</div>
        <div class="service-rec-reason">${svc.reason}</div>
      `;
      serviceRecommendations.appendChild(card);
    });

    // Summary
    summaryRows.innerHTML = '';
    rec.services.forEach(svc => {
      const row = document.createElement('div');
      row.className = 'summary-row';
      row.innerHTML = `<span class="summary-label">${svc.name}</span><span>$${svc.price.toLocaleString()}</span>`;
      summaryRows.appendChild(row);
    });
    if (rec.applyBundle) {
      const row = document.createElement('div');
      row.className = 'summary-row bundle-discount';
      row.innerHTML = `<span>Bundle Discount (${rec.discountPct}%)</span><span>-$${rec.discountAmt.toLocaleString()}</span>`;
      summaryRows.appendChild(row);
    }
    summaryTotal.textContent = '$' + rec.total.toLocaleString();
    rangeNote.textContent = `Estimated range: $${rec.range.low.toLocaleString()} – $${rec.range.high.toLocaleString()}`;
    pricingSummary.style.display = 'block';

    narrativeCard.style.display = 'none';
    narrativeText.textContent = '';
    sendToQuoteBtn.style.display = 'block';
  }

  // --- Narrative ---
  async function fetchNarrative(prop, rec) {
    narrativeLoading.style.display = 'flex';
    narrativeCard.style.display = 'none';

    const serviceList = rec.services.map(s => `${s.name}: $${s.price}`).join(', ');
    const messages = [{
      role: 'user',
      content: `I'm quoting a pressure washing job at: ${currentAnalysisAddress}

Property: ${prop.home_sqft.toLocaleString()} sq ft, ${prop.stories}-story, ${prop.siding_type} siding, ${prop.driveway_type !== 'none' ? prop.driveway_type + ' driveway' : 'no driveway'}, ${prop.gutter_linear_ft > 0 ? prop.gutter_linear_ft + ' ft of gutters' : 'no gutters'}, ${prop.fence_linear_ft > 0 ? prop.fence_linear_ft + ' ft vinyl fence' : 'no vinyl fence'}, condition: ${prop.condition}

Recommended pricing: ${serviceList}
Total: $${rec.total} (with ${rec.applyBundle ? rec.discountPct + '% bundle discount' : 'no bundle discount'})

Write a brief 3–4 sentence explanation of this pricing that I could use to explain the quote to the customer. Be specific about what drives the price. Keep it plain, professional, no fluff.`
    }];

    try {
      const data = await callClaude(messages, CHAT_SYSTEM);
      const text = data.content.find(b => b.type === 'text')?.text || '';
      narrativeText.textContent = text;
      narrativeCard.style.display = 'block';
    } catch (err) {
      // Narrative is optional — don't show error if it fails
    } finally {
      narrativeLoading.style.display = 'none';
    }
  }

  // --- Send to Quote Builder ---
  sendToQuoteBtn.addEventListener('click', () => {
    if (!currentRecommendation) return;
    const prop = readPropertyDetails();
    const rec = currentRecommendation;

    const findSvc = id => rec.services.find(s => s.id === id);
    const hw = findSvc('houseWash');
    const drv = findSvc('driveway');
    const gut = findSvc('gutterCleaning');
    const fence = findSvc('vinylFence');

    const drivewaySize = {
      '1car': 'single', '2car': 'double', '4car': 'triple-wide', large: 'large'
    }[prop.driveway_type] || 'double';

    const handoff = {
      source: 'pricing-agent',
      timestamp: Date.now(),
      customer: { address: currentAnalysisAddress },
      services: {
        houseWash: hw ? {
          selected: true,
          sidingType: prop.siding_type,
          squareFeet: String(prop.home_sqft),
          price: String(hw.price)
        } : { selected: false },
        driveway: drv ? {
          selected: true,
          size: drivewaySize,
          squareFeet: '',
          price: String(drv.price)
        } : { selected: false },
        gutterCleaning: gut ? {
          selected: true,
          stories: prop.stories,
          linearFeet: String(prop.gutter_linear_ft),
          price: String(gut.price)
        } : { selected: false },
        vinylFence: fence ? {
          selected: true,
          linearFeet: String(prop.fence_linear_ft),
          price: String(fence.price)
        } : { selected: false }
      }
    };

    localStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff));
    window.location.href = '../index.html';
  });

  // --- Start Over ---
  startOverBtn.addEventListener('click', () => {
    currentPropertyDetails = null;
    currentRecommendation = null;
    currentAnalysisAddress = '';
    propAddress.value = '';
    propNotes.value = '';
    propertyDetailsCard.style.display = 'none';
    serviceRecommendations.innerHTML = '';
    pricingSummary.style.display = 'none';
    narrativeCard.style.display = 'none';
    sendToQuoteBtn.style.display = 'none';
    switchTab('property');
  });

  // --- Chat ---
  function loadChatHistory() {
    try {
      chatHistory = JSON.parse(localStorage.getItem(CHAT_KEY)) || [];
    } catch (e) { chatHistory = []; }
    // Render saved messages (skip the default greeting already in HTML)
    if (chatHistory.length > 0) {
      chatMessages.innerHTML = '';
      chatHistory.forEach(msg => appendChatBubble(msg.role, msg.content, false));
    }
  }

  function saveChatHistory() {
    // Keep last 60 messages
    const trimmed = chatHistory.slice(-60);
    localStorage.setItem(CHAT_KEY, JSON.stringify(trimmed));
  }

  function appendChatBubble(role, text, animate) {
    const div = document.createElement('div');
    div.className = 'chat-msg ' + role + (animate ? ' streaming' : '');
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<span class="msg-body">${escapeHtml(text)}</span><span class="msg-time">${time}</span>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }

  async function sendChatMessage() {
    if (chatStreaming) return;
    const text = chatInput.value.trim();
    if (!text) return;
    const key = getApiKey();
    if (!key) { showToast('Add your API key in Settings'); switchTab('settings'); return; }

    chatInput.value = '';
    chatInput.style.height = '44px';
    chatHistory.push({ role: 'user', content: text });
    appendChatBubble('user', text, false);

    chatStreaming = true;
    chatSendBtn.disabled = true;

    // Build messages for Claude (use last 20 turns for context window)
    const msgContext = chatHistory.slice(-20).map(m => ({ role: m.role, content: m.content }));
    const bubble = appendChatBubble('assistant', '...', true);
    const bodyEl = bubble.querySelector('.msg-body');

    try {
      await callClaudeStream(
        msgContext,
        CHAT_SYSTEM,
        (partial) => {
          bodyEl.innerHTML = escapeHtml(partial);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        },
        (final) => {
          bodyEl.innerHTML = escapeHtml(final);
          bubble.classList.remove('streaming');
          chatHistory.push({ role: 'assistant', content: final });
          saveChatHistory();
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      );
    } catch (err) {
      bodyEl.innerHTML = '<em>Error: ' + escapeHtml(err.message) + '</em>';
      bubble.classList.remove('streaming');
    } finally {
      chatStreaming = false;
      chatSendBtn.disabled = false;
    }
  }

  chatSendBtn.addEventListener('click', sendChatMessage);

  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  chatInput.addEventListener('input', () => {
    chatInput.style.height = '44px';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  clearChatBtn.addEventListener('click', () => {
    chatHistory = [];
    localStorage.removeItem(CHAT_KEY);
    chatMessages.innerHTML = '<div class="chat-msg assistant">Hi! I\'m your Splash PW pricing assistant. Ask me anything about pricing, properties, or pressure washing jobs in Hampton Roads.<span class="msg-time">Now</span></div>';
    showToast('Chat cleared');
  });

  // --- History ---
  function saveHistory(entry) {
    try {
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
      history.unshift(entry);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
    } catch (e) { /* ignore */ }
  }

  function renderHistory() {
    let history = [];
    try { history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch (e) {}

    historyList.innerHTML = '';
    if (history.length === 0) {
      historyEmpty.style.display = 'block';
      return;
    }
    historyEmpty.style.display = 'none';

    history.forEach((entry, idx) => {
      const date = new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const services = (entry.recommendation?.services || []).map(s => s.name).join(', ');
      const total = entry.recommendation?.total || 0;

      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <div class="history-info">
          <div class="history-address">${escapeHtml(entry.address)}</div>
          <div class="history-date">${date}</div>
          <div class="history-services">${escapeHtml(services)}</div>
        </div>
        <div class="history-actions">
          <span class="history-total">$${total.toLocaleString()}</span>
          <button class="btn-danger" data-idx="${idx}">Delete</button>
        </div>
      `;
      item.querySelector('.history-info').addEventListener('click', () => restoreHistory(entry));
      item.querySelector('.btn-danger').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteHistory(idx);
      });
      historyList.appendChild(item);
    });
  }

  function restoreHistory(entry) {
    currentAnalysisAddress = entry.address;
    propAddress.value = entry.address;
    currentPropertyDetails = entry.propertyDetails;
    currentRecommendation = entry.recommendation;
    if (entry.propertyDetails) populatePropertyDetails(entry.propertyDetails);
    if (entry.recommendation) renderRecommendation(entry.propertyDetails, entry.recommendation);
    switchTab('recommendation');
  }

  function deleteHistory(idx) {
    try {
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
      history.splice(idx, 1);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      renderHistory();
    } catch (e) { /* ignore */ }
  }

  clearHistoryBtn.addEventListener('click', () => {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
    showToast('History cleared');
  });

  // --- PWA Install ---
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

  // --- Service Worker ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // --- Init ---
  function init() {
    loadKeyDisplay();
    loadRateInputs();
    loadChatHistory();
    updateKeyWarning();
  }

  init();
})();
