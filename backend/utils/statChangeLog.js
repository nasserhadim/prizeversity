const Notification = require('../models/Notification');
const { populateNotification } = require('../utils/notifications');

/**
 * Create "stats_adjusted" notification for the student only.
 * Teachers will NOT get a bell notification for bazaar/auto changes.
 */
async function logStatChanges({ io, classroomId, user, actionBy, prevStats = {}, currStats = {}, context = 'bazaar item' }) {
  const fields = ['multiplier', 'luck', 'discount', 'shield', 'groupMultiplier'];
  const changes = [];
  for (const f of fields) {
    const before = prevStats[f];
    const after = currStats[f];
    if (before === undefined && after === undefined) continue;
    if (String(before) !== String(after)) changes.push({ field: f, from: before, to: after });
  }
  if (!changes.length) return { created: false };

  const changeSummary = changes.map(c => `${c.field}: ${c.from} → ${c.to}`).join('; ');
  const now = new Date();

  // Student-facing notification (shows in student's bell; also used by People → Stat Changes)
  const studentNotification = await Notification.create({
    user: user._id,
    actionBy: actionBy,
    type: 'stats_adjusted',
    message: `Your stats were updated via ${context}: ${changeSummary}.`,
    classroom: classroomId || null,
    read: false,
    changes,
    targetUser: user._id,
    createdAt: now
  });

  // Emit to student only
  try {
    const populated = await populateNotification(studentNotification._id);
    if (io && populated) io.to(`user-${user._id}`).emit('notification', populated);
  } catch (_) {}

  // No teacher bell notification here (avoid spam)
  return { created: true, changes };
}

module.exports = { logStatChanges };