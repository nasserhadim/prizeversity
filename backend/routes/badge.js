const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureTeacher } = require('../middleware/auth'); // Changed from '../config/auth'
const Badge = require('../models/Badge');
const Classroom = require('../models/Classroom');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads/badges directory exists
const badgesDir = path.join(__dirname, '../uploads/badges');
if (!fs.existsSync(badgesDir)) {
  fs.mkdirSync(badgesDir, { recursive: true });
}

// Configure multer for badge image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, badgesDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'badge-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// GET all badges for a classroom
router.get('/classroom/:classroomId', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId } = req.params;
    
    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    const badges = await Badge.find({ classroom: classroomId })
      .populate('unlockedBazaarItems', 'name')
      .sort({ levelRequired: 1 });

    res.json(badges);
  } catch (err) {
    console.error('Error fetching badges:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST create new badge (teacher only)
router.post('/classroom/:classroomId', ensureAuthenticated, ensureTeacher, upload.single('image'), async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { name, description, levelRequired, icon, unlockedBazaarItems } = req.body;

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    if (classroom.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the teacher can create badges' });
    }

    // Check for duplicate badge name in this classroom
    const existingBadge = await Badge.findOne({ 
      classroom: classroomId, 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });
    if (existingBadge) {
      return res.status(400).json({ error: `A badge named "${name}" already exists in this classroom` });
    }

    // Parse rewards from request body (handle both FormData strings and JSON booleans)
    const parseBoolean = (val) => val === true || val === 'true';
    
    const rewards = {
      bits: parseInt(req.body['rewards.bits']) || 0,
      multiplier: parseFloat(req.body['rewards.multiplier']) || 0,
      luck: parseFloat(req.body['rewards.luck']) || 0,
      discount: parseInt(req.body['rewards.discount']) || 0,
      shield: parseInt(req.body['rewards.shield']) || 0,
      applyPersonalMultiplier: parseBoolean(req.body['rewards.applyPersonalMultiplier']),
      applyGroupMultiplier: parseBoolean(req.body['rewards.applyGroupMultiplier'])
    };

    let imagePath = '';
    if (req.file) {
      imagePath = `/uploads/badges/${req.file.filename}`;
    } else if (req.body.imageUrl) {
      imagePath = req.body.imageUrl;
    }

    const badge = new Badge({
      name: name.trim(),
      description,
      classroom: classroomId,
      levelRequired: parseInt(levelRequired),
      icon: icon || '🏅',
      image: imagePath,
      rewards,
      createdBy: req.user._id
    });

    await badge.save();

    res.json({ message: 'Badge created successfully', badge });
  } catch (err) {
    console.error('Error creating badge:', err);
    // Handle duplicate key error with friendly message
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A badge with this name already exists in this classroom' });
    }
    res.status(500).json({ error: 'Failed to create badge. Please try again.' });
  }
});

// PATCH update badge (teacher only)
router.patch('/:badgeId', ensureAuthenticated, ensureTeacher, upload.single('image'), async (req, res) => {
  try {
    const { badgeId } = req.params;
    const { name, description, levelRequired, icon, unlockedBazaarItems } = req.body;

    const badge = await Badge.findById(badgeId).populate('classroom');
    if (!badge) {
      return res.status(404).json({ error: 'Badge not found' });
    }

    if (badge.classroom.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the teacher can update badges' });
    }

    // Check for duplicate name (excluding current badge)
    if (name && name.trim().toLowerCase() !== badge.name.toLowerCase()) {
      const existingBadge = await Badge.findOne({ 
        classroom: badge.classroom._id, 
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: badgeId }
      });
      if (existingBadge) {
        return res.status(400).json({ error: `A badge named "${name}" already exists in this classroom` });
      }
    }

    // Parse rewards from request body (handle both FormData strings and JSON booleans)
    const parseBoolean = (val) => val === true || val === 'true';
    
    const rewards = {
      bits: parseInt(req.body['rewards.bits']) || 0,
      multiplier: parseFloat(req.body['rewards.multiplier']) || 0,
      luck: parseFloat(req.body['rewards.luck']) || 0,
      discount: parseInt(req.body['rewards.discount']) || 0,
      shield: parseInt(req.body['rewards.shield']) || 0,
      applyPersonalMultiplier: parseBoolean(req.body['rewards.applyPersonalMultiplier']),
      applyGroupMultiplier: parseBoolean(req.body['rewards.applyGroupMultiplier'])
    };

    badge.name = name ? name.trim() : badge.name;
    badge.description = description || badge.description;
    badge.levelRequired = levelRequired ? parseInt(levelRequired) : badge.levelRequired;
    badge.icon = icon || badge.icon;
    badge.rewards = rewards;
    
    if (req.file) {
      badge.image = `/uploads/badges/${req.file.filename}`;
    } else if (req.body.imageUrl !== undefined) {
      badge.image = req.body.imageUrl;
    }

    await badge.save();

    res.json({ message: 'Badge updated successfully', badge });
  } catch (err) {
    console.error('Error updating badge:', err);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A badge with this name already exists in this classroom' });
    }
    res.status(500).json({ error: 'Failed to update badge. Please try again.' });
  }
});

