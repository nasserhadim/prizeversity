module.exports = async function blockIfFrozen(req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    // If req.user is a mongoose document or plain object, prefer the local value.
    // Otherwise fetch a fresh value to be safe.
    let isFrozen = typeof req.user.isFrozen !== 'undefined'
      ? req.user.isFrozen
      : null;

    if (isFrozen === null) {
      // load minimal field from DB
      const User = require('../models/User');
      const u = await User.findById(req.user._id).select('isFrozen').lean();
      isFrozen = u ? Boolean(u.isFrozen) : false;
    }

    if (isFrozen) {
      return res.status(403).json({ error: 'Your balance is frozen during a siphon review' });
    }
    next();
  } catch (err) {
    console.error('blockIfFrozen error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
