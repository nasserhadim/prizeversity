const SiphonRequest = require('../models/SiphonRequest');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
const Classroom = require('../models/Classroom');
const { populateNotification } = require('./notifications');
const mongoose = require('mongoose');
const { getIO } = require('./io');

const CLEAN_INTERVAL_MS = Number(process.env.SIPHON_CLEAN_INTERVAL_MS || 1 * 60 * 1000); // default: 1 minute

async function cleanupExpiredSiphons() {
  try {
    // guard: don't try DB queries until mongoose is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('[siphonCleanup] mongoose not connected, skipping cleanup run');
      return;
    }

    const expiredSiphons = await SiphonRequest.find({
      status: 'pending',
      expiresAt: { $lt: new Date() }
    });

    for (const siphon of expiredSiphons) {
      siphon.status = 'expired';
      await siphon.save();
      
      // Unfreeze the target user for this siphon's classroom only
      await User.findByIdAndUpdate(siphon.targetUser, { $pull: { classroomFrozen: { classroom: siphon.classroom } } });

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
          const io = getIO && getIO();
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
              const io = getIO && getIO();
              if (io) io.to(`user-${memberId}`).emit('notification', populated);
            } catch (e) {}
          } catch (err) {
            console.error('[siphonCleanup] Failed to notify group member', memberId, err);
          }
        }

        // Emit group-level update
        try {
          const io = getIO && getIO();
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
            const io = getIO && getIO();
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

/* Replace immediate setInterval startup with a connection-aware starter */
let _janitorStarted = false;
function startJanitorOnce() {
  if (_janitorStarted) return;
  if (mongoose.connection.readyState === 1) {
    // Run an immediate pass and then schedule interval
    cleanupExpiredSiphons().catch(e => console.error('[siphonCleanup] startup run failed:', e));
    setInterval(cleanupExpiredSiphons, CLEAN_INTERVAL_MS);
    _janitorStarted = true;
    console.log('[siphonCleanup] janitor started (interval ms):', CLEAN_INTERVAL_MS);
  }
}

// Do NOT auto-start on require; listen for connection open and export starter
mongoose.connection.once && mongoose.connection.once('open', startJanitorOnce);

module.exports = { cleanupExpiredSiphons, startJanitorOnce };