const express = require('express');
const { ensureAuthenticated } = require('../config/auth');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
const User  = require('../models/User');
const router = express.Router();
const Notification = require('../models/Notification');
const { populateNotification } = require('../utils/notifications');
const Classroom = require('../models/Classroom'); // Import Classroom model
const PendingAssignment = require('../models/PendingAssignment'); // Import PendingAssignment model

// Utility to check if a TA can assign bits based on classroom policy
async function canTAAssignBits({ taUser, classroomId }) {
  const classroom = await Classroom.findById(classroomId).select('taBitPolicy students');
  if (!classroom) return { ok: false, status: 404, msg: 'Classroom not found' };

  // TAs must be part of the classroom they are trying to affect
  if (!classroom.students.map(String).includes(String(taUser._id))) {
    return { ok: false, status: 403, msg: 'You are not part of this classroom' };
  }

  switch (classroom.taBitPolicy) {
    case 'full':
      return { ok: true };
    case 'none':
      return { ok: false, status: 403, msg: 'Policy forbids Admins/TAs from assigning bits' };
    case 'approval':
      return { ok: false, requiresApproval: true };
    default:
      // Default to 'full' if not set, but should ideally be set.
      return { ok: true };
  }
}


// Middleware will allow only teachers or admins to access certain routes
async function ensureTeacher(req, res, next) {
  if (req.user.role === 'teacher') {
    return next();
  }

  if (req.user.role === 'admin') {
    const { groupSetId } = req.params;
    const groupSet = await GroupSet.findById(groupSetId).populate('classroom');
    
    // If there's no classroom context, we can't check policy, so deny for safety.
    // Teachers can still operate on such groups.
    if (!groupSet || !groupSet.classroom) {
      return res.status(404).json({ error: 'Classroom context not found for this group. TAs cannot adjust balances.' });
    }
    const classroomId = groupSet.classroom._id;
    const gate = await canTAAssignBits({ taUser: req.user, classroomId });

    if (gate.ok) {
      return next();
    }

    if (gate.requiresApproval) {
      req.requiresApproval = true; // Pass this to the main route handler
      return next();
    }
    
    return res.status(gate.status || 403).json({ error: gate.msg || 'You are not authorized to perform this action.' });
  }

  return res.status(403).json({ error: 'Only teachers or admins can adjust group balances' });
}

// Helper function for multiplier notes
function getMultiplierNote(applyGroup, applyPersonal) {
  if (!applyGroup && !applyPersonal) {
    return "All multipliers bypassed by teacher";
  } else if (!applyGroup) {
    return "Group multipliers bypassed by teacher";
  } else if (!applyPersonal) {
    return "Personal multipliers bypassed by teacher";
  }
  return undefined;
}

// Add the helper functions at the top of the file after imports
const getClassroomBalance = (user, classroomId) => {
  if (!Array.isArray(user.classroomBalances)) return 0;
  const cb = user.classroomBalances.find(cb => String(cb.classroom) === String(classroomId));
  return cb ? cb.balance : 0;
};

const updateClassroomBalance = (user, classroomId, newBalance) => {
  if (!Array.isArray(user.classroomBalances)) user.classroomBalances = [];
  const idx = user.classroomBalances.findIndex(cb => String(cb.classroom) === String(classroomId));
  if (idx >= 0) {
    user.classroomBalances[idx].balance = Math.max(0, newBalance);
  } else {
    user.classroomBalances.push({ classroom: classroomId, balance: Math.max(0, newBalance) });
  }
};

