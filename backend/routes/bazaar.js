const express = require('express');
const Bazaar = require('../models/Bazaar');
const Item = require('../models/Item');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const { ensureAuthenticated } = require('../config/auth');
const router = express.Router();
const Order = require('../models/Order');
const blockIfFrozen = require('../middleware/blockIfFrozen');
const upload = require('../middleware/upload'); // reuse existing upload middleware

// Middleware: Only teachers allowed for certain actions
function ensureTeacher(req, res, next) {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can perform this action' });
  }
  next();
}

// Create Bazaar for a classroom (only 1 allowed) — accept optional uploaded "image"
router.post(
  '/classroom/:classroomId/bazaar/create',
  ensureAuthenticated,
  ensureTeacher,
  upload.single('image'),
  async (req, res) => {
    const { classroomId } = req.params;
    // prefer uploaded file, fall back to image URL from body (if any)
    // build relative path so frontend decides full URL via API_BASE
    const image = req.file
      ? `/uploads/${req.file.filename}`
      : (req.body.image || undefined);

    try {
      const existing = await Bazaar.findOne({ classroom: classroomId });
      if (existing) {
        return res.status(400).json({ error: 'Bazaar already exists for this classroom' });
      }

      const bazaar = new Bazaar({
        name: (req.body.name || '').trim(),
        description: req.body.description,
        image,
        classroom: classroomId
      });

      await bazaar.save();
      res.status(201).json({ message: 'Bazaar created', bazaar });
    } catch (err) {
      console.error('[Create Bazaar] error:', err);
      res.status(500).json({ error: 'Failed to create bazaar', message: err.message });
    }
  }
);

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

