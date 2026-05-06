const { getBitcoinPrice, getGoldPrice, getBitcoinHistory, getGoldHistory } = require('../lib/datasources');
const { analyzeAsset } = require('../lib/analyzer');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  try {
    const [btcPrice, goldPrice, btcHistory, goldHistory] = await Promise.all([
      getBitcoinPrice(),
      getGoldPrice(),
      getBitcoinHistory(30),
      getGoldHistory(30),
    ]);

    const btcAnalysis = analyzeAsset(btcHistory.prices, btcPrice.priceUsd, 'Bitcoin');
    const goldAnalysis = analyzeAsset(goldHistory.prices, goldPrice.pricePerOzUsd, 'Emas (Gold)');

    res.json({
      success: true,
      data: {
        bitcoin: { price: btcPrice, analysis: btcAnalysis },
        gold: { price: goldPrice, analysis: goldAnalysis },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
