const IntegrationApp = require('../models/IntegrationApp');
const User = require('../models/User');

// Simple in-memory rate limiter
const rateCounts = new Map();

// Clean up stale rate keys every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key] of rateCounts) {
    const parts = key.split(':');
    const window = parts[1];
    const bucket = parseInt(parts[2], 10);
    const currentBucket = window === 'minute'
      ? Math.floor(now / 60000)
      : Math.floor(now / 3600000);
    if (bucket < currentBucket - 1) {
      rateCounts.delete(key);
    }
  }
}, 5 * 60 * 1000);

function getRateKey(appId, window) {
  const now = window === 'minute'
    ? Math.floor(Date.now() / 60000)
    : Math.floor(Date.now() / 3600000);
  return `${appId}:${window}:${now}`;
}

async function integrationAuth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return next();

  try {
    const app = await IntegrationApp.findOne({ apiKey: key, active: true });
    if (!app) {
      return res.status(401).json({ error: 'Invalid or revoked API key' });
    }

    // Rate limiting
    const minuteKey = getRateKey(app._id, 'minute');
    const hourKey = getRateKey(app._id, 'hour');
    const minuteCount = (rateCounts.get(minuteKey) || 0) + 1;
    const hourCount = (rateCounts.get(hourKey) || 0) + 1;
    rateCounts.set(minuteKey, minuteCount);
    rateCounts.set(hourKey, hourCount);

    if (minuteCount > app.rateLimit.maxPerMinute) {
      return res.status(429).json({
        error: 'Rate limit exceeded (per-minute)',
        retryAfter: 60
      });
    }
    if (hourCount > app.rateLimit.maxPerHour) {
      return res.status(429).json({
        error: 'Rate limit exceeded (per-hour)',
        retryAfter: 3600
      });
    }

    // Load the owner as the authenticated user
    const owner = await User.findById(app.owner).select('firstName lastName email role');
    if (!owner) {
      return res.status(401).json({ error: 'Integration app owner not found' });
    }

    req.user = owner;
    req.integrationApp = app;

    // Track usage (non-blocking)
    IntegrationApp.updateOne(
      { _id: app._id },
      { $set: { lastUsedAt: new Date() }, $inc: { requestCount: 1 } }
    ).catch(() => {});

    next();
  } catch (err) {
    console.error('[integrationAuth] error:', err);
    res.status(500).json({ error: 'Integration authentication failed' });
  }
}

function requireScope(...scopes) {
  return (req, res, next) => {
    if (!req.integrationApp) return next(); // session user — skip

    const hasAll = scopes.every(s => req.integrationApp.scopes.includes(s));
    if (!hasAll) {
      return res.status(403).json({
        error: `Missing required scope(s): ${scopes.join(', ')}`,
        requiredScopes: scopes,
        grantedScopes: req.integrationApp.scopes
      });
    }

    // Classroom scope check
    const classroomId = req.body?.classroomId || req.params?.classroomId || req.query?.classroomId;
    if (classroomId && req.integrationApp.classrooms.length > 0) {
      const allowed = req.integrationApp.classrooms.some(
        c => c.toString() === classroomId.toString()
      );
      if (!allowed) {
        return res.status(403).json({ error: 'Integration not authorized for this classroom' });
      }
    }

    next();
  };
}

module.exports = { integrationAuth, requireScope };