import express from 'express';
import Badge from '../models/Badge.js';
import User from '../models/User.js';

const router = express.Router();

// teacher creates a badge for a classroom
router.post('/', async (req, res) => {
  try {
    const { name, description, levelRequired, icon, classroomId, teacherId } = req.body;

    // quick check for required fields
    if (!name || !levelRequired || !classroomId || !teacherId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const badge = new Badge({
      name,
      description,
      levelRequired,
      icon,
      classroom: classroomId,
      createdBy: teacherId
    });

    await badge.save();
    res.json(badge);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create badge' });
  }
});

// get all badges for a classroom
router.get('/:classroomId', async (req, res) => {
  try {
    const { classroomId } = req.params;
    const badges = await Badge.find({ classroom: classroomId }).sort({ levelRequired: 1 });
    res.json(badges);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

// delete badge
router.delete('/:badgeId', async (req, res) => {
  try {
    const { badgeId } = req.params;
    await Badge.findByIdAndDelete(badgeId);
    res.json({ message: 'Badge deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete badge' });
  }
});

export default router;