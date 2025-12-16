const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureTeacher } = require('../middleware/auth');
const BadgeTemplate = require('../models/BadgeTemplate');
const Classroom = require('../models/Classroom');
const Badge = require('../models/Badge');

// GET templates for teacher
router.get('/', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const templates = await BadgeTemplate.find({ teacherId: req.user._id })
      .sort({ createdAt: -1 })
      .select('name badges sourceClassroom createdAt updatedAt');
    res.json({ templates });
  } catch (e) {
    console.error('Fetch badge templates failed:', e);
    res.status(500).json({ message: 'Failed to fetch templates' });
  }
});

// POST save template from existing classroom’s badges
router.post('/', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { name, classroomId } = req.body;
    if (!name || !classroomId) return res.status(400).json({ message: 'Template name and classroomId are required' });

    // Do not populate; compare ObjectId directly OR compare teacher._id if populated
    const classroom = await Classroom.findById(classroomId).select('teacher name code');
    if (
      !classroom ||
      String(classroom.teacher) !== String(req.user._id)
    ) {
      return res.status(403).json({ message: 'Not authorized to save this classroom’s badges' });
    }

    const existing = await BadgeTemplate.findOne({ teacherId: req.user._id, name: name.trim() });
    if (existing) return res.status(400).json({ message: 'A template with this name already exists' });

    const badges = await Badge.find({ classroom: classroomId }).populate('unlockedBazaarItems', '_id');

    const tpl = new BadgeTemplate({
      name: name.trim(),
      teacherId: req.user._id,
      sourceClassroom: { classroomId: classroom._id, name: classroom.name, code: classroom.code },
      badges: badges.map(b => ({
        name: b.name,
        description: b.description,

        // FIX: normalize legacy badges (some old docs may have levelRequired=1)
        levelRequired: Math.max(2, Number(b.levelRequired) || 2),

        icon: b.icon,
        image: b.image,
        unlockedBazaarItems: (b.unlockedBazaarItems || []).map(i => i._id)
      }))
    });

    await tpl.save();
    res.status(201).json({ message: 'Template saved', template: tpl });
  } catch (e) {
    console.error('Save badge template failed:', e);
    if (e.code === 11000) return res.status(400).json({ message: 'A template with this name already exists' });
    res.status(500).json({ message: 'Failed to save template' });
  }
});

// DELETE template
router.delete('/:templateId', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const deleted = await BadgeTemplate.findOneAndDelete({ _id: req.params.templateId, teacherId: req.user._id });
    if (!deleted) return res.status(404).json({ message: 'Template not found' });
    res.json({ message: 'Template deleted' });
  } catch (e) {
    console.error('Delete badge template failed:', e);
    res.status(500).json({ message: 'Failed to delete template' });
  }
});

// APPLY template to classroom (creates badges)
router.post('/:templateId/apply', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId } = req.body;
    const tpl = await BadgeTemplate.findOne({ _id: req.params.templateId, teacherId: req.user._id });
    if (!tpl) return res.status(404).json({ message: 'Template not found' });

    const classroom = await Classroom.findOne({ _id: classroomId, teacher: req.user._id });
    if (!classroom) return res.status(404).json({ message: 'Classroom not found or unauthorized' });

    // Fetch existing names to prevent dup-key
    const existing = await Badge.find({ classroom: classroomId }).select('name levelRequired');
    const existingNames = new Set(existing.map(b => b.name.trim().toLowerCase()));

    const created = [];
    const skipped = [];

    for (const b of tpl.badges || []) {
      const nameKey = (b.name || '').trim().toLowerCase();
      if (!nameKey || existingNames.has(nameKey)) {
        skipped.push({ name: b.name, reason: 'name-conflict' });
        continue;
      }

      // NEW: normalize legacy/invalid levelRequired at apply-time too
      const safeLevelRequired = Math.max(2, Number(b.levelRequired) || 2);

      try {
        const doc = new Badge({
          name: b.name,
          description: b.description,
          classroom: classroomId,
          levelRequired: safeLevelRequired, // <-- changed
          icon: b.icon,
          image: b.image,
          unlockedBazaarItems: b.unlockedBazaarItems || [],
          createdBy: req.user._id
        });

        await doc.save();
        existingNames.add(nameKey);
        created.push(doc);
      } catch (e) {
        if (e.code === 11000) {
          skipped.push({ name: b.name, reason: 'duplicate-key' });
          continue;
        }
        throw e;
      }
    }

    // NEW: summary + richer message (like bazaar template apply)
    const skippedByReason = skipped.reduce((acc, s) => {
      const r = s?.reason || 'unknown';
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {});

    const topSkippedNames = skipped
      .map(s => s?.name)
      .filter(Boolean)
      .slice(0, 5);

    const summary = {
      createdTotal: created.length,
      skippedTotal: skipped.length,
      skippedByReason,
      topSkippedNames
    };

    const reasonText = Object.entries(skippedByReason)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    const examplesText =
      topSkippedNames.length
        ? ` Examples: ${topSkippedNames.join(', ')}${skipped.length > topSkippedNames.length ? ', …' : ''}`
        : '';

    return res.json({
      message:
        `Applied template. Created ${summary.createdTotal} badge(s), skipped ${summary.skippedTotal}.` +
        (summary.skippedTotal ? ` (${reasonText}).` : '') +
        (summary.skippedTotal ? examplesText : ''),
      badges: created,
      skipped,
      summary
    });
  } catch (e) {
    console.error('Apply badge template failed:', e);
    res.status(500).json({ message: 'Failed to apply template' });
  }
});

module.exports = router;