const express = require('express');
const router = express.Router();
const { getAdapter } = require('../services/reviewProvider');
const config = require('../config/reviewProvider');

// GET /api/reviews/config – public config (no secrets)
router.get('/config', (_req, res) => {
  const adapter = getAdapter();
  const mode = config.mode || 'widget';
  const provider = config.provider || null;
  const enabled = mode === 'widget' ? !!provider && !!config.businessId : !!adapter;

  const response = {
    enabled,
    provider,
    mode,
    submitUrl: config.submitUrl || null,
  };

  // Widget mode: send info the frontend needs to render the embed
  if (mode === 'widget' && enabled) {
    response.widget = {
      businessId: config.businessId,
      businessUrl: config.businessUrl || null,
      templateId: config.widgetTemplate || null,
      token: config.widgetToken || null,
    };
  }

  res.json(response);
});

// GET /api/reviews – paginated reviews
router.get('/', async (req, res) => {
  try {
    const adapter = getAdapter();
    if (!adapter) return res.status(503).json({ error: 'Review provider not configured' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(50, Math.max(1, parseInt(req.query.perPage, 10) || 10));
    const data = await adapter.getReviews({ page, perPage });
    res.json(data);
  } catch (err) {
    console.error('Reviews fetch error:', err.message);
    res.status(502).json({ error: 'Failed to fetch reviews from provider' });
  }
});

// GET /api/reviews/summary – aggregate stats
router.get('/summary', async (_req, res) => {
  try {
    const adapter = getAdapter();
    if (!adapter) return res.status(503).json({ error: 'Review provider not configured' });

    const data = await adapter.getSummary();
    res.json(data);
  } catch (err) {
    console.error('Reviews summary error:', err.message);
    res.status(502).json({ error: 'Failed to fetch review summary from provider' });
  }
});

module.exports = router;
