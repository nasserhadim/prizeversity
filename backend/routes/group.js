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

    if (
      groupSet.name === name &&
      groupSet.selfSignup === selfSignup &&
      groupSet.joinApproval === joinApproval &&
      groupSet.maxMembers === maxMembers &&
      groupSet.image === image
    ) {
      return res.status(400).json({ message: 'No changes were made' });
    }

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
    const groupSets = await GroupSet.find({ classroom: req.params.classroomId })
      .populate({
        path: 'groups',
        populate: {
          path: 'members',
          select: 'email joinDate'
        }
      });
    res.status(200).json(groupSets);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch group sets' });
  }
});

// Create Group within GroupSet
router.post('/groupset/:groupSetId/group/create', ensureAuthenticated, async (req, res) => {
  const { name, count } = req.body;
  try {
    const groupSet = await GroupSet.findById(req.params.groupSetId);
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

    const groups = [];
    for (let i = 0; i < count; i++) {
      const group = new Group({ name: `${name} ${i + 1}`, maxMembers: groupSet.maxMembers });
      await group.save();
      groupSet.groups.push(group._id);
      groups.push(group);
    }
    await groupSet.save();

    res.status(201).json(groups);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create groups' });
  }
});

// Join Group within GroupSet
router.post('/groupset/:groupSetId/group/:groupId/join', ensureAuthenticated, async (req, res) => {
  try {
    const groupSet = await GroupSet.findById(req.params.groupSetId).populate('groups');
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

    // Check if the user is already a member of any group within the GroupSet
    const isMemberOfAnyGroup = groupSet.groups.some(group => group.members.includes(req.user._id));
    if (isMemberOfAnyGroup) {
      return res.status(400).json({ error: 'You are already a member of a group in this GroupSet' });
    }

    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const maxMembers = group.maxMembers || groupSet.maxMembers;
    if (group.members.length >= maxMembers) {
      return res.status(400).json({ error: 'Group is full' });
    }

    group.members.push({ _id: req.user._id, joinDate: new Date() });
    await group.save();
    res.status(200).json(group);
  } catch (err) {
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// Update Group
router.put('/groupset/:groupSetId/group/:groupId', ensureAuthenticated, async (req, res) => {
  const { name, image, maxMembers } = req.body;
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (group.name === name && group.image === image && group.maxMembers === maxMembers) {
      return res.status(400).json({ message: 'No changes were made' });
    }

    group.name = name || group.name;
    group.image = image || group.image;
    group.maxMembers = maxMembers !== undefined ? maxMembers : group.maxMembers;
    await group.save();
    res.status(200).json(group);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// Delete Group
router.delete('/groupset/:groupSetId/group/:groupId', ensureAuthenticated, async (req, res) => {
  try {
    await Group.deleteOne({ _id: req.params.groupId });
    const groupSet = await GroupSet.findById(req.params.groupSetId);
    groupSet.groups = groupSet.groups.filter(groupId => groupId.toString() !== req.params.groupId);
    await groupSet.save();
    res.status(200).json({ message: 'Group deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// Leave Group within GroupSet
router.post('/groupset/:groupSetId/group/:groupId/leave', ensureAuthenticated, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isMember = group.members.includes(req.user._id);
    if (!isMember) return res.status(400).json({ message: 'You are not in this group.' });

    group.members = group.members.filter(memberId => memberId.toString() !== req.user._id.toString());
    await group.save();
    res.status(200).json({ message: 'Left group successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

// Suspend Members from Group
router.post('/groupset/:groupSetId/group/:groupId/suspend', ensureAuthenticated, async (req, res) => {
  const { memberIds } = req.body;
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    group.members = group.members.filter(memberId => !memberIds.includes(memberId.toString()));
    await group.save();
    res.status(200).json({ message: 'Members suspended successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to suspend members' });
  }
});

module.exports = router;