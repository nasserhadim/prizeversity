const upload = require('../middleware/upload');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);
const express = require('express');                  
const router  = express.Router();
const mongoose = require('mongoose');
const { transferBits } = require('../utils/transferBits');
const Group = require('../models/Group');        
const SiphonRequest = require('../models/SiphonRequest'); 
const GroupSet = require('../models/GroupSet');      
const Classroom = require('../models/Classroom');     
const Notification = require('../models/Notification');  
const { ensureAuthenticated } = require('../config/auth');
const { populateNotification } = require('../utils/notifications');
const User = require('../models/User');

// Create a new siphon request (it requries file upload for proof and user authentication)
router.post(
  '/group/:groupId/create',
  ensureAuthenticated,
  upload.single('proof'),
  async (req, res) => {
    try {
      const { targetUserId, reason, amount } = req.body;

      // Get group and classroom info
      const group = await Group.findById(req.params.groupId).populate('members._id', 'balance');
      if (!group) return res.status(404).json({ error: 'Group not found' });

      const groupSet = await GroupSet.findOne({ groups: req.params.groupId }).populate('classroom');
      if (!groupSet) return res.status(404).json({ error: 'GroupSet not found' });

      const classroom = groupSet.classroom;

      // Check if there's already an active siphon request in this group
      const existingActiveSiphon = await SiphonRequest.findOne({
        group: req.params.groupId,
        status: { $in: ['pending', 'group_approved'] }
      });

      if (existingActiveSiphon) {
        return res.status(400).json({ 
          error: 'There is already an active siphon request in this group. Please wait for it to be resolved.' 
        });
      }

      // Ensure the target has enough balance (check classroom-specific balance)
      const target = await User.findById(targetUserId).select('balance classroomBalances');
      if (!target) {
        return res.status(400).json({ error: 'Target user not found' });
      }

      // Helper function to get classroom balance (add this if not already present)
      const getClassroomBalance = (user, classroomId) => {
        if (!Array.isArray(user.classroomBalances)) return user.balance || 0;
        const cb = user.classroomBalances.find(cb => String(cb.classroom) === String(classroomId));
        return cb ? cb.balance : (user.balance || 0);
      };

      const targetBalance = getClassroomBalance(target, classroom._id);
      if (targetBalance < Number(amount)) {
        return res.status(400).json({ error: 'Amount exceeds target user balance' });
      }
      
      // Sanitize the HTML reason input
      const cleanReason = DOMPurify.sanitize(reason, {
        ALLOWED_TAGS: ['b','i','u','span','font','p','br','ul','ol','li']
      });

      // Prepare file metadata if proof was uploaded
      const proof = req.file
        ? {
            originalName: req.file.originalname,
            storedName:   req.file.filename,
            mimeType:     req.file.mimetype,
            size:         req.file.size,
          }
        : null;

      // Calculate expiration date based on classroom setting
      const timeoutHours = classroom.siphonTimeoutHours || 72;
      const expiresAt = new Date(Date.now() + timeoutHours * 60 * 60 * 1000);
      
      // Create the SiphonRequest document
      const reqDoc = await SiphonRequest.create({
        group:      req.params.groupId,
        requestedBy:req.user._id,
        targetUser: targetUserId,
        reasonHtml: cleanReason,
        amount:     Number(amount),
        classroom:  classroom._id,
        expiresAt:  expiresAt,
        proof,
      });

      // Freeze the target user
      console.log(`[Siphon] Freezing user ${targetUserId} for classroom ${classroom._id}`);
      await User.findByIdAndUpdate(targetUserId, { $addToSet: { classroomFrozen: { classroom: classroom._id } } });

      // Verify the user was frozen
      const frozenUser = await User.findById(targetUserId).select('classroomFrozen');
      console.log(`[Siphon] User ${targetUserId} classroomFrozen:`, frozenUser.classroomFrozen);

      // Notify target user
      const n = await Notification.create({
        user: targetUserId, 
        type:'siphon_request',
        message:`Group "${group.name}" has initiated a siphon request involving your account. You have ${timeoutHours} hours to respond or for your group to decide.`,
        group: group._id, 
        actionBy: req.user._id, 
        classroom: classroom._id,
        anonymized: true
      });
      req.app.get('io').to(`user-${targetUserId}`).emit('notification', await populateNotification(n._id));
 
      // Notify all other approved group members (except requester and target) about the new siphon request
      const eligibleVoters = group.members.filter(m => 
        m.status === 'approved' && 
        !m._id.equals(req.user._id) && 
        !m._id.equals(targetUserId)
      );
 
      for (const voter of eligibleVoters) {
        const voterNotification = await Notification.create({
          user: voter._id,
          type: 'siphon_request',
          message: `A siphon request has been initiated in group "${group.name}". Your vote is needed within ${timeoutHours} hours.`,
          group: group._id,
          actionBy: req.user._id,
          classroom: classroom._id,
          anonymized: true
        });
        
        const populatedVoterNotification = await populateNotification(voterNotification._id);
        req.app.get('io').to(`user-${voter._id}`).emit('notification', populatedVoterNotification);
      }

      // Emit real time update to group members
      req.app.get('io').to(`group-${reqDoc.group}`).emit('siphon_create', reqDoc);
      res.status(201).json(reqDoc);
    } catch (err) {
      console.error(err);
      res.status(400).json({ error:'Failed to submit siphon request' });
    }
  }
);

