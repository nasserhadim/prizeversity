const express = require('express');
const Bazaar = require('../models/Bazaar');
const Item = require('../models/Item');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const { ensureAuthenticated } = require('../config/auth');
const router = express.Router();
const Order = require('../models/Order');
const blockIfFrozen = require('../middleware/blockIfFrozen');

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
  const { name, description, price, image, category, effect } = req.body;

  try {
    const item = new Item({
      name,
      description,
      price,
      image,
      category,
      effect,
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
router.post('/classroom/:classroomId/bazaar/:bazaarId/items/:itemId/buy',  ensureAuthenticated, blockIfFrozen, async (req, res) => { 
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

    // Create owned copies of the item
    const ownedItems = [];
    for (let i = 0; i < quantity; i++) {
      const ownedItem = await Item.create({
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
        bazaar: item.bazaar,
        category: item.category,
        effect: item.effect,
        owner: user._id
      });
      ownedItems.push(ownedItem);
    }

    res.status(200).json({
      message: 'Purchase successful',
      balance: user.balance,
      items: ownedItems
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process purchase' });
  }
});


// Checkout multiple items
  router.post('/checkout',  ensureAuthenticated, blockIfFrozen, async (req, res) => {
    console.log("Received checkout data:", req.body);
    const { userId, items } = req.body;

  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Applying discount if active
    const discountMultiplier = user.discountShop ? 0.8 : 1;

    const total = items.reduce((sum, item) => sum + (item.price * discountMultiplier), 0);
    console.log(`→ backend computed total=${total} from items:`, items.map(i => i.price));

    if (user.balance < total) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    user.balance -= total;

    user.transactions.push({
      description: `Checkout: ${items.length} item(s)`,
      amount: -total,
      type: 'purchase',
      date: new Date(),
      items: items.map(i => ({ name: i.name, price: i.price }))
    });

    await user.save();



    // Clone items and assign ownership
    const ownedItems = [];

    for (const itemData of items) {
      const item = await Item.findById(itemData._id || itemData.id);
      if (!item) continue;

      const ownedItem = await Item.create({
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
        bazaar: item.bazaar,
        category: item.category,
        effect: item.effect,
        owner: user._id
      });

      ownedItems.push(ownedItem);
    }

    // Save wnrder
    const order = new Order({
      user: req.user._id,
      items: ownedItems.map(i => i._id),
      total
    });
    await order.save();

    res.status(200).json({
      message: 'Purchase successful',
      items: ownedItems,
      balance: user.balance
    });

  } catch (err) {
    console.error('Checkout failed:', err);
    res.status(500).json({ error: 'Checkout failed' });
  }
});


router.get('/user/:userId/balance', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({ balance: user.balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

router.get(
  '/orders/user/:userId',
  ensureAuthenticated,
  async (req, res) => {
    try {
      const { userId } = req.params;
      // only allow the student themself or any teacher
      if (req.user._id.toString() !== userId && req.user.role !== 'teacher') {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const orders = await Order.find({ user: userId }).populate('items');
      res.json(orders);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  }
);

// Get the inventory page for the user to see what items they have
router.get('/inventory/:userId', async (req, res) => {
  const { userId } = req.params;
  const items = await Item.find({ owner: userId });
  res.json({ items });
});

module.exports = router;
