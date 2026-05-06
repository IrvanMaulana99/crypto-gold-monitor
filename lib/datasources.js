const fetch = require('node-fetch');

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const VANG_BASE = 'https://www.vang.today/api';
const PEGADAIAN_BASE = 'https://sahabat.pegadaian.co.id/gold/prices/chart';

// In-memory cache
const cache = {};
const CACHE_TTL = 30 * 1000; // 30 seconds

function getCached(key) {
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  cache[key] = { data, ts: Date.now() };
}

const PEGADAIAN_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
};

// ---------- Bitcoin (CoinGecko) ----------

async function getBitcoinPrice() {
  const key = 'btc_price';
  const cached = getCached(key);
  if (cached) return cached;

  const url = `${COINGECKO_BASE}/simple/price?ids=bitcoin&vs_currencies=usd,idr&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
  const json = await res.json();
  const btc = json.bitcoin;
  const data = {
    asset: 'bitcoin',
    symbol: 'BTC',
    priceUsd: btc.usd,
    priceIdr: btc.idr,
    change24h: btc.usd_24h_change,
    volume24hUsd: btc.usd_24h_vol,
    marketCapUsd: btc.usd_market_cap,
    source: 'CoinGecko',
    updatedAt: new Date().toISOString(),
  };
  setCache(key, data);
  return data;
}

async function getBitcoinHistory(days = 30) {
  const key = `btc_history_${days}`;
  const cached = getCached(key);
  if (cached) return cached;

  const url = `${COINGECKO_BASE}/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko history error: ${res.status}`);
  const json = await res.json();
  const data = {
    asset: 'bitcoin',
    symbol: 'BTC',
    days,
    prices: json.prices.map(([ts, price]) => ({ timestamp: ts, price })),
    volumes: json.total_volumes.map(([ts, vol]) => ({ timestamp: ts, volume: vol })),
    marketCaps: json.market_caps.map(([ts, mc]) => ({ timestamp: ts, marketCap: mc })),
    source: 'CoinGecko',
  };
  setCache(key, data);
  return data;
}

// ---------- Gold Global (vang.today + CoinGecko PAXG) ----------

async function getGoldPrice() {
  const key = 'gold_price';
  const cached = getCached(key);
  if (cached) return cached;

  const [xauRes, paxgRes, usdIdrRes] = await Promise.allSettled([
    fetch(`${VANG_BASE}/prices?type=XAUUSD`),
    fetch(`${COINGECKO_BASE}/simple/price?ids=pax-gold&vs_currencies=usd,idr&include_24hr_change=true`),
    fetch(`${COINGECKO_BASE}/simple/price?ids=tether&vs_currencies=idr`),
  ]);

  let xauUsd = null;
  let xauChangeUsd = null;
  let paxgData = null;
  let usdToIdr = 17320;

  if (xauRes.status === 'fulfilled' && xauRes.value.ok) {
    const xauJson = await xauRes.value.json();
    if (xauJson.success) {
      xauUsd = xauJson.buy || xauJson.sell;
      xauChangeUsd = xauJson.change_buy || 0;
    }
  }

  if (paxgRes.status === 'fulfilled' && paxgRes.value.ok) {
    const paxgJson = await paxgRes.value.json();
    paxgData = paxgJson['pax-gold'];
  }

  if (usdIdrRes.status === 'fulfilled' && usdIdrRes.value.ok) {
    const rateJson = await usdIdrRes.value.json();
    if (rateJson.tether && rateJson.tether.idr) {
      usdToIdr = rateJson.tether.idr;
    }
  }

  const pricePerOz = xauUsd || (paxgData ? paxgData.usd : null);
  const pricePerGram = pricePerOz ? pricePerOz / 31.1035 : null;
  const pricePerGramIdr = pricePerGram ? Math.round(pricePerGram * usdToIdr) : null;
  const change24h = paxgData ? paxgData.usd_24h_change : (xauChangeUsd ? (xauChangeUsd / pricePerOz) * 100 : 0);

  const data = {
    asset: 'gold_global',
    symbol: 'XAU',
    pricePerOzUsd: pricePerOz,
    pricePerGramUsd: pricePerGram ? +pricePerGram.toFixed(2) : null,
    pricePerGramIdr: pricePerGramIdr,
    change24h: change24h ? +change24h.toFixed(2) : 0,
    usdToIdr,
    source: xauUsd ? 'vang.today' : 'CoinGecko (PAXG)',
    updatedAt: new Date().toISOString(),
  };
  setCache(key, data);
  return data;
}

async function getGoldHistory(days = 30) {
  const key = `gold_history_${days}`;
  const cached = getCached(key);
  if (cached) return cached;

  const vangDays = Math.min(days, 30);
  const [vangRes, paxgRes] = await Promise.allSettled([
    fetch(`${VANG_BASE}/prices?type=XAUUSD&days=${vangDays}`),
    fetch(`${COINGECKO_BASE}/coins/pax-gold/market_chart?vs_currency=usd&days=${days}`),
  ]);

  let prices = [];

  if (vangRes.status === 'fulfilled' && vangRes.value.ok) {
    const vangJson = await vangRes.value.json();
    if (vangJson.success && vangJson.data && Array.isArray(vangJson.data)) {
      prices = vangJson.data.map((d) => ({
        timestamp: d.update_time * 1000,
        price: d.buy || d.sell,
      }));
    }
  }

  if (prices.length === 0 && paxgRes.status === 'fulfilled' && paxgRes.value.ok) {
    const paxgJson = await paxgRes.value.json();
    if (paxgJson.prices) {
      prices = paxgJson.prices.map(([ts, price]) => ({ timestamp: ts, price }));
    }
  }

  const data = {
    asset: 'gold_global',
    symbol: 'XAU',
    days,
    prices,
    source: prices.length > 0 ? 'vang.today / CoinGecko (PAXG)' : 'unavailable',
  };
  setCache(key, data);
  return data;
}

// ---------- Gold Pegadaian (sahabat.pegadaian.co.id) ----------

async function getPegadaianPrice() {
  const key = 'pegadaian_price';
  const cached = getCached(key);
  if (cached) return cached;

  const res = await fetch(`${PEGADAIAN_BASE}?interval=7&isRequest=true`, { headers: PEGADAIAN_HEADERS });
  if (!res.ok) throw new Error(`Pegadaian API error: ${res.status}`);
  const json = await res.json();

  if (json.responseCode !== '2000000100' || !json.data || !json.data.priceList) {
    throw new Error('Pegadaian API: unexpected response');
  }

  const priceList = json.data.priceList;
  const latest = priceList[priceList.length - 1];
  const previous = priceList.length >= 2 ? priceList[priceList.length - 2] : latest;

  // Prices are per 0.01 gram, multiply by 100 for per gram
  const buyPerGram = parseInt(latest.hargaJual) * 100;
  const sellPerGram = parseInt(latest.hargaBeli) * 100;
  const prevBuyPerGram = parseInt(previous.hargaJual) * 100;
  const change = prevBuyPerGram > 0 ? ((buyPerGram - prevBuyPerGram) / prevBuyPerGram) * 100 : 0;

  const data = {
    asset: 'gold_pegadaian',
    symbol: 'PEGADAIAN',
    buyPricePerGram: buyPerGram,
    sellPricePerGram: sellPerGram,
    buyPricePer001Gram: parseInt(latest.hargaJual),
    sellPricePer001Gram: parseInt(latest.hargaBeli),
    changePct: +change.toFixed(2),
    lastUpdate: latest.lastUpdate,
    source: 'Pegadaian (sahabat.pegadaian.co.id)',
    updatedAt: new Date().toISOString(),
  };
  setCache(key, data);
  return data;
}

async function getPegadaianHistory(days = 30) {
  const key = `pegadaian_history_${days}`;
  const cached = getCached(key);
  if (cached) return cached;

  const interval = Math.min(days, 365);
  const res = await fetch(`${PEGADAIAN_BASE}?interval=${interval}&isRequest=true`, { headers: PEGADAIAN_HEADERS });
  if (!res.ok) throw new Error(`Pegadaian history error: ${res.status}`);
  const json = await res.json();

  if (json.responseCode !== '2000000100' || !json.data || !json.data.priceList) {
    throw new Error('Pegadaian history: unexpected response');
  }

  const prices = json.data.priceList.map((item) => ({
    timestamp: new Date(item.lastUpdate).getTime(),
    price: parseInt(item.hargaJual) * 100, // per gram
    sellPrice: parseInt(item.hargaBeli) * 100,
  }));

  const data = {
    asset: 'gold_pegadaian',
    symbol: 'PEGADAIAN',
    days: interval,
    prices,
    source: 'Pegadaian (sahabat.pegadaian.co.id)',
  };
  setCache(key, data);
  return data;
}

module.exports = {
  getBitcoinPrice,
  getBitcoinHistory,
  getGoldPrice,
  getGoldHistory,
  getPegadaianPrice,
  getPegadaianHistory,
};
