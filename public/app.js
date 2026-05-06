/* ─── CryptoGold Monitor — Frontend App ─── */

const API_BASE = '';
let btcChart = null;
let goldChart = null;
let refreshInterval = null;
let countdown = 60;

// ─── Utilities ───

function fmt(n, dec = 0) {
  if (n == null) return '—';
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
}
function fmtUsd(n, dec = 2) {
  if (n == null) return '$—';
  return '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
}
function fmtIdr(n) {
  if (n == null) return 'Rp —';
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(n);
}
function fmtCompact(n) {
  if (n == null) return '—';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  return fmtUsd(n, 0);
}

function $(id) { return document.getElementById(id); }

// ─── Price Cards ───

async function loadPrices() {
  try {
    const res = await fetch(API_BASE + '/api/prices');
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    const { bitcoin, gold } = json.data;
    updateBtcCard(bitcoin);
    updateGoldCard(gold);
  } catch (err) {
    console.error('Price fetch error:', err);
  }
}

function updateBtcCard(btc) {
  $('btcPriceUsd').textContent = fmtUsd(btc.priceUsd, 0);
  $('btcPriceIdr').textContent = fmtIdr(btc.priceIdr);
  const ch = btc.change24h;
  const badge = $('btcChange');
  badge.textContent = (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%';
  badge.className = 'change-badge ' + (ch >= 0 ? 'change-positive' : 'change-negative');
  $('btcVolume').textContent = fmtCompact(btc.volume24hUsd);
  $('btcMcap').textContent = fmtCompact(btc.marketCapUsd);
}

function updateGoldCard(gold) {
  $('goldPriceUsd').textContent = fmtUsd(gold.pricePerOzUsd, 2) + ' /oz';
  $('goldPriceIdr').textContent = fmtIdr(gold.pricePerGramIdr) + ' /gram';
  const ch = gold.change24h;
  const badge = $('goldChange');
  badge.textContent = (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%';
  badge.className = 'change-badge ' + (ch >= 0 ? 'change-positive' : 'change-negative');
  if (gold.pegadaian) {
    $('pegBuy').textContent = fmtIdr(gold.pegadaian.buyEstimatePerGram);
    $('pegSell').textContent = fmtIdr(gold.pegadaian.sellEstimatePerGram);
    $('pegNote').textContent = gold.pegadaian.note;
  }
}

// ─── Charts ───

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1c2640',
      titleColor: '#e2e8f0',
      bodyColor: '#94a3b8',
      borderColor: '#2d3a50',
      borderWidth: 1,
      padding: 12,
      displayColors: false,
      callbacks: {
        label: function(ctx) {
          return fmtUsd(ctx.parsed.y, 2);
        }
      }
    }
  },
  scales: {
    x: {
      type: 'time',
      grid: { color: 'rgba(30,41,59,.5)', drawBorder: false },
      ticks: { color: '#64748b', font: { size: 11 }, maxTicksLimit: 8 },
    },
    y: {
      grid: { color: 'rgba(30,41,59,.5)', drawBorder: false },
      ticks: {
        color: '#64748b',
        font: { size: 11 },
        callback: (v) => {
          if (v >= 1000) return '$' + (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k';
          return '$' + v.toFixed(0);
        }
      },
    }
  }
};

function createGradient(ctx, color1, color2) {
  const g = ctx.createLinearGradient(0, 0, 0, 280);
  g.addColorStop(0, color1);
  g.addColorStop(1, color2);
  return g;
}