// Route to vote on a siphon request (members only)
router.post('/:id/vote', ensureAuthenticated, async (req,res)=>{
  const { vote } = req.body;     
  const siphon = await SiphonRequest.findById(req.params.id);
  if (!siphon || siphon.status!=='pending')
    return res.status(404).json({error:'Request not open for voting'});

  // Check if siphon has expired
  if (new Date() > siphon.expiresAt) {
    siphon.status = 'expired';
    await siphon.save();
    // Unfreeze only for this siphon's classroom
    await User.findByIdAndUpdate(siphon.targetUser, {
      $pull: { classroomFrozen: { classroom: siphon.classroom } }
    });
    return res.status(400).json({error:'Siphon request has expired'});
  }

  // Verify that the user is an approved group member BUT NOT the target
  const group = await Group.findById(siphon.group);

  // Resolve classroomId (used for notifications / checks). Fixes ReferenceError: classroomId is not defined
  const groupSet = await GroupSet.findOne({ groups: group._id }).select('classroom');
  const classroomId = groupSet?.classroom ?? null;

  const isMember = group.members.some(m=>m._id.equals(req.user._id) && m.status==='approved');
  const isTarget = siphon.targetUser.equals(req.user._id);
  
  if (!isMember) return res.status(403).json({error:'Not a group member'});
  if (isTarget) return res.status(403).json({error:'Target member cannot vote on their own siphon'});

  // Record or update the user's vote
  const idx = siphon.votes.findIndex(v=>v.user.equals(req.user._id));
  idx>=0 ? siphon.votes[idx].vote = vote : siphon.votes.push({user:req.user._id,vote});
  await siphon.save();

  // Calculate voting outcome (excluding target from total count)
  const eligibleMembers = group.members.filter(m=>m.status==='approved' && !m._id.equals(siphon.targetUser));
  const totalEligibleVoters = eligibleMembers.length;
  const yesVotes = siphon.votes.filter(v=>v.vote==='yes').length;
  const noVotes  = siphon.votes.filter(v=>v.vote==='no').length;
  const totalVotes = yesVotes + noVotes;

  // Require majority of eligible members to vote
  const majorityThreshold = Math.ceil(totalEligibleVoters / 2);

  // If majority voted "no", reject the request
  if (noVotes >= majorityThreshold) {
    siphon.status = 'rejected';
    await siphon.save();
    await User.findByIdAndUpdate(siphon.targetUser, {
      $pull: { classroomFrozen: { classroom: siphon.classroom } }
    });
    
    // Notify all group members (except target) that the siphon was rejected by majority vote
    const allGroupMembers = group.members.filter(m => 
      m.status === 'approved' && !m._id.equals(siphon.targetUser)
    );
 
    for (const member of allGroupMembers) {
      const rejectionNotification = await Notification.create({
        user: member._id,
        type: 'siphon_rejected',
        message: `The siphon request in group "${group.name}" was rejected by majority vote (${noVotes} voted NO, ${yesVotes} voted YES).`,
        group: group._id,
        actionBy: req.user._id,
        classroom: classroomId,
        anonymized: true
      });
      const populatedRejectionNotification = await populateNotification(rejectionNotification._id);
      req.app.get('io').to(`user-${member._id}`).emit('notification', populatedRejectionNotification);
    }
 
    // Notify the target user that the siphon request against them was rejected
    const targetRejectionNotification = await Notification.create({
      user: siphon.targetUser,
      type: 'siphon_rejected',
      message: `Good news! The siphon request against you in group "${group.name}" was rejected by majority vote (${noVotes} voted NO, ${yesVotes} voted YES). Your account is now unfrozen.`,
      group: group._id,
      actionBy: req.user._id,
      classroom: classroomId,
      anonymized: true
    });
    const populatedTargetRejectionNotification = await populateNotification(targetRejectionNotification._id);
    req.app.get('io').to(`user-${siphon.targetUser}`).emit('notification', populatedTargetRejectionNotification);
 
    req.app.get('io').to(`group-${group._id}`).emit('siphon_update', siphon);
    return res.json({ status: siphon.status });
  }
 
  // If majority voted "yes", escalate to teacher for final decision
  if (yesVotes >= majorityThreshold) {
    siphon.status = 'group_approved';
    await siphon.save();
 
    // Notify all group members (except target) that majority voted yes and it's now pending teacher decision
    const allGroupMembers = group.members.filter(m => 
      m.status === 'approved' && !m._id.equals(siphon.targetUser)
    );

    // After computing `group` (and before creating notifications), resolve classroomId once
    const classroomId = await GroupSet.findOne({ groups: group._id }).then(gs => gs?.classroom);

    // Notify eligible voters about the vote outcome
    for (const member of eligibleMembers) {
      const approvalNotification = await Notification.create({
        user: member._id,
        type: 'siphon_approved',
        message: `The siphon request in group "${group.name}" was approved by majority vote (${yesVotes} voted YES, ${noVotes} voted NO). Now pending teacher decision.`,
        group: group._id,
        actionBy: req.user._id,
        classroom: classroomId,
        anonymized: true
      });
      const populatedApprovalNotification = await populateNotification(approvalNotification._id);
      req.app.get('io').to(`user-${member._id}`).emit('notification', populatedApprovalNotification);
    }
 
    // Notify the target user that the siphon request against them was approved
    const targetApprovalNotification = await Notification.create({
      user: siphon.targetUser,
      type: 'siphon_approved',
      message: `The siphon request against you in group "${group.name}" was approved by majority vote (${yesVotes} voted YES, ${noVotes} voted NO). It's now pending teacher decision. Your account remains frozen until the teacher makes a final decision.`,
      group: group._id,
      actionBy: req.user._id,
      classroom: classroomId,
      anonymized: true
    });
    const populatedTargetApprovalNotification = await populateNotification(targetApprovalNotification._id);
    req.app.get('io').to(`user-${siphon.targetUser}`).emit('notification', populatedTargetApprovalNotification);
 
    // Notify teacher of the classroom (reuse classroomId resolved above)
    const teachers = await Classroom.findById(classroomId).select('teacher').then(c=>[c.teacher]);
    for (const t of teachers){
      const requesterName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;
      const n = await Notification.create({
        user: t, type:'siphon_review',
        message:`Group "${group.name}" approved a siphon request by majority vote and is pending your approval decision. Initiated by ${requesterName}.`,
        group: group._id, siphon: siphon._id, actionBy: req.user._id
      });
      req.app.get('io').to(`user-${t}`).emit('notification', await populateNotification(n._id));
    }
  }

  // Emit vote update in real time to group members
  req.app.get('io').to(`group-${group._id}`).emit('siphon_vote', siphon);
  res.json({
    status: siphon.status,
    votingProgress: {
      yesVotes,
      noVotes,
      totalVotes,
      totalEligibleVoters,
      majorityThreshold,
      needsMoreVotes: totalVotes < totalEligibleVoters && yesVotes < majorityThreshold && noVotes < majorityThreshold
    }
  });
});

