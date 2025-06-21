const express = require('express');
const Bazaar = require('../models/Bazaar');
const Item = require('../models/Item');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const { ensureAuthenticated } = require('../config/auth');
const router = express.Router();

// Middleware: Only teachers allowed for certain actions
function ensureTeacher(req, res, next) {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can perform this action' });
  }
  next();
}

// Create Bazaar for a classroom (only 1 allowed)
router.post('/classroom/:classroomId/bazaar/create', ensureAuthenticated, ensureTeacher, async (req, res) => {
  const { classroomId } = req.params;
  const { name, description, image } = req.body;

  try {
    const existing = await Bazaar.findOne({ classroom: classroomId });
    if (existing) {
      return res.status(400).json({ error: 'Bazaar already exists for this classroom' });
    }

    const bazaar = new Bazaar({
      name,
      description,
      image,
      classroom: classroomId
    });

    await bazaar.save();
    res.status(201).json({ message: 'Bazaar created', bazaar });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create bazaar' });
  }
});

// Get Bazaar for a classroom (if any)
router.get('/classroom/:classroomId/bazaar', ensureAuthenticated, async (req, res) => {
  const { classroomId } = req.params;

  try {
    const bazaar = await Bazaar.findOne({ classroom: classroomId }).populate('items');
    if (!bazaar) {
      return res.status(200).json({ bazaar: null, message: 'Bazaar not open yet' });
    }
    res.status(200).json({ bazaar });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bazaar' });
  }
});

// Add Item to Bazaar (teacher only)
router.post('/classroom/:classroomId/bazaar/:bazaarId/items', ensureAuthenticated, ensureTeacher, async (req, res) => {
  const { bazaarId } = req.params;
  const { name, description, price, image } = req.body;

  try {
    const item = new Item({
      name,
      description,
      price,
      image,
      bazaar: bazaarId
    });

    await item.save();

    // Add item reference to bazaar's items array
    await Bazaar.findByIdAndUpdate(bazaarId, { $push: { items: item._id } });

    res.status(201).json({ message: 'Item added', item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// Buy Item (any authenticated user)
router.post('/classroom/:classroomId/bazaar/:bazaarId/items/:itemId/buy', ensureAuthenticated, async (req, res) => {
  const { itemId } = req.params;
  const { quantity } = req.body;

  try {
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const user = await User.findById(req.user._id);
    const totalCost = item.price * quantity;

    if (user.balance < totalCost) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    user.balance -= totalCost;
    user.transactions.push({
      amount: -totalCost,
      description: `Purchased ${quantity} x ${item.name}`,
      assignedBy: req.user._id
    });
    await user.save();

    res.status(200).json({ message: 'Purchase successful', balance: user.balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process purchase' });
  }
});

module.exports = router;
