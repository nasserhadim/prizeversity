const axios = require('axios');
const config = require('../config/reviewProvider');

// ---------------------------------------------------------------------------
// Normalized response shape
// ---------------------------------------------------------------------------
// {
//   reviews: [{ id, author, rating, title, text, date, verified, source }],
//   pagination: { page, perPage, totalPages },
//   summary: { averageRating, totalReviews, ratingDistribution: {1..5} }
// }
// ---------------------------------------------------------------------------

// Simple in-memory cache keyed by request fingerprint
const cache = new Map();

function cacheKey(type, params) {
  return `${type}:${JSON.stringify(params)}`;
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > config.cacheMinutes * 60 * 1000) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

// ---------------------------------------------------------------------------
// Trustpilot adapter
// ---------------------------------------------------------------------------
const trustpilot = {
  async getReviews({ page = 1, perPage = 10 }) {
    const key = cacheKey('tp_reviews', { page, perPage });
    const cached = getCached(key);
    if (cached) return cached;

    const url = `https://api.trustpilot.com/v1/business-units/${encodeURIComponent(config.businessId)}/reviews`;
    const { data } = await axios.get(url, {
      params: {
        apikey: config.apiKey,
        page,
        perPage,
        orderBy: 'createdat.desc',
      },
      timeout: 10000,
    });

    const result = {
      reviews: (data.reviews || []).map((r) => ({
        id: r.id,
        author: r.consumer?.displayName || 'Anonymous',
        rating: r.stars,
        title: r.title || '',
        text: r.text || '',
        date: r.createdAt,
        verified: !!r.isVerified,
        source: 'trustpilot',
      })),
      pagination: {
        page: Number(page),
        perPage: Number(perPage),
        totalPages: data.pages || 1,
      },
    };

    setCache(key, result);
    return result;
  },

  async getSummary() {
    const key = cacheKey('tp_summary', {});
    const cached = getCached(key);
    if (cached) return cached;

    const url = `https://api.trustpilot.com/v1/business-units/${encodeURIComponent(config.businessId)}`;
    const { data } = await axios.get(url, {
      params: { apikey: config.apiKey },
      timeout: 10000,
    });

    const dist = {};
    if (data.stars) {
      // Trustpilot returns starsDistribution as array [{stars:1,count:10},...]
      // or as part of the response
      for (let s = 1; s <= 5; s++) dist[s] = 0;
      if (Array.isArray(data.starsDistribution)) {
        data.starsDistribution.forEach((d) => { dist[d.stars] = d.count; });
      }
    }

    const result = {
      averageRating: data.score?.trustScore ?? data.trustScore ?? 0,
      totalReviews: data.numberOfReviews?.total ?? 0,
      ratingDistribution: dist,
    };

    setCache(key, result);
    return result;
  },

  getSubmitUrl() {
    return config.submitUrl || `https://www.trustpilot.com/evaluate/${config.businessId}`;
  },
};

// ---------------------------------------------------------------------------
// Provider registry – add new adapters here
// ---------------------------------------------------------------------------
const adapters = {
  trustpilot,
};

function getAdapter() {
  const name = config.provider;
  if (!name) return null;
  const adapter = adapters[name];
  if (!adapter) return null;
  return adapter;
}

module.exports = { getAdapter };
