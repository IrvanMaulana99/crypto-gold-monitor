const { getBitcoinPrice, getGoldPrice, getPegadaianPrice, getBitcoinHistory, getGoldHistory, getPegadaianHistory } = require('../lib/datasources');
const { analyzeAsset } = require('../lib/analyzer');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  try {
    const [btcPrice, goldPrice, pegPrice, btcHistory, goldHistory, pegHistory] = await Promise.all([
      getBitcoinPrice(),
      getGoldPrice(),
      getPegadaianPrice().catch(() => null),
      getBitcoinHistory(30),
      getGoldHistory(30),
      getPegadaianHistory(30).catch(() => null),
    ]);

    const btcAnalysis = analyzeAsset(btcHistory.prices, btcPrice.priceUsd, 'Bitcoin');
    const goldAnalysis = analyzeAsset(goldHistory.prices, goldPrice.pricePerOzUsd, 'Emas Global');

    let pegAnalysis = null;
    if (pegPrice && pegHistory && pegHistory.prices.length > 5) {
      pegAnalysis = analyzeAsset(pegHistory.prices, pegPrice.buyPricePerGram, 'Emas Pegadaian');
    }

    res.json({
      success: true,
      data: {
        bitcoin: { price: btcPrice, analysis: btcAnalysis },
        goldGlobal: { price: goldPrice, analysis: goldAnalysis },
        pegadaian: pegPrice ? { price: pegPrice, analysis: pegAnalysis } : null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
