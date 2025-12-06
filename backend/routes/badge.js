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

    const badge = new Badge({
      name,
      description,
      classroom: classroomId,
      levelRequired: parseInt(levelRequired),
      icon: icon || '🏅',
      // allow either uploaded file or a direct URL from body
      image: req.file ? `/uploads/badges/${req.file.filename}` : (req.body.image || ''),
      unlockedBazaarItems: unlockedBazaarItems ? JSON.parse(unlockedBazaarItems) : [],
      createdBy: req.user._id
    });

    await badge.save();

    res.json({ message: 'Badge created successfully', badge });
  } catch (err) {
    console.error('Error creating badge:', err);
    res.status(500).json({ error: err.message || 'Server error' });
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

    if (name) badge.name = name;
    if (description) badge.description = description;
    if (levelRequired) badge.levelRequired = parseInt(levelRequired);
    if (icon) badge.icon = icon;
    if (req.file) {
      badge.image = `/uploads/badges/${req.file.filename}`;
    } else if (Object.prototype.hasOwnProperty.call(req.body, 'image')) {
      // allow replacing or clearing image via URL (empty string clears)
      badge.image = req.body.image || '';
    }
    if (unlockedBazaarItems) badge.unlockedBazaarItems = JSON.parse(unlockedBazaarItems);

    await badge.save();

    res.json({ message: 'Badge updated successfully', badge });
  } catch (err) {
    console.error('Error updating badge:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE badge (teacher only)
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

    await Badge.findByIdAndDelete(badgeId);

    res.json({ message: 'Badge deleted successfully' });
  } catch (err) {
    console.error('Error deleting badge:', err);
    res.status(500).json({ error: 'Server error' });
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

      return {
        _id: student._id,
        email: student.email,
        firstName: student.firstName,
        lastName: student.lastName,
        level,
        xp,
        earnedBadges,
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

module.exports = router;