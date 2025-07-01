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


router.post(
  '/group/:groupId/create',
  ensureAuthenticated,
  upload.single('proof'),
  async (req, res) => {
    try {
      const { targetUserId, reason, amount } = req.body;
      const User = require('../models/User');                   
    const target = await User.findById(targetUserId).select('balance');
    if (!target || target.balance < Number(amount)) {
    return res.status(400).json({ error: 'Amount exceeds target user balance' });
  }
      
      const cleanReason = DOMPurify.sanitize(reason, {
        ALLOWED_TAGS: ['b','i','u','span','font','p','br','ul','ol','li']
      });

      
      const proof = req.file
        ? {
            originalName: req.file.originalname,
            storedName:   req.file.filename,
            mimeType:     req.file.mimetype,
            size:         req.file.size,
          }
        : null;

      const reqDoc = await SiphonRequest.create({
        group:      req.params.groupId,
        requestedBy:req.user._id,
        targetUser: targetUserId,
        reasonHtml: cleanReason,
        amount:     Number(amount),
        proof,
      });

      await User.findByIdAndUpdate(targetUserId, { isFrozen: true });
      req.app.get('io').to(`group-${reqDoc.group}`).emit('siphon_create', reqDoc);
      res.status(201).json(reqDoc);
    } catch (err) {
      console.error(err);
      res.status(400).json({ error:'Failed to submit siphon request' });
    }
  }
);


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
   await User.findByIdAndUpdate(siphon.targetUser, { isFrozen: false });
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
  await User.findByIdAndUpdate(siphon.targetUser, { isFrozen: false });
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
    await User.findByIdAndUpdate(siphon.targetUser, { isFrozen: false });
    req.app.get('io').to(`group-${siphon.group._id}`).emit('siphon_update', siphon);
    res.json({ message: 'Approved and executed', siphon });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Approval failed' });
  }
});

module.exports = router;