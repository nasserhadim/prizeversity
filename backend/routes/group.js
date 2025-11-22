const express = require('express');
const GroupSet = require('../models/GroupSet');
const Group = require('../models/Group');
const Notification = require('../models/Notification');
const Classroom = require('../models/Classroom');
const { ensureAuthenticated } = require('../config/auth');
const blockIfFrozen = require('../middleware/blockIfFrozen');
const router = express.Router();
const io = require('socket.io')();
const { populateNotification } = require('../utils/notifications');
const upload = require('../middleware/upload'); // ADD: reuse existing upload middleware

// Create GroupSet
router.post('/groupset/create', ensureAuthenticated, upload.single('image'), async (req, res) => {
  const { name, classroomId, selfSignup, joinApproval, maxMembers, groupMultiplierIncrement } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : (req.body.image || undefined);
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
      groupMultiplierIncrement: groupMultiplierIncrement !== undefined ? groupMultiplierIncrement : 0, // Default to 0, not 0.1
      image 
    });
    await groupSet.save();

    const populatedGroupSet = await GroupSet.findById(groupSet._id)
      .populate({
        path: 'groups',
        populate: {
          path: 'members._id',
          select: 'email isFrozen firstName lastName classroomFrozen avatar profileImage'
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
router.put('/groupset/:id', ensureAuthenticated, upload.single('image'), async (req, res) => {
  const { name, selfSignup, joinApproval, maxMembers, groupMultiplierIncrement } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : (req.body.image !== undefined ? req.body.image : undefined);
  try {
    const groupSet = await GroupSet.findById(req.params.id)
      .populate('groups')
      .populate('classroom');
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

    // Prevent renaming to a name that already exists in the same classroom
    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (trimmed && trimmed !== groupSet.name) {
        const conflict = await GroupSet.findOne({
          classroom: groupSet.classroom,
          name: trimmed,
          _id: { $ne: groupSet._id }
        });
        if (conflict) {
          return res.status(400).json({ error: 'A GroupSet with this name already exists in this classroom' });
        }
      }
    }

    const oldName = groupSet.name;
    const changes = {};
    if (name !== undefined && groupSet.name !== name) changes.name = name;
    if (selfSignup !== undefined && groupSet.selfSignup !== selfSignup) changes.selfSignup = selfSignup;
    if (joinApproval !== undefined && groupSet.joinApproval !== joinApproval) changes.joinApproval = joinApproval;
    if (maxMembers !== undefined && groupSet.maxMembers !== maxMembers) changes.maxMembers = maxMembers;
    if (groupMultiplierIncrement !== undefined && groupSet.groupMultiplierIncrement !== groupMultiplierIncrement) {
      changes.groupMultiplierIncrement = groupMultiplierIncrement; // Don't use || 0.1 here
    }
    if (image !== undefined && groupSet.image !== image) changes.image = image;

    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ message: 'No changes were made' });
    }

    Object.assign(groupSet, changes);
    await groupSet.save();

    // If multiplier increment changed, update all groups in this groupset
    if (changes.groupMultiplierIncrement !== undefined) {
      const Group = require('../models/Group');
      for (const groupId of groupSet.groups) {
        const group = await Group.findById(groupId);
        if (group) {
          await group.updateMultiplier();
        }
      }
    }

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
          select: 'email isFrozen firstName lastName classroomFrozen avatar profileImage'
        }
      });
    
    req.app.get('io').to(`classroom-${groupSet.classroom._id}`).emit('groupset_update', populatedGroupSet);

    res.status(200).json(groupSet);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update group set' });
  }
});

