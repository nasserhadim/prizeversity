const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const BazaarTemplate = require('../models/BazaarTemplate');
const Bazaar = require('../models/Bazaar');
const Classroom = require('../models/Classroom');
const Item = require('../models/Item');

async function copyBazaarIntoClassroom({ sourceBazaarId, targetClassroomId }) {
  const bazaarSource = await Bazaar.findById(sourceBazaarId)
    .populate('items')
    .lean();

  if (!bazaarSource) throw new Error('The source bazaar was not found.');

  const newBazaar = await Bazaar.create({
    name: bazaarSource.name,
    description: bazaarSource.description,
    image: bazaarSource.image,
    classroom: new mongoose.Types.ObjectId(targetClassroomId),
  });

  const now = new Date();

  // Copy all of the item fields so mystery/discount/etc keep their configurations
  const itemsPayload = (bazaarSource.items || []).map((i) => {
    // omit fields that should not be copied over
    const {
      _id,
      __v,
      bazaar,
      classroom,
      owner,
      createdAt,
      updatedAt,
      orders,
      // add any other runtime-only fields you know you don't want to carry over
      ...rest
    } = i;

    return {
      ...rest,
      // always point to the new bazaar/classroom
      bazaar: newBazaar._id,
      classroom: newBazaar.classroom,
      // items in the bazaar shop should not belong to a specific student
      owner: undefined,
      createdAt: now,
      updatedAt: now,
      // keep existing flags when present, otherwise default to sensible values
      active: i.active ?? true,
      usesRemaining: i.usesRemaining ?? rest.usesRemaining ?? 0,
    };
  });

  const newItems = itemsPayload.length
    ? await Item.insertMany(itemsPayload)
    : [];

  await Bazaar.findByIdAndUpdate(
    newBazaar._id,
    { $set: { items: newItems.map((i) => i._id) } }
  );

  return newBazaar;
}

// GET /api/bazaarTemplate
router.get('/', async (req, res) => {
  try {
    const ownerId = req.user?._id;
    if (!ownerId) return res.status(401).json({ message: 'Unauthorized' });

    const templateQuery = BazaarTemplate.find({ owner: ownerId }).sort({ createdAt: -1 });
    if (req.query.includeClassroomNames === 'true') {
      templateQuery.populate('sourceClassroom', 'name code');
    }

    const templates = await templateQuery.lean();
    res.json({ templates });
  } catch (err) {
    console.error('[GET /api/bazaarTemplate]', err);
    res.status(500).json({ message: 'Failed to list templates' });
  }
});

// POST /api/bazaarTemplate/save/:bazaarId
router.post('/save/:bazaarId', async (req, res) => {
  try {
    const ownerId = req.user?._id;
    if (!ownerId) return res.status(401).json({ message: 'Unauthorized' });

    const { bazaarId } = req.params;
    if (!mongoose.isValidObjectId(bazaarId))
      return res.status(400).json({ message: 'Invalid bazaarId' });

    const bazaar = await Bazaar.findById(bazaarId).populate('classroom').lean();
    if (!bazaar) return res.status(404).json({ message: 'Bazaar not found' });

    const countItem = await Item.countDocuments({ bazaar: bazaar._id });

    const template = await BazaarTemplate.create({
      name: bazaar.name,
      description: bazaar.description,
      owner: ownerId,
      sourceBazaar: bazaar._id,
      sourceClassroom: bazaar.classroom?._id || bazaar.classroom,
      countItem,
    });

    res.json({ template });
  } catch (err) {
    console.error('[POST /api/bazaarTemplate/save/:bazaarId]', err);
    res.status(500).json({ message: 'Could not save template' });
  }
});

// POST /api/bazaarTemplate/apply/:templateId
router.post('/apply/:templateId', async (req, res) => {
  try {
    const ownerId = req.user?._id;
    if (!ownerId) return res.status(401).json({ message: 'Unauthorized' });

    const { templateId } = req.params;
    const { targetClassroomId } = req.body;

    if (!mongoose.isValidObjectId(templateId) || !mongoose.isValidObjectId(targetClassroomId)) {
      return res.status(400).json({ message: 'Invalid id(s)' });
    }

    const template = await BazaarTemplate.findOne({ _id: templateId, owner: ownerId }).lean();
    if (!template) return res.status(404).json({ message: 'Template not found' });

    const newBazaar = await copyBazaarIntoClassroom({
      sourceBazaarId: template.sourceBazaar,
      targetClassroomId,
    });

    res.json({ bazaar: newBazaar });
  } catch (err) {
    console.error('[POST /api/bazaarTemplate/apply/:templateId]', err);
    res.status(500).json({ message: 'Could not apply template' });
  }
});

// DELETE /api/bazaarTemplate/:templateId
router.delete('/:templateId', async (req, res) => {
  try {
    const ownerId = req.user?._id;
    if (!ownerId) return res.status(401).json({ message: 'Unauthorized' });

    const { templateId } = req.params;
    if (!mongoose.isValidObjectId(templateId))
      return res.status(400).json({ message: 'Invalid templateId' });

    const template = await BazaarTemplate.findOne({ _id: templateId, owner: ownerId });
    if (!template) return res.status(404).json({ message: 'Template not found' });

    await template.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/bazaarTemplate/:templateId]', err);
    res.status(500).json({ message: 'Could not delete template' });
  }
});

// GET /api/bazaarTemplate/reusable-bazaars/:classroomId
router.get('/reusable-bazaars/:classroomId', async (req, res) => {
  try {
    const ownerId = req.user?._id;
    if (!ownerId) return res.status(401).json({ message: 'Unauthorized' });

    const { classroomId } = req.params;
    if (!mongoose.isValidObjectId(classroomId))
      return res.status(400).json({ message: 'Invalid classroomId' });

    const myClassrooms = await Classroom.find({ teacher: ownerId }).select('_id name code').lean();
    const myClassroomIds = new Set(myClassrooms.map(c => String(c._id)));

    const bazaars = await Bazaar.find({
      classroom: { $in: [...myClassroomIds].filter(id => id !== String(classroomId)) }
    })
      .populate('classroom', 'name code')
      .populate('items', '_id')
      .sort({ createdAt: -1 })
      .lean();

    const formed = (bazaars || []).map(b => ({
      _id: b._id,
      name: b.name,
      description: b.description,
      classroom: b.classroom,
      countItem: (b.items || []).length,
      createdAt: b.createdAt,
    }));

    res.json({ bazaars: formed });
  } catch (err) {
    console.error('[GET /api/bazaarTemplate/reusable-bazaars/:classroomId]', err);
    res.status(500).json({ message: 'Could not load reusable bazaars' });
  }
});

// POST /api/bazaarTemplate/reusable-bazaars/:sourceBazaarId/apply
router.post('/reusable-bazaars/:sourceBazaarId/apply', async (req, res) => {
  try {
    const ownerId = req.user?._id;
    if (!ownerId) return res.status(401).json({ message: 'Unauthorized' });

    const { sourceBazaarId } = req.params;
    const { targetClassroomId } = req.body;

    if (!mongoose.isValidObjectId(sourceBazaarId) || !mongoose.isValidObjectId(targetClassroomId)) {
      return res.status(400).json({ message: 'Invalid id(s)' });
    }

    const newBazaar = await copyBazaarIntoClassroom({ sourceBazaarId, targetClassroomId });
    res.json({ bazaar: newBazaar });
  } catch (err) {
    console.error('[POST /api/bazaarTemplate/reusable-bazaars/:sourceBazaarId/apply]', err);
    res.status(500).json({ message: 'Could not apply bazaar' });
  }
});

module.exports = router;