// TEACHER REJECT a siphon request
router.post('/:id/teacher-reject', ensureAuthenticated, async (req, res) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Only teacher or admin can reject' });

  const siphon = await SiphonRequest.findById(req.params.id);
  if (!siphon || siphon.status !== 'group_approved')
    return res.status(400).json({ error: 'Not ready for teacher rejection' });

  // Updates the request status and unfreezes user
  siphon.status = 'rejected';
  await siphon.save();
  await User.findByIdAndUpdate(siphon.targetUser, {
    $pull: { classroomFrozen: { classroom: siphon.classroom } }
  });
  
  // Follow-up notification to the target letting them know account has been unfrozen
  try {
    const groupDoc = await Group.findById(siphon.group).select('name');
    const followup = await Notification.create({
      user: siphon.targetUser,
      type: 'siphon_rejected',
      message: `Good news! Your account has been unfrozen following the teacher's decision in group "${groupDoc?.name || 'the group'}".`,
      group: siphon.group,
      actionBy: req.user._id,
      classroom: siphon.classroom,
      anonymized: true
    });
    const populated = await populateNotification(followup._id);
    req.app.get('io').to(`user-${siphon.targetUser}`).emit('notification', populated);
  } catch (e) {
    console.error('Failed to send teacher-reject followup notification:', e);
  }

  // NEW: Notify group members (except the target) that the teacher rejected the siphon.
  try {
    const group = await Group.findById(siphon.group).populate('members._id', '_id status');
    const classroomId = siphon.classroom;
    const recipients = (group?.members || [])
      .filter(m => m.status === 'approved' && String(m._id._id) !== String(siphon.targetUser))
      .map(m => m._id._id);

    for (const memberId of recipients) {
      const n = await Notification.create({
        user: memberId,
        type: 'siphon_rejected',
        // do NOT include the target's name — preserve privacy
        message: `The siphon request in group "${group?.name || 'the group'}" was rejected by the teacher.`,
        group: siphon.group,
        classroom: classroomId,
        actionBy: req.user._id,
        anonymized: true
      });
      const populated = await populateNotification(n._id);
      req.app.get('io').to(`user-${memberId}`).emit('notification', populated);
    }
  } catch (e) {
    console.error('Failed to notify group on teacher reject:', e);
  }

  req.app.get('io').to(`group-${siphon.group}`).emit('siphon_update', siphon);
  res.json({ message: 'Request rejected', siphon });
});

