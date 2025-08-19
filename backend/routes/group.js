const express = require('express');
const GroupSet = require('../models/GroupSet');
const Group = require('../models/Group');
const Notification = require('../models/Notification');
const { ensureAuthenticated } = require('../config/auth');
const router = express.Router();
const io = require('socket.io')();
const { populateNotification } = require('../utils/notifications');

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

    const populatedGroupSet = await GroupSet.findById(groupSet._id)
      .populate({
        path: 'groups',
        populate: {
          path: 'members._id',
          select: 'email isFrozen firstName lastName'
        }
      });

    // Emit to classroom channel
    req.app.get('io').to(`classroom-${classroomId}`).emit('groupset_create', populatedGroupSet);
    
    res.status(201).json(groupSet);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create group set' });
  }
});

// Update GroupSet
router.put('/groupset/:id', ensureAuthenticated, async (req, res) => {
  const { name, selfSignup, joinApproval, maxMembers, image } = req.body;
  try {
    const groupSet = await GroupSet.findById(req.params.id)
      .populate('groups')
      .populate('classroom');
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

    const oldName = groupSet.name; // Store old name before changes
    const changes = {};
    if (groupSet.name !== name) changes.name = name;
    if (groupSet.selfSignup !== selfSignup) changes.selfSignup = selfSignup;
    if (groupSet.joinApproval !== joinApproval) changes.joinApproval = joinApproval;
    if (groupSet.maxMembers !== maxMembers) changes.maxMembers = maxMembers;
    if (groupSet.image !== image) changes.image = image;

    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ message: 'No changes were made' });
    }

    Object.assign(groupSet, changes);
    await groupSet.save();

    // Get all unique members across all groups
    const memberIds = new Set();
    groupSet.groups.forEach(group => {
      group.members.forEach(member => {
        memberIds.add(member._id._id.toString());
      });
    });

    // Send notifications for name change
    if (changes.name) {
      for (const memberId of memberIds) {
        const notification = await Notification.create({
          user: memberId,
          type: 'groupset_update',
          message: `GroupSet "${oldName}" has been renamed to "${name}"`,
          classroom: groupSet.classroom._id,
          groupSet: groupSet._id,
          actionBy: req.user._id
        });

        const populatedNotification = await populateNotification(notification._id);
        req.app.get('io').to(`user-${memberId}`).emit('notification', populatedNotification);
      }
    }

    // Always emit the groupset update event to all classroom members
    const populatedGroupSet = await GroupSet.findById(groupSet._id)
      .populate({
        path: 'groups',
        populate: {
          path: 'members._id',
          select: 'email isFrozen firstName lastName'
        }
      });
    
    req.app.get('io').to(`classroom-${groupSet.classroom._id}`).emit('groupset_update', populatedGroupSet);

    res.status(200).json(groupSet);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update group set' });
  }
});

