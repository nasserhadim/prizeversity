const express = require('express');
const router = express.Router();
const BazaarTemplate = require('../models/BazaarTemplate');
const { ensureAuthenticated, ensureTeacher } = require('../middleware/auth');

// GET /api/bazaar-templates - Get all templates for the authenticated teacher
router.get('/', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const teacherId = req.user._id;
    const templates = await BazaarTemplate.find({ teacherId })
      .sort({ createdAt: -1 })
      .select('name bazaarData items sourceClassroom createdAt updatedAt'); // Added sourceClassroom here

    res.json({ templates });
  } catch (error) {
    console.error('Error fetching bazaar templates:', error);
    res.status(500).json({ message: 'Failed to fetch templates' });
  }
});

// POST /api/bazaar-templates - Create a new template from existing bazaar
router.post('/', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { name, bazaarId } = req.body;
    const teacherId = req.user._id;

    if (!name || !bazaarId) {
      return res.status(400).json({ message: 'Template name and bazaar ID are required' });
    }

    // Check if template name already exists for this teacher
    const existingTemplate = await BazaarTemplate.findOne({ 
      teacherId, 
      name: name.trim() 
    });

    if (existingTemplate) {
      return res.status(400).json({ message: 'A template with this name already exists' });
    }

    // Fetch the bazaar with populated items
    const Bazaar = require('../models/Bazaar');
    const bazaar = await Bazaar.findById(bazaarId).populate('items');
    
    if (!bazaar) {
      return res.status(404).json({ message: 'Bazaar not found' });
    }

    // Verify teacher owns this bazaar's classroom
    const Classroom = require('../models/Classroom');
    const classroom = await Classroom.findById(bazaar.classroom);
    if (!classroom || classroom.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'Not authorized to save this bazaar as template' });
    }

    // Extract bazaar data (excluding classroom reference and _id)
    const bazaarData = {
      name: bazaar.name,
      description: bazaar.description,
      image: bazaar.image
    };

    // Extract items data (excluding owner, bazaar reference, and _id)
    const items = bazaar.items.map(item => ({
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.image,
      category: item.category,
      primaryEffect: item.primaryEffect,
      primaryEffectValue: item.primaryEffectValue,
      secondaryEffects: item.secondaryEffects || [],
      swapOptions: item.swapOptions || []
    }));

    // NEW: Store classroom info
    const template = new BazaarTemplate({
      name: name.trim(),
      teacherId,
      sourceClassroom: {
        classroomId: classroom._id,
        name: classroom.name,
        code: classroom.code
      },
      bazaarData,
      items
    });

    await template.save();

    res.status(201).json({ 
      message: 'Template saved successfully',
      template: {
        _id: template._id,
        name: template.name,
        sourceClassroom: template.sourceClassroom,
        bazaarData: template.bazaarData,
        itemCount: template.items.length,
        createdAt: template.createdAt
      }
    });
  } catch (error) {
    console.error('Error saving bazaar template:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A template with this name already exists' });
    }
    res.status(500).json({ message: 'Failed to save template' });
  }
});

// PUT /api/bazaar-templates/:templateId - Update an existing template
router.put('/:templateId', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { templateId } = req.params;
    const { name, bazaarData, items } = req.body;
    const teacherId = req.user._id;

    if (!name) {
      return res.status(400).json({ message: 'Template name is required' });
    }

    const template = await BazaarTemplate.findOne({ 
      _id: templateId, 
      teacherId 
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Check if new name conflicts with existing template (excluding current one)
    if (name.trim() !== template.name) {
      const existingTemplate = await BazaarTemplate.findOne({ 
        teacherId, 
        name: name.trim(),
        _id: { $ne: templateId }
      });

      if (existingTemplate) {
        return res.status(400).json({ message: 'A template with this name already exists' });
      }
    }

    template.name = name.trim();
    if (bazaarData) template.bazaarData = bazaarData;
    if (items) template.items = items;
    
    await template.save();

    res.json({ 
      message: 'Template updated successfully',
      template: {
        _id: template._id,
        name: template.name,
        bazaarData: template.bazaarData,
        itemCount: template.items.length,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating bazaar template:', error);
    res.status(500).json({ message: 'Failed to update template' });
  }
});

// DELETE /api/bazaar-templates/:templateId - Delete a template
router.delete('/:templateId', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { templateId } = req.params;
    const teacherId = req.user._id;

    const template = await BazaarTemplate.findOneAndDelete({ 
      _id: templateId, 
      teacherId 
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting bazaar template:', error);
    res.status(500).json({ message: 'Failed to delete template' });
  }
});

// POST /api/bazaar-templates/:templateId/apply - Apply template to create/restore bazaar
router.post('/:templateId/apply', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { templateId } = req.params;
    const { classroomId } = req.body;
    const teacherId = req.user._id;

    if (!classroomId) {
      return res.status(400).json({ message: 'Classroom ID is required' });
    }

    const template = await BazaarTemplate.findOne({ 
      _id: templateId, 
      teacherId 
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Verify teacher owns the classroom
    const Classroom = require('../models/Classroom');
    const classroom = await Classroom.findOne({ 
      _id: classroomId, 
      teacher: teacherId 
    });

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found or unauthorized' });
    }

    // Check if bazaar already exists
    const Bazaar = require('../models/Bazaar');
    const existingBazaar = await Bazaar.findOne({ classroom: classroomId });
    
    if (existingBazaar) {
      return res.status(400).json({ 
        message: 'Bazaar already exists for this classroom. Delete it first to apply template.' 
      });
    }

    // Create new bazaar from template
    const bazaar = new Bazaar({
      name: template.bazaarData.name,
      description: template.bazaarData.description,
      image: template.bazaarData.image,
      classroom: classroomId
    });

    await bazaar.save();

    // Create items from template
    const Item = require('../models/Item');
    const createdItems = [];

    for (const itemData of template.items) {
      const item = new Item({
        name: itemData.name,
        description: itemData.description,
        price: itemData.price,
        image: itemData.image,
        category: itemData.category,
        primaryEffect: itemData.primaryEffect,
        primaryEffectValue: itemData.primaryEffectValue,
        secondaryEffects: itemData.secondaryEffects || [],
        swapOptions: itemData.swapOptions || [],
        bazaar: bazaar._id
      });

      await item.save();
      createdItems.push(item._id);
    }

    // Update bazaar with items
    bazaar.items = createdItems;
    await bazaar.save();

    // Populate items for response
    await bazaar.populate('items');

    res.status(201).json({ 
      message: 'Template applied successfully',
      bazaar 
    });
  } catch (error) {
    console.error('Error applying bazaar template:', error);
    res.status(500).json({ message: 'Failed to apply template' });
  }
});

module.exports = router;