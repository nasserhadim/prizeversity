const express = require('express');
const GroupSet = require('../models/GroupSet');
const Group = require('../models/Group');
const Notification = require('../models/Notification'); // Add this line
const { ensureAuthenticated } = require('../config/auth');
const router = express.Router();
const io = require('socket.io')(); // Add this line

// Create GroupSet
router.post('/groupset/create', ensureAuthenticated, async (req, res) => {
  const { name, classroomId, selfSignup, joinApproval, maxMembers, image } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'GroupSet name is required' });
  }

  try {
    // Check if groupset with same name exists in the classroom
    const existingGroupSet = await GroupSet.findOne({ 
      classroom: classroomId,
      name: name.trim()
    });
    
    if (existingGroupSet) {
      return res.status(400).json({ error: 'A GroupSet with this name already exists in this classroom' });
    }

    if (maxMembers && maxMembers < 0) {
      return res.status(400).json({ error: 'Max members cannot be a negative number' });
    }

    const groupSet = new GroupSet({ 
      name: name.trim(), 
      classroom: classroomId, 
      selfSignup, 
      joinApproval, 
      maxMembers, 
      image 
    });
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
          path: 'members._id',
          select: 'email'
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
  if (!name.trim()) {
    return res.status(400).json({ error: 'Group name is required' });
  }

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

    // Check if user has any pending requests in this GroupSet
    const hasPendingRequest = groupSet.groups.some(group => 
      group.members.some(member => 
        member._id.equals(req.user._id) && member.status === 'pending'
      )
    );

    if (hasPendingRequest) {
      const pendingGroup = groupSet.groups.find(group => 
        group.members.some(member => 
          member._id.equals(req.user._id) && member.status === 'pending'
        )
      );
      return res.status(400).json({ 
        error: `Your request to join group "${pendingGroup.name}" is pending approval. You may not join another group until approval is provisioned for that group.` 
      });
    }

    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Check if user was previously rejected from this group
    const wasRejected = group.members.some(member => 
      member._id.equals(req.user._id) && member.status === 'rejected'
    );
    if (wasRejected) {
      return res.status(400).json({ 
        error: `Your request to join this group "${group.name}" has been denied. If you still wish to join this group, reach out to the classroom admin/teacher.` 
      });
    }

    // Check if user already has a pending request for this group
    const hasPendingRequestForGroup = group.members.some(member => 
      member._id.equals(req.user._id) && member.status === 'pending'
    );
    if (hasPendingRequestForGroup) {
      return res.status(400).json({ 
        error: `You've already submitted a request to join this group "${group.name}". Please check the status with the classroom admin/teacher.` 
      });
    }

    const status = groupSet.joinApproval ? 'pending' : 'approved';
    group.members.push({ 
      _id: req.user._id, 
      joinDate: new Date(),
      status 
    });
    await group.save();

    res.status(200).json({ 
      message: groupSet.joinApproval ? 
        'Join request submitted. Awaiting teacher approval.' : 
        'Joined group successfully!'
    });
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
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    for (const member of group.members) {
      const notification = await new Notification({
        user: member._id._id,
        type: 'group_removal',
        message: `Group "${group.name}" has been deleted`,
        classroom: groupSet.classroom,
        groupSet: groupSet._id,
        actionBy: req.user._id
      }).save();
    
      req.app.get('io').to(`user-${member._id._id}`).emit('notification', notification);
    }

    await Group.deleteOne({ _id: req.params.groupId });
    const groupSet = await GroupSet.findById(req.params.groupSetId);
    groupSet.groups = groupSet.groups.filter(groupId => groupId.toString() !== req.params.groupId);
    await groupSet.save();
    res.status(200).json({ message: 'Group deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// Suspend Members from Group
router.post('/groupset/:groupSetId/group/:groupId/suspend', ensureAuthenticated, async (req, res) => {
  const { memberIds } = req.body;
  
  if (!memberIds || memberIds.length === 0) {
    return res.status(400).json({ message: 'No members selected for suspension' });
  }

  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const initialMemberCount = group.members.length;
    group.members = group.members.filter(member => 
      !memberIds.includes(member._id.toString()) || member.status === 'pending'
    );
    
    if (group.members.length === initialMemberCount) {
      return res.status(400).json({ message: 'No members were suspended' });
    }

    for (const memberId of memberIds) {
      const notification = await new Notification({
        user: memberId,
        type: 'group_removal',
        message: `You have been suspended from group "${group.name}"`,
        classroom: groupSet.classroom,
        groupSet: groupSet._id,
        group: group._id,
        actionBy: req.user._id
      }).save();
    
      req.app.get('io').to(`user-${memberId}`).emit('notification', notification);
    }

    await group.save();
    res.status(200).json({ message: 'Members suspended successfully' });
  } catch (err) {
    console.error('Suspension error:', err);
    res.status(500).json({ error: 'Failed to suspend members' });
  }
});

// Leave Group within GroupSet
router.post('/groupset/:groupSetId/group/:groupId/leave', ensureAuthenticated, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isMember = group.members.some(member => member._id.equals(req.user._id));
    if (!isMember) return res.status(400).json({ message: "You're not a member of this group to leave it!" });

    group.members = group.members.filter(member => !member._id.equals(req.user._id));
    await group.save();
    res.status(200).json({ message: 'Left group successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

// Approve Members to Group
router.post('/groupset/:groupSetId/group/:groupId/approve', ensureAuthenticated, async (req, res) => {
  const { memberIds } = req.body;
  
  const sendNotification = (userId, notification) => {
    io.to(`user-${userId}`).emit('notification', notification);
  };

  try {
    const groupSet = await GroupSet.findById(req.params.groupSetId);
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    let approvalCount = 0;
    group.members = group.members.map(member => {
      if (memberIds.includes(member._id.toString()) && member.status === 'pending') {
        approvalCount++;
        return { ...member.toObject(), status: 'approved' };
      }
      return member;
    });

    if (approvalCount === 0) {
      return res.status(400).json({ message: 'No pending members selected for approval.' });
    }

    await group.save();

    // Create notifications for approved members
    for (const memberId of memberIds) {
      const notification = await new Notification({
        user: memberId,
        type: 'group_approval',
        message: `Your request to join group "${group.name}" has been approved.`,
        classroom: groupSet.classroom, // Use the classroom ID from groupSet
        groupSet: groupSet._id,
        group: group._id,
        actionBy: req.user._id
      }).save();
      sendNotification(memberId, notification);
    }

    res.status(200).json({ message: 'Members approved successfully' });
  } catch (err) {
    console.error('Approval error:', err);
    res.status(500).json({ error: 'Failed to approve members' });
  }
});

// Reject Members from Group
router.post('/groupset/:groupSetId/group/:groupId/reject', ensureAuthenticated, async (req, res) => {
  const { memberIds } = req.body;
  
  const sendNotification = (userId, notification) => {
    io.to(`user-${userId}`).emit('notification', notification);
  };

  if (!memberIds || memberIds.length === 0) {
    return res.status(400).json({ message: 'No selection with pending status made to perform this action.' });
  }

  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    let rejectionCount = 0;
    group.members = group.members.filter(member => {
      if (memberIds.includes(member._id.toString()) && member.status === 'pending') {
        rejectionCount++;
        return false;  // Remove member
      }
      return true;  // Keep member
    });

    if (rejectionCount === 0) {
      return res.status(400).json({ message: 'No pending members selected for rejection.' });
    }

    await group.save();

    // Create notifications for rejected members
    for (const memberId of memberIds) {
      const notification = await new Notification({
        user: memberId,
        type: 'group_rejection',
        message: `Your request to join group "${group.name}" has been rejected.`,
        classroom: req.params.classroomId,
        groupSet: req.params.groupSetId,
        group: group._id,
        actionBy: req.user._id
      }).save();
      sendNotification(memberId, notification);
    }

    res.status(200).json({ message: 'Members rejected successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject members' });
  }
});

module.exports = router;