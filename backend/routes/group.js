const express = require('express');
const GroupSet = require('../models/GroupSet');
const Group = require('../models/Group');
const { ensureAuthenticated } = require('../config/auth');
const router = express.Router();

// Create GroupSet
router.post('/groupset/create', ensureAuthenticated, async (req, res) => {
  const { name, classroomId, selfSignup, joinApproval, maxMembers, image } = req.body;
  try {
    const groupSet = new GroupSet({ name, classroom: classroomId, selfSignup, joinApproval, maxMembers, image });
    await groupSet.save();
    res.status(201).json(groupSet);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create group set' });
  }
});

// Update GroupSet
router.put('/groupset/:id', ensureAuthenticated, async (req, res) => {
  const { name, selfSignup, joinApproval, maxMembers, image } = req.body;
  try {
    const groupSet = await GroupSet.findById(req.params.id);
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

    groupSet.name = name || groupSet.name;
    groupSet.selfSignup = selfSignup !== undefined ? selfSignup : groupSet.selfSignup;
    groupSet.joinApproval = joinApproval !== undefined ? joinApproval : groupSet.joinApproval;
    groupSet.maxMembers = maxMembers !== undefined ? maxMembers : groupSet.maxMembers;
    groupSet.image = image || groupSet.image;
    await groupSet.save();
    res.status(200).json(groupSet);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update group set' });
  }
});

// Delete GroupSet
router.delete('/groupset/:id', ensureAuthenticated, async (req, res) => {
  try {
    await GroupSet.deleteOne({ _id: req.params.id });
    res.status(200).json({ message: 'GroupSet deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete group set' });
  }
});

// Fetch GroupSets for Classroom
router.get('/groupset/classroom/:classroomId', ensureAuthenticated, async (req, res) => {
  try {
    const groupSets = await GroupSet.find({ classroom: req.params.classroomId }).populate('groups');
    res.status(200).json(groupSets);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch group sets' });
  }
});

// Create Group within GroupSet
router.post('/groupset/:groupSetId/group/create', ensureAuthenticated, async (req, res) => {
  const { name } = req.body;
  try {
    const groupSet = await GroupSet.findById(req.params.groupSetId);
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

    const group = new Group({ name });
    await group.save();

    groupSet.groups.push(group._id);
    await groupSet.save();

    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Join Group within GroupSet
router.post('/groupset/:groupSetId/group/:groupId/join', ensureAuthenticated, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (group.members.length >= group.maxMembers) {
      return res.status(400).json({ error: 'Group is full' });
    }

    group.members.push(req.user._id);
    await group.save();
    res.status(200).json(group);
  } catch (err) {
    res.status(500).json({ error: 'Failed to join group' });
  }
});

module.exports = router;