// Remove GroupSet image
router.delete('/groupset/:id/remove-image', ensureAuthenticated, async (req, res) => {
  try {
    const groupSet = await GroupSet.findById(req.params.id);
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });
    groupSet.image = 'placeholder.jpg';
    await groupSet.save();
    res.json({ groupSet });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove image' });
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

    // Delete all associated groups first
    if (groupSet.groups.length > 0) {
      await Group.deleteMany({ _id: { $in: groupSet.groups } });
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
          { 
            path: 'members._id', 
            select: 'email isFrozen firstName lastName classroomFrozen avatar profileImage'
          },
          { 
            path: 'siphonRequests', 
            model: 'SiphonRequest',
            populate: {
              path: 'targetUser',
              select: 'firstName lastName email'
            }
          }
        ]
      });

    // Clean up any null member references and update multipliers if needed
    for (const groupSet of groupSets) {
      for (const group of groupSet.groups) {
        const originalLength = group.members.length;
        group.members = group.members.filter(member => member._id !== null);
        
        // If we removed null members, update the group
        if (group.members.length !== originalLength) {
          await group.updateMultiplier();
          await group.save();
        }
      }
    }

    res.status(200).json(groupSets);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch group sets' });
  }
});

// Create Group within GroupSet
router.post('/groupset/:groupSetId/group/create', ensureAuthenticated, upload.single('image'), async (req, res) => {
  const { name, count } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : (req.body.image || undefined);

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
        image,
        isAutoMultiplier: true, // Enable auto calculation for new groups
        groupMultiplier: 1 // Start with base multiplier
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
          select: 'email isFrozen firstName lastName classroomFrozen avatar profileImage'
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
        error: `Group "${group.name}" has reached its maximum capacity of ${maxMembers} members.`
      });
    }

    // Check for existing APPROVED membership across the entire GroupSet
    const alreadyApprovedInGroupSet = groupSet.groups.some(g =>
      g.members.some(m => m._id.equals(req.user._id) && m.status === 'approved')
    );
    if (alreadyApprovedInGroupSet) {
      return res.status(400).json({ error: 'You are already approved in a group within this GroupSet.' });
    }

    // NEW: Check for existing PENDING request anywhere in the GroupSet
    const hasPendingInGroupSet = groupSet.groups.some(g =>
      g.members.some(m => m._id.equals(req.user._id) && m.status === 'pending')
    );
    if (hasPendingInGroupSet) {
      // Find which group has the pending request
      const pendingGroup = groupSet.groups.find(g =>
        g.members.some(m => m._id.equals(req.user._id) && m.status === 'pending')
      );
      return res.status(400).json({ 
        error: `You already have a pending request in "${pendingGroup.name}". Cancel that request first or wait for approval.` 
      });
    }

    // Remove any old rejected requests from this specific group
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

    // Update group multiplier after member joins
    await group.updateMultiplier();

    const populatedGroup = await Group.findById(group._id)
      .populate('members._id', 'email isFrozen firstName lastName classroomFrozen avatar profileImage');

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