// Delete GroupSet
router.delete('/groupset/:id', ensureAuthenticated, async (req, res) => {
  try {
    const groupSet = await GroupSet.findById(req.params.id)
      .populate('groups')
      .populate('classroom');
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

    // Get all unique members across all groups
    const memberIds = new Set();
    groupSet.groups.forEach(group => {
      group.members.forEach(member => {
        memberIds.add(member._id._id.toString());
      });
    });

    // Create notifications for all members
    for (const memberId of memberIds) {
      const notification = await Notification.create({
        user: memberId,
        type: 'groupset_deletion',
        message: `GroupSet "${groupSet.name}" has been deleted`,
        classroom: groupSet.classroom._id,
        actionBy: req.user._id
      });
    
      const populatedNotification = await populateNotification(notification._id);
      req.app.get('io').to(`user-${memberId}`).emit('notification', populatedNotification);
    }

    await GroupSet.deleteOne({ _id: req.params.id });

    // Emit deletion event to all classroom members
    req.app.get('io').to(`classroom-${groupSet.classroom._id}`).emit('groupset_delete', groupSet._id);

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
    populate: [
      { path: 'members._id', select: 'email isFrozen firstName lastName' },
      { path: 'siphonRequests', model: 'SiphonRequest' }
    ]
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
  if (!count || count < 1) {
    return res.status(400).json({ error: 'Group count must be at least 1' });
  }

  try {
    const groupSet = await GroupSet.findById(req.params.groupSetId).populate('groups');
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

    // Collect all current group names in this group set
    const existingNames = new Set(groupSet.groups.map(g => g.name.toLowerCase()));

    const newGroups = [];
    for (let i = 0; i < count; i++) {
      const newName = `${name}`;
      if (existingNames.has(newName.toLowerCase())) {
        return res.status(400).json({ error: `Group name "${newName}" already exists in this group set.` });
      }

      const newGroup = new Group({
        name: newName,
        maxMembers: groupSet.maxMembers,
      });

      await newGroup.save();
      groupSet.groups.push(newGroup._id);
      newGroups.push(newGroup);
      existingNames.add(newName.toLowerCase()); // prevent duplicate in-loop
    }

    await groupSet.save();

    const populatedGroupSet = await GroupSet.findById(groupSet._id)
      .populate({
        path: 'groups',
        populate: {
          path: 'members._id',
          select: 'email isFrozen firstName lastName'
        }
      });

    req.app.get('io').to(`classroom-${groupSet.classroom}`).emit('groupset_update', populatedGroupSet);

    res.status(201).json(newGroups);
  } catch (err) {
    console.error('Group creation error:', err);
    res.status(500).json({ error: 'Failed to create groups' });
  }
});

// Join Group within GroupSet
router.post('/groupset/:groupSetId/group/:groupId/join', ensureAuthenticated, async (req, res) => {
  try {
    const groupSet = await GroupSet.findById(req.params.groupSetId).populate('groups');
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Prevent students from joining if self-signup is disabled
    if (req.user.role === 'student' && !groupSet.selfSignup) {
      return res.status(403).json({ error: 'Self-signup is not allowed for this GroupSet.' });
    }

    const maxMembers = group.maxMembers || groupSet.maxMembers;
    const currentApprovedCount = group.members.filter(m => m.status === 'approved').length;

    // Check if group is full
    if (maxMembers && currentApprovedCount >= maxMembers) {
      return res.status(400).json({
        error: `Group "${group.name}" has reached its maximum capacity of ${maxMembers}.`
      });
    }

    // Check for existing approved membership in this GroupSet
    const alreadyInGroup = groupSet.groups.some(g =>
      g.members.some(m => m._id.equals(req.user._id) && m.status === 'approved')
    );
    if (alreadyInGroup) {
      return res.status(400).json({ error: 'You are already in a group within this GroupSet.' });
    }

    // Check for existing pending request in this group
    const hasPending = group.members.some(m =>
      m._id.equals(req.user._id) && m.status === 'pending'
    );
    if (hasPending) {
      return res.status(400).json({ error: `You already requested to join "${group.name}".` });
    }

    // Remove rejected requests
    group.members = group.members.filter(m =>
      !(m._id.equals(req.user._id) && m.status === 'rejected')
    );

    const status = groupSet.joinApproval ? 'pending' : 'approved';

    group.members.push({
      _id: req.user._id,
      status,
      joinDate: new Date()
    });

    await group.save();

    const populatedGroup = await Group.findById(group._id)
      .populate('members._id', 'email isFrozen firstName lastName');

    req.app.get('io').to(`classroom-${groupSet.classroom}`).emit('group_update', {
      groupSet: groupSet._id,
      group: populatedGroup
    });

    res.status(200).json({
      message: status === 'approved' ? 'Joined group successfully!' : 'Join request sent for approval.'
    });
  } catch (err) {
    console.error('Join error:', err);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// Update Group
router.put('/groupset/:groupSetId/group/:groupId', ensureAuthenticated, async (req, res) => {
  const { name, image, maxMembers } = req.body;
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const groupSet = await GroupSet.findById(req.params.groupSetId);
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

    const oldName = group.name; // Store old name before changes
    const changes = {};
    
    // More robust comparison for name
    if (name !== undefined && group.name !== name.trim()) changes.name = name.trim();
    
    // More robust comparison for image
    if (image !== undefined && group.image !== image) changes.image = image;
    
    // More robust comparison for maxMembers (handle string/number conversion)
    const newMaxMembers = maxMembers === '' || maxMembers === null || maxMembers === undefined ? null : Number(maxMembers);
    const currentMaxMembers = group.maxMembers;
    if (newMaxMembers !== currentMaxMembers) changes.maxMembers = newMaxMembers;

    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ message: 'No changes were made' });
    }

    Object.assign(group, changes);
    await group.save();

    // Send notifications for name change
    if (changes.name) {
      for (const member of group.members) {
        const notification = await Notification.create({
          user: member._id._id,
          type: 'group_update',
          message: `Group "${oldName}" has been renamed to "${name}"`,
          classroom: groupSet.classroom,
          groupSet: groupSet._id,
          group: group._id,
          actionBy: req.user._id
        });

        const populatedNotification = await populateNotification(notification._id);
        req.app.get('io').to(`user-${member._id._id}`).emit('notification', populatedNotification);
      }
    }

    // Always emit the group update event with populated data
    const populatedGroup = await Group.findById(group._id)
      .populate('members._id', 'email firstName lastName');

    req.app.get('io').to(`classroom-${groupSet.classroom}`).emit('group_update', { 
      groupSet: groupSet._id, 
      group: populatedGroup
    });

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

    const groupSet = await GroupSet.findById(req.params.groupSetId);
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

    for (const member of group.members) {
      const notification = await Notification.create({
        user: member._id._id,
        type: 'group_deletion',
        message: `Group "${group.name}" has been deleted`,
        classroom: groupSet.classroom,
        groupSet: groupSet._id,
        actionBy: req.user._id
      });
    
      const populatedNotification = await populateNotification(notification._id);
      req.app.get('io').to(`user-${member._id._id}`).emit('notification', populatedNotification);
    }

    await Group.deleteOne({ _id: req.params.groupId });
    groupSet.groups = groupSet.groups.filter(groupId => groupId.toString() !== req.params.groupId);
    await groupSet.save();

    // Emit group deletion event to all classroom members
    req.app.get('io').to(`classroom-${groupSet.classroom}`).emit('group_delete', {
      groupSetId: groupSet._id,
      groupId: req.params.groupId
    });

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

    const groupSet = await GroupSet.findById(req.params.groupSetId);
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

    for (const memberId of memberIds) {
      const notification = await Notification.create({
        user: memberId,
        type: 'group_suspension',
        message: `You have been suspended from group "${group.name}"`,
        classroom: groupSet.classroom,
        groupSet: groupSet._id,
        group: group._id,
        actionBy: req.user._id
      });
    
      const populatedNotification = await populateNotification(notification._id);
      req.app.get('io').to(`user-${memberId}`).emit('notification', populatedNotification);
    }

    await group.save();

    // After successful member status change (approve/reject/suspend)
    const populatedGroup = await Group.findById(group._id)
      .populate('members._id', 'email firstName lastName');

    req.app.get('io').to(`classroom-${groupSet.classroom}`).emit('group_update', { 
      groupSet: groupSet._id, 
      group: populatedGroup
    });

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
  
  try {
    const groupSet = await GroupSet.findById(req.params.groupSetId);
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Calculate current approved members count
    const currentApprovedCount = group.members.filter(m => m.status === 'approved').length;

    // Check if we have a member limit
    const maxMembers = group.maxMembers || groupSet.maxMembers;
    const remainingSlots = maxMembers ? maxMembers - currentApprovedCount : Infinity;

    if (remainingSlots <= 0) {
      return res.status(400).json({ message: 'Group is already at maximum capacity' });
    }

    // Sort members by join date to approve oldest requests first
    const pendingMembers = memberIds
      .map(id => group.members.find(m => m._id.toString() === id && m.status === 'pending'))
      .filter(Boolean)
      .sort((a, b) => a.joinDate - b.joinDate);

    if (pendingMembers.length === 0) {
      return res.status(400).json({ message: 'No pending members selected for approval.' });
    }

    // Track which members were approved and rejected
    const approved = [];
    const rejected = [];

    // Process members up to the remaining slot limit
    for (const member of pendingMembers) {
      if (approved.length < remainingSlots) {
        approved.push(member._id.toString());
      } else {
        rejected.push(member._id.toString());
      }
    }

    // Update member statuses
    group.members = group.members.map(member => {
      if (approved.includes(member._id.toString())) {
        return { ...member.toObject(), status: 'approved' };
      }
      if (rejected.includes(member._id.toString())) {
        return { ...member.toObject(), status: 'rejected' };
      }
      return member;
    });

    await group.save();

    // Send notifications to approved members
    for (const memberId of approved) {
      const notification = await Notification.create({
        user: memberId,
        type: 'group_approval',
        message: `Your request to join group "${group.name}" has been approved.`,
        classroom: groupSet.classroom,
        groupSet: groupSet._id,
        group: group._id,
        actionBy: req.user._id
      });
      
      const populatedNotification = await populateNotification(notification._id);
      req.app.get('io').to(`user-${memberId}`).emit('notification', populatedNotification);
    }

    // Send notifications to rejected members (due to capacity)
    for (const memberId of rejected) {
      const notification = await Notification.create({
        user: memberId,
        type: 'group_rejection',
        message: `Your request to join group "${group.name}" was rejected due to group reaching maximum capacity.`,
        classroom: groupSet.classroom,
        groupSet: groupSet._id,
        group: group._id,
        actionBy: req.user._id
      });
      
      const populatedNotification = await populateNotification(notification._id);
      req.app.get('io').to(`user-${memberId}`).emit('notification', populatedNotification);
    }

    // After successful member status change
    const populatedGroup = await Group.findById(group._id)
      .populate('members._id', 'email firstName lastName');

    // Emit update immediately
    req.app.get('io').to(`classroom-${groupSet.classroom}`).emit('group_update', { 
      groupSet: groupSet._id, 
      group: populatedGroup
    });

    res.status(200).json({ 
      message: `${approved.length} member(s) approved. ${rejected.length} member(s) rejected due to capacity limits.`,
      approved,
      rejected
    });

  } catch (err) {
    console.error('Approval error:', err);
    res.status(500).json({ error: 'Failed to approve members' });
  }
});

// Reject Members from Group
router.post('/groupset/:groupSetId/group/:groupId/reject', ensureAuthenticated, async (req, res) => {
  const { memberIds } = req.body;

  if (!memberIds || memberIds.length === 0) {
    return res.status(400).json({ message: 'No selection with pending status made to perform this action.' });
  }

  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const groupSet = await GroupSet.findById(req.params.groupSetId).populate('classroom');
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

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
      const notification = await Notification.create({
        user: memberId,
        type: 'group_rejection',
        message: `Your request to join group "${group.name}" has been rejected.`,
        classroom: groupSet.classroom._id,
        groupSet: groupSet._id,
        group: group._id,
        actionBy: req.user._id
      });
      
      const populatedNotification = await populateNotification(notification._id);
      req.app.get('io').to(`user-${memberId}`).emit('notification', populatedNotification);
    }

    // After successful member status change (approve/reject/suspend)
    const populatedGroup = await Group.findById(group._id)
      .populate('members._id', 'email firstName lastName');

    req.app.get('io').to(`classroom-${groupSet.classroom}`).emit('group_update', { 
      groupSet: groupSet._id, 
      group: populatedGroup
    });

    res.status(200).json({ message: 'Members rejected successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject members' });
  }
});

