// backend/routes/items.js
//const ensureTeacher = require('../middleware/isAdmin');

const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const ensureTeacher = require('../middleware/ensureTeacher');
// If middleware exports { ensureTeacher }, then use:
// const { ensureTeacher } = require('../middleware/ensureTeacher');


// student can read all items  //9/22 added public routes
router.get('/public', async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 }); //newest first
    res.json(items);//will send back to json format
  } catch (err) { //in case something goes wrong will send error
    res.status(500).json({ error: 'Failed to load items' });
  }
});

// Get a single item (public)
router.get('/public/:itemId', async (req, res) => {
  try {
    const item = await Item.findById(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load item' });
  }
});


// Only teachers can edit/delete
//router.use(ensureTeacher); //9/22 commented out, to test if "access denined" still pops up for students

// Update an item
//router.put('/:itemId', async (req, res, next) => { //9/22 commented out and changed to  below fo rtesting 
router.put('/:itemId', ensureTeacher, async (req, res, next) => {
  try {
    const updated = await Item.findByIdAndUpdate(
      req.params.itemId,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// the put and delete were there, but ensured that only teachers could access them by editing and deletig.
// Delete an item
//router.delete('/:itemId', async (req, res, next) => { //commented out 9/22 to test new one below:
router.delete('/:itemId', ensureTeacher, async (req, res, next) => {
  try {
    const deleted = await Item.findByIdAndDelete(req.params.itemId);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
// Note: No GET or POST routes here; those are public and in routes/itemsPublic.js

// backend/server.js