const express = require('express');
const { ensureAuthenticated } = require('../config/auth');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
const User  = require('../models/User');
const router = express.Router();
const Notification = require('../models/Notification');
const { populateNotification } = require('../utils/notifications');

// Middlware will allow only teachers or admins to access certain routes
function ensureTeacher(req, res, next) {
  if (!['teacher','admin'].includes(req.user.role)) {
    return res.status(403).json({ error:'Only teachers or admins can adjust group balances' });
  }
  next();
}

// Adjust balance for all students in a group, applying group and personal multipliers
router.post(
  '/groupset/:groupSetId/group/:groupId/adjust-balance',
  ensureAuthenticated,
  ensureTeacher,
  async (req, res) => {
    const { groupId } = req.params;
    const groupSet = await GroupSet.findById(req.params.groupSetId).populate('classroom');
    const { amount, description, applyGroupMultipliers = true, applyPersonalMultipliers = true, memberIds } = req.body;
    
    try {
      // First validate the amount
      const numericAmount = Number(amount);
      if (isNaN(numericAmount)) {
        return res.status(400).json({ error: 'Invalid amount' });
      }

      if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
        return res.status(400).json({ error: 'No members selected for balance adjustment.' });
      }

      // Find the group with members populated including their passiveAttributes
      const group = await Group.findById(groupId).populate({
        path: 'members._id',
        select: 'balance passiveAttributes transactions role classroomBalances'
      });

      if (!group) return res.status(404).json({ error: 'Group not found' });

      const results = [];
      
      // Will loop through each group member and apply balance adjustment
      for (const member of group.members) {
        // Ensure we have a full user doc. member._id may be populated or may be an ObjectId.
        let user = member._id;
        if (!user || !user._id) {
          // fallback: fetch user document
          user = await User.findById(member._id).select('balance passiveAttributes transactions role classroomBalances');
        }
        if (!user || user.role !== 'student' || !memberIds.includes(user._id.toString())) continue;

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

        user.transactions.push({
          amount: adjustedAmount,
          description: description || `Group adjust (${group.name})`,
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
          description: description || `Group adjust (${group.name})`,
          group: group._id,
          groupSet: req.params.groupSetId,
          classroom: classroomId,
          actionBy: req.user._id,
        });
        const populated = await populateNotification(notification._id);
        req.app.get('io').to(`user-${user._id}`).emit('notification', populated);
      }

      // Emit classroom-aware event including classroomId
      const classroomId = groupSet?.classroom ? groupSet.classroom._id || groupSet.classroom : group.classroom;
      
      req.app.get('io').to(`group-${group._id}`).emit('balance_adjust', {
        groupId: group._id,
        classroomId,
        amount: numericAmount,
        description,
        results
      });

      // Respond with success and detailed result
      res.json({ 
        success: true,
        message: `${results.length} students updated`,
        results,
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
router.post('/groupset/:groupSetId/group/:groupId/set-multiplier', ensureAuthenticated, ensureTeacher, async (req, res) => {
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

module.exports = router;
