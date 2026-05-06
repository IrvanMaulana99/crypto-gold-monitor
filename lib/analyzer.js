/**
 * Technical Analysis & AI Decision Engine
 * Provides buy/hold/wait recommendations based on comprehensive price data analysis.
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

function calcStochRSI(prices, rsiPeriod = 14, stochPeriod = 14) {
  if (prices.length < rsiPeriod + stochPeriod + 1) return null;
  const rsiValues = [];
  for (let i = rsiPeriod + 1; i <= prices.length; i++) {
    const slice = prices.slice(0, i);
    const rsi = calcRSI(slice, rsiPeriod);
    if (rsi !== null) rsiValues.push(rsi);
  }
  if (rsiValues.length < stochPeriod) return null;
  const recent = rsiValues.slice(-stochPeriod);
  const min = Math.min(...recent);
  const max = Math.max(...recent);
  if (max === min) return 50;
  return ((rsiValues[rsiValues.length - 1] - min) / (max - min)) * 100;
}

function calcMACD(prices) {
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);
  if (ema12 === null || ema26 === null) return null;

  const macdLine = ema12 - ema26;
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

function calcROC(prices, period = 12) {
  if (prices.length < period + 1) return null;
  const current = prices[prices.length - 1];
  const past = prices[prices.length - 1 - period];
  return ((current - past) / past) * 100;
}

function calcATR(prices, period = 14) {
  if (prices.length < period + 1) return null;
  let trSum = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const tr = Math.abs(prices[i] - prices[i - 1]);
    trSum += tr;
  }
  return trSum / period;
}

function calcVolatility(prices, period = 20) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const returns = [];
  for (let i = 1; i < slice.length; i++) {
    returns.push((slice[i] - slice[i - 1]) / slice[i - 1]);
  }
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * 100;
}

function calcWilliamsR(prices, period = 14) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const high = Math.max(...slice);
  const low = Math.min(...slice);
  const close = prices[prices.length - 1];
  if (high === low) return -50;
  return ((high - close) / (high - low)) * -100;
}

function findSupportResistance(prices) {
  if (prices.length < 10) return { support: null, resistance: null };
  const sorted = [...prices].sort((a, b) => a - b);
  const len = sorted.length;
  const lowSlice = sorted.slice(0, Math.max(3, Math.floor(len * 0.1)));
  const support = lowSlice.reduce((s, p) => s + p, 0) / lowSlice.length;
  const highSlice = sorted.slice(-Math.max(3, Math.floor(len * 0.1)));
  const resistance = highSlice.reduce((s, p) => s + p, 0) / highSlice.length;
  return { support, resistance };
}

function detectTrend(prices, shortPeriod = 7, longPeriod = 25) {
  const shortSma = calcSMA(prices, shortPeriod);
  const longSma = calcSMA(prices, longPeriod);
  if (!shortSma || !longSma) return 'TIDAK CUKUP DATA';
  const diff = ((shortSma - longSma) / longSma) * 100;
  if (diff > 3) return 'UPTREND KUAT';
  if (diff > 1) return 'UPTREND';
  if (diff > -1) return 'SIDEWAYS';
  if (diff > -3) return 'DOWNTREND';
  return 'DOWNTREND KUAT';
}

// ─── Scoring Engine ───

function scoreRSI(rsi) {
  if (rsi === null) return { score: 50, signal: 'NETRAL', detail: 'Data tidak cukup untuk menghitung RSI. Diperlukan minimal 15 data poin harga untuk kalkulasi yang akurat.' };
  if (rsi <= 20) return { score: 95, signal: 'STRONG BUY', detail: `RSI berada di ${rsi.toFixed(1)}, jauh di bawah level 30 (oversold extreme). Ini menandakan tekanan jual yang sangat besar dan harga kemungkinan sudah terlalu rendah. Secara historis, level RSI ini sering diikuti oleh rebound signifikan. Peluang beli sangat kuat.` };
  if (rsi <= 30) return { score: 80, signal: 'BUY', detail: `RSI di ${rsi.toFixed(1)} memasuki zona oversold (di bawah 30). Artinya tekanan jual sudah berlebihan dan harga berpotensi mengalami pembalikan arah ke atas. Ini adalah sinyal klasik untuk mulai akumulasi posisi beli.` };
  if (rsi <= 45) return { score: 65, signal: 'LEAN BUY', detail: `RSI di ${rsi.toFixed(1)} mendekati zona oversold. Meskipun belum sepenuhnya oversold, momentum jual mulai melemah. Bisa dipertimbangkan untuk mulai cicil beli secara bertahap (DCA).` };
  if (rsi <= 55) return { score: 50, signal: 'NETRAL', detail: `RSI di ${rsi.toFixed(1)} berada di zona netral (40-60). Tidak ada sinyal kuat untuk beli maupun jual. Pasar dalam keseimbangan antara buyer dan seller.` };
  if (rsi <= 70) return { score: 35, signal: 'LEAN WAIT', detail: `RSI di ${rsi.toFixed(1)} mendekati zona overbought. Momentum beli mulai berlebihan dan ada risiko koreksi harga. Sebaiknya tunggu pullback sebelum masuk posisi baru.` };
  if (rsi <= 80) return { score: 20, signal: 'WAIT', detail: `RSI di ${rsi.toFixed(1)} sudah memasuki zona overbought (di atas 70). Tekanan beli sudah berlebihan dan kemungkinan besar akan terjadi koreksi. Sangat disarankan untuk menunggu harga turun.` };
  return { score: 10, signal: 'STRONG WAIT', detail: `RSI di ${rsi.toFixed(1)} berada di level extreme overbought (di atas 80). Ini adalah kondisi yang sangat berisiko untuk membeli. Secara historis, level ini hampir selalu diikuti oleh koreksi tajam.` };
}

function scoreStochRSI(stochRsi) {
  if (stochRsi === null) return { score: 50, signal: 'NETRAL', detail: 'Data tidak cukup untuk menghitung Stochastic RSI.' };
  if (stochRsi <= 10) return { score: 90, signal: 'STRONG BUY', detail: `Stoch RSI di ${stochRsi.toFixed(1)} — extreme oversold. RSI sendiri sudah berada di titik terendah relatifnya. Konfirmasi kuat bahwa aset sangat oversold dan potensi rebound tinggi.` };
  if (stochRsi <= 20) return { score: 75, signal: 'BUY', detail: `Stoch RSI di ${stochRsi.toFixed(1)} memasuki zona oversold. Momentum penurunan mulai melemah, mengindikasikan potensi pembalikan arah.` };
  if (stochRsi <= 40) return { score: 60, signal: 'LEAN BUY', detail: `Stoch RSI di ${stochRsi.toFixed(1)} — di bawah netral, mengindikasikan tekanan jual masih ada namun mulai berkurang.` };
  if (stochRsi <= 60) return { score: 50, signal: 'NETRAL', detail: `Stoch RSI di ${stochRsi.toFixed(1)} — zona netral, tidak ada sinyal arah yang jelas.` };
  if (stochRsi <= 80) return { score: 35, signal: 'LEAN WAIT', detail: `Stoch RSI di ${stochRsi.toFixed(1)} — di atas netral, momentum beli masih berjalan namun mulai mendekati jenuh.` };
  return { score: 15, signal: 'STRONG WAIT', detail: `Stoch RSI di ${stochRsi.toFixed(1)} — extreme overbought. Momentum beli sudah sangat berlebihan, risiko koreksi sangat tinggi.` };
}

function scoreMACrossover(prices) {
  const sma7 = calcSMA(prices, 7);
  const sma25 = calcSMA(prices, 25);
  const sma50 = calcSMA(prices, 50);
  if (sma7 === null || sma25 === null) return { score: 50, signal: 'NETRAL', detail: 'Data tidak cukup untuk menghitung Moving Average crossover.' };

  const crossRatio = ((sma7 - sma25) / sma25) * 100;
  const longTrend = sma50 ? ((sma25 - sma50) / sma50) * 100 : null;
  const trendInfo = longTrend !== null ? ` Tren jangka panjang (SMA25 vs SMA50): ${longTrend > 0 ? 'bullish' : 'bearish'} (${longTrend.toFixed(1)}%).` : '';

  if (crossRatio > 5) return { score: 20, signal: 'WAIT', detail: `SMA 7-hari di atas SMA 25-hari sebesar +${crossRatio.toFixed(1)}%. Ini menunjukkan uptrend yang sudah berjalan cukup jauh. Membeli di posisi ini berisiko karena harga sudah naik signifikan dari rata-ratanya.${trendInfo}` };
  if (crossRatio > 2) return { score: 35, signal: 'LEAN WAIT', detail: `SMA 7-hari di atas SMA 25-hari (+${crossRatio.toFixed(1)}%). Uptrend moderat sedang berjalan. Jika sudah punya posisi, bisa hold. Untuk entry baru, sebaiknya tunggu pullback.${trendInfo}` };
  if (crossRatio > 0.5) return { score: 50, signal: 'HOLD', detail: `SMA 7-hari sedikit di atas SMA 25-hari (+${crossRatio.toFixed(1)}%). Tren masih positif tapi tidak agresif. Cocok untuk strategi DCA (Dollar Cost Averaging).${trendInfo}` };
  if (crossRatio > -0.5) return { score: 60, signal: 'BUY', detail: `SMA 7-hari hampir sama dengan SMA 25-hari (${crossRatio.toFixed(1)}%). Ini bisa menjadi awal dari golden cross (sinyal bullish). Waktu yang baik untuk mulai akumulasi.${trendInfo}` };
  if (crossRatio > -3) return { score: 70, signal: 'BUY', detail: `SMA 7-hari di bawah SMA 25-hari (${crossRatio.toFixed(1)}%). Harga sedang dalam tekanan dan berada di bawah rata-rata. Ini memberikan peluang beli dengan harga diskon dari rata-rata pergerakan.${trendInfo}` };
  return { score: 85, signal: 'STRONG BUY', detail: `SMA 7-hari jauh di bawah SMA 25-hari (${crossRatio.toFixed(1)}%). Terjadi death cross yang dalam, menandakan koreksi besar. Secara kontrarian, ini sering menjadi peluang beli terbaik karena harga sudah jatuh sangat jauh dari rata-ratanya.${trendInfo}` };
}

function scoreMacd(macd) {
  if (!macd) return { score: 50, signal: 'NETRAL', detail: 'Data tidak cukup untuk menghitung MACD. Diperlukan minimal 26 data poin.' };
  const { histogram, macdLine, signal } = macd;
  const crossover = macdLine > signal ? 'bullish' : 'bearish';

  if (histogram > 0 && histogram > Math.abs(signal) * 0.5) {
    return { score: 30, signal: 'WAIT', detail: `MACD histogram positif kuat (${histogram.toFixed(2)}), crossover ${crossover}. Momentum bullish sedang berjalan kencang. Artinya harga sudah naik cukup banyak — membeli sekarang berisiko membeli di puncak momentum.` };
  }
  if (histogram > 0) {
    return { score: 40, signal: 'HOLD', detail: `MACD histogram positif (${histogram.toFixed(2)}), crossover ${crossover}. Ada momentum bullish namun tidak terlalu kuat. Jika sudah punya posisi, hold. Untuk entry baru, bisa mulai cicil kecil.` };
  }
  if (histogram > -Math.abs(signal) * 0.5) {
    return { score: 60, signal: 'LEAN BUY', detail: `MACD histogram negatif ringan (${histogram.toFixed(2)}), crossover ${crossover}. Momentum bearish mulai melemah dan bisa jadi awal pembalikan arah. Peluang untuk mulai akumulasi.` };
  }
  return { score: 75, signal: 'BUY', detail: `MACD histogram negatif kuat (${histogram.toFixed(2)}), crossover ${crossover}. Momentum bearish yang kuat menandakan tekanan jual besar. Secara kontrarian, ini bisa menjadi peluang beli karena tekanan jual biasanya tidak berlangsung selamanya.` };
}

function scoreBollinger(bb, currentPrice) {
  if (!bb) return { score: 50, signal: 'NETRAL', detail: 'Data tidak cukup untuk menghitung Bollinger Bands.' };
  const position = (currentPrice - bb.lower) / (bb.upper - bb.lower);
  const bw = bb.bandwidth;

  if (position <= 0.05) return { score: 95, signal: 'STRONG BUY', detail: `Harga berada di bawah lower Bollinger Band (posisi ${(position * 100).toFixed(0)}%). Ini adalah kondisi extreme — harga sudah keluar dari range normal volatilitas. Secara statistik, harga cenderung kembali ke tengah band. Bandwidth: ${bw.toFixed(1)}%.` };
  if (position <= 0.2) return { score: 75, signal: 'BUY', detail: `Harga berada dekat lower Bollinger Band (posisi ${(position * 100).toFixed(0)}%). Harga relatif murah dibanding range volatilitas normal. Ada potensi harga bergerak naik menuju middle band. Bandwidth: ${bw.toFixed(1)}%.` };
  if (position <= 0.4) return { score: 60, signal: 'LEAN BUY', detail: `Harga di bawah tengah Bollinger Band (posisi ${(position * 100).toFixed(0)}%). Masih dalam zona yang relatif menarik untuk akumulasi. Bandwidth: ${bw.toFixed(1)}%.` };
  if (position <= 0.6) return { score: 50, signal: 'NETRAL', detail: `Harga berada di tengah Bollinger Band (posisi ${(position * 100).toFixed(0)}%). Harga wajar sesuai volatilitas pasar saat ini. Bandwidth: ${bw.toFixed(1)}%.` };
  if (position <= 0.8) return { score: 35, signal: 'LEAN WAIT', detail: `Harga di atas tengah Bollinger Band (posisi ${(position * 100).toFixed(0)}%). Harga mulai relatif mahal dibanding range volatilitas normal. Bandwidth: ${bw.toFixed(1)}%.` };
  if (position <= 0.95) return { score: 20, signal: 'WAIT', detail: `Harga mendekati upper Bollinger Band (posisi ${(position * 100).toFixed(0)}%). Harga sudah mahal relatif terhadap volatilitasnya dan berisiko mengalami pullback. Bandwidth: ${bw.toFixed(1)}%.` };
  return { score: 10, signal: 'STRONG WAIT', detail: `Harga menembus upper Bollinger Band (posisi ${(position * 100).toFixed(0)}%). Kondisi extreme mahal — secara statistik harga cenderung kembali turun ke middle band. Sangat berisiko untuk membeli sekarang. Bandwidth: ${bw.toFixed(1)}%.` };
}

function scoreMomentum(momentum) {
  if (momentum === null) return { score: 50, signal: 'NETRAL', detail: 'Data tidak cukup untuk menghitung momentum harga.' };
  if (momentum < -15) return { score: 90, signal: 'STRONG BUY', detail: `Momentum ${momentum.toFixed(1)}% — penurunan sangat besar dalam 10 periode terakhir. Ini bisa jadi panic selling yang berlebihan. Secara historis, penurunan sebesar ini sering diikuti oleh rebound kuat.` };
  if (momentum < -8) return { score: 75, signal: 'BUY', detail: `Momentum ${momentum.toFixed(1)}% — koreksi signifikan. Tekanan jual yang kuat membuat harga jatuh cukup dalam. Peluang bagus untuk beli di harga rendah.` };
  if (momentum < -3) return { score: 65, signal: 'LEAN BUY', detail: `Momentum ${momentum.toFixed(1)}% — koreksi moderat. Harga turun cukup untuk memberikan diskon dari level sebelumnya. Bisa dipertimbangkan untuk mulai akumulasi.` };
  if (momentum < 3) return { score: 50, signal: 'NETRAL', detail: `Momentum ${momentum.toFixed(1)}% — pergerakan sideways. Harga relatif stabil tanpa arah yang jelas. Pasar sedang konsolidasi.` };
  if (momentum < 8) return { score: 40, signal: 'HOLD', detail: `Momentum ${momentum.toFixed(1)}% — kenaikan moderat. Tren positif tapi belum berlebihan. Bisa hold posisi yang ada, tapi hati-hati untuk entry baru.` };
  if (momentum < 15) return { score: 25, signal: 'WAIT', detail: `Momentum ${momentum.toFixed(1)}% — rally kuat. Harga sudah naik signifikan dan ada risiko profit taking. Sebaiknya tunggu koreksi sebelum beli.` };
  return { score: 10, signal: 'STRONG WAIT', detail: `Momentum ${momentum.toFixed(1)}% — rally berlebihan. Kenaikan terlalu cepat dan tajam. Sangat berisiko membeli di puncak rally seperti ini.` };
}

function scoreWilliamsR(wr) {
  if (wr === null) return { score: 50, signal: 'NETRAL', detail: 'Data tidak cukup untuk menghitung Williams %R.' };
  if (wr <= -80) return { score: 85, signal: 'STRONG BUY', detail: `Williams %R di ${wr.toFixed(1)} (zona oversold, di bawah -80). Harga berada di dekat level terendah dalam 14 periode terakhir. Ini adalah sinyal kuat bahwa aset sudah oversold dan siap untuk rebound.` };
  if (wr <= -60) return { score: 65, signal: 'BUY', detail: `Williams %R di ${wr.toFixed(1)} — mendekati zona oversold. Tekanan jual cukup kuat dan harga mendekati batas bawah range-nya.` };
  if (wr <= -40) return { score: 50, signal: 'NETRAL', detail: `Williams %R di ${wr.toFixed(1)} — zona netral. Harga berada di tengah range 14 periode terakhir.` };
  if (wr <= -20) return { score: 35, signal: 'LEAN WAIT', detail: `Williams %R di ${wr.toFixed(1)} — mendekati zona overbought. Harga sudah relatif tinggi dalam range-nya.` };
  return { score: 15, signal: 'STRONG WAIT', detail: `Williams %R di ${wr.toFixed(1)} (zona overbought, di atas -20). Harga berada di dekat level tertinggi dalam 14 periode terakhir. Sangat berisiko untuk beli.` };
}

function scoreVolatility(vol, atr, currentPrice) {
  if (vol === null) return { score: 50, signal: 'NETRAL', detail: 'Data tidak cukup untuk menghitung volatilitas.' };
  const atrPct = atr ? (atr / currentPrice) * 100 : null;
  const atrInfo = atrPct ? ` ATR (Average True Range): ${atrPct.toFixed(2)}% dari harga saat ini.` : '';

  if (vol < 0.5) return { score: 55, signal: 'LEAN BUY', detail: `Volatilitas rendah (${vol.toFixed(2)}%). Pasar tenang — bisa jadi awal dari pergerakan besar (breakout). Waktu yang baik untuk posisi karena risiko fluktuasi kecil.${atrInfo}` };
  if (vol < 1.5) return { score: 50, signal: 'NETRAL', detail: `Volatilitas normal (${vol.toFixed(2)}%). Pergerakan harga dalam batas wajar. Kondisi pasar sehat.${atrInfo}` };
  if (vol < 3) return { score: 45, signal: 'HOLD', detail: `Volatilitas tinggi (${vol.toFixed(2)}%). Harga bergerak lebih agresif dari biasanya. Hati-hati dengan entry baru, gunakan stop-loss.${atrInfo}` };
  return { score: 35, signal: 'WAIT', detail: `Volatilitas sangat tinggi (${vol.toFixed(2)}%). Pasar sedang bergejolak — risiko tinggi. Sebaiknya tunggu volatilitas menurun sebelum masuk posisi.${atrInfo}` };
}

function scoreSupportResistance(sr, currentPrice) {
  if (!sr.support || !sr.resistance) return { score: 50, signal: 'NETRAL', detail: 'Data tidak cukup untuk menentukan level support dan resistance.' };
  const range = sr.resistance - sr.support;
  const position = (currentPrice - sr.support) / range;

  if (position <= 0.15) return { score: 90, signal: 'STRONG BUY', detail: `Harga sangat dekat dengan level support (Rp/$ ${sr.support.toFixed(0)}). Posisi dalam range: ${(position * 100).toFixed(0)}%. Support adalah level di mana secara historis banyak buyer masuk, sehingga harga cenderung memantul naik dari level ini. Resistance di Rp/$ ${sr.resistance.toFixed(0)}.` };
  if (position <= 0.35) return { score: 70, signal: 'BUY', detail: `Harga berada di sepertiga bawah range (posisi ${(position * 100).toFixed(0)}%). Relatif dekat dengan support di Rp/$ ${sr.support.toFixed(0)} dan jauh dari resistance di Rp/$ ${sr.resistance.toFixed(0)}. Rasio risk/reward cukup menarik.` };
  if (position <= 0.65) return { score: 50, signal: 'NETRAL', detail: `Harga di tengah range support-resistance (posisi ${(position * 100).toFixed(0)}%). Support: Rp/$ ${sr.support.toFixed(0)}, Resistance: Rp/$ ${sr.resistance.toFixed(0)}. Tidak ada keunggulan posisi yang jelas.` };
  if (position <= 0.85) return { score: 30, signal: 'WAIT', detail: `Harga berada di sepertiga atas range (posisi ${(position * 100).toFixed(0)}%). Mendekati resistance di Rp/$ ${sr.resistance.toFixed(0)}. Risiko rejection di level resistance cukup tinggi.` };
  return { score: 15, signal: 'STRONG WAIT', detail: `Harga sangat dekat atau melampaui resistance (posisi ${(position * 100).toFixed(0)}%). Resistance: Rp/$ ${sr.resistance.toFixed(0)}. Ini level di mana banyak seller masuk, sehingga harga sulit naik lebih tinggi. Sangat berisiko.` };
}

// ─── Main Analysis ───

function analyzeAsset(priceHistory, currentPrice, assetName) {
  const prices = priceHistory.map((p) => p.price);
  if (prices.length < 5) {
    return {
      asset: assetName,
      recommendation: 'INSUFFICIENT_DATA',
      score: 50,
      message: 'Data historis tidak cukup untuk analisis yang akurat.',
      indicators: [],
      trend: 'TIDAK CUKUP DATA',
    };
  }

  // Calculate all indicators
  const rsi = calcRSI(prices, 14);
  const stochRsi = calcStochRSI(prices, 14, 14);
  const macd = calcMACD(prices);
  const bb = calcBollingerBands(prices, 20, 2);
  const momentum = calcMomentum(prices, 10);
  const roc = calcROC(prices, 12);
  const atr = calcATR(prices, 14);
  const volatility = calcVolatility(prices, 20);
  const williamsR = calcWilliamsR(prices, 14);
  const sr = findSupportResistance(prices);
  const trend = detectTrend(prices, 7, 25);
  const sma7 = calcSMA(prices, 7);
  const sma25 = calcSMA(prices, 25);
  const sma50 = calcSMA(prices, 50);
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);

  // Score each indicator
  const scores = {
    rsi: scoreRSI(rsi),
    stochRsi: scoreStochRSI(stochRsi),
    maCrossover: scoreMACrossover(prices),
    macd: scoreMacd(macd),
    bollinger: scoreBollinger(bb, currentPrice),
    momentum: scoreMomentum(momentum),
    williamsR: scoreWilliamsR(williamsR),
    volatility: scoreVolatility(volatility, atr, currentPrice),
    supportResistance: scoreSupportResistance(sr, currentPrice),
  };

  // Weighted average
  const weights = {
    rsi: 0.16,
    stochRsi: 0.08,
    maCrossover: 0.14,
    macd: 0.12,
    bollinger: 0.14,
    momentum: 0.10,
    williamsR: 0.08,
    volatility: 0.06,
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
    message = `Sangat direkomendasikan untuk BELI ${assetName} sekarang. Mayoritas indikator teknikal menunjukkan bahwa harga sedang berada di level yang sangat menarik. RSI, Bollinger Bands, dan momentum semuanya mengindikasikan kondisi oversold. Ini adalah momen langka di mana risk/reward ratio sangat menguntungkan pembeli. Pertimbangkan untuk masuk dengan porsi signifikan.`;
  } else if (totalScore >= 65) {
    recommendation = 'BUY';
    message = `Peluang bagus untuk BELI ${assetName}. Beberapa indikator kunci menunjukkan bahwa harga sedang terkoreksi ke level yang menarik. Moving Average dan RSI mendukung sinyal beli. Disarankan untuk mulai akumulasi secara bertahap — bisa masuk 30-50% dari alokasi yang direncanakan, dan sisanya saat ada konfirmasi lebih lanjut.`;
  } else if (totalScore >= 50) {
    recommendation = 'HOLD';
    message = `${assetName} dalam kondisi netral — tidak ada sinyal kuat untuk beli maupun jual. Jika sudah punya posisi, HOLD (tahan). Jika belum punya, strategi terbaik adalah DCA (Dollar Cost Averaging) — cicil beli secara bertahap dengan jumlah tetap setiap minggu/bulan untuk merata-ratakan harga beli.`;
  } else if (totalScore >= 35) {
    recommendation = 'WAIT';
    message = `Sebaiknya TUNGGU untuk beli ${assetName}. Beberapa indikator menunjukkan harga masih dalam zona overbought atau momentum bullish yang terlalu kuat. Ada risiko koreksi dalam waktu dekat. Bersabar dan tunggu pullback — harga yang lebih baik kemungkinan akan datang.`;
  } else {
    recommendation = 'STRONG_WAIT';
    message = `JANGAN BELI ${assetName} sekarang. Hampir semua indikator menunjukkan kondisi overbought extreme. Harga sudah naik terlalu tinggi dan terlalu cepat. Risiko koreksi tajam sangat besar. Tunggu sampai indikator mulai menunjukkan sinyal netral atau oversold sebelum mempertimbangkan untuk beli.`;
  }

  const fmtPrice = (n) => {
    if (n == null) return 'N/A';
    if (n >= 10000) return n.toFixed(0);
    if (n >= 100) return n.toFixed(0);
    return n.toFixed(2);
  };

  const indicators = [
    { name: 'RSI (14)', value: rsi != null ? rsi.toFixed(1) : 'N/A', ...scores.rsi, weight: weights.rsi },
    { name: 'Stochastic RSI', value: stochRsi != null ? stochRsi.toFixed(1) : 'N/A', ...scores.stochRsi, weight: weights.stochRsi },
    { name: 'MA Crossover (7/25)', value: sma7 != null && sma25 != null ? `${fmtPrice(sma7)} / ${fmtPrice(sma25)}` : 'N/A', ...scores.maCrossover, weight: weights.maCrossover },
    { name: 'MACD (12/26/9)', value: macd ? macd.histogram.toFixed(2) : 'N/A', ...scores.macd, weight: weights.macd },
    { name: 'Bollinger Bands (20)', value: bb ? `${fmtPrice(bb.lower)} – ${fmtPrice(bb.upper)}` : 'N/A', ...scores.bollinger, weight: weights.bollinger },
    { name: 'Momentum (10)', value: momentum != null ? `${momentum.toFixed(1)}%` : 'N/A', ...scores.momentum, weight: weights.momentum },
    { name: 'Williams %R (14)', value: williamsR != null ? williamsR.toFixed(1) : 'N/A', ...scores.williamsR, weight: weights.williamsR },
    { name: 'Volatilitas', value: volatility != null ? `${volatility.toFixed(2)}%` : 'N/A', ...scores.volatility, weight: weights.volatility },
    { name: 'Support / Resistance', value: sr.support != null ? `${fmtPrice(sr.support)} / ${fmtPrice(sr.resistance)}` : 'N/A', ...scores.supportResistance, weight: weights.supportResistance },
  ];

  return {
    asset: assetName,
    currentPrice,
    recommendation,
    score: totalScore,
    message,
    trend,
    indicators,
    technicals: {
      rsi, stochRsi, sma7, sma25, sma50, ema12, ema26,
      macd, bollingerBands: bb, momentum, roc, atr, volatility, williamsR,
      supportResistance: sr,
    },
  };
}

module.exports = { analyzeAsset };