// Update Group (accept image file)
router.put('/groupset/:groupSetId/group/:groupId', ensureAuthenticated, upload.single('image'), async (req, res) => {
  const { name, maxMembers } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : (req.body.image !== undefined ? req.body.image : undefined);
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
      .populate('members._id', 'email isFrozen firstName lastName classroomFrozen avatar profileImage');

    req.app.get('io').to(`classroom-${groupSet.classroom}`).emit('group_update', {
      groupSet: groupSet._id,
      group: populatedGroup
    });

    res.status(200).json(group);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// Remove Group image
router.delete('/groupset/:groupSetId/group/:groupId/remove-image', ensureAuthenticated, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    group.image = 'placeholder.jpg';
    await group.save();
    res.json({ group });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove image' });
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

// Add members to a group (Teacher/Admin action)
router.post('/groupset/:groupSetId/group/:groupId/add-members', ensureAuthenticated, async (req, res) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only teachers or admins can add members.' });
  }

  const { memberIds } = req.body;
  if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: 'Member IDs are required.' });
  }

  try {
    const groupSet = await GroupSet.findById(req.params.groupSetId).populate('groups');
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const classroom = await Classroom.findById(groupSet.classroom).select('students');
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    // --- Validation ---
    const maxMembers = group.maxMembers || groupSet.maxMembers;
    const currentApprovedCount = group.members.filter(m => m.status === 'approved').length;

    if (maxMembers && (currentApprovedCount + memberIds.length) > maxMembers) {
      return res.status(400).json({ error: `Adding these members would exceed the group capacity of ${maxMembers}.` });
    }

    const allMemberIdsInGroupSet = new Set(
      groupSet.groups.flatMap(g => g.members.map(m => m._id.toString()))
    );

    const membersToAdd = [];
    const errors = [];

    for (const memberId of memberIds) {
      if (!classroom.students.map(s => s.toString()).includes(memberId)) {
        errors.push(`Student ${memberId} is not in this classroom.`);
        continue;
      }
      if (allMemberIdsInGroupSet.has(memberId)) {
        errors.push(`Student ${memberId} is already in a group in this GroupSet.`);
        continue;
      }
      membersToAdd.push(memberId);
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(' ') });
    }

    // --- Add Members ---
    for (const memberId of membersToAdd) {
      group.members.push({
        _id: memberId,
        status: 'approved',
        joinDate: new Date()
      });

      const notification = await Notification.create({
        user: memberId,
        type: 'group_add',
        message: `You have been added to the group "${group.name}".`,
        classroom: groupSet.classroom,
        groupSet: groupSet._id,
        group: group._id,
        actionBy: req.user._id
      });
      const populatedNotification = await populateNotification(notification._id);
      req.app.get('io').to(`user-${memberId}`).emit('notification', populatedNotification);
    }

    await group.updateMultiplier();
    await group.save();

    const populatedGroup = await Group.findById(group._id).populate('members._id', 'email isFrozen firstName lastName classroomFrozen avatar profileImage');
    req.app.get('io').to(`classroom-${groupSet.classroom}`).emit('group_update', {
      groupSet: groupSet._id,
      group: populatedGroup
    });

    res.status(200).json({ message: `${membersToAdd.length} member(s) added successfully.` });

  } catch (err) {
    console.error('Add members error:', err);
    res.status(500).json({ error: 'Failed to add members.' });
  }
});


// Suspend Members from Group
router.post('/groupset/:groupSetId/group/:groupId/suspend', ensureAuthenticated, async (req, res) => {
  const { memberIds } = req.body;
  
  if (!memberIds || memberIds.length === 0) {
    return res.status(400).json({ message: 'No members selected for suspension.' });
  }

  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Check if any selected members are actually approved (can only suspend approved members)
    const selectedApprovedMembers = memberIds.filter(id =>
      group.members.some(m => m._id.toString() === id && m.status === 'approved')
    );

    if (selectedApprovedMembers.length === 0) {
      const pendingMembers = memberIds.filter(id =>
        group.members.some(m => m._id.toString() === id && m.status === 'pending')
      );
      
      if (pendingMembers.length > 0) {
        return res.status(400).json({ 
          message: 'Cannot suspend pending members. Use reject instead.' 
        });
      } else {
        return res.status(400).json({ 
          message: 'No approved members found in selection.' 
        });
      }
    }

    const initialMemberCount = group.members.length;
    group.members = group.members.filter(member => 
      !selectedApprovedMembers.includes(member._id.toString())
    );
    
    const suspendedCount = initialMemberCount - group.members.length;

    const groupSet = await GroupSet.findById(req.params.groupSetId);
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

    for (const memberId of selectedApprovedMembers) {
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

    // Update group multiplier after suspending members
    await group.updateMultiplier();

    // After successful member status change (approve/reject/suspend)
    const populatedGroup = await Group.findById(group._id)
      .populate('members._id', 'email firstName lastName classroomFrozen avatar profileImage');

    req.app.get('io').to(`classroom-${groupSet.classroom}`).emit('group_update', { 
      groupSet: groupSet._id, 
      group: populatedGroup
    });

    res.status(200).json({ 
      message: `${suspendedCount} member(s) suspended successfully.` 
    });
  } catch (err) {
    console.error('Suspension error:', err);
    res.status(500).json({ error: 'Failed to suspend members' });
  }
});

