/**
 * Technical Analysis & AI Decision Engine
 * Provides buy/hold/wait recommendations based on price data analysis.
 */

// ─── Indicator Calculations ───

function calcSMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((s, p) => s + p, 0) / period;
}

function calcEMA(prices, period) {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = calcSMA(prices.slice(0, period), period);
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function calcMACD(prices) {
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);
  if (ema12 === null || ema26 === null) return null;

  // Calculate MACD line for signal
  const macdLine = ema12 - ema26;

  // Calculate signal line (9-period EMA of MACD values)
  // Simplified: use recent MACD approximation
  const macdValues = [];
  for (let i = 26; i <= prices.length; i++) {
    const e12 = calcEMA(prices.slice(0, i), 12);
    const e26 = calcEMA(prices.slice(0, i), 26);
    if (e12 !== null && e26 !== null) macdValues.push(e12 - e26);
  }
  const signal = macdValues.length >= 9 ? calcEMA(macdValues, 9) : macdLine;
  const histogram = macdLine - signal;

  return { macdLine, signal, histogram };
}

function calcBollingerBands(prices, period = 20, stdDev = 2) {
  if (prices.length < period) return null;
  const sma = calcSMA(prices, period);
  const slice = prices.slice(-period);
  const variance = slice.reduce((s, p) => s + Math.pow(p - sma, 2), 0) / period;
  const sd = Math.sqrt(variance);
  return {
    upper: sma + stdDev * sd,
    middle: sma,
    lower: sma - stdDev * sd,
    bandwidth: ((sma + stdDev * sd - (sma - stdDev * sd)) / sma) * 100,
  };
}

function calcMomentum(prices, period = 10) {
  if (prices.length < period + 1) return null;
  const current = prices[prices.length - 1];
  const past = prices[prices.length - 1 - period];
  return ((current - past) / past) * 100;
}

function findSupportResistance(prices) {
  if (prices.length < 10) return { support: null, resistance: null };
  const sorted = [...prices].sort((a, b) => a - b);
  const len = sorted.length;
  // Support: average of lower 10%
  const lowSlice = sorted.slice(0, Math.max(3, Math.floor(len * 0.1)));
  const support = lowSlice.reduce((s, p) => s + p, 0) / lowSlice.length;
  // Resistance: average of upper 10%
  const highSlice = sorted.slice(-Math.max(3, Math.floor(len * 0.1)));
  const resistance = highSlice.reduce((s, p) => s + p, 0) / highSlice.length;
  return { support, resistance };
}

// ─── Scoring Engine ───

function scoreRSI(rsi) {
  if (rsi === null) return { score: 50, signal: 'NETRAL', detail: 'Data tidak cukup' };
  if (rsi <= 20) return { score: 95, signal: 'STRONG BUY', detail: `RSI ${rsi.toFixed(1)} — Sangat oversold, potensi rebound tinggi` };
  if (rsi <= 30) return { score: 80, signal: 'BUY', detail: `RSI ${rsi.toFixed(1)} — Oversold, peluang beli` };
  if (rsi <= 45) return { score: 65, signal: 'LEAN BUY', detail: `RSI ${rsi.toFixed(1)} — Mendekati oversold` };
  if (rsi <= 55) return { score: 50, signal: 'NETRAL', detail: `RSI ${rsi.toFixed(1)} — Zona netral` };
  if (rsi <= 70) return { score: 35, signal: 'LEAN WAIT', detail: `RSI ${rsi.toFixed(1)} — Mendekati overbought` };
  if (rsi <= 80) return { score: 20, signal: 'WAIT', detail: `RSI ${rsi.toFixed(1)} — Overbought, sebaiknya tunggu koreksi` };
  return { score: 10, signal: 'STRONG WAIT', detail: `RSI ${rsi.toFixed(1)} — Sangat overbought, risiko koreksi besar` };
}

