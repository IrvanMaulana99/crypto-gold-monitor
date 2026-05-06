/* ─── CryptoGold Monitor — App ─── */

const API_BASE = window.location.origin;
const REFRESH_INTERVAL = 30; // seconds

// ─── Formatters ───
const fmt = (n, dec = 0) => n != null ? n.toLocaleString('id-ID', { maximumFractionDigits: dec }) : '—';
const fmtUsd = (n) => n != null ? '$' + n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 0 : 2 }) : '$—';
const fmtIdr = (n) => n != null ? 'Rp ' + n.toLocaleString('id-ID') : 'Rp —';
const fmtCompact = (n) => {
  if (n == null) return '—';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  return '$' + fmt(n);
};

// ─── State ───
let btcChart = null, goldChart = null, pegChart = null;
let btcDays = 7, goldDays = 7, pegDays = 7;
let countdown = REFRESH_INTERVAL;
let timerInterval = null;

// ─── Price Loading ───
async function loadPrices() {
  try {
    const res = await fetch(`${API_BASE}/api/prices`);
    const json = await res.json();
    if (!json.success) return;
    updateBtcCard(json.data.bitcoin);
    updateGoldCard(json.data.goldGlobal);
    updatePegCard(json.data.pegadaian);
  } catch (e) {
    console.error('Price fetch error:', e);
  }
}

function updateBtcCard(d) {
  if (!d) return;
  document.getElementById('btcPriceUsd').textContent = fmtUsd(d.priceUsd);
  document.getElementById('btcPriceIdr').textContent = fmtIdr(d.priceIdr);
  document.getElementById('btcVolume').textContent = fmtCompact(d.volume24hUsd);
  document.getElementById('btcMcap').textContent = fmtCompact(d.marketCapUsd);
  const badge = document.getElementById('btcChange');
  const ch = d.change24h;
  badge.textContent = (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%';
  badge.className = 'change-badge ' + (ch >= 0 ? 'change-up' : 'change-down');
}

function updateGoldCard(d) {
  if (!d) return;
  document.getElementById('goldPriceUsd').textContent = fmtUsd(d.pricePerOzUsd) + ' /oz';
  document.getElementById('goldPriceIdr').textContent = fmtIdr(d.pricePerGramIdr) + ' /gram';
  const badge = document.getElementById('goldChange');
  const ch = d.change24h;
  badge.textContent = (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%';
  badge.className = 'change-badge ' + (ch >= 0 ? 'change-up' : 'change-down');
}

function updatePegCard(d) {
  if (!d) return;
  document.getElementById('pegBuy').textContent = fmtIdr(d.buyPricePerGram);
  document.getElementById('pegSell').textContent = fmtIdr(d.sellPricePerGram);
  document.getElementById('pegBuy001').textContent = fmtIdr(d.buyPricePer001Gram);
  document.getElementById('pegSell001').textContent = fmtIdr(d.sellPricePer001Gram);
  const badge = document.getElementById('pegChange');
  const ch = d.changePct;
  badge.textContent = (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%';
  badge.className = 'change-badge ' + (ch >= 0 ? 'change-up' : 'change-down');
}

// ─── Charts ───
function chartGradient(ctx, color) {
  const g = ctx.createLinearGradient(0, 0, 0, 260);
  g.addColorStop(0, color + '40');
  g.addColorStop(1, color + '00');
  return g;
}

function createChart(canvasId, data, color, yPrefix, yPostfix) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  const context = ctx.getContext('2d');
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(p => new Date(p.timestamp)),
      datasets: [{
        data: data.map(p => p.price),
        borderColor: color,
        backgroundColor: chartGradient(context, color),
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        mode: 'index', intersect: false,
        callbacks: {
          label: (ctx) => (yPrefix || '') + fmt(ctx.raw, 2) + (yPostfix || ''),
        },
      }},
      scales: {
        x: { type: 'time', grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } },
        y: {
          grid: { color: '#1e293b' },
          ticks: {
            color: '#64748b', font: { size: 11 },
            callback: (v) => (yPrefix || '') + fmtChartTick(v) + (yPostfix || ''),
          },
        },
      },
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
    },
  });
}

function fmtChartTick(v) {
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(v >= 1e4 ? 0 : 1) + 'k';
  return v.toFixed(v >= 100 ? 0 : 2);
}

async function renderChart(chartRef, canvasId, asset, days, color, yPrefix, yPostfix) {
  try {
    const res = await fetch(`${API_BASE}/api/history?asset=${asset}&days=${days}`);
    const json = await res.json();
    if (!json.success || !json.data.prices.length) return chartRef;
    if (chartRef) chartRef.destroy();
    return createChart(canvasId, json.data.prices, color, yPrefix, yPostfix);
  } catch (e) {
    console.error(`Chart error (${asset}):`, e);
    return chartRef;
  }
}

async function renderAllCharts() {
  [btcChart, goldChart, pegChart] = await Promise.all([
    renderChart(btcChart, 'btcChart', 'bitcoin', btcDays, '#f7931a', '$'),
    renderChart(goldChart, 'goldChart', 'gold', goldDays, '#fbbf24', '$'),
    renderChart(pegChart, 'pegChart', 'pegadaian', pegDays, '#38bdf8', 'Rp '),
  ]);
}

// ─── Timeframe buttons ───
document.querySelectorAll('.timeframe-btns').forEach(group => {
  group.querySelectorAll('.tf-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      group.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const days = parseInt(btn.dataset.days);
      const chart = group.dataset.chart;
      if (chart === 'btc') { btcDays = days; btcChart = await renderChart(btcChart, 'btcChart', 'bitcoin', days, '#f7931a', '$'); }
      else if (chart === 'gold') { goldDays = days; goldChart = await renderChart(goldChart, 'goldChart', 'gold', days, '#fbbf24', '$'); }
      else if (chart === 'peg') { pegDays = days; pegChart = await renderChart(pegChart, 'pegChart', 'pegadaian', days, '#38bdf8', 'Rp '); }
    });
  });
});

