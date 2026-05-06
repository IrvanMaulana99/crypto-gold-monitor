const { getBitcoinHistory, getGoldHistory } = require('../lib/datasources');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const asset = req.query.asset || 'bitcoin';
  const days = Math.min(parseInt(req.query.days) || 30, 365);

  try {
    let data;
    if (asset === 'gold') {
      data = await getGoldHistory(days);
    } else {
      data = await getBitcoinHistory(days);
    }
    res.json({ success: true, data });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