function scoreMACrossover(prices) {
  const sma7 = calcSMA(prices, 7);
  const sma25 = calcSMA(prices, 25);
  if (sma7 === null || sma25 === null) return { score: 50, signal: 'NETRAL', detail: 'Data tidak cukup' };

  const crossRatio = ((sma7 - sma25) / sma25) * 100;
  if (crossRatio > 3) return { score: 30, signal: 'WAIT', detail: `SMA7 di atas SMA25 (+${crossRatio.toFixed(1)}%) — Uptrend kuat, mungkin sudah terlambat` };
  if (crossRatio > 1) return { score: 55, signal: 'HOLD', detail: `SMA7 sedikit di atas SMA25 (+${crossRatio.toFixed(1)}%) — Uptrend, perhatikan momentum` };
  if (crossRatio > -1) return { score: 60, signal: 'BUY', detail: `SMA7 ≈ SMA25 (${crossRatio.toFixed(1)}%) — Potensi golden cross` };
  if (crossRatio > -3) return { score: 70, signal: 'BUY', detail: `SMA7 di bawah SMA25 (${crossRatio.toFixed(1)}%) — Harga tertekan, peluang beli` };
  return { score: 80, signal: 'STRONG BUY', detail: `SMA7 jauh di bawah SMA25 (${crossRatio.toFixed(1)}%) — Koreksi dalam, peluang beli kuat` };
}

function scoreMacd(macd) {
  if (!macd) return { score: 50, signal: 'NETRAL', detail: 'Data tidak cukup' };
  const { histogram } = macd;
  if (histogram > 0) {
    return { score: 40, signal: 'WAIT', detail: `MACD histogram positif — Momentum bullish masih berjalan` };
  }
  return { score: 65, signal: 'BUY', detail: `MACD histogram negatif — Momentum bearish, bisa jadi peluang beli` };
}

function scoreBollinger(bb, currentPrice) {
  if (!bb) return { score: 50, signal: 'NETRAL', detail: 'Data tidak cukup' };
  const position = (currentPrice - bb.lower) / (bb.upper - bb.lower);
  if (position <= 0.1) return { score: 90, signal: 'STRONG BUY', detail: `Harga di bawah lower band — Sangat murah relatif` };
  if (position <= 0.3) return { score: 70, signal: 'BUY', detail: `Harga mendekati lower band — Peluang beli` };
  if (position <= 0.7) return { score: 50, signal: 'NETRAL', detail: `Harga di tengah Bollinger Band — Zona netral` };
  if (position <= 0.9) return { score: 30, signal: 'WAIT', detail: `Harga mendekati upper band — Potensi overbought` };
  return { score: 15, signal: 'STRONG WAIT', detail: `Harga di atas upper band — Terlalu mahal relatif` };
}

function scoreMomentum(momentum) {
  if (momentum === null) return { score: 50, signal: 'NETRAL', detail: 'Data tidak cukup' };
  if (momentum < -10) return { score: 85, signal: 'STRONG BUY', detail: `Momentum ${momentum.toFixed(1)}% — Penurunan besar, potensi rebound` };
  if (momentum < -5) return { score: 70, signal: 'BUY', detail: `Momentum ${momentum.toFixed(1)}% — Koreksi signifikan` };
  if (momentum < -2) return { score: 60, signal: 'LEAN BUY', detail: `Momentum ${momentum.toFixed(1)}% — Koreksi ringan` };
  if (momentum < 2) return { score: 50, signal: 'NETRAL', detail: `Momentum ${momentum.toFixed(1)}% — Sideways` };
  if (momentum < 5) return { score: 40, signal: 'HOLD', detail: `Momentum ${momentum.toFixed(1)}% — Kenaikan moderat` };
  if (momentum < 10) return { score: 30, signal: 'WAIT', detail: `Momentum ${momentum.toFixed(1)}% — Rally kuat, risiko koreksi` };
  return { score: 15, signal: 'STRONG WAIT', detail: `Momentum ${momentum.toFixed(1)}% — Rally berlebihan` };
}

function scoreSupportResistance(sr, currentPrice) {
  if (!sr.support || !sr.resistance) return { score: 50, signal: 'NETRAL', detail: 'Data tidak cukup' };
  const range = sr.resistance - sr.support;
  const position = (currentPrice - sr.support) / range;
  if (position <= 0.2) return { score: 85, signal: 'STRONG BUY', detail: `Harga dekat support (${position.toFixed(0)}% dari range) — Peluang beli kuat` };
  if (position <= 0.4) return { score: 65, signal: 'BUY', detail: `Harga di bawah tengah range (${(position * 100).toFixed(0)}%) — Peluang beli` };
  if (position <= 0.6) return { score: 50, signal: 'NETRAL', detail: `Harga di tengah range (${(position * 100).toFixed(0)}%) — Zona netral` };
  if (position <= 0.8) return { score: 35, signal: 'WAIT', detail: `Harga mendekati resistance (${(position * 100).toFixed(0)}%) — Sebaiknya tunggu` };
  return { score: 20, signal: 'STRONG WAIT', detail: `Harga dekat resistance (${(position * 100).toFixed(0)}%) — Risiko tinggi` };
}

