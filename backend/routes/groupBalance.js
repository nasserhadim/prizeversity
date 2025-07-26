
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
    const { amount, description } = req.body;  // can be + or –
    
    try {
      // First validate the amount
      const numericAmount = Number(amount);
      if (isNaN(numericAmount)) {
        return res.status(400).json({ error: 'Invalid amount' });
      }

      // Find the group with members populated including their passiveAttributes
      const group = await Group.findById(groupId).populate({
        path: 'members._id',
        select: 'balance passiveAttributes transactions role'
      });

      if (!group) return res.status(404).json({ error: 'Group not found' });

      const results = [];
      
      // Will loop through each group member and apply balance adjustmen
      for (const member of group.members) {
        const user = member._id;
        if (user.role !== 'student') continue;

        // Apply multipliers only for positive amounts
        // Calculate the adjusted amount
        let adjustedAmount = numericAmount;
        if (numericAmount > 0) { // This here only apply multipliers for positive amounts
          const groupMultiplier = group.groupMultiplier || 1;
          const personalMultiplier = user.passiveAttributes?.multiplier || 1;
          adjustedAmount = Math.round(numericAmount * groupMultiplier * personalMultiplier);
        }

        // Update user balance
        user.balance = Math.max(0, user.balance + adjustedAmount);
        user.transactions.push({
          amount: adjustedAmount, // Store the actual amount transferred
          description: description || `Group adjust (${group.name})`,
          assignedBy: req.user._id,
        });
        await user.save();

        // Add result summary for the student
        results.push({ 
          id: user._id, 
          newBalance: user.balance,
          baseAmount: numericAmount,
          adjustedAmount: adjustedAmount,
          multipliersApplied: {
            group: group.groupMultiplier || 1,
            personal: user.passiveAttributes?.multiplier || 1,
            total: numericAmount > 0 ? (group.groupMultiplier || 1) * (user.passiveAttributes?.multiplier || 1) : 1
          }
        });
        // Create notification for this student
  const notification = await Notification.create({
    user: user._id, // specify the user this notification is for
    type: 'wallet_transaction',
    message: `You were ${amount >= 0 ? 'credited' : 'debited'} ${Math.abs(amount)} bits in ${group.name}.`,
    amount,
    description: description || `Group adjust (${group.name})`,
    group: group._id,
    groupSet: req.params.groupSetId,
    classroom: groupSet?.classroom?._id,
    actionBy: req.user._id,
  });
  const populated = await populateNotification(notification._id);
      req.app.get('io').to(`user-${user._id}`).emit('notification', populated);

      }
// Notify the group about the balance adjustment

      req.app.get('io').to(`group-${group._id}`).emit('balance_adjust', {
        groupId: group._id,
        amount: numericAmount,
        description,
        results,
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


// Adjusting group multipliers directly
router.post('/groupset/:groupSetId/group/:groupId/set-multiplier', ensureAuthenticated, ensureTeacher, async (req, res) => {
  const { groupId } = req.params;
  const { multiplier } = req.body;

  try {
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Validate multiplier value (between 0.5 and 2 for example)
    if (multiplier < 0.5 || multiplier > 5) {

      return res.status(400).json({ error: 'Multiplier must be between 0.5 and 5' });
    }

    // Saving the new multiplier
    group.groupMultiplier = multiplier;
    await group.save();
    
    // Notify group members about the multiplier
    for (const member of group.members) {
      req.app.get('io').to(`user-${member._id}`).emit('group_multiplier_update', {
        groupId: group._id,
        multiplier
      });
    }

    // Respnding with updated multiplier info
    res.json({ 
      message: 'Group multiplier updated',
      groupId: group._id,
      multiplier
    });
  } catch (err) {
    console.error('Group multiplier update error:', err);
    res.status(500).json({ error: 'Failed to update group multiplier' });
    }
  }
);

module.exports = router;
