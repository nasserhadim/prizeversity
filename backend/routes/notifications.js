const express = require('express');
const Notification = require('../models/Notification');
const User = require('../models/User'); // added
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

    // Sanitize anonymized notifications: replace actor with System while keeping other populated fields.
    // If a non-anonymized notification arrives without actor name fields, fetch the actor as a fallback.
    const sanitized = await Promise.all(notifications.map(async n => {
      const obj = n && typeof n.toObject === 'function' ? n.toObject() : n;

      // Keep anonymized notifications clearly labeled "System"
      if (obj && obj.anonymized) {
        obj.actionBy = { _id: null, firstName: 'System', lastName: '', email: null };
        return obj;
      }

      // If actionBy is populated but missing name/email -> we should fetch the user record.
      let needActorFetch = false;
      if (!obj || !obj.actionBy) {
        needActorFetch = true;
      } else {
        // actionBy might be an object (possibly populated) or an id string/ObjectId
        if (typeof obj.actionBy === 'object') {
          const hasName = !!(obj.actionBy.firstName || obj.actionBy.lastName || obj.actionBy.email);
          if (!hasName) needActorFetch = true;
        } else {
          needActorFetch = true;
        }
      }

      // Resolve the actor id robustly from the original mongoose document `n`
      let actorId = null;
      if (n && n.actionBy) {
        if (typeof n.actionBy === 'object') {
          // could be populated doc or just { _id: ObjectId }
          actorId = n.actionBy._id ? n.actionBy._id : null;
        } else {
          actorId = n.actionBy; // likely an ObjectId or string id
        }
      }

      if (needActorFetch && actorId) {
        try {
          const actor = await User.findById(actorId).select('firstName lastName email');
          if (actor) obj.actionBy = actor.toObject();
        } catch (e) {
          console.error('Failed to fetch notification actor fallback:', e);
          // leave obj.actionBy as-is (frontend will handle missing actor)
        }
      }

      return obj;
    }));
      
    res.status(200).json(sanitized);
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