async function loadChart(asset, days) {
  try {
    const res = await fetch(`${API_BASE}/api/history?asset=${asset}&days=${days}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    const data = json.data.prices.map(p => ({ x: new Date(p.timestamp), y: p.price }));
    if (asset === 'bitcoin') {
      renderBtcChart(data);
    } else {
      renderGoldChart(data);
    }
  } catch (err) {
    console.error(`Chart ${asset} error:`, err);
  }
}

function renderBtcChart(data) {
  const canvas = $('btcChart');
  const ctx = canvas.getContext('2d');
  if (btcChart) btcChart.destroy();
  btcChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        data,
        borderColor: '#f7931a',
        borderWidth: 2,
        backgroundColor: createGradient(ctx, 'rgba(247,147,26,.15)', 'rgba(247,147,26,.0)'),
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#f7931a',
      }]
    },
    options: { ...chartDefaults }
  });
}

function renderGoldChart(data) {
  const canvas = $('goldChart');
  const ctx = canvas.getContext('2d');
  if (goldChart) goldChart.destroy();
  goldChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        data,
        borderColor: '#fbbf24',
        borderWidth: 2,
        backgroundColor: createGradient(ctx, 'rgba(251,191,36,.15)', 'rgba(251,191,36,.0)'),
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#fbbf24',
      }]
    },
    options: { ...chartDefaults }
  });
}

// ─── Analysis ───

async function loadAnalysis() {
  try {
    const res = await fetch(API_BASE + '/api/analysis');
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    const { bitcoin, gold } = json.data;
    renderAnalysis('btc', bitcoin);
    renderAnalysis('gold', gold);
  } catch (err) {
    console.error('Analysis error:', err);
  }
}

function getRecColor(score) {
  if (score >= 80) return '#22c55e';
  if (score >= 65) return '#4ade80';
  if (score >= 50) return '#3b82f6';
  if (score >= 35) return '#fbbf24';
  return '#ef4444';
}

function getRecClass(score) {
  if (score >= 80) return 'score-strong-buy';
  if (score >= 65) return 'score-buy';
  if (score >= 50) return 'score-hold';
  if (score >= 35) return 'score-wait';
  return 'score-strong-wait';
}

function getRecText(rec) {
  const map = {
    'STRONG_BUY': 'STRONG BUY',
    'BUY': 'BUY',
    'HOLD': 'HOLD / DCA',
    'WAIT': 'WAIT',
    'STRONG_WAIT': 'JANGAN BELI',
    'INSUFFICIENT_DATA': 'DATA KURANG',
  };
  return map[rec] || rec;
}

function getSignalClass(signal) {
  const s = signal.toLowerCase().replace(/\s+/g, '-');
  return 'signal-' + s;
}

function renderAnalysis(prefix, data) {
  const a = data.analysis;
  const p = data.price;

  // Price
  if (prefix === 'btc') {
    $('analysisBtcPrice').textContent = fmtUsd(p.priceUsd, 0);
  } else {
    $('analysisGoldPrice').textContent = fmtUsd(p.pricePerOzUsd, 2) + ' /oz';
  }

  // Score ring
  const ring = $(prefix + 'ScoreRing');
  const circumference = 2 * Math.PI * 52; // r=52
  const offset = circumference - (a.score / 100) * circumference;
  ring.style.strokeDashoffset = offset;
  ring.style.stroke = getRecColor(a.score);

  // Score value
  const scoreEl = $(prefix + 'Score');
  scoreEl.textContent = a.score;
  scoreEl.className = 'score-value ' + getRecClass(a.score);

  // Recommendation text
  const labelEl = $(prefix + 'RecLabel');
  labelEl.textContent = getRecText(a.recommendation);
  labelEl.className = 'rec-label ' + getRecClass(a.score);

  $(prefix + 'RecMessage').textContent = a.message;

  // Indicators
  const listEl = $(prefix + 'Indicators');
  listEl.innerHTML = '';
  if (a.indicators) {
    a.indicators.forEach(ind => {
      const row = document.createElement('div');
      row.className = 'indicator-row';
      row.innerHTML = `
        <span class="indicator-name">${ind.name}</span>
        <span class="indicator-value">${ind.value}</span>
        <span class="indicator-signal ${getSignalClass(ind.signal)}">${ind.signal}</span>
      `;
      listEl.appendChild(row);
    });
  }
}

// ─── Timeframe Buttons ───

document.querySelectorAll('.timeframe-btns').forEach(group => {
  const chart = group.dataset.chart;
  group.querySelectorAll('.tf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const days = parseInt(btn.dataset.days);
      const asset = chart === 'btc' ? 'bitcoin' : 'gold';
      loadChart(asset, days);
    });
  });
});

// ─── Auto Refresh ───

function startTimer() {
  countdown = 60;
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    countdown--;
    $('updateTimer').textContent = `Update: ${countdown}s`;
    if (countdown <= 0) {
      loadAll();
      countdown = 60;
    }
  }, 1000);
}

// ─── Init ───

async function loadAll() {
  $('updateTimer').textContent = 'Memuat...';
  await Promise.all([
    loadPrices(),
    loadChart('bitcoin', 7),
    loadChart('gold', 7),
    loadAnalysis(),
  ]);
  $('updateTimer').textContent = 'Update: 60s';
}

loadAll().then(startTimer);