// Adjust balance for all students in a group, applying group and personal multipliers
router.post(
  '/groupset/:groupSetId/group/:groupId/adjust-balance',
  ensureAuthenticated,
  ensureTeacher,
  async (req, res) => {
    const { groupId, groupSetId } = req.params;
    const groupSet = await GroupSet.findById(groupSetId).populate('classroom');
    const { amount, description, applyGroupMultipliers = true, applyPersonalMultipliers = true, memberIds } = req.body;
    
    try {
      // First validate the amount
      const numericAmount = Number(amount);
      if (isNaN(numericAmount)) {
        return res.status(400).json({ error: 'Invalid amount' });
      }

      // If approval is required, create pending assignments and return
      if (req.requiresApproval) {
        const classroom = groupSet.classroom;
        for (const memberId of memberIds) {
          await PendingAssignment.create({
            classroom: classroom._id,
            student: memberId,
            amount: numericAmount,
            description: description || `Group adjust`,
            requestedBy: req.user._id,
          });
        }
        // Notify teacher
        const notification = await Notification.create({
          user: classroom.teacher,
          type: 'bit_assignment_request',
          message: `Admin/TA ${req.user.firstName || req.user.email} requested a group balance adjustment.`,
          classroom: classroom._id,
          actionBy: req.user._id,
        });
        const populated = await populateNotification(notification._id);
        req.app.get('io').to(`user-${classroom.teacher}`).emit('notification', populated);

        return res.status(202).json({ message: 'Request queued for teacher approval' });
      }

      // Find the group with members populated including their passiveAttributes
      const group = await Group.findById(groupId).populate({
        path: 'members._id',
        model: 'User',
        select: 'balance passiveAttributes transactions role classroomBalances',
      });

      if (!group) return res.status(404).json({ error: 'Group not found' });

      // Compose the transaction description once (in outer scope) so it's available
      // everywhere: per-user transactions, notifications, and emitted events.
      const roleLabel = req.user.role === 'admin' ? 'Admin/TA' : 'Teacher';
      const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email || String(req.user._id);
      const baseDesc = (description && String(description).trim()) ? `: ${String(description).trim()}` : '';
      const txDescription = `Group adjust (${group.name})${baseDesc} by ${roleLabel} (${userName})`;
      
      // Keep successful entries and skipped entries as separate arrays.
      const results = []; // detailed per-student success entries
      const skipped = []; // skipped entries (e.g. banned / not found)
      const membersToUpdate = memberIds 
        ? group.members.filter(m => memberIds.includes(m._id._id.toString()))
        : group.members;
      
      { 
        // Add: get classroom banned set (groupSet populated earlier)
        const classroomBannedSet = new Set(
          (groupSet.classroom?.bannedStudents || []).map(b => String(b._id || b))
        );

        // Will loop through each group member and apply balance adjustment
        for (const member of membersToUpdate) {
          // Ensure we have a full user doc. member._id may be populated or may be an ObjectId.
          let user = member._id;
          if (!user || !user._id) {
            // fallback: fetch user document
            user = await User.findById(member._id).select('balance passiveAttributes transactions role classroomBalances');
          }

          // Skip non-students & skip banned users
          if (!user || user.role !== 'student' || !memberIds.includes(user._id.toString())) continue;
          if (classroomBannedSet.has(String(user._id))) {
            skipped.push({ id: String(user._id), reason: 'User is banned in this classroom' });
            continue;
          }

          // Apply multipliers separately based on flags
          let adjustedAmount = numericAmount;
          let finalMultiplier = 1;
          
          if (numericAmount > 0) {
            if (applyGroupMultipliers) {
              finalMultiplier *= (group.groupMultiplier || 1);
            }
            if (applyPersonalMultipliers) {
              finalMultiplier *= (user.passiveAttributes?.multiplier || 1);
            }
            adjustedAmount = Math.round(numericAmount * finalMultiplier);
          }

          // Update user balance using classroom-aware functions
          const classroomId = groupSet?.classroom ? groupSet.classroom._id || groupSet.classroom : group.classroom;
        
          if (classroomId) {
            const currentBalance = getClassroomBalance(user, classroomId);
            const newBalance = Math.max(0, currentBalance + adjustedAmount);
            updateClassroomBalance(user, classroomId, newBalance);
          } else {
            user.balance = Math.max(0, user.balance + adjustedAmount);
          }

          // Ensure transactions array exists before pushing
          if (!Array.isArray(user.transactions)) user.transactions = [];

          user.transactions.push({
            amount: adjustedAmount,
            description: txDescription,
            assignedBy: req.user._id,
            classroom: classroomId || null,
            calculation: (numericAmount > 0 && (applyGroupMultipliers || applyPersonalMultipliers)) ? {
              baseAmount: numericAmount,
              personalMultiplier: applyPersonalMultipliers ? (user.passiveAttributes?.multiplier || 1) : 1,
              groupMultiplier: applyGroupMultipliers ? (group.groupMultiplier || 1) : 1,
              totalMultiplier: finalMultiplier,
            } : {
              baseAmount: numericAmount,
              personalMultiplier: 1,
              groupMultiplier: 1,
              totalMultiplier: 1,
              note: getMultiplierNote(applyGroupMultipliers, applyPersonalMultipliers)
            },
          });
          await user.save();
 
          // Add result summary for the student
          results.push({ 
            id: user._id, 
            newBalance: classroomId ? getClassroomBalance(user, classroomId) : user.balance,
            baseAmount: numericAmount,
            adjustedAmount: adjustedAmount,
            multipliersApplied: {
              group: applyGroupMultipliers ? (group.groupMultiplier || 1) : 1,
              personal: applyPersonalMultipliers ? (user.passiveAttributes?.multiplier || 1) : 1,
              total: finalMultiplier
            }
          });
 
         // Create notification for this student
         const notification = await Notification.create({
           user: user._id,
           type: 'wallet_transaction',
           message: `You were ${amount >= 0 ? 'credited' : 'debited'} ${Math.abs(adjustedAmount)} ₿ in ${group.name}.`,
           amount: adjustedAmount,
           description: txDescription,
           group: group._id,
           groupSet: req.params.groupSetId,
           classroom: classroomId,
           actionBy: req.user._id,
         });
         const populated = await populateNotification(notification._id);
         req.app.get('io').to(`user-${user._id}`).emit('notification', populated);
        }
      }

      // Emit classroom-aware event including classroomId, use composed description
      const classroomId = groupSet?.classroom ? groupSet.classroom._id || groupSet.classroom : group.classroom;
      
      req.app.get('io').to(`group-${group._id}`).emit('balance_adjust', {
        groupId: group._id,
        classroomId,
        amount: numericAmount,
        description: txDescription,
        results,
        skipped
      });
      
       // Respond with success and detailed result
      res.json({ 
        success: true,
        message: `${results.length} students updated`,
        results,
        skipped,
        groupMultiplier: group.groupMultiplier || 1
      });
    } catch (err) {
      console.error('Group balance adjust error:', err);
      res.status(500).json({ 
        success: false,
        error: 'Failed to adjust group balances',
        details: err.message 
      });
    }
  }
);


