const fetch = require('node-fetch');

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const VANG_BASE = 'https://www.vang.today/api';

// In-memory cache
const cache = {};
const CACHE_TTL = 60 * 1000; // 60 seconds

function getCached(key) {
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  cache[key] = { data, ts: Date.now() };
}

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

// ---------- Gold (vang.today + CoinGecko PAXG) ----------

async function getGoldPrice() {
  const key = 'gold_price';
  const cached = getCached(key);
  if (cached) return cached;

  // Fetch both XAU/USD from vang.today and PAXG from CoinGecko
  const [xauRes, paxgRes, usdIdrRes] = await Promise.allSettled([
    fetch(`${VANG_BASE}/prices?type=XAUUSD`),
    fetch(`${COINGECKO_BASE}/simple/price?ids=pax-gold&vs_currencies=usd,idr&include_24hr_change=true`),
    fetch(`${COINGECKO_BASE}/simple/price?ids=tether&vs_currencies=idr`), // USD→IDR rate proxy
  ]);

  let xauUsd = null;
  let xauChangeUsd = null;
  let paxgData = null;
  let usdToIdr = 17320; // fallback rate

  // Parse vang.today
  if (xauRes.status === 'fulfilled' && xauRes.value.ok) {
    const xauJson = await xauRes.value.json();
    if (xauJson.success) {
      xauUsd = xauJson.buy || xauJson.sell;
      xauChangeUsd = xauJson.change_buy || 0;
    }
  }

  // Parse CoinGecko PAXG
  if (paxgRes.status === 'fulfilled' && paxgRes.value.ok) {
    const paxgJson = await paxgRes.value.json();
    paxgData = paxgJson['pax-gold'];
  }

  // Parse USD to IDR
  if (usdIdrRes.status === 'fulfilled' && usdIdrRes.value.ok) {
    const rateJson = await usdIdrRes.value.json();
    if (rateJson.tether && rateJson.tether.idr) {
      usdToIdr = rateJson.tether.idr; // USDT≈1 USD
    }
  }

  // Use vang.today as primary, PAXG as fallback
  const pricePerOz = xauUsd || (paxgData ? paxgData.usd : null);
  const pricePerGram = pricePerOz ? pricePerOz / 31.1035 : null;
  const pricePerGramIdr = pricePerGram ? Math.round(pricePerGram * usdToIdr) : null;

  // Pegadaian estimate: global price per gram in IDR + ~2-4% markup
  const pegadaianBuyEstimate = pricePerGramIdr ? Math.round(pricePerGramIdr * 1.03) : null;
  const pegadaianSellEstimate = pricePerGramIdr ? Math.round(pricePerGramIdr * 0.97) : null;

  const change24h = paxgData ? paxgData.usd_24h_change : (xauChangeUsd ? (xauChangeUsd / pricePerOz) * 100 : 0);

  const data = {
    asset: 'gold',
    symbol: 'XAU',
    pricePerOzUsd: pricePerOz,
    pricePerGramUsd: pricePerGram ? +pricePerGram.toFixed(2) : null,
    pricePerGramIdr: pricePerGramIdr,
    change24h: change24h ? +change24h.toFixed(2) : 0,
    pegadaian: {
      buyEstimatePerGram: pegadaianBuyEstimate,
      sellEstimatePerGram: pegadaianSellEstimate,
      note: 'Estimasi berdasarkan harga emas global + markup ~3%. Harga Pegadaian aktual bisa berbeda.',
    },
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

  // Try vang.today first (max 30 days)
  const vangDays = Math.min(days, 30);
  const [vangRes, paxgRes] = await Promise.allSettled([
    fetch(`${VANG_BASE}/prices?type=XAUUSD&days=${vangDays}`),
    fetch(`${COINGECKO_BASE}/coins/pax-gold/market_chart?vs_currency=usd&days=${days}`),
  ]);

  let prices = [];

  // Try vang.today
  if (vangRes.status === 'fulfilled' && vangRes.value.ok) {
    const vangJson = await vangRes.value.json();
    if (vangJson.success && vangJson.data && Array.isArray(vangJson.data)) {
      prices = vangJson.data.map((d) => ({
        timestamp: d.update_time * 1000,
        price: d.buy || d.sell,
      }));
    }
  }

  // Fallback to PAXG
  if (prices.length === 0 && paxgRes.status === 'fulfilled' && paxgRes.value.ok) {
    const paxgJson = await paxgRes.value.json();
    if (paxgJson.prices) {
      prices = paxgJson.prices.map(([ts, price]) => ({ timestamp: ts, price }));
    }
  }

  const data = {
    asset: 'gold',
    symbol: 'XAU',
    days,
    prices,
    source: prices.length > 0 ? 'vang.today / CoinGecko (PAXG)' : 'unavailable',
  };
  setCache(key, data);
  return data;
}

module.exports = {
  getBitcoinPrice,
  getBitcoinHistory,
  getGoldPrice,
  getGoldHistory,
};
