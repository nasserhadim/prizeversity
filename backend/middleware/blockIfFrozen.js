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

    // Determine if user is frozen in the classroom context
    const frozenInThisClassroom = classroomId
      ? Array.isArray(user?.classroomFrozen) && user.classroomFrozen.some(cf => String(cf.classroom) === String(classroomId))
      : Array.isArray(user?.classroomFrozen) && user.classroomFrozen.length > 0;

    if (frozenInThisClassroom) {
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