// Add Item to Bazaar (teacher only) — accept file upload "image"
router.post('/classroom/:classroomId/bazaar/:bazaarId/items', ensureAuthenticated, ensureTeacher, upload.single('image'), async (req, res) => {
  const { bazaarId } = req.params;
  const { name, description, price, category, primaryEffect, primaryEffectValue } = req.body;
  // Prefer uploaded file, fallback to image URL
  const image = req.file
    ? `/uploads/${req.file.filename}`
    : (req.body.image || undefined);

  // Parse JSON fields that may arrive as strings when using multipart/form-data
  let parsedSecondaryEffects = [];
  let parsedSwapOptions = [];
  try {
    if (Array.isArray(req.body.secondaryEffects)) {
      parsedSecondaryEffects = req.body.secondaryEffects;
    } else if (req.body.secondaryEffects) {
      parsedSecondaryEffects = JSON.parse(req.body.secondaryEffects);
    }
  } catch (err) {
    parsedSecondaryEffects = [];
  }
  try {
    if (Array.isArray(req.body.swapOptions)) {
      parsedSwapOptions = req.body.swapOptions;
    } else if (req.body.swapOptions) {
      parsedSwapOptions = JSON.parse(req.body.swapOptions);
    }
  } catch (err) {
    parsedSwapOptions = [];
  }

  // Basic validation
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Create item
    const item = new Item({
      name: name.trim(),
      description: description?.trim(),
      price: Number(price),
      image: image?.trim(),
      category,
      primaryEffect: category !== 'Passive' ? primaryEffect : undefined,
      primaryEffectValue: category !== 'Passive' ? Number(primaryEffectValue) : undefined,
      secondaryEffects: (parsedSecondaryEffects || []).map(se => ({
        effectType: se.effectType,
        value: Number(se.value)
      })),
      swapOptions: parsedSwapOptions && parsedSwapOptions.length ? parsedSwapOptions : undefined,
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

    res.status(201).json({ item });
  } catch (err) {
    console.error('[Add Bazaar Item] error:', err);
    res.status(500).json({ error: 'Failed to add item', details: err.message });
  }
});

// Helper functions (add these at the top of the file, after imports)
const getClassroomBalance = (user, classroomId) => {
  const classroomBalance = user.classroomBalances.find(cb => cb.classroom.toString() === classroomId.toString());
  return classroomBalance ? classroomBalance.balance : 0;
};

const updateClassroomBalance = (user, classroomId, newBalance) => {
  const index = user.classroomBalances.findIndex(cb => cb.classroom.toString() === classroomId.toString());
  if (index >= 0) {
    user.classroomBalances[index].balance = Math.max(0, newBalance);
  } else {
    user.classroomBalances.push({ classroom: classroomId, balance: Math.max(0, newBalance) });
  }
};

// Buy Item (updated for per-classroom balances)
router.post('/classroom/:classroomId/bazaar/:bazaarId/items/:itemId/buy', ensureAuthenticated, blockIfFrozen, async (req, res) => {
  const { classroomId, itemId } = req.params;
  const { quantity } = req.body;

  try {
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const user = await User.findById(req.user._id);
    const totalCost = item.price * quantity;

    // Use per-classroom balance for check and deduction
    const userBalance = getClassroomBalance(user, classroomId);
    if (userBalance < totalCost) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Create owned copies for quantity and collect summaries (unchanged, but now with per-classroom context)
    const ownedItems = [];
    for (let i = 0; i < quantity; i++) {
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
        owner: user._id
      });
      ownedItems.push(ownedItem);
    }

    // Deduct from per-classroom balance and record detailed transaction
    updateClassroomBalance(user, classroomId, userBalance - totalCost);
    user.transactions.push({
      amount: -totalCost,
      description: `Purchased ${quantity} x ${item.name}`,
      assignedBy: req.user._id,
      classroom: classroomId,  // Add classroom reference
      type: 'purchase',
      date: new Date(),
      // Include item summaries so frontend can render thumbnails/descriptions/effects
      items: ownedItems.map(i => ({
        id: i._id,
        name: i.name,
        description: i.description,
        price: i.price,
        category: i.category,
        primaryEffect: i.primaryEffect,
        primaryEffectValue: i.primaryEffectValue,
        secondaryEffects: i.secondaryEffects,
        image: i.image || null
      }))
    });

    await user.save();

    // Notify classroom about the purchase (unchanged)
    req.app.get('io').to(`classroom-${classroomId}`).emit('bazaar_purchase', {
      itemId,
      buyerId: req.user._id,
      newStock: item.stock
    });

    res.status(200).json({
      message: 'Purchase successful',
      balance: getClassroomBalance(user, classroomId),  // Return per-classroom balance
      items: ownedItems
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process purchase' });
  }
});

// Checkout multiple items (updated for per-classroom balances)
router.post('/checkout', ensureAuthenticated, blockIfFrozen, async (req, res) => {
  console.log("Received checkout request:", req.body);

  try {
    const { userId, items, classroomId } = req.body;  // Add classroomId to request body

    if (!userId || !items || !Array.isArray(items) || items.length === 0 || !classroomId) {
      console.error("Invalid checkout data:", { userId, items, classroomId });
      return res.status(400).json({ error: 'Invalid checkout data or missing classroomId' });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error("User not found:", userId);
      return res.status(404).json({ error: 'User not found' });
    }

    const total = items.reduce((sum, item) => sum + item.price, 0);
    console.log(`Calculated total: ${total}, User per-classroom balance: ${getClassroomBalance(user, classroomId)}`);

    // Use per-classroom balance for check
    const userBalance = getClassroomBalance(user, classroomId);
    if (userBalance < total) {
      console.error("Insufficient balance:", { balance: userBalance, total });
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Process each item (unchanged, but now with per-classroom context)
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

    // Deduct from per-classroom balance and create order/transaction
    updateClassroomBalance(user, classroomId, userBalance - total);

    const order = new Order({
      user: userId,
      items: ownedItems.map(i => i._id),
      total
    });
    await order.save();

    // Push a single detailed purchase transaction
    user.transactions.push({
      amount: -total,
      description: `Checkout: ${items.map(i => i.name).join(', ')}`,
      assignedBy: req.user._id,
      classroom: classroomId,  // Add classroom reference
      type: 'purchase',
      date: new Date(),
      items: ownedItems.map(i => ({
        id: i._id,
        name: i.name,
        description: i.description,
        price: i.price,
        category: i.category,
        primaryEffect: i.primaryEffect,
        primaryEffectValue: i.primaryEffectValue,
        secondaryEffects: i.secondaryEffects,
        image: i.image || null
      })),
      orderId: order._id
    });

    await user.save();

    console.log("Checkout successful for user:", userId, "order:", order._id);
    res.status(200).json({
      message: 'Purchase successful',
      items: ownedItems,
      balance: getClassroomBalance(user, classroomId),  // Return per-classroom balance
      orderId: order._id
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

// Get the balance for a user (updated for per-classroom)
router.get('/user/:userId/balance', async (req, res) => {
  try {
    const { classroomId } = req.query;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let balance = user.balance; // Default to global
    if (classroomId) {
      balance = getClassroomBalance(user, classroomId);
    }
    res.json({ balance });
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

// Allow frontend to fetch a saved order (populated items) by id
router.get('/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ error: 'Missing orderId' });
    const order = await Order.findById(orderId).populate('items');
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.status(200).json({ order });
  } catch (err) {
    console.error('Failed to fetch order:', err);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Get the inventory page for the user to see what items they have
router.get('/inventory/:userId', async (req, res) => {
  const { userId } = req.params;
  const items = await Item.find({ owner: userId });
  res.json({ items });
});

module.exports = router;
