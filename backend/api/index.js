const { app, ensureConnected } = require('../index.js');

module.exports = async function handler(req, res) {
  try {
    await ensureConnected();
    app(req, res);
  } catch (err) {
    console.error('[Vercel handler] Database unavailable:', err.message);
    res.status(500).json({ error: 'Database unavailable', message: err.message });
  }
};

module.exports.config = { maxDuration: 60 };