// Leave Group within GroupSet
router.post('/groupset/:groupSetId/group/:groupId/leave', ensureAuthenticated, blockIfFrozen, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Prevent leaving while there's an active siphon against this user
    const SiphonRequest = require('../models/SiphonRequest');
    const User = require('../models/User');
    const liveUser = await User.findById(req.user._id).select('isFrozen');
    if (liveUser?.isFrozen) {
      const active = await SiphonRequest.findOne({
        targetUser: req.user._id,
        status: { $in: ['pending', 'group_approved'] }
      });
      if (active) {
        return res.status(403).json({ message: 'You cannot leave the group while a siphon request against you is pending.' });
      }
    }

    const isMember = group.members.some(member => member._id.equals(req.user._id));
    if (!isMember) return res.status(400).json({ message: "You're not a member of this group to leave it!" });
    
    console.log(`Before leave - Group ${group.name}: ${group.members.length} members, multiplier: ${group.groupMultiplier}`);
    
    group.members = group.members.filter(member => !member._id.equals(req.user._id));
    await group.save();

    // Update group multiplier after member leaves
    await group.updateMultiplier();
    
    console.log(`After leave - Group ${group.name}: ${group.members.length} members, multiplier: ${group.groupMultiplier}`);

    res.status(200).json({ message: 'Left group successfully' });
  } catch (err) {
    console.error('Leave group error:', err);
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

    // Check if any of the selected members are actually pending
    const selectedPendingMembers = memberIds.filter(id => 
      group.members.some(m => m._id.toString() === id && m.status === 'pending')
    );

    if (selectedPendingMembers.length === 0) {
      const alreadyApproved = memberIds.filter(id =>
        group.members.some(m => m._id.toString() === id && m.status === 'approved')
      );
      
      if (alreadyApproved.length > 0) {
        return res.status(400).json({ 
          message: 'Selected members are already approved.' 
        });
      } else {
        return res.status(400).json({ 
          message: 'No pending members found in selection.' 
        });
      }
    }

    // Calculate current approved members count
    const currentApprovedCount = group.members.filter(m => m.status === 'approved').length;

    // Check if we have a member limit
    const maxMembers = group.maxMembers || groupSet.maxMembers;
    const remainingSlots = maxMembers ? maxMembers - currentApprovedCount : Infinity;

    if (remainingSlots <= 0) {
      return res.status(400).json({ 
        message: `Group "${group.name}" is already at maximum capacity of ${maxMembers} members.` 
      });
    }

    // Sort members by join date to approve oldest requests first
    const pendingMembers = selectedPendingMembers
      .map(id => group.members.find(m => m._id.toString() === id && m.status === 'pending'))
      .filter(Boolean)
      .sort((a, b) => a.joinDate - b.joinDate);

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

    // Update member statuses - approve selected ones, remove rejected ones completely
    group.members = group.members.filter(member => {
      const memberId = member._id.toString();
      
      // If this member should be rejected, remove them entirely
      if (rejected.includes(memberId)) {
        return false; // Remove from group
      }
      
      // If this member should be approved, update their status
      if (approved.includes(memberId)) {
        member.status = 'approved';
      }
      
      return true; // Keep in group
    });

    await group.save();

    // Update group multiplier after approving members
    await group.updateMultiplier();

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

      // Award XP for joining group
      const classroom = await Classroom.findById(groupSet.classroom);
      const joinXP = classroom?.xpConfig?.groupJoin ?? 0;

      if (Number(joinXP) > 0) {
        const { awardXP } = require('../utils/xp');

        await awardXP({
          userId: memberId,
          classroomId: classroom._id,
          opts: { rawXP: Number(joinXP) }
        });
      }
    }

    // Send notifications to rejected members (due to capacity) - they were removed
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
      .populate('members._id', 'email isFrozen firstName lastName classroomFrozen avatar profileImage');

    // Emit update immediately
    req.app.get('io').to(`classroom-${groupSet.classroom}`).emit('group_update', { 
      groupSet: groupSet._id, 
      group: populatedGroup
    });

    res.status(200).json({ 
      message: approved.length === selectedPendingMembers.length 
        ? `${approved.length} member(s) approved successfully.`
        : `${approved.length} member(s) approved. ${rejected.length} member(s) rejected due to capacity limits.`,
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
    return res.status(400).json({ message: 'No members selected for rejection.' });
  }

  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const groupSet = await GroupSet.findById(req.params.groupSetId).populate('classroom');
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

    // Check if any selected members are actually pending
    const selectedPendingMembers = memberIds.filter(id =>
      group.members.some(m => m._id.toString() === id && m.status === 'pending')
    );

    if (selectedPendingMembers.length === 0) {
      const alreadyApproved = memberIds.filter(id =>
        group.members.some(m => m._id.toString() === id && m.status === 'approved')
      );
      
      if (alreadyApproved.length > 0) {
        return res.status(400).json({ 
          message: 'Cannot reject approved members. Use suspend instead.' 
        });
      } else {
        return res.status(400).json({ 
          message: 'No pending members found in selection.' 
        });
      }
    }

    // Remove rejected members completely from the group
    const initialMemberCount = group.members.length;
    group.members = group.members.filter(member => 
      !selectedPendingMembers.includes(member._id.toString())
    );
    const rejectionCount = initialMemberCount - group.members.length;

    await group.save();

    // Create notifications for rejected members
    for (const memberId of selectedPendingMembers) {
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
      .populate('members._id', 'email firstName lastName classroomFrozen avatar profileImage');

    req.app.get('io').to(`classroom-${groupSet.classroom}`).emit('group_update', { 
      groupSet: groupSet._id, 
      group: populatedGroup
    });

    res.status(200).json({ 
      message: `${rejectionCount} member(s) rejected successfully.` 
    });
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
    return res.status(400).json({ message: 'No members selected for suspension.' });
  }

  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Check if any selected members are actually approved (can only suspend approved members)
    const selectedApprovedMembers = memberIds.filter(id =>
      group.members.some(m => m._id.toString() === id && m.status === 'approved')
    );

    if (selectedApprovedMembers.length === 0) {
      const pendingMembers = memberIds.filter(id =>
        group.members.some(m => m._id.toString() === id && m.status === 'pending')
      );
      
      if (pendingMembers.length > 0) {
        return res.status(400).json({ 
          message: 'Cannot suspend pending members. Use reject instead.' 
        });
      } else {
        return res.status(400).json({ 
          message: 'No approved members found in selection.' 
        });
      }
    }

    const initialMemberCount = group.members.length;
    group.members = group.members.filter(member => 
      !selectedApprovedMembers.includes(member._id.toString())
    );
    
    const suspendedCount = initialMemberCount - group.members.length;

    const groupSet = await GroupSet.findById(req.params.groupSetId);
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

    for (const memberId of selectedApprovedMembers) {
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

    // Update group multiplier after suspending members
    await group.updateMultiplier();

    // After successful member status change (approve/reject/suspend)
    const populatedGroup = await Group.findById(group._id)
      .populate('members._id', 'email firstName lastName classroomFrozen avatar profileImage');

    req.app.get('io').to(`classroom-${groupSet.classroom}`).emit('group_update', { 
      groupSet: groupSet._id, 
      group: populatedGroup
    });

    res.status(200).json({ 
      message: `${suspendedCount} member(s) suspended successfully.` 
    });
  } catch (err) {
    console.error('Suspension error:', err);
    res.status(500).json({ error: 'Failed to suspend members' });
  }
});