// Join Classroom
router.post('/join', ensureAuthenticated, async (req, res) => {
  const { code } = req.body;
  try {
    const classroom = await Classroom.findOne({ code });
    if (!classroom) return res.status(404).json({ error: 'Invalid classroom code' });

    if (classroom.students.includes(req.user._id)) {
      return res.status(400).json({ error: 'You have already joined this classroom' });
    }

    classroom.students.push(req.user._id);
    await classroom.save();

    // Populate and emit updated classroom immediately
    const populatedClassroom = await Classroom.findById(classroom._id)
      .populate('teacher', 'email')
      .populate('students', 'email');

    req.app.get('io').to(`classroom-${classroom._id}`).emit('classroom_update', populatedClassroom);

    res.status(200).json({ message: 'Joined classroom successfully', classroom });
  } catch (err) {
    res.status(500).json({ error: 'Failed to join classroom' });
  }
});

// Bulk Delete Groups within GroupSet
router.delete('/groupset/:groupSetId/groups/bulk', ensureAuthenticated, async (req, res) => {
  const { groupIds } = req.body;

  if (!groupIds || groupIds.length === 0) {
    return res.status(400).json({ error: 'No groups selected for deletion' });
  }

  try {
    const groupSet = await GroupSet.findById(req.params.groupSetId);
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

    // Get all groups to be deleted for notifications
    const groups = await Group.find({ _id: { $in: groupIds } }).populate('members._id');
    
    // Create notifications for all members in all groups
    for (const group of groups) {
      for (const member of group.members) {
        const notification = await Notification.create({
          user: member._id._id,
          type: 'group_deletion',
          message: `Group "${group.name}" has been deleted`,
          classroom: groupSet.classroom,
          groupSet: groupSet._id,
          actionBy: req.user._id
        });
        
        const populatedNotification = await populateNotification(notification._id);
        req.app.get('io').to(`user-${member._id._id}`).emit('notification', populatedNotification);
      }
    }

    // Delete all groups
    await Group.deleteMany({ _id: { $in: groupIds } });
    
    // Remove group references from groupSet
    groupSet.groups = groupSet.groups.filter(groupId => !groupIds.includes(groupId.toString()));
    await groupSet.save();

    // Emit bulk group deletion event to all classroom members
    req.app.get('io').to(`classroom-${groupSet.classroom}`).emit('groups_bulk_delete', {
      groupSetId: groupSet._id,
      groupIds: groupIds
    });

    res.status(200).json({ message: `${groupIds.length} group(s) deleted successfully` });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ error: 'Failed to delete groups' });
  }
});

module.exports = router;