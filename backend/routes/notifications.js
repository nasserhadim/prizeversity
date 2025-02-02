const express = require('express');
const Notification = require('../models/Notification');
const { ensureAuthenticated } = require('../config/auth');
const router = express.Router();

router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .populate('actionBy', 'email')
      .populate('classroom', 'name')
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

module.exports = router;