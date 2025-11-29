const User = require('../models/User');
const Badge = require('../models/Badge');
const Notification = require('../models/Notification');
const { calculateLevelFromXP } = require('./xp');
const { populateNotification } = require('./notifications'); // path matches your project utils

/**
 * Award XP to a user in a specific classroom
 * @param {string} userId - User ID
 * @param {string} classroomId - Classroom ID
 * @param {number} xpAmount - Amount of XP to award
 * @param {string} reason - Reason for XP award
 * @param {object} xpSettings - Classroom XP settings
 * @param {object} options - Additional options
 * @returns {Promise<object>} { leveledUp, oldLevel, newLevel, earnedBadges }
 */
async function awardXP(userId, classroomId, xpAmount, reason, xpSettings, options = {}) {
  if (!xpSettings?.enabled || xpAmount <= 0) {
    return { leveledUp: false, oldLevel: 1, newLevel: 1, earnedBadges: [] };
  }

  // Allow caller to pass an already-loaded mongoose user doc to avoid save/version races
  const user = options.user || await User.findById(userId);
  if (!user) throw new Error('User not found');

  // Find or create classroom XP entry
  let classroomXPEntry = user.classroomXP.find(
    cx => cx.classroom.toString() === classroomId.toString()
  );

  if (!classroomXPEntry) {
    classroomXPEntry = {
      classroom: classroomId,
      xp: 0,
      level: 1,
      earnedBadges: []
    };
    user.classroomXP.push(classroomXPEntry);
  }

  const oldXP = classroomXPEntry.xp;
  const oldLevel = classroomXPEntry.level;

  // Award XP
  classroomXPEntry.xp += xpAmount;

  // Calculate new level
  const newLevel = calculateLevelFromXP(
    classroomXPEntry.xp,
    xpSettings.levelingFormula,
    xpSettings.baseXPForLevel2
  );

  const leveledUp = newLevel > oldLevel;
  classroomXPEntry.level = newLevel;

  // Check for new badges earned
  const earnedBadges = [];
  if (leveledUp) {
    const badges = await Badge.find({
      classroom: classroomId,
      levelRequired: { $lte: newLevel, $gt: oldLevel }
    }).sort({ levelRequired: 1 });

    for (const badge of badges) {
      // Check if badge already earned
      const alreadyEarned = classroomXPEntry.earnedBadges.some(
        eb => eb.badge.toString() === badge._id.toString()
      );

      if (!alreadyEarned) {
        classroomXPEntry.earnedBadges.push({
          badge: badge._id,
          earnedAt: new Date()
        });
        earnedBadges.push(badge);

        // Create notification for badge earned
        const badgeNotification = await Notification.create({
          user: userId,
          type: 'badge_earned',
          message: `🏅 You earned the "${badge.name}" badge! ${badge.description}`,
          classroom: classroomId,
          badge: badge._id,
          read: false
        });

        // Emit real-time notification
        const populated = await populateNotification(badgeNotification._id);
        if (populated) {
          const io = user.db.base.io;
          if (io) io.to(`user-${userId}`).emit('notification', populated);
        }
      }
    }
  }

  await user.save();

  // Create notification for XP gain (optional, can be toggled)
  if (leveledUp) {
    await sendLevelUpNotification({ userId, classroomId, newLevel, reason });
  }

  return {
    leveledUp,
    oldLevel,
    newLevel,
    oldXP,
    newXP: classroomXPEntry.xp,
    xpGained: xpAmount,
    earnedBadges
  };
}

async function sendLevelUpNotification({ userId, classroomId, newLevel, reason }) {
  // Avoid duplicate notifications for the same level in the same classroom
  const existing = await Notification.findOne({
    user: userId,
    classroom: classroomId || null,
    type: 'level_up',
    'meta.level': newLevel
  }).sort({ createdAt: -1 });

  if (existing) return;

  const n = await Notification.create({
    user: userId,
    type: 'level_up',
    message: `Level Up! You reached Level ${newLevel}!${reason ? ` (${reason})` : ''}`,
    classroom: classroomId || null,
    meta: { level: newLevel },
    createdAt: new Date()
  });
  const populated = await populateNotification(n._id);
  if (populated && global.io) global.io.to(`user-${userId}`).emit('notification', populated);
}

module.exports = { awardXP };