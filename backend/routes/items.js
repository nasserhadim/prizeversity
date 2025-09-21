// backend/routes/items.js
//const ensureTeacher = require('../middleware/isAdmin');

const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const ensureTeacher = require('../middleware/ensureTeacher');
// If your middleware exports { ensureTeacher }, then use:
// const { ensureTeacher } = require('../middleware/ensureTeacher');

// Only teachers can edit/delete
router.use(ensureTeacher);

// Update an item
router.put('/:itemId', async (req, res, next) => {
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

// Delete an item
router.delete('/:itemId', async (req, res, next) => {
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