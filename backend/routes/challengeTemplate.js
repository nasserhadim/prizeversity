const express = require('express');
const router = express.Router();
const ChallengeTemplate = require('../models/ChallengeTemplate');
const Classroom = require('../models/Classroom'); // NEW
const { ensureAuthenticated, ensureTeacher } = require('../middleware/auth');

// GET /api/challenge-templates - Get all templates for the authenticated teacher
router.get('/', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const teacherId = req.user._id;
    const templates = await ChallengeTemplate.find({ teacherId })
      .sort({ createdAt: -1 })
      .select('name title settings sourceClassroom createdAt updatedAt'); // NEW: sourceClassroom

    res.json({ templates });
  } catch (error) {
    console.error('Error fetching challenge templates:', error);
    res.status(500).json({ message: 'Failed to fetch templates' });
  }
});

// POST /api/challenge-templates - Create a new template
router.post('/', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { name, title, settings, classroomId } = req.body; // NEW: classroomId
    const teacherId = req.user._id;

    if (!name || !settings || !classroomId) {
      return res.status(400).json({ message: 'Template name, settings, and classroomId are required' });
    }

    // Verify teacher owns the classroom (consistent with other templates)
    const classroom = await Classroom.findOne({ _id: classroomId, teacher: teacherId }).select('name code');
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found or unauthorized' });
    }

    const existingTemplate = await ChallengeTemplate.findOne({ 
      teacherId, 
      name: name.trim() 
    });

    if (existingTemplate) {
      return res.status(400).json({ message: 'A template with this name already exists' });
    }

    const template = new ChallengeTemplate({
      name: name.trim(),
      title: title || 'Cyber Challenge Series',
      teacherId,
      settings,
      sourceClassroom: { classroomId, name: classroom.name, code: classroom.code } // NEW
    });

    await template.save();

    res.status(201).json({ 
      message: 'Template saved successfully',
      template: {
        _id: template._id,
        name: template.name,
        title: template.title,
        settings: template.settings,
        sourceClassroom: template.sourceClassroom, // NEW
        createdAt: template.createdAt
      }
    });
  } catch (error) {
    console.error('Error saving challenge template:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A template with this name already exists' });
    }
    res.status(500).json({ message: 'Failed to save template' });
  }
});

// PUT /api/challenge-templates/:templateId - Update an existing template
router.put('/:templateId', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { templateId } = req.params;
    const { name, title, settings } = req.body;
    const teacherId = req.user._id;

    if (!name || !settings) {
      return res.status(400).json({ message: 'Template name and settings are required' });
    }

    const template = await ChallengeTemplate.findOne({ 
      _id: templateId, 
      teacherId 
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Check if new name conflicts with existing template (excluding current one)
    if (name.trim() !== template.name) {
      const existingTemplate = await ChallengeTemplate.findOne({ 
        teacherId, 
        name: name.trim(),
        _id: { $ne: templateId }
      });

      if (existingTemplate) {
        return res.status(400).json({ message: 'A template with this name already exists' });
      }
    }

    template.name = name.trim();
    template.title = title || template.title;
    template.settings = settings;
    
    await template.save();

    res.json({ 
      message: 'Template updated successfully',
      template: {
        _id: template._id,
        name: template.name,
        title: template.title,
        settings: template.settings,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating challenge template:', error);
    res.status(500).json({ message: 'Failed to update template' });
  }
});

// DELETE /api/challenge-templates/:templateId - Delete a template
router.delete('/:templateId', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { templateId } = req.params;
    const teacherId = req.user._id;

    const template = await ChallengeTemplate.findOneAndDelete({ 
      _id: templateId, 
      teacherId 
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting challenge template:', error);
    res.status(500).json({ message: 'Failed to delete template' });
  }
});

module.exports = router;