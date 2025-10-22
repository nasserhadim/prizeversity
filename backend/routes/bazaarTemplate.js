const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const BazaarTemplate = require('../models/BazaarTemplate');
const Bazaar = require('../models/Bazaar');
const Classroom = require('../models/Classroom')
const Item = require('../models/Item');

async function copyBazaarIntoClassroom({ sourceBazaarId, targetClassroomId}) {
  const bazaarSource = await Bazaar.findById(sourceBazaarId).populate('items').lean();
  if(!bazaarSource) {
    throw new Error('The source bazaar was not found.');
  };

  const newBazaar = await Bazaar.create({
    name: bazaarSource.name,
    description: bazaarSource.description,
    image: bazaarSource.image,
    classroom: new mongoose.Types.ObjectId(targetClassroomId),
  });

  const newItems = await Item.insertMany(
    (bazaarSource || []).map((i) => ({
      name: i.name,
      description: i.description,
      price: i.price,
      image: i.image,
      category: i.category,
      primaryEffect: i.primaryEffect,
      secondaryEffect: i.secondaryEffect,
      usesRemaining: i.usesRemaining,
      active: i.active,
      bazaar: newBazaar._id,
      createdAt: new Date(),
    }))
  );

  await Bazaar.findByIdAndUpdate(newBazaar._id, { $set: { items: newItems.map(i => i._id)} });
  return newBazaar;
}

router.get('/', async (req, res) => {
  try {
    const ownerId = req.user?._id;
    if(!ownderId)
      return res.status(401).json({ message: 'Not Approved' });

    const templateQuery = BazaarTemplate.find({ ownder: ownderId}).sort({ createdAt: -1});
    if (req.query.AddClassroomName === 'true')
      q.populate('sourceClassroom', 'name code');

    const templates = await templateQuery.lean();
    res.json({ templates });
  } catch(err) {
    console.error('[GET /api/templates]', err);
    res.status(500).json({ message: 'There was an error to list the templates'});
  }
});

router.post('/save/:bazaarId', async (req, res) => {
  try {
    const ownerId = req.user?._id;
    if(!ownerId)
      return res.status(401).json({ message: 'Not Approved'});

    const { bazaarId } = req.params;
    if(!mongoose.isValidObjectId(bazaarId))
      return res.status(400).json({ message: 'That is not a valid bazaarId'});

    const bazaar = await Bazaar.findById(bazaarId).populate('classroom').lean();
    if(!bazaar)
      return res.status(404).json({ message: 'The bazaar could not be found'});

    const countItem = await Item.countDocuments({ bazaar: bazaar._id});
    const template = await BazaarTemplate.create({
      name: bazaar.name,
      description: bazaar.description,
      owner: ownerId,
      sourceBazaar: bazaar._id,
      sourceClassroom: bazaar.classroom,
      countItem,
    });

    res.json({ template })
  } catch(err) {
      console.error('[POST /api/templates/save/: bazaarId]', err);
      res.status(500).json({ message: 'Could not save the template'})
  }
});

router.post('/apply/:templateId', async (req, res) => {
  try {
    const ownerId = req.user?._id;
    if(!ownerId)
      return res.status(401).json({ message: 'Not Approved'});

    const { templateId } = req.params;
    const { targetClassroomId } = req.body;

    if(!mongoose.isValidObjectId(templateId) || !mongoose.isValidObjectId(targetClassroomId)) {
      return res.status(400).json({ message: 'THis is an invalid ID'})
    }

    const template = await BazaarTemplate.findOne({ _id: templateId, owner: ownderId}).lean();
    if(!template)
      return res.status(404).json({ message: 'The template could not be found'});

    const newBazaar = await copyBazaarIntoClassroom({
      sourceBazaarId: template.sourceBazaar,
      targetClassroomId,
    });

    res.json({ bazaar: newBazaar});
  } catch (err) {
    console.error('[POST /api/templates/apply/: templateId]', err);
    res.status(500).json({ message: 'Could not apply the template '});
  }
});

router.delete('/:templateId', async (req, res) => {
  try {
    const ownerId = req.user?._id;
    if (!ownerId) return res.status(401).json({ message: 'Unauthorized' });

    const { templateId } = req.params;
    if (!mongoose.isValidObjectId(templateId)) {
      return res.status(400).json({ message: 'Invalid templateId' });
    }

    const template = await BazaarTemplate.findOne({ _id: templateId, owner: ownerId });
    if (!template) return res.status(404).json({ message: 'Template not found' });

    await template.deleteOne();

    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/templates/:templateId]', err);
    res.status(500).json({ message: 'Could not delete template' });
  }
});


router.get('/resuable-bazaars/:classroomId', async (req, res) => {
  try {
    const ownerId = req.user?._id;
    if(!ownerId)
      return res.status(401).json({ message: 'Not Approved'});

    const { classroomId } = req.params;
    if(!mongoose.isValidObjectId(classroomId))
      return res.status(400).json({ message: 'This is an invalid classroomId'});

    const myClassrooms = await Classroom.find({ teacher: ownerId}).select('_id name code').lean();
    const myClassroomIds = new Set(myClassrooms.map(c => String(c._id)));

    const bazaars = await Bazaar.find({
      classroom: {$in: [...myClassroomIds].filter(id => id != classroomId)}
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
      createdAt: b.createdAt
    }));
    
    res.json({ bazaars: formed});
  } catch (err) {
    console.error('[GET /api/templates/reusable-bazaars/:classroomId]', err);
    res.status(500).json({ message: 'Could not load the resuable bazaars'});
  }
});

router.post('/reusable-bazaars/:sourceBazaarId/apply', async (req, res) => {
  try {
    const ownerId = req.user?._id;
    if (!ownerId)
      return res.status(401).json({ message: 'Not Approved'});

    const { sourceBazzarId } = req.params;
    const { targetClassroomId } = req.body;

    if(!mongoose.isValidObjectId(sourceBazzarId) || !mongoose.isValidObjectId(targetClassroomId)) {
      return res.status(400).json({ message: 'This is an invalid Id'})
    }

    const newBazaar = await copyBazaarIntoClassroom({ sourceBazaarId, targetClassroomId});
    res.json({ bazaar: newBazaar});
  } catch (err) {
    console.error('[POST /api/templates/reusable-bazaars/:sourceBazaarId/apply]', err);
    res.status(500).json({ message: 'Could not apply the bazaar'});
  }
});

module.exports = router;

