(function () {
  'use strict';

  // ============ DOM REFS ============
  const $ = id => document.getElementById(id);
  const locInput   = $('locInput');
  const checkBtn   = $('checkBtn');
  const statusLine = $('statusLine');
  const statusLoc  = $('statusLoc');
  const statusAge  = $('statusAge');
  const refreshBtn = $('refreshBtn');
  const messageEl  = $('message');
  const summaryEl  = $('summary');
  const dayList    = $('dayList');
  const toastEl    = $('toast');

  // ============ STORAGE KEYS ============
  const LS_LOCATION = 'splash_ww_last_location';
  const LS_FORECAST = 'splash_ww_forecast';

  // ============ HELPERS ============
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2000);
  }

  function showMessage(text, isError) {
    messageEl.innerHTML = text;
    messageEl.className = 'message' + (isError ? ' error' : '');
    messageEl.style.display = 'block';
  }
  function clearMessage() {
    messageEl.style.display = 'none';
    messageEl.textContent = '';
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

  function dayLabel(iso) {
    const d = new Date(iso);
    if (d.toDateString() === new Date().toDateString()) return 'Today';
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  }
  function dateLabel(iso) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // NWS windSpeed is a string like "10 mph" or "5 to 10 mph" — take the max integer.
  function parseWindMax(s) {
    if (!s) return 0;
    const nums = (String(s).match(/\d+/g) || []).map(Number);
    return nums.length ? Math.max.apply(null, nums) : 0;
  }

  // 0-100 wash score. Rain dominates; cold/freezing and high wind penalized.
  // `storm` (thunderstorms in the forecast) is a hard no — can't safely run in lightning.
  function washScore(rain, temp, wind, storm) {
    let score = 100;
    if (rain == null) rain = 0;

    if (rain >= 50)       score -= 70;   // more likely than not — Skip
    else if (rain >= 30)  score -= 30;
    else if (rain >= 15)  score -= 28;   // slight chance of showers — drop out of "Great"

    if (temp < 32)        score -= 60;   // freezing — wash water freezes, unsafe
    else if (temp < 40)   score -= 35;   // cold, surfaces won't dry
    else if (temp < 50)   score -= 12;
    else if (temp > 95)   score -= 10;   // extreme heat, chemicals flash off

    if (wind >= 25)       score -= 25;   // overspray, hard to control
    else if (wind >= 20)  score -= 15;
    else if (wind >= 15)  score -= 8;

    score = Math.max(0, Math.min(100, Math.round(score)));
    if (storm) score = Math.min(score, 20);   // thunderstorms: force Skip
    return score;
  }

  function bucket(score) {
    if (score >= 75) return { label: 'Great', cls: 'b-great' };
    if (score >= 50) return { label: 'OK',    cls: 'b-ok' };
    return                  { label: 'Skip',  cls: 'b-skip' };
  }

  function pickEmoji(sf) {
    const s = (sf || '').toLowerCase();
    if (s.includes('thunder')) return '⛈️';
    if (s.includes('rain') || s.includes('shower') || s.includes('drizzle')) return '🌧️';
    if (s.includes('snow') || s.includes('flurr')) return '❄️';
    if (s.includes('sleet') || s.includes('ice')) return '🧊';
    if (s.includes('fog') || s.includes('haze')) return '🌫️';
    if (s.includes('partly') || s.includes('mostly sunny')) return '⛅';
    if (s.includes('cloud') || s.includes('overcast')) return '☁️';
    if (s.includes('sunny') || s.includes('clear')) return '☀️';
    return '⛅';
  }

  // ============ NETWORK ============
  async function getJson(url, retried) {
    const headers = url.includes('api.weather.gov')
      ? { 'Accept': 'application/geo+json' }
      : { 'Accept': 'application/json' };
    let res;
    try {
      res = await fetch(url, { headers });
    } catch (e) {
      throw new Error('Network error — check your connection.');
    }
    // NWS is occasionally flaky with 5xx; retry once.
    if (res.status >= 500 && url.includes('api.weather.gov') && !retried) {
      await new Promise(r => setTimeout(r, 800));
      return getJson(url, true);
    }
    if (res.status === 404) { const e = new Error('not found'); e.notFound = true; throw e; }
    if (!res.ok) throw new Error('Service error ' + res.status);
    return res.json();
  }

  async function geocodeZip(zip) {
    let data;
    try {
      data = await getJson('https://api.zippopotam.us/us/' + zip);
    } catch (e) {
      if (e.notFound) return null;
      throw e;
    }
    const p = data && data.places && data.places[0];
    if (!p) return null;
    return {
      lat: parseFloat(p.latitude),
      lon: parseFloat(p.longitude),
      name: p['place name'] + ', ' + p['state abbreviation']
    };
  }

  async function geocodeCity(city) {
    const url = 'https://geocoding-api.open-meteo.com/v1/search?name=' +
      encodeURIComponent(city) + '&count=1&country=US';
    const data = await getJson(url);
    const r = data && data.results && data.results[0];
    if (!r) return null;
    return {
      lat: r.latitude,
      lon: r.longitude,
      name: r.admin1 ? (r.name + ', ' + r.admin1) : r.name
    };
  }

  async function fetchForecast(lat, lon) {
    const pts = await getJson(
      'https://api.weather.gov/points/' + lat.toFixed(4) + ',' + lon.toFixed(4));
    const fcUrl = pts.properties && pts.properties.forecast;
    if (!fcUrl) throw new Error('No forecast available for that location.');
    const fc = await getJson(fcUrl);
    const periods = (fc.properties && fc.properties.periods) || [];
    const days = periods
      .filter(p => p.isDaytime)
      .slice(0, 7)
      .map(p => {
        const rain = p.probabilityOfPrecipitation ? p.probabilityOfPrecipitation.value : null;
        const wind = parseWindMax(p.windSpeed);
        const temp = p.temperature;
        const storm = /thunder|t-storm|tstorm/i.test(p.shortForecast || '');
        const score = washScore(rain, temp, wind, storm);
        const b = bucket(score);
        return {
          name: dayLabel(p.startTime),
          date: dateLabel(p.startTime),
          emoji: pickEmoji(p.shortForecast),
          forecast: p.shortForecast || '',
          temp: temp,
          rain: rain == null ? 0 : rain,
          wind: wind,
          score: score,
          bLabel: b.label,
          bCls: b.cls
        };
      });
    if (!days.length) throw new Error('No forecast available for that location.');
    return days;
  }

  // ============ RENDER ============
  function summarize(days) {
    const great = days.filter(d => d.bCls === 'b-great')
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    if (great.length) {
      const names = great.map(d => d.name).join(', ');
      return { label: 'Best wash days this week', text: names };
    }
    const ok = days.filter(d => d.bCls === 'b-ok').sort((a, b) => b.score - a.score)[0];
    if (ok) {
      return { label: 'No standout days', text: 'Best bet: ' + ok.name + ' (OK)' };
    }
    return { label: 'Rough week for washing', text: 'Every day looks marginal — watch the radar.' };
  }

  function render(data) {
    // Status line
    statusLoc.textContent = data.locName;
    statusAge.textContent = 'Updated ' + timeAgo(data.savedAt);
    statusLine.style.display = 'flex';

    // Summary
    const s = summarize(data.days);
    summaryEl.innerHTML =
      '<div class="summary-label">' + s.label + '</div>' +
      '<div class="summary-days">' + s.text + '</div>';
    summaryEl.style.display = 'block';

    // Day cards
    dayList.innerHTML = data.days.map(d =>
      '<div class="day-card ' + d.bCls + '">' +
        '<div class="day-emoji">' + d.emoji + '</div>' +
        '<div class="day-main">' +
          '<div class="day-head">' +
            '<span class="day-name">' + d.name + '</span>' +
            '<span class="day-date">' + d.date + '</span>' +
          '</div>' +
          '<div class="day-forecast">' + d.forecast + '</div>' +
          '<div class="day-stats">' +
            '<span>🌡️ ' + d.temp + '°F</span>' +
            '<span>🌧️ ' + d.rain + '%</span>' +
            '<span>💨 ' + d.wind + ' mph</span>' +
          '</div>' +
        '</div>' +
        '<span class="badge ' + d.bCls + '">' + d.bLabel + '</span>' +
      '</div>'
    ).join('') +
    '<p class="foot-note">Forecast: U.S. National Weather Service. Scores weigh rain, temperature, and wind.</p>';
  }

  // ============ MAIN FLOW ============
  async function runLookup(query) {
    const q = (query || '').trim();
    if (!q) { showToast('Enter a ZIP or city.'); return; }

    checkBtn.disabled = true;
    refreshBtn.disabled = true;
    showMessage('<span class="spinner"></span>Checking forecast…', false);

    try {
      const isZip = /^\d{5}$/.test(q);
      const geo = isZip ? await geocodeZip(q) : await geocodeCity(q);
      if (!geo) {
        showMessage("Couldn't find that location. Try a ZIP like 23320 or \"Chesapeake, VA\".", true);
        return;
      }
      const days = await fetchForecast(geo.lat, geo.lon);

      const data = { savedAt: Date.now(), locName: geo.name, days: days };
      localStorage.setItem(LS_LOCATION, q);
      localStorage.setItem(LS_FORECAST, JSON.stringify(data));

      clearMessage();
      render(data);
    } catch (e) {
      const msg = e && e.message ? e.message : 'Something went wrong.';
      let friendly = msg;
      if (/Service error 5/.test(msg)) friendly = 'Weather service is busy — try again in a minute.';
      // Keep showing the cached forecast if we have one.
      const cached = loadCache();
      if (cached) {
        showMessage(friendly + ' Showing last saved forecast.', true);
        render(cached);
      } else {
        showMessage(friendly, true);
      }
    } finally {
      checkBtn.disabled = false;
      refreshBtn.disabled = false;
    }
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(LS_FORECAST);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // ============ EVENTS ============
  checkBtn.addEventListener('click', () => runLookup(locInput.value));
  locInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); runLookup(locInput.value); }
  });
  refreshBtn.addEventListener('click', () => {
    const last = localStorage.getItem(LS_LOCATION) || locInput.value;
    runLookup(last);
  });

  // ============ INIT ============
  (function init() {
    const lastLoc = localStorage.getItem(LS_LOCATION);
    if (lastLoc) locInput.value = lastLoc;
    const cached = loadCache();
    if (cached) render(cached);
  })();

  // ============ INSTALL PROMPT ============
  const installBtn = $('installBtn');
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'block';
  });
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.style.display = 'none';
  });
  window.addEventListener('appinstalled', () => {
    installBtn.style.display = 'none';
  });

  // ============ SERVICE WORKER ============
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
})();
