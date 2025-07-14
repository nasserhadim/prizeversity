
const express = require('express');
const { ensureAuthenticated } = require('../config/auth');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
const User  = require('../models/User');
const router = express.Router();
const Notification = require('../models/Notification');
const { populateNotification } = require('../utils/notifications');

function ensureTeacher(req, res, next) {
  if (!['teacher','admin'].includes(req.user.role)) {
    return res.status(403).json({ error:'Only teachers or admins can adjust group balances' });
  }
  next();
}

router.post(
  '/groupset/:groupSetId/group/:groupId/adjust-balance',
  ensureAuthenticated,
  ensureTeacher,
  async (req, res) => {
    const { groupId }   = req.params;
    const groupSet = await GroupSet.findById(req.params.groupSetId).populate('classroom');
    const { amount, description } = req.body;  // can be + or –
    try {
      const group = await Group.findById(groupId).populate('members._id');
      if (!group) return res.status(404).json({ error:'Group not found' });

      const results = [];
for (const member of group.members) {
  const user = member._id;
  if (user.role !== 'student') continue;

  user.balance += amount;
  user.transactions.push({
    amount,
    description: description || `Group adjust (${group.name})`,
    assignedBy: req.user._id,
  });
  await user.save();
  results.push({ id: user._id, newBalance: user.balance });

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
          
      req.app.get('io').to(`group-${group._id}`).emit('balance_adjust', {
        groupId:    group._id,
        amount,
        description,
        results,
      });

      res.json({ message:`${results.length} students updated`, results });
    } catch (err) {
      console.error('Group balance adjust error:', err);
      res.status(500).json({ error:'Failed to adjust group balances' });
    }
  }
);

module.exports = router;
