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



router.post('/group/:groupId/create', ensureAuthenticated, async (req,res)=>{
  const { targetUserId, reason, amount } = req.body;
  const group = await Group.findById(req.params.groupId);
  if (!group) return res.status(404).json({error:'Group not found'});

  const isMember = group.members.some(m=>m._id.equals(req.user._id) && m.status==='approved');
  const isTarget = group.members.some(m=>m._id.equals(targetUserId) && m.status==='approved');
  if (!isMember || !isTarget) return res.status(400).json({error:'Invalid membership'});


  const duplicate = await SiphonRequest.findOne({
    group: group._id, status: { $in:['pending','group_approved'] },
    targetUser: targetUserId
  });
  if (duplicate) return res.status(400).json({error:'A request is already open for this user.'});

  const reqDoc = await SiphonRequest.create({
    group: group._id,
    requestedBy: req.user._id,
    targetUser: targetUserId,
    reason, amount
  });

  
  req.app.get('io').to(`group-${group._id}`).emit('siphon_create', reqDoc);
  res.status(201).json(reqDoc);
});

router.post('/:id/vote', ensureAuthenticated, async (req,res)=>{
  const { vote } = req.body;     
  const siphon = await SiphonRequest.findById(req.params.id);
  if (!siphon || siphon.status!=='pending')
    return res.status(404).json({error:'Request not open for voting'});


  const group = await Group.findById(siphon.group);
  const isMember = group.members.some(m=>m._id.equals(req.user._id) && m.status==='approved');
  if (!isMember) return res.status(403).json({error:'Not a group member'});


  const idx = siphon.votes.findIndex(v=>v.user.equals(req.user._id));
  idx>=0 ? siphon.votes[idx].vote = vote : siphon.votes.push({user:req.user._id,vote});
  await siphon.save();


  const approvedMembers = group.members.filter(m=>m.status==='approved').length;
  const yesVotes = siphon.votes.filter(v=>v.vote==='yes').length;
  const noVotes  = siphon.votes.filter(v=>v.vote==='no').length;

if (noVotes > approvedMembers/2) {
  siphon.status = 'rejected';
   await siphon.save();
   req.app.get('io').to(`group-${group._id}`).emit('siphon_update', siphon);
   return res.json({ status: siphon.status });
 }

  if (yesVotes > approvedMembers/2) {
    siphon.status = 'group_approved';
    await siphon.save();

    
    const classroomId = await GroupSet.findOne({groups: group._id}).then(gs=>gs?.classroom);
    const teachers = await Classroom.findById(classroomId).select('teacher').then(c=>[c.teacher]);
    for (const t of teachers){
      const n = await Notification.create({
        user: t, type:'siphon_review',
        message:`Group "${group.name}" approved a siphon request`,
        group: group._id, siphon: siphon._id, actionBy: req.user._id
      });
      req.app.get('io').to(`user-${t}`).emit('notification', await populateNotification(n._id));
    }
  }

  req.app.get('io').to(`group-${group._id}`).emit('siphon_vote', siphon);
  res.json({status:siphon.status});
});

// TEACHER REJECT
router.post('/:id/teacher-reject', ensureAuthenticated, async (req, res) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Only teacher or admin can reject' });

  const siphon = await SiphonRequest.findById(req.params.id);
  if (!siphon || siphon.status !== 'group_approved')
    return res.status(400).json({ error: 'Not ready for teacher rejection' });

  siphon.status = 'rejected';
  await siphon.save();

  req.app.get('io').to(`group-${siphon.group}`).emit('siphon_update', siphon);
  res.json({ message: 'Request rejected', siphon });
});


router.post('/:id/teacher-approve', ensureAuthenticated, async (req, res) => {
  if (req.user.role !== 'teacher' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Only teacher or admin can approve' });

  const siphon = await SiphonRequest.findById(req.params.id).populate('group');
  if (!siphon || siphon.status !== 'group_approved')
    return res.status(400).json({ error: 'Not ready for teacher approval' });

  try {
  
    const recipients = siphon.group.members
      .filter(m => m.status === 'approved' && !m._id.equals(siphon.targetUser))
      .map(m => m._id);

  
   console.log('transferBits finished');
    await transferBits({
      fromUserId: siphon.targetUser,
      recipients,
      amount: siphon.amount
    });

    siphon.status = 'teacher_approved';
    await siphon.save();

    req.app.get('io').to(`group-${siphon.group._id}`).emit('siphon_update', siphon);
    res.json({ message: 'Approved and executed', siphon });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Approval failed' });
  }
});

module.exports = router;