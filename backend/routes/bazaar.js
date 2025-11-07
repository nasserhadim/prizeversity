const express = require('express');
const Bazaar = require('../models/Bazaar');
const Item = require('../models/Item');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const Discounts = require('../models/Discount');
const { ensureAuthenticated } = require('../config/auth');
const router = express.Router();
const Order = require('../models/Order');
const blockIfFrozen = require('../middleware/blockIfFrozen');
const upload = require('../middleware/upload'); // reuse existing upload middleware
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const { xpOnBitsSpentPurchase } = require('../middleware/xpHooks');
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
    const bazaar = await Bazaar.findOne({ classroom: classroomId }).populate({
      path: 'items',
      match: { deletedAt: null }, // only non-deleted items
    });
    // If no bazaar, return null with message so frontend knows it's not an error
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
router.post('/classroom/:classroomId/bazaar/:bazaarId/items', 
  ensureAuthenticated, 
  ensureTeacher, 
  upload.single('image'), 
  async (req, res) => { 
  const { bazaarId } = req.params;
  const { name, 
    description, 
    price, 
    category, 
    primaryEffect, 
    primaryEffectValue,
  } = req.body;
  console.log("1");
  // Prefer uploaded file, fallback to image URL
  const image = req.file
    ? `/uploads/${req.file.filename}`
    : (req.body.image || undefined);

  // Parse JSON fields that may arrive as strings when using multipart/form-data
  let parsedSecondaryEffects = [];
  let parsedSwapOptions = [];
  let parsedDuration = null;
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
  try {
    if (req.body.duration) {
      parsedDuration = req.body.duration;
    }
  } catch (err) {
    parsedDuration = null;
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
      primaryEffect: (category !== 'Passive' && category !== 'Mystery') ? primaryEffect : undefined,
      primaryEffectValue: (category !== 'Passive' && category !== 'Mystery') ? Number(primaryEffectValue) : undefined,

      secondaryEffects: (parsedSecondaryEffects || []).map(se => ({
        effectType: se.effectType,
        value: Number(se.value)
      })),

      swapOptions: parsedSwapOptions && parsedSwapOptions.length ? parsedSwapOptions : undefined,
      duration: parsedDuration || null,
      bazaar: bazaarId,
      kind: category === 'Mystery' ? 'mystery_box' : undefined,

    });
    if (item.category === 'Mystery' && item.kind !== 'mystery_box') {
      item.kind = 'mystery_box';
    }

    //allowing rewards to be passed on create from the teacher view 
    if (item.category === 'Mystery' ) {
      let rewardFromBody = [];
      try{ 
        if (Array.isArray(req.body.rewards)) {
          rewardFromBody = req.body.rewards;
        } else if (typeof req.body.rewards === 'string' && req.body.rewards.trim()) {
          rewardFromBody = JSON.parse(req.body.rewards);
        }
      } catch (err) {
        rewardFromBody = []; }

        if (rewardFromBody.length >0){
          //validating the item ID is the same bazaar and has a postive weight 
          const rewardIds = rewardFromBody.map(r => r.itemId);
          const count = await Item.countDocuments({
            _id: { $in: rewardIds },
            bazaar: bazaarId,
            deletedAt: null
          });
          if (count !== rewardIds.length) {
            return res.status(400).json({ error: 'Some rewards are invalid or not in this bazaar' });
          }
          for (const r of rewardFromBody) {
            if (!(Number(r.weight) > 0)) {
              return res.status(400).json({ error: 'Each reward weight must be > 0' });
            }
          }
          //asign rewards to item so they save
          item.metadata = item.metadata || {};
          item.metadata.rewards = rewardFromBody.map(r => ({
            itemId: r.itemId,
            weight: Number(r.weight)
          }));


        } else {
          //if teacher did not pick any rewards, this will auto add all regular items
        const regulars = await Item.find({
          bazaar: bazaarId,
          deletedAt: null,
          $or: [{ kind: { $ne: 'mystery_box' } }, { kind: { $exists: false } }],
          category: { $ne: 'Mystery' }
        }).select('_id').lean();

        if (regulars.length > 0) {
          item.metadata = item.metadata || {};
          item.metadata.rewards = regulars.map(r => ({ itemId: r._id, weight: 1 }));
        }
        // If there are no regular items yet, the buy/checkout guards you added will still prevent purchase.
      }          
    }
    console.log('[CreateItem] about to save:', { category: item.category, kind: item.kind });

    await item.save();

    // Update bazaarS
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
    return res.status(500).json({ error: err.message || 'Failed to add item' });

  }
});

