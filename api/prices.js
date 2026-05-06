const { getBitcoinPrice, getGoldPrice } = require('../lib/datasources');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  try {
    const [bitcoin, gold] = await Promise.all([getBitcoinPrice(), getGoldPrice()]);
    res.json({ success: true, data: { bitcoin, gold }, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Prices error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
