const express = require('express');
const GroupSet = require('../models/GroupSet');
const Group = require('../models/Group');
const { ensureAuthenticated } = require('../config/auth');
const router = express.Router();

// Create GroupSet
router.post('/groupset/create', ensureAuthenticated, async (req, res) => {
  const { name, classroomId, selfSignup, joinApproval } = req.body;
  try {
    const groupSet = new GroupSet({ name, classroom: classroomId, selfSignup, joinApproval });
    await groupSet.save();
    res.status(201).json(groupSet);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create group set' });
  }
});

// Fetch GroupSets for Classroom
router.get('/groupset/classroom/:classroomId', ensureAuthenticated, async (req, res) => {
  try {
    const groupSets = await GroupSet.find({ classroom: req.params.classroomId });
    res.status(200).json(groupSets);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch group sets' });
  }
});

// Create Group
router.post('/create', ensureAuthenticated, async (req, res) => {
  const { name, image, maxMembers, classroomId } = req.body;
  try {
    const group = new Group({ name, image, maxMembers, classroom: classroomId });
    await group.save();
    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Join Group
router.post('/:groupId/join', ensureAuthenticated, async (req, res) => {
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

// Fetch Groups for Classroom
router.get('/classroom/:classroomId', ensureAuthenticated, async (req, res) => {
  try {
    const groups = await Group.find({ classroom: req.params.classroomId });
    res.status(200).json(groups);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

module.exports = router;