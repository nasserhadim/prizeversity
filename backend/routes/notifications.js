const express = require('express');
const Notification = require('../models/Notification');
const { ensureAuthenticated } = require('../config/auth');
const { populateNotification } = require('../utils/notifications');
const router = express.Router();

// Fetch notifications with populated references
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .populate('user', 'email')
      .populate('actionBy', 'email firstName lastName')
      .populate('classroom', 'name code') // include code so frontend can show "Name (CODE)"
      .populate('groupSet', 'name')
      .populate('group', 'name')
      .sort('-createdAt');
      
    res.status(200).json(notifications);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.post('/read/:id', ensureAuthenticated, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.status(200).json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

router.post('/read-all', ensureAuthenticated, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id }, 
      { read: true }
    );
    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

router.post('/create', ensureAuthenticated, async (req, res) => {
  try {
    const created = await Notification.create({
      user: req.user._id,
      actionBy: req.body.actionBy,
      classroom: req.body.classroom,
      type: req.body.type,       // e.g., "join request", "update", etc.
      title: req.body.title,     // Short title for the notification
      message: req.body.message, // Detailed message content
      read: false,               // Mark as unread by default
      createdAt: new Date()      // Timestamp for notification creation
    });
    
    // Fetch the notification with populated fields
    const newNotification = await populateNotification(created._id);
    
    // Emit the populated notification to the user
    const io = req.app.get('io');
    io.to(`user-${req.user._id}`).emit('notification', newNotification);
    res.status(201).json(newNotification);
  } catch (err) {
    console.error('Error creating notification:', err);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

module.exports = router;