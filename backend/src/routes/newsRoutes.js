const express = require('express');
const router = express.Router();
const { getNews, FEEDS, searchNews } = require('../utils/newsFetcher');
const { applyRecency, aggregateSentiment } = require('../utils/sentiment');

router.get('/', async (req, res) => {
  try {
    const force = req.query.refresh === '1';
    const result = await getNews({ force });
    const news = applyRecency(result.news);
    res.json({
      updatedAt: new Date(result.fetchedAt).toISOString(),
      sourceCount: FEEDS.length,
      sources: FEEDS.map(f => ({ id: f.id, name: f.name, category: f.category })),
      news,
    });
  } catch (err) {
    console.error('[News API] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

router.get('/sentiment', async (req, res) => {
  try {
    const force = req.query.refresh === '1';
    const result = await getNews({ force });
    const sentiment = aggregateSentiment(result.news);
    res.json({
      updatedAt: new Date(result.fetchedAt).toISOString(),
      ...sentiment,
    });
  } catch (err) {
    console.error('[News Sentiment API] Error:', err.message);
    res.status(500).json({ error: 'Failed to compute market sentiment' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toUpperCase();
    if (!q) return res.status(400).json({ error: 'Missing "q" query parameter (stock symbol or phrase)' });
    const items = await searchNews(q, { max: 12 });
    res.json({
      query: q,
      updatedAt: new Date().toISOString(),
      news: applyRecency(items),
    });
  } catch (err) {
    console.error('[News Search API] Error:', err.message);
    res.status(500).json({ error: 'Failed to search news' });
  }
});

module.exports = router;
