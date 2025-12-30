const express = require('express');
const router = express.Router();
const CustomChallengeTemplate = require('../models/CustomChallengeTemplate');
const Classroom = require('../models/Classroom');
const { ensureAuthenticated, ensureTeacher } = require('../middleware/auth');

router.get('/', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const teacherId = req.user._id;
    const templates = await CustomChallengeTemplate.find({ teacherId })
      .sort({ createdAt: -1 })
      .select('name challenges isSingleChallenge sourceClassroom createdAt updatedAt');

    res.json({ templates });
  } catch (error) {
    console.error('Error fetching custom challenge templates:', error);
    res.status(500).json({ message: 'Failed to fetch templates' });
  }
});

router.post('/', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { name, challenges, isSingleChallenge, classroomId } = req.body;
    const teacherId = req.user._id;

    if (!name || !challenges || !Array.isArray(challenges) || challenges.length === 0) {
      return res.status(400).json({ message: 'Template name and at least one challenge are required' });
    }

    if (!classroomId) {
      return res.status(400).json({ message: 'Classroom ID is required' });
    }

    const classroom = await Classroom.findOne({ _id: classroomId, teacher: teacherId }).select('name code');
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found or unauthorized' });
    }

    const existingTemplate = await CustomChallengeTemplate.findOne({ 
      teacherId, 
      name: name.trim() 
    });

    if (existingTemplate) {
      return res.status(400).json({ message: 'A template with this name already exists' });
    }

    const sanitizedChallenges = challenges.map(c => ({
      title: (c.title || '').trim().slice(0, 200),
      description: (c.description || '').trim().slice(0, 2000),
      externalUrl: (c.externalUrl || '').trim(),
      solution: (c.solution || '').trim().slice(0, 500),
      templateType: c.templateType || 'passcode',
      templateConfig: c.templateConfig || {},
      maxAttempts: c.maxAttempts || null,
      hintsEnabled: Boolean(c.hintsEnabled),
      hints: Array.isArray(c.hints) ? c.hints.filter(h => h && h.trim()).map(h => h.trim().slice(0, 500)) : [],
      hintPenaltyPercent: c.hintPenaltyPercent != null ? Number(c.hintPenaltyPercent) : null,
      bits: Number(c.bits) || 50,
      multiplier: Number(c.multiplier) || 1.0,
      luck: Number(c.luck) || 1.0,
      discount: Number(c.discount) || 0,
      shield: Boolean(c.shield),
      visible: c.visible !== false,
      dueDateEnabled: Boolean(c.dueDateEnabled)
    }));

    const template = new CustomChallengeTemplate({
      name: name.trim(),
      teacherId,
      challenges: sanitizedChallenges,
      isSingleChallenge: Boolean(isSingleChallenge),
      sourceClassroom: { classroomId, name: classroom.name, code: classroom.code }
    });

    await template.save();

    res.status(201).json({ 
      message: 'Template saved successfully',
      template: {
        _id: template._id,
        name: template.name,
        challenges: template.challenges,
        isSingleChallenge: template.isSingleChallenge,
        sourceClassroom: template.sourceClassroom,
        createdAt: template.createdAt
      }
    });
  } catch (error) {
    console.error('Error saving custom challenge template:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A template with this name already exists' });
    }
    res.status(500).json({ message: 'Failed to save template' });
  }
});

router.delete('/:templateId', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { templateId } = req.params;
    const teacherId = req.user._id;

    const template = await CustomChallengeTemplate.findOneAndDelete({ 
      _id: templateId, 
      teacherId 
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting custom challenge template:', error);
    res.status(500).json({ message: 'Failed to delete template' });
  }
});

module.exports = router;

