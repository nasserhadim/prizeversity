const SiphonRequest = require('../models/SiphonRequest');

module.exports = async function blockIfFrozen(req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const User = require('../models/User');
    const user = await User.findById(req.user._id).select('isFrozen').lean();
    
    console.log(`[blockIfFrozen] User ${req.user._id} isFrozen: ${user?.isFrozen}`);
    
    if (user?.isFrozen) {
      // Check if there's an active siphon request against this user
      const activeSiphon = await SiphonRequest.findOne({
        targetUser: req.user._id,
        status: { $in: ['pending', 'group_approved'] }
      }).populate('classroom', 'siphonTimeoutHours');

      console.log(`[blockIfFrozen] Active siphon found: ${!!activeSiphon}`);

      if (activeSiphon) {
        const timeRemaining = new Date(activeSiphon.expiresAt) - new Date();
        const hoursRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60));
        
        console.log(`[blockIfFrozen] Blocking user - time remaining: ${hoursRemaining}h`);
        
        return res.status(403).json({ 
          error: `Your account is frozen due to an active siphon request. Time remaining: ${hoursRemaining} hours.`,
          siphonActive: true,
          timeRemaining: hoursRemaining
        });
      }
      
      console.log(`[blockIfFrozen] User frozen but no active siphon found`);
      return res.status(403).json({ error: 'Your account is frozen' });
    }
    
    console.log(`[blockIfFrozen] User not frozen, proceeding`);
    next();
  } catch (err) {
    console.error('blockIfFrozen error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
