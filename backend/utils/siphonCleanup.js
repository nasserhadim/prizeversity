const SiphonRequest = require('../models/SiphonRequest');
const User = require('../models/User');

async function cleanupExpiredSiphons() {
  try {
    const expiredSiphons = await SiphonRequest.find({
      status: 'pending',
      expiresAt: { $lt: new Date() }
    });

    for (const siphon of expiredSiphons) {
      siphon.status = 'expired';
      await siphon.save();
      
      // Unfreeze the target user
      await User.findByIdAndUpdate(siphon.targetUser, { isFrozen: false });
      
      console.log(`Expired siphon request ${siphon._id} and unfroze user ${siphon.targetUser}`);
    }

    if (expiredSiphons.length > 0) {
      console.log(`Cleaned up ${expiredSiphons.length} expired siphon requests`);
    }
  } catch (err) {
    console.error('Error cleaning up expired siphons:', err);
  }
}

// Run every 10 minutes
setInterval(cleanupExpiredSiphons, 10 * 60 * 1000);

module.exports = { cleanupExpiredSiphons };