// DELETE badge (teacher only) - Add notification for affected users
router.delete('/:badgeId', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { badgeId } = req.params;

    const badge = await Badge.findById(badgeId).populate('classroom');
    if (!badge) {
      return res.status(404).json({ error: 'Badge not found' });
    }

    if (badge.classroom.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the teacher can delete badges' });
    }

    const classroomId = badge.classroom._id;
    const badgeName = badge.name;
    const badgeIcon = badge.icon;

    // Find all users who earned this badge before deleting
    const User = require('../models/User');
    const Notification = require('../models/Notification');
    const { populateNotification } = require('../utils/notifications');
    
    const usersWithBadge = await User.find({
      'classroomXP.classroom': classroomId,
      'classroomXP.earnedBadges.badge': badgeId
    }).select('_id');

    const affectedUserIds = usersWithBadge.map(u => u._id);

    // Remove this badge from all users' earnedBadges and equippedBadge
    await User.updateMany(
      { 'classroomXP.classroom': classroomId },
      {
        $pull: { 'classroomXP.$[elem].earnedBadges': { badge: badgeId } }
      },
      {
        arrayFilters: [{ 'elem.classroom': classroomId }]
      }
    );

    // Clear equippedBadge if it matches the deleted badge
    await User.updateMany(
      { 
        'classroomXP.classroom': classroomId,
        'classroomXP.equippedBadge': badgeId 
      },
      {
        $set: { 'classroomXP.$[elem].equippedBadge': null }
      },
      {
        arrayFilters: [{ 'elem.classroom': classroomId, 'elem.equippedBadge': badgeId }]
      }
    );

    await Badge.findByIdAndDelete(badgeId);

    // Send notifications to affected users
    const io = req.app.get('io');
    for (const userId of affectedUserIds) {
      try {
        const notification = await Notification.create({
          user: userId,
          type: 'badge_earned', // reuse type, message makes it clear
          message: `${badgeIcon} The badge "${badgeName}" has been removed from the classroom. It has been removed from your collection.`,
          classroom: classroomId,
          actionBy: req.user._id,
          read: false
        });

        const populated = await populateNotification(notification._id);
        if (populated && io) {
          io.to(`user-${userId}`).emit('notification', populated);
        }
      } catch (notifErr) {
        console.warn('[badge delete] failed to notify user:', userId, notifErr);
      }
    }

    res.json({ message: 'Badge deleted successfully', affectedUsers: affectedUserIds.length });
  } catch (err) {
    console.error('Error deleting badge:', err);
    res.status(500).json({ error: 'Failed to delete badge. Please try again.' });
  }
});

