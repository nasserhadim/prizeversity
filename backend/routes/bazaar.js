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
  const { name, description, price, image, category, primaryEffect, primaryEffectValue, secondaryEffects } = req.body;

  // Basic validation
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Verify bazaar exists
    const bazaarExists = await Bazaar.exists({ _id: bazaarId });
    if (!bazaarExists) {
      return res.status(404).json({ error: 'Bazaar not found' });
    }

    // Create item
    const item = new Item({
      name: name.trim(),
      description: description?.trim(),
      price: Number(price),
      image: image?.trim(),
      category,
      primaryEffect: category !== 'Passive' ? primaryEffect : undefined,
      primaryEffectValue: category !== 'Passive' ? Number(primaryEffectValue) : undefined,
      secondaryEffects: secondaryEffects?.map(se => ({
        effectType: se.effectType,
        value: Number(se.value)
      })),
      bazaar: bazaarId
    });

    await item.save();

    // Update bazaar
    await Bazaar.findByIdAndUpdate(
      bazaarId,
      { $push: { items: item._id } },
      { new: true }
    );

    // Notify classroom about the new item
    req.app.get('io').to(`classroom-${req.params.classroomId}`).emit('bazaar_update', {
      bazaarId,
      newItem: item
    });

    res.status(201).json({ 
      message: 'Item added successfully',
      item: await Item.findById(item._id)
    });

  } catch (err) {
    console.error('Item creation failed:', err);
    res.status(500).json({ 
      error: 'Failed to create item',
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
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

    // Checking if the user has enough balance
    if (user.balance < totalCost) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }


    // Deducting balance and log transaction
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

    // Notify classroom about the purchase
    req.app.get('io').to(`classroom-${req.params.classroomId}`).emit('bazaar_purchase', {
      itemId,
      buyerId: req.user._id,
      newStock: item.stock
    });

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
  router.post('/checkout', ensureAuthenticated, blockIfFrozen, async (req, res) => {
  console.log("Received checkout request:", req.body);
  
  try {
    const { userId, items } = req.body;
    
    if (!userId || !items || !Array.isArray(items) || items.length === 0) {
      console.error("Invalid checkout data:", { userId, items });
      return res.status(400).json({ error: 'Invalid checkout data' });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error("User not found:", userId);
      return res.status(404).json({ error: 'User not found' });
    }

    const total = items.reduce((sum, item) => sum + item.price, 0);
    console.log(`Calculated total: ${total}, User balance: ${user.balance}`);

    // Ensuring user has enough balance
    if (user.balance < total) {
      console.error("Insufficient balance:", { balance: user.balance, total });
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Process each item
    const ownedItems = [];
    for (const itemData of items) {
      const item = await Item.findById(itemData._id || itemData.id);
      if (!item) {
        console.error("Item not found:", itemData._id);
        continue;
      }

      const ownedItem = await Item.create({
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
        bazaar: item.bazaar,
        category: item.category,
        primaryEffect: item.primaryEffect,
        primaryEffectValue: item.primaryEffectValue,
        secondaryEffects: item.secondaryEffects,
        owner: userId
      });

      ownedItems.push(ownedItem);
    }

    // Deduct balance
    user.balance -= total;
    user.transactions.push({
      amount: -total,
      description: `Checkout: ${items.length} item(s)`,
      type: 'purchase'
    });
    await user.save();

    // Create order and save 
    const order = new Order({
      user: userId,
      items: ownedItems.map(i => i._id),
      total
    });
    await order.save();

    console.log("Checkout successful for user:", userId);
    res.status(200).json({
      message: 'Purchase successful',
      items: ownedItems,
      balance: user.balance
    });

  } catch (err) {
    console.error("Checkout failed:", err);
    res.status(500).json({ 
      error: 'Checkout failed',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});


// Get the balance for a user
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


// Retrieve all orders for a user *which must be the user themself or a teacher)
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
      const orders = await Order.find({ user: userId })
        .populate('items')
        .populate({
          path: 'items',
          populate: {
            path: 'bazaar',
            populate: {
              path: 'classroom',
              select: 'name code'
            }
          }
        });
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