// (JA) List items in a bazaar with optional category and keyword filters
router.get('/classroom/:classroomId/bazaar/:bazaarId/items', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId, bazaarId } = req.params;
    const { category, q } = req.query;

    // Ensure this bazaar actually belongs to this classroom (prevents cross-class leaks)
    const bazaar = await Bazaar.findOne({ _id: bazaarId, classroom: classroomId })
      .select('_id')
      .lean();
    if (!bazaar) {
      return res.status(404).json({ error: 'Bazaar not found for this classroom' });
    }

    const ALLOWED = ['Attack', 'Defend', 'Utility', 'Passive', 'Mystery'];
    const filter = { bazaar: bazaar._id, deletedAt: null }; // only non-deleted items, and hides soft deleted

    if (category && ALLOWED.includes(category)) {
      filter.category = category;
    }

    if (q && q.trim()) {
      const rx = new RegExp(escapeRx(q.trim()), 'i'); // escape user input
      filter.$or = [{ name: rx }, { description: rx }];
    }

    const items = await Item.find(filter).lean();
    res.json({ items, count: items.length });
  } catch (err) {
    console.error('[List Bazaar Items] error:', err);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Edit Bazaar Item (teacher only)
router.patch(
  '/classroom/:classroomId/bazaar/:bazaarId/items/:itemId',
  ensureAuthenticated,
  ensureTeacher,
  upload.single('image'),
  async (req, res) => {
    const { classroomId, bazaarId, itemId } = req.params;
    try {
// Ensure this bazaar actually belongs to this classroom (prevents cross-class leaks). ensures verivication teacher owns this classroom
      const classroom = await Classroom.findById(classroomId).select('teacher'); // only need teacher field stops one teacher from editing another classroom 
      if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
      if (classroom.teacher.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Only the teacher can edit items' });
      }   
      const item = await Item.findById(itemId);
      if (!item) return res.status(404).json({ error: 'Item not found' });

// Parse JSON fields that may arrive as strings when using multipart/form-data
      const {
        name,
        description,
        price,
        category,
        primaryEffect,
        primaryEffectValue,
        secondaryEffects,
        swapOptions
      } = req.body;
 
      if (req.file) {
        item.image = `/uploads/${req.file.filename}`;
      } else if (req.body.image !== undefined) {
        item.image = req.body.image || item.image;
      }
 
      if (name !== undefined) item.name = name;
      if (description !== undefined) item.description = description;
      if (price !== undefined) item.price = Number(price);
      if (category !== undefined) item.category = category;
      if (primaryEffect !== undefined) item.primaryEffect = primaryEffect;
      if (primaryEffectValue !== undefined) item.primaryEffectValue = Number(primaryEffectValue);

      //parsing json arrays if strings (multipart)
        try {
        item.secondaryEffects = secondaryEffects ? JSON.parse(secondaryEffects) : item.secondaryEffects;
      } catch (e) { /* ignore parse error, assume already array */ }
 
      try {
        item.swapOptions = swapOptions ? JSON.parse(swapOptions) : item.swapOptions;
      } catch (e) { /* ignore parse error */ }
 
      await item.save();
      // Notify classroom clients item updated
      req.app.get('io')?.to(`classroom-${classroomId}`).emit('bazaar_item_updated', { item });
 
      res.json({ item });
    } catch (err) {
      console.error('[Edit Bazaar Item] error:', err);
      res.status(500).json({ error: 'Failed to update item', details: err.message });
    }
  }
);


// Set rewards for a Mystery Box (teacher only)
router.put(
  '/classroom/:classroomId/bazaar/:bazaarId/items/:itemId/rewards',
  ensureAuthenticated,
  ensureTeacher,
  async (req, res) => {
    const { classroomId, bazaarId, itemId } = req.params;
    const { rewards } = req.body; // [{ itemId, weight }, ...]

    try {
      // Verify teacher owns this classroom
      const classroom = await Classroom.findById(classroomId).select('teacher');
      if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
      if (String(classroom.teacher) !== String(req.user._id)) {
        return res.status(403).json({ error: 'Only the teacher can configure rewards' });
      }

      // Box must exist, belong to this bazaar, and be a Mystery box
      const box = await Item.findOne({ _id: itemId, bazaar: bazaarId });
      if (!box) return res.status(404).json({ error: 'Mystery box not found' });
      if (box.category !== 'Mystery' || box.kind !== 'mystery_box') {
        return res.status(400).json({ error: 'Item is not a mystery box' });
      }

      if (!Array.isArray(rewards) || rewards.length === 0) {
        return res.status(400).json({ error: 'Provide rewards as a non-empty array' });
      }

      // Validate rewards: positive weight and reward items exist
      const rewardIds = rewards.map(r => r.itemId);
      const foundRewards = await Item.find({ _id: { $in: rewardIds }, bazaar: bazaarId })
        .select('_id category');
      const foundSet = new Set(foundRewards.map(r => String(r._id)));
      for (const r of rewards) {
        if (!foundSet.has(String(r.itemId))) {
          return res.status(400).json({ error: `Reward item not found in this bazaar: ${r.itemId}` });
        }
        if (!(Number(r.weight) > 0)) {
          return res.status(400).json({ error: 'Each reward weight must be > 0' });
        }
      }

      box.metadata = box.metadata || {};
      box.metadata.rewards = rewards.map(r => ({
        itemId: r.itemId,
        weight: Number(r.weight)
      }));

      await box.save();
      res.json({ box });
    } catch (err) {
      console.error('[Set Mystery Rewards] error:', err);
      res.status(500).json({ error: 'Failed to set rewards', details: err.message });
    }
  }
);
 
// Delete Bazaar Item (teacher only)
router.delete(
  '/classroom/:classroomId/bazaar/:bazaarId/items/:itemId',
  ensureAuthenticated,
  ensureTeacher,
  async (req, res) => {
    const { classroomId, bazaarId, itemId } = req.params;
    try {
      // Verify teacher owns this classroom
      const classroom = await Classroom.findById(classroomId).select('teacher');
      if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
      if (classroom.teacher.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Only the teacher can delete items' });
      }
 
      const item = await Item.findById(itemId);
      if (!item) return res.status(404).json({ error: 'Item not found' });
 
      
      //soft delete the item, so not perfmently rmeove 
      await Item.findByIdAndUpdate(itemId, { deletedAt: new Date() });
 
      // Remove reference from bazaar
      await Bazaar.findByIdAndUpdate(bazaarId, { $pull: { items: itemId } }); // remove item from bazaar's items array
 
      // Notify classroom clients that the item was deleted so frontends can remove it from carts
      req.app.get('io')?.to(`classroom-${classroomId}`).emit('bazaar_item_deleted', { itemId });
 
      res.json({ message: 'Item deleted', itemId });
    } catch (err) {
      console.error('[Delete Bazaar Item] error:', err);
      res.status(500).json({ error: 'Failed to delete item', details: err.message });
    }
  }
);



// Helper functions
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

    //guarding, block purchase of a mystery box with no prizes 
    if (item.kind === 'mystery_box' || item.category === 'Mystery') {
      const pool = Array.isArray(item.metadata?.rewards) ? item.metadata.rewards : [];
      if (!pool.some(r => Number(r.weight) > 0)) {
        return res.status(409).json({
          code: 'EMPTY_REWARDS',
          error: 'This Mystery Box has no prizes configured yet.'
        });
      }
    }

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
      const ownedData = {
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
      };

      //if this is a mystery box, we need to draw a reward now and create that as the owned item instead
      if (item.kind === 'mystery_box' || item.category === 'Mystery') {
        ownedData.kind = 'mystery_box';
        ownedData.category = 'Mystery';
        ownedData.metadata = { ...item.metadata || {} }; //copies metadata.rewards
        ownedData.openedAt = null; // not opened yet
      }
      const ownedItem = await Item.create(ownedData);
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

    //award xp for bit spents on purchase
    try {
      const spentBits = totalCost;
      await xpOnBitsSpentPurchase({
        userId: req.user._id,
        classroomId,
        spentBits,
        bitsMode: 'final'
      });
    } catch (xpErr) {
      console.warn('[XP] Failed to award XP for purchase:', xpErr.message);
    }

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
  console.log(`[Checkout] User ${req.user._id} attempting checkout`);
  console.log("Received checkout request:", req.body);

  try {
    const { userId, items, classroomId } = req.body;  // Add classroomId to request body

    if (!userId || !items || !Array.isArray(items) || items.length === 0 || !classroomId) {
      console.error("Invalid checkout data:", { userId, items, classroomId });
      return res.status(400).json({ error: 'Invalid checkout data or missing classroomId' });
    }
// Resolve actual items from DB and detect any missing/deleted items
    const resolved = await Promise.all(items.map(it => Item.findById(it._id || it.id)));
    const missingIndexes = [];
    const missingIds = [];
    const resolvedItems = [];
    resolved.forEach((it, idx) => {
      if (!it) {
        missingIndexes.push(idx);
        missingIds.push(items[idx]?._id || items[idx]?.id || null);
      } else {
        resolvedItems.push(it);
      }
    }); //collectes missig and keeps existing
 
    if (missingIds.length > 0) {
      // Inform client that items were removed so frontend can remove them from the cart
      return res.status(400).json({
        error: 'Some items were removed from the bazaar and cannot be purchased',
        removed: missingIds.filter(Boolean)
      });
    }

    //blocking any mystery boxes without rewards
    const emptyMystery = resolvedItems.filter(it =>
      (it.kind === 'mystery_box' || it.category === 'Mystery') &&
      !(Array.isArray(it.metadata?.rewards) && it.metadata.rewards.some(r => Number(r.weight) > 0))
    );

    if (emptyMystery.length > 0) {
      return res.status(409).json({
        code: 'EMPTY_REWARDS',
        error: 'One or more Mystery Boxes have no prizes configured.',
        items: emptyMystery.map(i => i._id) // let frontend remove/flag these
      });
    }

    const user = await User.findById(userId).select('balance classroomBalances classroomFrozen transactions');

    
    if (!user) {
      console.error("User not found:", userId);
      return res.status(404).json({ error: 'User not found' });
    }

    // Initialize transactions array if it doesn't exist
    if (!user.transactions) {
      user.transactions = [];
    }

    // Additional frozen check (backup to middleware) — check classroom-scoped freeze
    const frozenHere = classroomId
      ? Array.isArray(user?.classroomFrozen) && user.classroomFrozen.some(cf => String(cf.classroom) === String(classroomId))
      : Array.isArray(user?.classroomFrozen) && user.classroomFrozen.length > 0;
    console.log(`[Checkout] User ${userId} frozenHere: ${frozenHere}`);
    
    if (frozenHere) {
      const SiphonRequest = require('../models/SiphonRequest');
      const activeSiphon = await SiphonRequest.findOne({
        targetUser: userId,
        status: { $in: ['pending', 'group_approved'] }
      });

      if (activeSiphon) {
        return res.status(403).json({ 
          error: 'Your account is frozen due to an active siphon request. Cannot complete checkout.',
          siphonActive: true
        });
      }
    }

    // finds the discounts
    const discounts = await Discounts.find(
        { classroom: classroomId, owner: userId}
    );
    // determines the total discount
    let percent = 0;
    console.log("Discounts: ", discounts.length)
    if (discounts.length)
    {
        const combined = discounts.reduce(
            (acc, d) => acc * (1 - (d.discountPercent || 0) / 100), 1
        );
        percent = (1 - combined) * 100;
    }
    console.log("Discount applied: ", percent);



    //const pct = Number(user.discountPercent) || 0;
    //const discountMultiplier = pct > 0 ? (1 - pct / 100) : 1;
    //replaced const total 
    const total = Math.ceil(resolvedItems.reduce((sum, item) => sum + item.price, 0) * (1 - percent / 100));

    console.log(`Calculated total: ${total}, User per-classroom balance: ${getClassroomBalance(user, classroomId)}`);

    // Use per-classroom balance for check
    const userBalance = getClassroomBalance(user, classroomId);
    if (userBalance < total) {
      console.error("Insufficient balance:", { balance: userBalance, total });
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Process each item (unchanged, but now with per-classroom context)
    const ownedItems = [];
    //changed loop condition 
    for (const itemData of resolvedItems) {
      const item = await Item.findById(itemData._id || itemData.id);
      if (!item) {
        console.error("Item not found:", itemData._id);
        continue;
      }

      const ownedData = {
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
        bazaar: item.bazaar,
        category: item.category,
        primaryEffect: item.primaryEffect,
        primaryEffectValue: item.primaryEffectValue,
        secondaryEffects: item.secondaryEffects,
        duration: item.duration,
        owner: userId
      };

      if (item.kind === 'mystery_box' || item.category === 'Mystery'){
        ownedData.kind = 'mystery_box';
        ownedData.category = 'Mystery';
        ownedData.metadata = { ...item.metadata || {} };
        ownedData.openedAt = null; // not opened yet
      }
      const ownedItem = await Item.create(ownedData);
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
      //changed description so it shows all items being checked out
      description: `Checkout: ${resolvedItems.map(i => i.name).join(', ')}`,
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
        duration: i.duration,
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

// Get the discounts for a user (updated for per-classroom)
router.get('/user/:userId/discounts', async (req, res) => {
  try {
    const { classroomId } = req.query;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let discounts = []; // Default to empty set
    let num = 0; // default to no discounts
    if (classroomId) {
      discounts = await  discounts.find({owner : req.params.userId});
    }
    res.json({ discounts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});


// Retrieve all orders for a user *which must be the user themself or a teacher/admin (admins limited to their classrooms)
router.get('/orders/user/:userId', ensureAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;

    // Only the user themself, teachers, or admins may proceed
    if (req.user._id.toString() !== userId && !['teacher', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    let orders;

    // TEACHER: same behavior as before — teacher sees orders for their own classrooms
    if (req.user.role === 'teacher' && req.user._id.toString() !== userId) {
      const Classroom = require('../models/Classroom');
      const teacherClassrooms = await Classroom.find({ teacher: req.user._id }).select('_id');
      const teacherClassroomIds = teacherClassrooms.map(c => c._id);

      const allOrders = await Order.find({ user: userId })
        .populate('items')
        .populate({
          path: 'items',
          populate: {
            path: 'bazaar',
            populate: {
              path: 'classroom',
              select: '_id name code'
            }
          }
        })
        .sort({ createdAt: -1 });

      // Filter orders to only include those from teacher's classrooms
      orders = allOrders.filter(order =>
        order.items.some(item => {
          const classroomId = item.bazaar?.classroom?._id;
          return classroomId && teacherClassroomIds.some(tcId => tcId.equals(classroomId));
        })
      );

    // ADMIN/TA: allow viewing student's orders only for classrooms where the admin/TA is a member
    } else if (req.user.role === 'admin' && req.user._id.toString() !== userId) {
      const Classroom = require('../models/Classroom');

      // Find classrooms where this admin/TA is a member (i.e., in classroom.students)
      const adminClassrooms = await Classroom.find({ students: req.user._id }).select('_id');
      const adminClassroomIds = adminClassrooms.map(c => c._id);

      // Fetch all orders for the target user, then filter by the admin's classroom membership
      const allOrders = await Order.find({ user: userId })
        .populate('items')
        .populate({
          path: 'items',
          populate: {
            path: 'bazaar',
            populate: {
              path: 'classroom',
              select: '_id name code'
            }
          }
        })
        .sort({ createdAt: -1 });

      orders = allOrders.filter(order =>
        order.items.some(item => {
          const classroomId = item.bazaar?.classroom?._id;
          return classroomId && adminClassroomIds.some(acId => acId.equals(classroomId));
        })
      );

    } else {
      // Self (student) or admin/teacher viewing own orders: return all orders for that user
      orders = await Order.find({ user: userId })
        .populate('items')
        .populate({
          path: 'items',
          populate: {
            path: 'bazaar',
            populate: {
              path: 'classroom',
              select: '_id name code'
            }
          }
        })
        .sort({ createdAt: -1 });
    }

    res.json(orders);
  } catch (err) {
    console.error('Failed to fetch orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

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

//open a purchased mustery box, in the inventory 
router.post('/inventory/:ownedId/open', ensureAuthenticated, async (req, res) => {
  const { ownedId } = req.params;
  //find the owned item and validate it's a mystery box
  const box = await Item.findOne({ _id: ownedId, owner: req.user._id})
  .setOptions({ withDeleted: true }); // allow finding soft-deleted (opened) boxes

  if (!box) return res.status(404).json({ error: 'Box not found' });

  const isMystery = box.category === 'Mystery' || box.kind === 'mystery_box';

  if (!isMystery) return res.status(400).json({ error: 'Not a mystery box' });
  if (box.openedAt) return res.status(200).json({ ok: true, alreadyOpened: true, message: 'Box already opened' });
  // Atomically mark this box as opened; only the first request will succeed
  const claim = await Item.updateOne(
    { _id: ownedId, owner: req.user._id, openedAt: null },
    { $set: { openedAt: new Date(), deletedAt: new Date() } }
  );

  if (claim.modifiedCount === 0) {
    // A prior request already opened it (likely a double click); treat as success so UI doesn't show an error
    return res.status(200).json({ ok: true, alreadyOpened: true, message: 'Box already opened' });
  }

  /// pick a reward from metadata.rewards (weighted)
  const rewards = Array.isArray(box.metadata?.rewards) ? box.metadata.rewards : [];
  const totalW = rewards.reduce((s, r) => s + Number(r.weight || 0), 0);
  if (totalW <= 0) return res.status(400).json({ error: 'No rewards configured for this box' });

  let roll = Math.random() * totalW;
  let picked = rewards[0];
  for (const r of rewards) {
    roll -= Number(r.weight || 0);
    if (roll <= 0) { picked = r; break; }
  }
  //create an owned copy of the awarded item
  const base = await Item.findById(picked.itemId).setOptions({ withDeleted: true });
  if (!base) return res.status(400).json({ error: 'Configured reward item is missing' });
  const awardedItemOwned = await Item.create({
    name: base.name,
    description: base.description,
    price: base.price,
    image: base.image,
    bazaar: base.bazaar,
    category: base.category,
    primaryEffect: base.primaryEffect,
    primaryEffectValue: base.primaryEffectValue,
    secondaryEffects: base.secondaryEffects,
    owner: req.user._id
  });
  // mark box opened + hide it (soft delete)
  await Item.findByIdAndUpdate(ownedId, { openedAt: new Date(), deletedAt: new Date() });
  return res.json({
    ok: true,
    message: 'Box opened',
    reward: { id: base._id, name: base.name },
    awardedItemOwned,
    item: awardedItemOwned // for backward compatibility
  });
});
//test test tes


// Get the inventory page for the user to see what items they have
router.get('/inventory/:userId', async (req, res) => {
  const { userId } = req.params;
  const { classroomId } = req.query; // Add classroom filter
  
  try {
    let items;
    if (classroomId) {
      // Filter items to only those from the specified classroom's bazaar
      items = await Item.find({ owner: userId })
        .populate({
          path: 'bazaar',
          populate: {
            path: 'classroom',
            select: '_id'
          }
        });
      
      // Filter to only items from the specified classroom
      items = items.filter(item => 
        item.bazaar && 
        item.bazaar.classroom && 
        item.bazaar.classroom._id.toString() === classroomId.toString()
      );
    } else {
      // If no classroom specified, return all items (existing behavior)
      items = await Item.find({ owner: userId });
    }
    
    res.json({ items });
  } catch (err) {
    console.error('Failed to fetch inventory:', err);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});
// below was deleted because its above.

// Delete Bazaar
router.delete(
    '/classroom/:classroomId/bazaar/delete',
    ensureAuthenticated,
    ensureTeacher,
    async (req, res) => {
        const { classroomId} = req.params;

    try {
        // finds bazaar connected to classroom - errors if not found
        const bazaar = await Bazaar.findOne({ classroom: classroomId });
        if (!bazaar) {
            return res.status(404).json({ error: 'Bazaar not found' });
        }
        // deletes bazaar items
        //if (bazaar.items.length > 0) {
           // await Item.deleteMany({ _id: { $in: bazaar.items } });
        //} commented this out on 10/16 for testing

        //soft delete all items in the bazaar so history is kept
        if (bazaar.items.length > 0) {
          await Item.updateMany(
            { _id: { $in: bazaar.items } },
            { deletedAt: new Date() }
          );
        }
            

        //deletes bazaar
        await Bazaar.deleteOne({ classroom: classroomId });
        res.status(200).json({ message: 'Bazaar deleted successfully' });
    
  } catch (error) {
    res.status(500).json({ error : 'Something went wrong'});
  }
});

// Edit Bazaar
router.put(
    '/classroom/bazaar/edit/:bazaarId',
    ensureAuthenticated,
    ensureTeacher,
    upload.single('image'),
    async (req, res) => {
        const { name, description, } = req.body;
        const { bazaarId } = req.params;
        const image = req.file ? `/uploads/${req.file.filename}` : (req.body.image !== undefined ? req.body.image : undefined);

        try {
            // finds bazaar connected to classroom - errors if not found
            const bazaar = await Bazaar.findById(bazaarId);
            if (!bazaar) {
                return res.status(404).json({ error: `Bazaar not found ${bazaarId}` });
            }
            // determines changes to be made - errors if no changes
            const changes = {};
            if (name !== undefined && bazaar.name !== name) changes.name = name;
            if (description !== undefined && bazaar.description !== description) changes.description = description;
            if (image !== undefined && bazaar.image !== image) changes.image = image;
            //return res.status(999).json({ message: 'No breaks until here' });
            if (Object.keys(changes).length === 0) {
                return res.status(400).json({ message: 'No changes were made' });
            }
            Object.assign(bazaar, changes);
            await bazaar.save();

            res.status(200).json(bazaar);
        } catch (error) {
            res.status(500).json({ error : 'Something went wrong'});
        }
});


module.exports = router;