// ─── Analysis ───
async function renderAnalysis() {
  try {
    const res = await fetch(`${API_BASE}/api/analysis`);
    const json = await res.json();
    if (!json.success) return;
    const d = json.data;

    renderAssetAnalysis('btc', d.bitcoin);
    renderAssetAnalysis('gold', d.goldGlobal);
    if (d.pegadaian) {
      renderAssetAnalysis('peg', d.pegadaian);
    }
  } catch (e) {
    console.error('Analysis error:', e);
  }
}

function renderAssetAnalysis(prefix, data) {
  if (!data || !data.analysis) return;
  const { analysis, price } = data;

  // Price display
  const priceEl = document.getElementById(`analysis${cap(prefix)}Price`);
  if (priceEl) {
    if (prefix === 'btc') priceEl.textContent = fmtUsd(price.priceUsd);
    else if (prefix === 'gold') priceEl.textContent = fmtUsd(price.pricePerOzUsd) + ' /oz';
    else if (prefix === 'peg') priceEl.textContent = fmtIdr(price.buyPricePerGram) + ' /gram';
  }

  // Trend
  const trendEl = document.getElementById(`analysis${cap(prefix)}Trend`);
  if (trendEl && analysis.trend) trendEl.textContent = 'Tren: ' + analysis.trend;

  // Score ring
  const score = analysis.score;
  const ring = document.getElementById(`${prefix}ScoreRing`);
  if (ring) {
    const circumference = 2 * Math.PI * 52;
    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset = circumference - (circumference * score / 100);
    ring.style.stroke = scoreColor(score);
  }
  const scoreEl = document.getElementById(`${prefix}Score`);
  if (scoreEl) scoreEl.textContent = score;

  // Recommendation
  const stateClass = getStateClass(analysis.recommendation);
  const recLabel = document.getElementById(`${prefix}RecLabel`);
  const recMsg = document.getElementById(`${prefix}RecMessage`);
  if (recLabel) {
    recLabel.textContent = recLabelText(analysis.recommendation);
    recLabel.closest('.recommendation-box')?.parentElement?.classList.remove('strong-buy-state', 'buy-state', 'hold-state', 'wait-state', 'strong-wait-state');
    recLabel.closest('.recommendation-box')?.parentElement?.classList.add(stateClass);
  }
  if (recMsg) recMsg.textContent = analysis.message;

  // Indicators
  const container = document.getElementById(`${prefix}Indicators`);
  if (!container) return;
  container.innerHTML = '';
  for (const ind of analysis.indicators) {
    const signalClass = getSignalClass(ind.signal);
    const weightPct = (ind.weight * 100).toFixed(0);
    const row = document.createElement('div');
    row.className = 'indicator-wrapper';
    row.innerHTML = `
      <div class="indicator-row">
        <span class="indicator-name">${ind.name}</span>
        <span class="indicator-value">${ind.value}</span>
        <span class="indicator-signal ${signalClass}">${ind.signal}</span>
      </div>
      <div class="indicator-detail">${ind.detail} <span style="opacity:.5">(bobot: ${weightPct}%)</span></div>
    `;
    container.appendChild(row);
  }
}

function cap(s) {
  if (s === 'btc') return 'Btc';
  if (s === 'gold') return 'Gold';
  if (s === 'peg') return 'Peg';
  return s;
}

function scoreColor(score) {
  if (score >= 80) return '#22c55e';
  if (score >= 65) return '#4ade80';
  if (score >= 50) return '#fbbf24';
  if (score >= 35) return '#fb923c';
  return '#ef4444';
}

function getStateClass(rec) {
  const map = { STRONG_BUY: 'strong-buy-state', BUY: 'buy-state', HOLD: 'hold-state', WAIT: 'wait-state', STRONG_WAIT: 'strong-wait-state' };
  return map[rec] || 'hold-state';
}

function recLabelText(rec) {
  const map = {
    STRONG_BUY: 'SANGAT LAYAK BELI',
    BUY: 'LAYAK BELI',
    HOLD: 'HOLD / DCA',
    WAIT: 'TUNGGU',
    STRONG_WAIT: 'JANGAN BELI',
  };
  return map[rec] || rec;
}

function getSignalClass(signal) {
  const s = signal.toLowerCase().replace(/\s+/g, '-');
  const map = {
    'strong-buy': 'sig-strong-buy',
    'buy': 'sig-buy',
    'lean-buy': 'sig-lean-buy',
    'hold': 'sig-hold',
    'netral': 'sig-netral',
    'lean-wait': 'sig-lean-wait',
    'wait': 'sig-wait',
    'strong-wait': 'sig-strong-wait',
  };
  return map[s] || 'sig-netral';
}

// ─── Timer ───
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  countdown = REFRESH_INTERVAL;
  document.getElementById('updateTimer').textContent = `Update: ${countdown}s`;
  timerInterval = setInterval(() => {
    countdown--;
    document.getElementById('updateTimer').textContent = `Update: ${countdown}s`;
    if (countdown <= 0) {
      loadAll();
      countdown = REFRESH_INTERVAL;
    }
  }, 1000);
}

// ─── Load All ───
async function loadAll() {
  await Promise.all([loadPrices(), renderAllCharts(), renderAnalysis()]);
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
  loadAll().then(() => startTimer());
});
