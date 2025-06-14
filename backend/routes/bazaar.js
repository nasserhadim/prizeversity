const express = require('express');
const Bazaar = require('../models/Bazaar');
const Item = require('../models/Item');
const User = require('../models/User');  // <-- Import User model
const { ensureAuthenticated } = require('../config/auth');
const router = express.Router();

// Create Bazaar - only teacher can create, only one per classroom
router.post('/create', ensureAuthenticated, async (req, res) => {
  const { name, description, image, classroomId } = req.body;

  // Role check: only teachers can create
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can create a bazaar' });
  }

  try {
    // Check if bazaar already exists for this classroom
    const existing = await Bazaar.findOne({ classroom: classroomId });
    if (existing) {
      return res.status(400).json({ error: 'Bazaar already exists for this classroom' });
    }

    const bazaar = new Bazaar({ name, description, image, classroom: classroomId });
    await bazaar.save();
    res.status(201).json(bazaar);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create bazaar' });
  }
});

// Add Item to Bazaar
router.post('/:bazaarId/items/add', ensureAuthenticated, async (req, res) => {
  const { name, description, price, image } = req.body;
  try {
    const item = new Item({ name, description, price, image, bazaar: req.params.bazaarId });
    await item.save();
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// Buy Item
router.post('/:bazaarId/items/:itemId/buy', ensureAuthenticated, async (req, res) => {
  const { quantity } = req.body;
  try {
    const item = await Item.findById(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const user = await User.findById(req.user._id);
    if (user.balance < item.price * quantity) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    user.balance -= item.price * quantity;
    await user.save();
    res.status(200).json({ message: 'Item purchased successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to buy item' });
  }
});

// Fetch Bazaars for Classroom
router.get('/classroom/:classroomId', ensureAuthenticated, async (req, res) => {
  try {
    const bazaars = await Bazaar.find({ classroom: req.params.classroomId });
    res.status(200).json(bazaars);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bazaars' });
  }
});

// Update Bazaar
router.put('/:id', ensureAuthenticated, async (req, res) => {
  const { name, description, image } = req.body;
  try {
    const bazaar = await Bazaar.findById(req.params.id);
    if (!bazaar) return res.status(404).json({ error: 'Bazaar not found' });

    bazaar.name = name || bazaar.name;
    bazaar.description = description || bazaar.description;
    bazaar.image = image || bazaar.image;
    await bazaar.save();
    res.status(200).json(bazaar);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update bazaar' });
  }
});

// Delete Bazaar
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    await Bazaar.deleteOne({ _id: req.params.id });
    res.status(200).json({ message: 'Bazaar deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete bazaar' });
  }
});

// Update Item
router.put('/:bazaarId/items/:itemId', ensureAuthenticated, async (req, res) => {
  const { name, description, price, image } = req.body;
  try {
    const item = await Item.findById(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    item.name = name || item.name;
    item.description = description || item.description;
    item.price = price || item.price;
    item.image = image || item.image;
    await item.save();
    res.status(200).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete Item
router.delete('/:bazaarId/items/:itemId', ensureAuthenticated, async (req, res) => {
  try {
    await Item.deleteOne({ _id: req.params.itemId });
    res.status(200).json({ message: 'Item deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

module.exports = router;
