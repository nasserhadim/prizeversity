const SiphonRequest = require('../models/SiphonRequest');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
const Classroom = require('../models/Classroom');
const { populateNotification } = require('./notifications');

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

      // Try to gather group / classroom context
      let group = null;
      let groupSet = null;
      let classroom = null;

      try {
        group = await Group.findById(siphon.group).populate('members._id', 'email');
        groupSet = group ? await GroupSet.findOne({ groups: group._id }).populate('classroom') : null;
        classroom = groupSet?.classroom ? await Classroom.findById(groupSet.classroom) : null;
      } catch (err) {
        console.error('[siphonCleanup] Failed to populate context:', err);
      }

      // Create notification for target user
      try {
        const targetNotification = await Notification.create({
          user: siphon.targetUser,
          type: 'siphon_rejected', // reuse existing type for informing user they are unfrozen/expired
          message: `A siphon request against you in ${group?.name || 'your group'} has expired. Your account has been unfrozen.`,
          group: siphon.group,
          siphon: siphon._id,
          classroom: classroom?._id,
          actionBy: null
        });
        const populatedTarget = await populateNotification(targetNotification._id);

        // emit realtime if io available
        try {
          const srv = require('../server');
          const io = srv?.getIO ? srv.getIO() : srv?.io;
          if (io) io.to(`user-${siphon.targetUser}`).emit('notification', populatedTarget);
        } catch (e) {
          // server may not export io; ignore
        }
      } catch (err) {
        console.error('[siphonCleanup] Failed to notify target user:', err);
      }

      // Notify group members (except target)
      if (group && Array.isArray(group.members)) {
        const memberIds = group.members
          .filter(m => String(m._id._id || m._id) !== String(siphon.targetUser))
          .map(m => m._id._id ? m._id._id : m._id);

        for (const memberId of memberIds) {
          try {
            const n = await Notification.create({
              user: memberId,
              type: 'siphon_rejected',
              message: `A siphon request in group "${group.name}" has expired and will not be applied.`,
              group: group._id,
              siphon: siphon._id,
              classroom: classroom?._id,
              actionBy: null
            });
            const populated = await populateNotification(n._id);

            try {
              const srv = require('../server');
              const io = srv?.getIO ? srv.getIO() : srv?.io;
              if (io) io.to(`user-${memberId}`).emit('notification', populated);
            } catch (e) {}
          } catch (err) {
            console.error('[siphonCleanup] Failed to notify group member', memberId, err);
          }
        }

        // Emit group-level update
        try {
          const srv = require('../server');
          const io = srv?.getIO ? srv.getIO() : srv?.io;
          if (io) io.to(`group-${group._id}`).emit('siphon_update', siphon);
        } catch (e) {}
      }

      // Notify classroom teacher(s) if we have classroom
      if (classroom) {
        const teacherId = classroom.teacher;
        try {
          const tn = await Notification.create({
            user: teacherId,
            type: 'siphon_rejected',
            message: `A siphon request in group "${group?.name || 'unknown'}" expired without teacher action.`,
            group: group?._id,
            siphon: siphon._id,
            classroom: classroom._id,
            actionBy: null
          });
          const populatedT = await populateNotification(tn._id);
          try {
            const srv = require('../server');
            const io = srv?.getIO ? srv.getIO() : srv?.io;
            if (io) io.to(`user-${teacherId}`).emit('notification', populatedT);
          } catch (e) {}
        } catch (err) {
          console.error('[siphonCleanup] Failed to notify teacher:', err);
        }
      }

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