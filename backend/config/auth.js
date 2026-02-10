const ensureAuthenticated = (req, res, next) => {
    // Allow session-based auth (Passport)
    if (req.isAuthenticated()) {
      return next();
    }
    // Allow API-key auth (set by integrationAuth middleware)
    if (req.integrationApp && req.user) {
      return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
  };
  
  module.exports = { ensureAuthenticated };