// Update the manual multiplier setting route
router.post(
  '/groupset/:groupSetId/group/:groupId/set-multiplier',
  ensureAuthenticated,
  ensureTeacher,
  async (req, res) => {
    const { groupId } = req.params;
    const { multiplier } = req.body;

    try {
      const group = await Group.findById(groupId);
      if (!group) return res.status(404).json({ error: 'Group not found' });

      // Validate multiplier value - only check for positive number
      if (multiplier < 0) {
        return res.status(400).json({ error: 'Multiplier must be a positive number' });
      }

      // Use the manual multiplier method (this sets isAutoMultiplier to false)
      await group.setManualMultiplier(multiplier);
      
      // Notify group members about the multiplier change
      for (const member of group.members) {
        req.app.get('io').to(`user-${member._id}`).emit('group_multiplier_update', {
          groupId: group._id,
          multiplier
        });
      }

      res.json({ 
        message: 'Group multiplier updated (manual override)',
        groupId: group._id,
        multiplier,
        isAutoMultiplier: false
      });
    } catch (err) {
      console.error('Group multiplier update error:', err);
      res.status(500).json({ error: 'Failed to update group multiplier' });
    }
});

// Add this route to reset a group back to auto multiplier mode
router.post('/groupset/:groupSetId/group/:groupId/reset-auto-multiplier', ensureAuthenticated, ensureTeacher, async (req, res) => {
  const { groupId } = req.params;

  try {
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Reset to auto mode and recalculate
    group.isAutoMultiplier = true;
    await group.updateMultiplier();

    res.json({ 
      message: 'Group multiplier reset to auto mode',
      groupId: group._id,
      multiplier: group.groupMultiplier,
      isAutoMultiplier: true
    });
  } catch (err) {
    console.error('Reset auto multiplier error:', err);
    res.status(500).json({ error: 'Failed to reset to auto multiplier' });
  }
});

module.exports = router;
