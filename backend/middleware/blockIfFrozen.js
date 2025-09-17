const SiphonRequest = require('../models/SiphonRequest');

module.exports = async function blockIfFrozen(req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const User = require('../models/User');
    const user = await User.findById(req.user._id).select('classroomFrozen').lean();

    // Derive classroom context (body / query / params)
    const classroomId = req.body?.classroomId || req.query?.classroomId || req.params?.classroomId || null;
    console.log(`[blockIfFrozen] User ${req.user._id} classroomFrozen:`, user?.classroomFrozen, 'request classroomId:', classroomId);

    // If we have classroom context, only consider active siphons for that classroom.
    const activeSiphonQuery = {
      targetUser: req.user._id,
      status: { $in: ['pending', 'group_approved'] }
    };
    if (classroomId) activeSiphonQuery.classroom = classroomId;
    const activeSiphon = await SiphonRequest.findOne(activeSiphonQuery).populate('classroom', 'siphonTimeoutHours');

    // helper: format ms -> "1h 2m 3s" (omits zero parts)
    const formatMs = (ms) => {
      if (!ms || ms <= 0) return '0s';
      const totalSeconds = Math.floor(ms / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const parts = [];
      if (hours) parts.push(`${hours}h`);
      if (minutes) parts.push(`${minutes}m`);
      if (seconds || parts.length === 0) parts.push(`${seconds}s`);
      return parts.join(' ');
    };

    // Determine if user is frozen in the classroom context
    const frozenInThisClassroom = classroomId
      ? Array.isArray(user?.classroomFrozen) && user.classroomFrozen.some(cf => String(cf.classroom) === String(classroomId))
      : Array.isArray(user?.classroomFrozen) && user.classroomFrozen.length > 0;

    if (frozenInThisClassroom) {
      if (activeSiphon) {
        const now = Date.now();
        const expiresAt = new Date(activeSiphon.expiresAt);
        const msRemaining = Math.max(0, expiresAt.getTime() - now);
        const humanReadable = formatMs(msRemaining);
        console.log(`[blockIfFrozen] Blocking user - time remaining: ${humanReadable} (${msRemaining}ms)`);
        return res.status(403).json({
          error: `Your account is frozen due to an active siphon request. Time Remaining: ${humanReadable}`,
          siphonActive: true,
          // Human-friendly string (keeps compatibility with older clients)
          timeRemaining: humanReadable,
          // Precise fields for frontend countdown display:
          timeRemainingMs: msRemaining,
          expiresAt: expiresAt.toISOString()
        });
      }
      console.log(`[blockIfFrozen] User frozen (no active siphon found in this classroom)`);
      return res.status(403).json({ error: 'Your account is frozen in this classroom' });
    }

    console.log(`[blockIfFrozen] User not frozen for this request, proceeding`);
    next();
  } catch (err) {
    console.error('blockIfFrozen error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
