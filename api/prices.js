const { getBitcoinPrice, getGoldPrice, getPegadaianPrice } = require('../lib/datasources');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');

  try {
    const [bitcoin, goldGlobal, pegadaian] = await Promise.all([
      getBitcoinPrice(),
      getGoldPrice(),
      getPegadaianPrice().catch(() => null),
    ]);
    res.json({
      success: true,
      data: { bitcoin, goldGlobal, pegadaian },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Prices error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
