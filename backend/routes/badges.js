const express = require('express');
const Badge = require('../models/Badge');
const User = require('../models/User');
const upload = require('../middleware/upload');

const router = express.Router();

// Teacher creates a badge for a classroom
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, description, levelRequired, icon, classroomId, teacherId } = req.body;
    const imageUrl = req.file
      ? `/uploads/${req.file.filename}`
      : req.body.imageUrl || undefined;

    // Quick validation
    if (!name || !levelRequired || !classroomId || !teacherId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const badge = new Badge({
      name,
      description,
      levelRequired,
      icon,
      imageUrl,
      classroom: classroomId,
      createdBy: teacherId
    });

    await badge.save();
    res.json(badge);
  } catch (err) {
    console.error('Error creating badge:', err);
    res.status(500).json({ error: 'Failed to create badge' });
  }
});

// Get all badges for a classroom
router.get('/:classroomId', async (req, res) => {
  try {
    const { classroomId } = req.params;
    const badges = await Badge.find({ classroom: classroomId }).sort({ levelRequired: 1 });
    res.json(badges);
  } catch (err) {
    console.error('Error fetching badges:', err);
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

// Delete a badge
router.delete('/:badgeId', async (req, res) => {
  try {
    const { badgeId } = req.params;
    await Badge.findByIdAndDelete(badgeId);
    res.json({ message: 'Badge deleted' });
  } catch (err) {
    console.error('Error deleting badge:', err);
    res.status(500).json({ error: 'Failed to delete badge' });
  }
});

// Update (edit) a badge
router.put('/:badgeId', upload.single('image'), async (req, res) => {
  try {
    const { badgeId } = req.params;
    const { name, description, levelRequired, icon } = req.body;
    const imageUrl = req.file
      ? `/uploads/${req.file.filename}`
      : req.body.imageUrl || undefined;

    const updateData = { name, description, levelRequired, icon };
    if (imageUrl) updateData.imageUrl = imageUrl;
    const updatedBadge = await Badge.findByIdAndUpdate(badgeId, updateData, { new: true });


    if (!updatedBadge) {
      return res.status(404).json({ error: 'Badge not found' });
    }

    res.json(updatedBadge);
  } catch (err) {
    console.error('Error updating badge:', err);
    res.status(500).json({ error: 'Failed to update badge' });
  }
});

module.exports = router;