// Leave Group within GroupSet
router.post('/groupset/:groupSetId/group/:groupId/leave', ensureAuthenticated, blockIfFrozen, async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Prevent leaving while there's an active siphon against this user
    const SiphonRequest = require('../models/SiphonRequest');
    const User = require('../models/User');
    const liveUser = await User.findById(req.user._id).select('isFrozen');
    if (liveUser?.isFrozen) {
      const active = await SiphonRequest.findOne({
        targetUser: req.user._id,
        status: { $in: ['pending', 'group_approved'] }
      });
      if (active) {
        return res.status(403).json({ message: 'You cannot leave the group while a siphon request against you is pending.' });
      }
    }

    const isMember = group.members.some(member => member._id.equals(req.user._id));
    if (!isMember) return res.status(400).json({ message: "You're not a member of this group to leave it!" });
    
    console.log(`Before leave - Group ${group.name}: ${group.members.length} members, multiplier: ${group.groupMultiplier}`);
    
    group.members = group.members.filter(member => !member._id.equals(req.user._id));
    await group.save();

    // Update group multiplier after member leaves
    await group.updateMultiplier();
    
    console.log(`After leave - Group ${group.name}: ${group.members.length} members, multiplier: ${group.groupMultiplier}`);

    res.status(200).json({ message: 'Left group successfully' });
  } catch (err) {
    console.error('Leave group error:', err);
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

    // Check if any of the selected members are actually pending
    const selectedPendingMembers = memberIds.filter(id => 
      group.members.some(m => m._id.toString() === id && m.status === 'pending')
    );

    if (selectedPendingMembers.length === 0) {
      const alreadyApproved = memberIds.filter(id =>
        group.members.some(m => m._id.toString() === id && m.status === 'approved')
      );
      
      if (alreadyApproved.length > 0) {
        return res.status(400).json({ 
          message: 'Selected members are already approved.' 
        });
      } else {
        return res.status(400).json({ 
          message: 'No pending members found in selection.' 
        });
      }
    }

    // Calculate current approved members count
    const currentApprovedCount = group.members.filter(m => m.status === 'approved').length;

    // Check if we have a member limit
    const maxMembers = group.maxMembers || groupSet.maxMembers;
    const remainingSlots = maxMembers ? maxMembers - currentApprovedCount : Infinity;

    if (remainingSlots <= 0) {
      return res.status(400).json({ 
        message: `Group "${group.name}" is already at maximum capacity of ${maxMembers} members.` 
      });
    }

    // Sort members by join date to approve oldest requests first
    const pendingMembers = selectedPendingMembers
      .map(id => group.members.find(m => m._id.toString() === id && m.status === 'pending'))
      .filter(Boolean)
      .sort((a, b) => a.joinDate - b.joinDate);

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

    // Update member statuses - approve selected ones, remove rejected ones completely
    group.members = group.members.filter(member => {
      const memberId = member._id.toString();
      
      // If this member should be rejected, remove them entirely
      if (rejected.includes(memberId)) {
        return false; // Remove from group
      }
      
      // If this member should be approved, update their status
      if (approved.includes(memberId)) {
        member.status = 'approved';
      }
      
      return true; // Keep in group
    });

    await group.save();

    // Update group multiplier after approving members
    await group.updateMultiplier();

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

    // Send notifications to rejected members (due to capacity) - they were removed
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
      .populate('members._id', 'email isFrozen firstName lastName classroomFrozen avatar profileImage');

    // Emit update immediately
    req.app.get('io').to(`classroom-${groupSet.classroom}`).emit('group_update', { 
      groupSet: groupSet._id, 
      group: populatedGroup
    });

    res.status(200).json({ 
      message: approved.length === selectedPendingMembers.length 
        ? `${approved.length} member(s) approved successfully.`
        : `${approved.length} member(s) approved. ${rejected.length} member(s) rejected due to capacity limits.`,
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
    return res.status(400).json({ message: 'No members selected for rejection.' });
  }

  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const groupSet = await GroupSet.findById(req.params.groupSetId).populate('classroom');
    if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

    // Check if any selected members are actually pending
    const selectedPendingMembers = memberIds.filter(id =>
      group.members.some(m => m._id.toString() === id && m.status === 'pending')
    );

    if (selectedPendingMembers.length === 0) {
      const alreadyApproved = memberIds.filter(id =>
        group.members.some(m => m._id.toString() === id && m.status === 'approved')
      );
      
      if (alreadyApproved.length > 0) {
        return res.status(400).json({ 
          message: 'Cannot reject approved members. Use suspend instead.' 
        });
      } else {
        return res.status(400).json({ 
          message: 'No pending members found in selection.' 
        });
      }
    }

    // Remove rejected members completely from the group
    const initialMemberCount = group.members.length;
    group.members = group.members.filter(member => 
      !selectedPendingMembers.includes(member._id.toString())
    );
    const rejectionCount = initialMemberCount - group.members.length;

    await group.save();

    // Create notifications for rejected members
    for (const memberId of selectedPendingMembers) {
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
      .populate('members._id', 'email firstName lastName classroomFrozen avatar profileImage');

    req.app.get('io').to(`classroom-${groupSet.classroom}`).emit('group_update', { 
      groupSet: groupSet._id, 
      group: populatedGroup
    });

    res.status(200).json({ 
      message: `${rejectionCount} member(s) rejected successfully.` 
    });
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

// Bulk Delete Groupsets within Classroom
router.delete('/classroom/:classroomId/groupsets/bulk', ensureAuthenticated, async (req, res) => {
  const { groupSetIds } = req.body;
  if (!groupSetIds || !groupSetIds.length) {
    return res.status(400).json({ error: 'No GroupSets selected for deletion' });
  }

  try {
    // load groupSets for this classroom
    const groupSets = await GroupSet.find({
      _id: { $in: groupSetIds },
      classroom: req.params.classroomId
    }).populate('groups').populate('classroom');

    if (groupSets.length === 0) {
      return res.status(404).json({ error: 'No GroupSets found' });
    }

    // collect all group ids and all member ids for notifications
    const allGroupIds = [];
    const memberIds = new Set();
    for (const gs of groupSets) {
      // gs.groups is populated as objects, so use gid._id
      gs.groups.forEach(gid => allGroupIds.push(gid._id.toString()));
      // load each group members to collect user ids
      const groups = await Group.find({ _id: { $in: gs.groups.map(g => g._id) } }).populate('members._id');
      groups.forEach(g => {
        g.members.forEach(m => memberIds.add(m._id._id.toString()));
      });
    }

    // create notifications for all affected members
    for (const memberId of memberIds) {
      const notification = await Notification.create({
        user: memberId,
        type: 'groupset_deletion',
        message: `A GroupSet in classroom "${groupSets[0].classroom.name}" was deleted`,
        classroom: groupSets[0].classroom._id,
        actionBy: req.user._id
      });
      const populated = await populateNotification(notification._id);
      req.app.get('io').to(`user-${memberId}`).emit('notification', populated);
    }

    // delete groups and groupSets
    if (allGroupIds.length) await Group.deleteMany({ _id: { $in: allGroupIds } });
    await GroupSet.deleteMany({ _id: { $in: groupSetIds } });

    // notify classroom channel
    req.app.get('io').to(`classroom-${req.params.classroomId}`).emit('groupsets_bulk_delete', groupSetIds);

    res.status(200).json({ message: `${groupSetIds.length} GroupSet(s) deleted` });
  } catch (err) {
    console.error('[Bulk delete GroupSets] error:', err);
    res.status(500).json({ error: 'Failed to delete GroupSets' });
  }
});

module.exports = router;