// GET student badge progress for teacher dashboard
router.get('/classroom/:classroomId/student-progress', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId } = req.params;
    
    const classroom = await Classroom.findById(classroomId)
      .populate('students', 'email firstName lastName classroomXP');
    
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    if (classroom.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Fetch all badges for this classroom
    const badges = await Badge.find({ classroom: classroomId }).sort({ levelRequired: 1 });

    // Build student progress data
    const { calculateXPForLevel } = require('../utils/xp');
    const studentProgress = classroom.students.map(student => {
      const classroomXP = student.classroomXP?.find(
        cx => cx.classroom.toString() === classroomId.toString()
      );

      const level = classroomXP?.level || 1;
      const xp = classroomXP?.xp || 0;
      const earnedBadges = classroomXP?.earnedBadges || [];
      const equippedBadgeId = classroomXP?.equippedBadge?.toString() || null;

      // Find next badge to unlock
      const earnedBadgeIds = earnedBadges.map(eb => eb.badge.toString());
      const nextBadge = badges.find(b => !earnedBadgeIds.includes(b._id.toString()));

      let xpUntilNextBadge = 0;
      let levelsUntilNextBadge = 0;

      if (nextBadge) {
        levelsUntilNextBadge = Math.max(0, nextBadge.levelRequired - level);
        const xpForNextBadgeLevel = calculateXPForLevel(
          nextBadge.levelRequired,
          classroom.xpSettings?.levelingFormula || 'exponential',
          classroom.xpSettings?.baseXPForLevel2 || 100
        );
        xpUntilNextBadge = Math.max(0, xpForNextBadgeLevel - xp);
      }

      // Find equipped badge details
      const equippedBadge = equippedBadgeId 
        ? badges.find(b => b._id.toString() === equippedBadgeId)
        : null;

      return {
        _id: student._id,
        email: student.email,
        firstName: student.firstName,
        lastName: student.lastName,
        level,
        xp,
        earnedBadges,
        equippedBadge: equippedBadge ? {
          _id: equippedBadge._id,
          name: equippedBadge.name,
          icon: equippedBadge.icon,
          image: equippedBadge.image
        } : null,
        nextBadge: nextBadge ? {
          _id: nextBadge._id,
          name: nextBadge.name,
          icon: nextBadge.icon,
          levelRequired: nextBadge.levelRequired
        } : null,
        xpUntilNextBadge,
        levelsUntilNextBadge
      };
    });

    res.json(studentProgress);
  } catch (err) {
    console.error('Error fetching student badge progress:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST equip a badge (student equips their own badge)
router.post('/equip', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId, badgeId } = req.body;
    
    if (!classroomId) {
      return res.status(400).json({ error: 'classroomId is required' });
    }

    const user = await require('../models/User').findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find or create classroomXP entry
    let classroomXPEntry = user.classroomXP?.find(
      cx => cx.classroom.toString() === classroomId.toString()
    );

    if (!classroomXPEntry) {
      return res.status(404).json({ error: 'Not enrolled in this classroom' });
    }

    // If badgeId is null/undefined, unequip
    if (!badgeId) {
      classroomXPEntry.equippedBadge = null;
      await user.save();
      return res.json({ message: 'Badge unequipped', equippedBadge: null });
    }

    // Verify the badge exists and belongs to this classroom
    const badge = await require('../models/Badge').findById(badgeId);
    if (!badge || badge.classroom.toString() !== classroomId.toString()) {
      return res.status(404).json({ error: 'Badge not found in this classroom' });
    }

    // Verify user has earned this badge
    const hasEarned = classroomXPEntry.earnedBadges?.some(
      eb => eb.badge.toString() === badgeId.toString()
    );

    if (!hasEarned) {
      return res.status(403).json({ error: 'You have not earned this badge' });
    }

    // Equip the badge
    classroomXPEntry.equippedBadge = badgeId;
    await user.save();

    res.json({ 
      message: 'Badge equipped successfully', 
      equippedBadge: {
        _id: badge._id,
        name: badge.name,
        icon: badge.icon,
        image: badge.image
      }
    });
  } catch (err) {
    console.error('Error equipping badge:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET equipped badge for a user in a classroom
router.get('/equipped/:classroomId/:userId?', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId, userId } = req.params;
    const targetUserId = userId || req.user._id;

    const User = require('../models/User');
    const user = await User.findById(targetUserId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const classroomXPEntry = user.classroomXP?.find(
      cx => cx.classroom.toString() === classroomId.toString()
    );

    if (!classroomXPEntry || !classroomXPEntry.equippedBadge) {
      return res.json({ equippedBadge: null });
    }

    const badge = await require('../models/Badge').findById(classroomXPEntry.equippedBadge);
    
    res.json({
      equippedBadge: badge ? {
        _id: badge._id,
        name: badge.name,
        icon: badge.icon,
        image: badge.image
      } : null
    });
  } catch (err) {
    console.error('Error fetching equipped badge:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;