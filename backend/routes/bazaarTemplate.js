// backend/routes/bazaarTemplate.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const BazaarTemplate = require('../models/BazaarTemplate');
const Bazaar = require('../models/Bazaar');
const Item = require('../models/Item');

// If you have an auth middleware, apply it here so req.user exists
// router.use(require('../middleware/auth')); // example

// GET /api/classrooms/:classroomId/bazaar-templates
router.get('/classrooms/:classroomId/bazaar-templates', async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { scope = 'all', searchText } = req.query;

    if (!mongoose.isValidObjectId(classroomId)) {
      return res.status(400).json({ message: 'Invalid classroomId' });
    }
    const clsId = new mongoose.Types.ObjectId(classroomId);
    const userId = req.user?._id ? new mongoose.Types.ObjectId(req.user._id) : null;

    // Build query by scope
    let query = { classroomId: clsId };
    if (scope === 'mine') {
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });
      query.madeBy = userId;
    } else if (scope === 'public') {
      query.isPublic = true;
    } else {
      // 'all': show public + mine in this classroom
      if (userId) {
        query.$or = [{ isPublic: true }, { madeBy: userId }];
      } else {
        query.isPublic = true;
      }
    }

    // Full-text search
    if (searchText && searchText.trim()) {
      query.$text = { $search: searchText.trim() };
    }

    const templateDocs = await BazaarTemplate.find(query)
      .sort({ createdAt: -1 })
      .select('_id name description madeBy isPublic tags createdAt updatedAt')
      .lean();

    return res.json({ bazaarTemplates: templateDocs });
  } catch (error) {
    console.error('GET bazaar-templates error:', error);
    return res.status(500).json({ message: 'There was an error while fetching the bazaar templates.' });
  }
});


router.post('/classrooms/:classroomId/bazaar-templates', async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { classroomId } = req.params;
    const { bazaarTemplateId, newBazaarName } = req.body;

    if (!mongoose.isValidObjectId(classroomId)) {
      return res.status(400).json({ message: 'Invalid classroomId' });
    }
    if (!bazaarTemplateId || !mongoose.isValidObjectId(bazaarTemplateId)) {
      return res.status(400).json({ message: 'bazaarTemplateId is required' });
    }

    await session.withTransaction(async () => {
      const loadBazaarTemplate = await BazaarTemplate.findById(bazaarTemplateId).session(session);
      if (!loadBazaarTemplate) {
        return res.status(404).json({ message: 'Template not found' });
      }

      const sourceBazaar = await Bazaar.findById(loadBazaarTemplate.bazaarId).lean().session(session);
      if (!sourceBazaar) {
        return res.status(404).json({ message: 'Source bazaar not found' });
      }

      const [newBazaar] = await Bazaar.create([{
        name: (newBazaarName && newBazaarName.trim()) || loadBazaarTemplate.name || sourceBazaar.name || 'Imported Bazaar Template',
        classroom: classroomId,
        description: (loadBazaarTemplate.description || sourceBazaar.description || '').trim(),
        image: sourceBazaar.image || null,
      }], { session });

      const sourceItems = await Item.find({ bazaar: loadBazaarTemplate.bazaarId }).lean().session(session);
      if (Array.isArray(sourceItems) && sourceItems.length) {
        const itemsToAdd = sourceItems.map((item) => ({
          name: item.name,
          description: item.description || '',
          category: item.category,
          price: item.price,
          primaryEffect: item.primaryEffect,
          secondaryEffect: item.secondaryEffect,
          image: item.image ?? undefined,
          imageUrl: item.imageUrl ?? undefined,
          bazaar: newBazaar._id,
        }));
        await Item.insertMany(itemsToAdd, { session, ordered: false });
      }

      return res.json({ bazaar: newBazaar });
    });
  } catch (error) {
    console.error('POST bazaar-templates error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'There was an error while importing the bazaar template.' });
    }
  } finally {
    session.endSession();
  }
});

module.exports = router;