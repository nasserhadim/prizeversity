const express = require('express');
const Bazaar = require('../models/Bazaar');
const Item = require('../models/Item');
const { ensureAuthenticated } = require('../config/auth');
const router = express.Router();

// Create Bazaar
router.post('/create', ensureAuthenticated, async (req, res) => {
  const { name, description, image, classroomId } = req.body;
  try {
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

module.exports = router;