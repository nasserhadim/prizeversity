//9/21 new admin item routes

// routes/itemsAdmin.js
const express = require('express');
const router = express.Router();

const Item = require('../models/Item'); // ensure this exists
// adjust import based on how you export ensureTeacher:
const ensureTeacher = require('../middleware/ensureTeacher'); 
// OR: const { ensureTeacher } = require('../middleware/ensureTeacher');

// Only writes are protected
router.use(ensureTeacher);

// PUT: replace whole item (teacher only)
router.put('/:itemId', async (req, res, next) => {
  try {
    const updated = await Item.findByIdAndUpdate(
      req.params.itemId,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) { next(e); }
});

// PATCH: partial update (teacher only)
router.patch('/:itemId', async (req, res, next) => {
  try {
    const updated = await Item.findByIdAndUpdate(
      req.params.itemId,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) { next(e); }
});

// DELETE: remove item (teacher only)
router.delete('/:itemId', async (req, res, next) => {
  try {
    const deleted = await Item.findByIdAndDelete(req.params.itemId);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