// ─── Main Analysis ───

function analyzeAsset(priceHistory, currentPrice, assetName) {
  const prices = priceHistory.map((p) => p.price);
  if (prices.length < 5) {
    return {
      asset: assetName,
      recommendation: 'INSUFFICIENT_DATA',
      score: 50,
      message: 'Data historis tidak cukup untuk analisis',
      indicators: [],
    };
  }

  // Calculate indicators
  const rsi = calcRSI(prices, 14);
  const macd = calcMACD(prices);
  const bb = calcBollingerBands(prices, 20, 2);
  const momentum = calcMomentum(prices, 10);
  const sr = findSupportResistance(prices);
  const sma7 = calcSMA(prices, 7);
  const sma25 = calcSMA(prices, 25);
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);

  // Score each indicator
  const scores = {
    rsi: scoreRSI(rsi),
    maCrossover: scoreMACrossover(prices),
    macd: scoreMacd(macd),
    bollinger: scoreBollinger(bb, currentPrice),
    momentum: scoreMomentum(momentum),
    supportResistance: scoreSupportResistance(sr, currentPrice),
  };

  // Weighted average
  const weights = {
    rsi: 0.22,
    maCrossover: 0.18,
    macd: 0.15,
    bollinger: 0.18,
    momentum: 0.15,
    supportResistance: 0.12,
  };

  let totalScore = 0;
  for (const [key, weight] of Object.entries(weights)) {
    totalScore += scores[key].score * weight;
  }
  totalScore = Math.round(totalScore);

  // Map score to recommendation
  let recommendation, message;
  if (totalScore >= 80) {
    recommendation = 'STRONG_BUY';
    message = `Sangat direkomendasikan untuk BELI ${assetName} sekarang. Banyak indikator menunjukkan harga sedang di level yang sangat menarik.`;
  } else if (totalScore >= 65) {
    recommendation = 'BUY';
    message = `Peluang bagus untuk BELI ${assetName}. Beberapa indikator menunjukkan harga di level yang menarik untuk masuk.`;
  } else if (totalScore >= 50) {
    recommendation = 'HOLD';
    message = `${assetName} dalam kondisi netral. Jika sudah punya, HOLD. Jika belum, bisa cicil beli secara bertahap (DCA).`;
  } else if (totalScore >= 35) {
    recommendation = 'WAIT';
    message = `Sebaiknya TUNGGU untuk beli ${assetName}. Harga masih terlihat tinggi dan ada risiko koreksi.`;
  } else {
    recommendation = 'STRONG_WAIT';
    message = `JANGAN BELI ${assetName} sekarang. Indikator menunjukkan harga terlalu tinggi dan sangat berisiko.`;
  }

  const indicators = [
    { name: 'RSI (14)', value: rsi ? rsi.toFixed(1) : 'N/A', ...scores.rsi, weight: weights.rsi },
    { name: 'MA Crossover (7/25)', value: sma7 && sma25 ? `${sma7.toFixed(0)} / ${sma25.toFixed(0)}` : 'N/A', ...scores.maCrossover, weight: weights.maCrossover },
    { name: 'MACD', value: macd ? macd.histogram.toFixed(2) : 'N/A', ...scores.macd, weight: weights.macd },
    { name: 'Bollinger Bands', value: bb ? `${bb.lower.toFixed(0)} – ${bb.upper.toFixed(0)}` : 'N/A', ...scores.bollinger, weight: weights.bollinger },
    { name: 'Momentum (10)', value: momentum ? `${momentum.toFixed(1)}%` : 'N/A', ...scores.momentum, weight: weights.momentum },
    { name: 'Support/Resistance', value: sr.support ? `${sr.support.toFixed(0)} / ${sr.resistance.toFixed(0)}` : 'N/A', ...scores.supportResistance, weight: weights.supportResistance },
  ];

  return {
    asset: assetName,
    currentPrice,
    recommendation,
    score: totalScore,
    message,
    indicators,
    technicals: {
      rsi,
      sma7,
      sma25,
      ema12,
      ema26,
      macd,
      bollingerBands: bb,
      momentum,
      supportResistance: sr,
    },
  };
}

module.exports = { analyzeAsset };