// Route for teacher/admin to approve and execute siphon transfer
router.post('/:id/teacher-approve', ensureAuthenticated, async (req, res) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Only teacher or admin can approve' });

  const siphon = await SiphonRequest.findById(req.params.id).populate('group').populate('targetUser', 'firstName lastName email');
  if (!siphon || siphon.status !== 'group_approved')
    return res.status(400).json({ error: 'Not ready for teacher approval' });

  try {
    // Get classroom context for balance updates
    const groupSet = await GroupSet.findOne({ groups: siphon.group._id }).populate('classroom');
    const classroomId = groupSet?.classroom?._id;

    // Select recipients (approved group members excluding target)
    const recipients = siphon.group.members
      .filter(m => m.status === 'approved' && String(m._id) !== String(siphon.targetUser._id))
      .map(m => m._id);

    console.log('Siphon target user:', String(siphon.targetUser._id));
    console.log('All group members:', siphon.group.members.map(m => ({ id: String(m._id), status: m.status })));
    console.log('Filtered recipients:', recipients.map(r => String(r)));

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No eligible recipients found' });
    }

    // Transfer bits from target to recipients
    console.log('transferBits starting');
    
    // Get group and groupset info for transaction details
    const groupInfo = await Group.findById(siphon.group._id).populate('name');
    const groupSetInfo = await GroupSet.findOne({ groups: siphon.group._id }).select('name');
    
    await transferBits({
      fromUserId: siphon.targetUser._id, // Change this line - add ._id
      recipients,
      amount: siphon.amount,
      classroomId: classroomId
    });

    // Mark request as fully approved and executed
    siphon.status = 'teacher_approved';
    await siphon.save();
    await User.findByIdAndUpdate(siphon.targetUser, {
      $pull: { classroomFrozen: { classroom: siphon.classroom } }
    });

    // Create enhanced notifications with more details
    const targetName = `${siphon.targetUser.firstName || ''} ${siphon.targetUser.lastName || ''}`.trim() || siphon.targetUser.email;
    const amountPerRecipient = Math.floor(siphon.amount / recipients.length);
    const groupName = siphon.group.name;
    const groupSetName = groupSetInfo?.name || 'Unknown GroupSet';

    // Update the target user's transaction with detailed info
    const targetUser = await User.findById(siphon.targetUser);
    if (targetUser && targetUser.transactions.length > 0) {
      const lastTransaction = targetUser.transactions[targetUser.transactions.length - 1];
      lastTransaction.description = `Siphoned from ${groupSetName} > ${groupName}: ${siphon.amount} bits redistributed to ${recipients.length} members`;
      lastTransaction.metadata = {
        type: 'siphon',
        groupSet: groupSetInfo?._id,
        groupSetName: groupSetName,
        group: siphon.group._id,
        groupName: groupName,
        originalAmount: siphon.amount,
        recipientCount: recipients.length,
        amountPerRecipient: amountPerRecipient
      };
      await targetUser.save();
    }

    // Update recipients' transactions with detailed info
    for (const recipientId of recipients) {
      const recipient = await User.findById(recipientId);
      if (recipient && recipient.transactions.length > 0) {
        const lastTransaction = recipient.transactions[recipient.transactions.length - 1];
        lastTransaction.description = `Siphon from ${groupSetName} > ${groupName}: Received ${amountPerRecipient} bits (from ${targetName})`;
        lastTransaction.metadata = {
          type: 'siphon',
          groupSet: groupSetInfo?._id,
          groupSetName: groupSetName,
          group: siphon.group._id,
          groupName: groupName,
          targetUser: siphon.targetUser,
          targetUserName: targetName,
          originalAmount: siphon.amount,
          recipientCount: recipients.length,
          amountReceived: amountPerRecipient
        };
        await recipient.save();
      }
    }

    // Notify target user (they LOST bits)
    const targetNotification = await Notification.create({
      user: siphon.targetUser._id,
      type: 'siphon_approved',
      message: `${siphon.amount} bits were siphoned from you and redistributed to ${recipients.length} group members in "${groupName}" (${groupSetName}).`,
      classroom: classroomId,
      group: siphon.group._id,
      actionBy: req.user._id,
    });
    const populatedTargetNotification = await populateNotification(targetNotification._id);
    req.app.get('io').to(`user-${siphon.targetUser._id}`).emit('notification', populatedTargetNotification);

    // Notify recipients (they RECEIVED bits)
    for (const recipientId of recipients) {
      const recipientNotification = await Notification.create({
        user: recipientId,
        type: 'siphon_approved',
        message: `You received ${amountPerRecipient} bits from siphon against ${targetName} in "${groupName}" (${groupSetName}).`,
        classroom: classroomId,
        group: siphon.group._id,
        actionBy: req.user._id,
      });
      const populatedRecipientNotification = await populateNotification(recipientNotification._id);
      req.app.get('io').to(`user-${recipientId}`).emit('notification', populatedRecipientNotification);
    }

    req.app.get('io').to(`group-${siphon.group._id}`).emit('siphon_update', siphon);
    res.json({ message: 'Approved and executed', siphon });
  } catch (err) {
    console.error('Siphon approval error:', err);
    res.status(500).json({ error: 'Approval failed: ' + err.message });
  }
});

// Route to download proof file
router.get('/:id/proof', ensureAuthenticated, async (req, res) => {
  try {
    const siphon = await SiphonRequest.findById(req.params.id);
    if (!siphon) {
      return res.status(404).json({ error: 'Siphon request not found' });
    }

    // Check if user has permission to view this proof
    const group = await Group.findById(siphon.group);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Only allow group members and teachers to view proof
    const isMember = group.members.some(m => m._id.equals(req.user._id));
    const isTeacher = req.user.role === 'teacher';
    const isAdmin = req.user.role === 'admin';

    if (!isMember && !isTeacher && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to view this proof' });
    }

    if (!siphon.proof || !siphon.proof.storedName) {
      return res.status(404).json({ error: 'No proof file found' });
    }

    const path = require('path');
    const filePath = path.join(__dirname, '../uploads', siphon.proof.storedName);
    
    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${siphon.proof.originalName}"`);
    res.setHeader('Content-Type', siphon.proof.mimeType || 'application/octet-stream');
    
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error sending proof file:', err);
        res.status(404).json({ error: 'File not found' });
      }
    });
  } catch (err) {
    console.error('Proof download error:', err);
    res.status(500).json({ error: 'Failed to download proof' });
  }
});

module.exports = router;