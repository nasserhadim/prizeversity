const express = require('express');
const Bazaar = require('../models/Bazaar');
const Item = require('../models/Item');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const { awardXP } = require('../utils/awardXP');
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
  const image = req.file
    ? `/uploads/${req.file.filename}`
    : (req.body.image || undefined);
  
  // Parse JSON fields
  let parsedSecondaryEffects = [];
  let parsedSwapOptions = [];
  let parsedMysteryBoxConfig = null;
  
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
  
  // Parse mystery box config if category is MysteryBox
  if (category === 'MysteryBox') {
    try {
      if (typeof req.body.mysteryBoxConfig === 'object') {
        parsedMysteryBoxConfig = req.body.mysteryBoxConfig;
      } else if (req.body.mysteryBoxConfig) {
        parsedMysteryBoxConfig = JSON.parse(req.body.mysteryBoxConfig);
      }
      
      // ADD: Log to see what we're receiving
      console.log('[Create Item] Received mysteryBoxConfig:', JSON.stringify(parsedMysteryBoxConfig, null, 2));
      
    } catch (err) {
      return res.status(400).json({ error: 'Invalid mysteryBoxConfig format' });
    }
  }

  // Basic validation
  if (!name || !price || !category) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Mystery Box specific validation
  if (category === 'MysteryBox') {
    if (!parsedMysteryBoxConfig || !parsedMysteryBoxConfig.itemPool) {
      return res.status(400).json({ error: 'Mystery box must have an item pool' });
    }

    const itemPool = parsedMysteryBoxConfig.itemPool;
    
    // ADD: Log the itemPool
    console.log('[Create Item] Item pool to save:', JSON.stringify(itemPool, null, 2));
    
    // Check for duplicates
    const itemIds = itemPool.map(p => p.item.toString());
    const uniqueItemIds = new Set(itemIds);
    if (itemIds.length !== uniqueItemIds.size) {
      return res.status(400).json({ 
        error: 'Each item can only be added once to the mystery box. Please remove duplicates.' 
      });
    }

    // Verify drop chances sum to 100%
    const totalChance = itemPool.reduce((sum, item) => sum + Number(item.baseDropChance), 0);
    if (Math.abs(totalChance - 100) > 0.01) {
      return res.status(400).json({ 
        error: `Drop chances must sum to 100% (currently ${totalChance.toFixed(2)}%)` 
      });
    }

    // Verify all items exist in the bazaar and are not mystery boxes
    const Item = require('../models/Item');
    const items = await Item.find({ 
      _id: { $in: itemIds },
      bazaar: bazaarId,
      category: { $ne: 'MysteryBox' } // Exclude mystery boxes from pool
    });
    
    if (items.length !== itemIds.length) {
      return res.status(400).json({ 
        error: 'One or more items do not exist in this bazaar or are invalid (mystery boxes cannot contain other mystery boxes)' 
      });
    }
  }

  try {
    // Create item
    const itemData = {
      name: name.trim(),
      description: description?.trim(),
      price: Number(price),
      image: image?.trim(),
      category,
      bazaar: bazaarId
    };

    // Add category-specific fields
    if (category === 'MysteryBox') {
      console.log('[Create Item] parsedMysteryBoxConfig:', parsedMysteryBoxConfig);
      console.log('[Create Item] itemPool from config:', parsedMysteryBoxConfig.itemPool);
      
      itemData.mysteryBoxConfig = {
        luckMultiplier: Number(parsedMysteryBoxConfig.luckMultiplier || 1.5),
        pityEnabled: !!parsedMysteryBoxConfig.pityEnabled,
        guaranteedItemAfter: Number(parsedMysteryBoxConfig.guaranteedItemAfter || 10),
        pityMinimumRarity: parsedMysteryBoxConfig.pityMinimumRarity || 'rare',
        maxOpensPerStudent: parsedMysteryBoxConfig.maxOpensPerStudent ? Number(parsedMysteryBoxConfig.maxOpensPerStudent) : null,
        itemPool: parsedMysteryBoxConfig.itemPool.map(p => ({
          item: p.item,
          rarity: p.rarity,
          baseDropChance: Number(p.baseDropChance)
        }))
      };
      
      // ADD: Log what we're about to save
      console.log('[Create Item] Saving mysteryBoxConfig:', JSON.stringify(itemData.mysteryBoxConfig, null, 2));
    } else if (category !== 'Passive') {
      itemData.primaryEffect = primaryEffect;
      itemData.primaryEffectValue = Number(primaryEffectValue);
    }

    // Add secondary effects and swap options for all categories except MysteryBox
    if (category !== 'MysteryBox') {
      itemData.secondaryEffects = (parsedSecondaryEffects || []).map(se => ({
        effectType: se.effectType,
        value: Number(se.value)
      }));
      // ALWAYS persist a canonical array (may be empty) so later purchases have the field
      itemData.swapOptions = Array.isArray(parsedSwapOptions) ? parsedSwapOptions : [];
    }

    const item = new Item(itemData);
    
    // ADD: Log before save
    console.log('[Create Item] Item before save:', JSON.stringify(item.mysteryBoxConfig, null, 2));
    
    await item.save();
    
    // ADD: Log after save
    console.log('[Create Item] Item after save:', JSON.stringify(item.mysteryBoxConfig, null, 2));

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
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// UPDATE bazaar item (teacher)
router.put(
  '/classroom/:classroomId/bazaar/:bazaarId/items/:itemId',
  ensureAuthenticated,
  ensureTeacher,
  upload.single('image'),
  async (req, res) => {
    const { itemId } = req.params;
    try {
      const item = await Item.findById(itemId);
      if (!item) return res.status(404).json({ error: 'Item not found' });

      // Accept basic fields
      const up = {};
      ['name','description','price','primaryEffect','primaryEffectValue','category','image']
        .forEach(f => {
          if (typeof req.body[f] !== 'undefined') {
            up[f] = f === 'price' || f === 'primaryEffectValue'
              ? Number(req.body[f])
              : req.body[f].trim?.() || req.body[f];
          }
        });

      if (req.file) {
        up.image = `/uploads/${req.file.filename}`;
      }

      // Parse arrays if provided
      if (req.body.secondaryEffects) {
        try { up.secondaryEffects = JSON.parse(req.body.secondaryEffects); } catch {}
      }
      if (req.body.swapOptions) {
        try { up.swapOptions = JSON.parse(req.body.swapOptions); } catch {}
      }
      if (req.body.mysteryBoxConfig) {
        try { up.mysteryBoxConfig = JSON.parse(req.body.mysteryBoxConfig); } catch {}
      }

      Object.assign(item, up);
      await item.save();

      // Broadcast change
      req.app.get('io').to(`classroom-${req.params.classroomId}`).emit('bazaar_item_updated', {
        itemId: item._id,
        item
      });

      res.json({ item });
    } catch (e) {
      console.error('[Update Item] error', e);
      res.status(500).json({ error: 'Failed to update item' });
    }
  }
);

// DELETE bazaar item (teacher)
router.delete(
  '/classroom/:classroomId/bazaar/:bazaarId/items/:itemId',
  ensureAuthenticated,
  ensureTeacher,
  async (req, res) => {
    const { bazaarId, itemId, classroomId } = req.params;
    try {
      const item = await Item.findById(itemId);
      if (!item) return res.status(404).json({ error: 'Item not found' });

      await Item.findByIdAndDelete(itemId);
      // remove from bazaar.items array
      await Bazaar.findByIdAndUpdate(bazaarId, { $pull: { items: itemId } });

      req.app.get('io').to(`classroom-${classroomId}`).emit('bazaar_item_deleted', {
        itemId
      });

      res.json({ deleted: true });
    } catch (e) {
      console.error('[Delete Item] error', e);
      res.status(500).json({ error: 'Failed to delete item' });
    }
  }
);

// Add helper near top of file (or in a utils file)
function normalizeSwapOptionsServer(swapOptions) {
  if (!swapOptions) return [];
  let arr = Array.isArray(swapOptions) ? swapOptions : [];
  if (typeof swapOptions === 'string') {
    try { arr = JSON.parse(swapOptions); } catch (e) {
      arr = swapOptions.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  const canonical = (s) => {
    if (!s) return null;
    const val = String(s).toLowerCase().trim();
    if (['bits','bit','b'].includes(val)) return 'bits';
    if (['multiplier','mult','mul','x'].includes(val)) return 'multiplier';
    if (['luck','l'].includes(val)) return 'luck';
    return null;
  };
  const set = new Set();
  arr.forEach(it => {
    if (!it) return;
    if (typeof it === 'string' || typeof it === 'number') {
      const c = canonical(it);
      if (c) set.add(c);
      return;
    }
    if (typeof it === 'object') {
      ['attribute','from','to'].forEach(k => {
        if (it[k]) {
          const c = canonical(it[k]);
          if (c) set.add(c);
        }
      });
      ['bits','multiplier','luck'].forEach(k => {
        if (it[k] === true || it[k] === 'true') set.add(k);
      });
    }
  });
  return Array.from(set);
}

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
    // POPULATE itemPool.item for mystery boxes
    const item = await Item.findById(itemId).populate('mysteryBoxConfig.itemPool.item');
    if (!item) return res.status(404).json({ error: 'Item not found' });

    console.log('[Buy Item] Item after populate:', JSON.stringify({
      category: item.category,
      hasMysteryBoxConfig: !!item.mysteryBoxConfig,
      itemPoolLength: item.mysteryBoxConfig?.itemPool?.length,
      firstPoolItem: item.mysteryBoxConfig?.itemPool?.[0]
    }, null, 2));

    const user = await User.findById(req.user._id);
    const totalCost = item.price * quantity;

    // Use per-classroom balance for check and deduction
    const userBalance = getClassroomBalance(user, classroomId);
    if (userBalance < totalCost) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Create owned copies for quantity and collect summaries
    const ownedItems = [];
    for (let i = 0; i < quantity; i++) {
      const ownedItemData = {
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
        bazaar: item.bazaar,
        category: item.category,
        primaryEffect: item.primaryEffect,
        primaryEffectValue: item.primaryEffectValue,
        secondaryEffects: item.secondaryEffects,
        // Ensure owned copy always stores canonical swapOptions (string[] of 'bits'|'multiplier'|'luck')
        swapOptions: normalizeSwapOptionsServer(item.swapOptions),
        owner: req.user._id
      };
      console.log('[Buy Item] ownedItemData.swapOptions ->', ownedItemData.swapOptions);

      // Copy mysteryBoxConfig for MysteryBox items
      if (item.category === 'MysteryBox' && item.mysteryBoxConfig) {
        console.log('[Buy Item] Copying mysteryBoxConfig:', JSON.stringify({
          hasItemPool: !!item.mysteryBoxConfig.itemPool,
          itemPoolLength: item.mysteryBoxConfig.itemPool?.length
        }, null, 2));

        ownedItemData.mysteryBoxConfig = {
          luckMultiplier: item.mysteryBoxConfig.luckMultiplier,
          pityEnabled: item.mysteryBoxConfig.pityEnabled,
          guaranteedItemAfter: item.mysteryBoxConfig.guaranteedItemAfter,
          pityMinimumRarity: item.mysteryBoxConfig.pityMinimumRarity,
          maxOpensPerStudent: item.mysteryBoxConfig.maxOpensPerStudent,
          itemPool: item.mysteryBoxConfig.itemPool.map(p => ({
            item: p.item._id || p.item, // Handle both populated and non-populated
            rarity: p.rarity,
            baseDropChance: p.baseDropChance
          }))
        };

        console.log('[Buy Item] Created mysteryBoxConfig with itemPool:', 
          ownedItemData.mysteryBoxConfig.itemPool.length, 'items');
      }

      const ownedItem = await Item.create(ownedItemData);
      
      console.log('[Buy Item] Owned item created:', JSON.stringify({
        id: ownedItem._id,
        category: ownedItem.category,
        hasMysteryBoxConfig: !!ownedItem.mysteryBoxConfig,
        itemPoolLength: ownedItem.mysteryBoxConfig?.itemPool?.length
      }, null, 2));
      
      ownedItems.push({
        id: ownedItem._id,
        name: ownedItem.name,
        description: ownedItem.description,
        price: ownedItem.price,
        category: ownedItem.category,
        image: ownedItem.image || null
      });
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

    // CHANGED: Store item details in order metadata so they persist after item deletion
    const order = new Order({
      user: req.user._id,
      items: ownedItems.map(oi => oi.id),
      total: totalCost,
      classroom: classroomId,
      type: 'purchase',
      metadata: {
        itemDetails: ownedItems.map(oi => ({
          _id: oi.id,
          name: oi.name,
          description: oi.description,
          price: oi.price,
          category: oi.category,
          image: oi.image
        }))
      }
    });
    await order.save();

    // ADD: award XP for spending bits
    try {
      const cls = await Classroom.findById(classroomId).select('xpSettings');
      if (cls?.xpSettings?.enabled) {
        const xpRate = cls.xpSettings.bitsSpent || 0;
        // final vs base: for purchases, base == final unless you later apply in-route discounts
        const xpBits = Math.abs(totalCost);
        const xpToAward = xpBits * xpRate;
        if (xpToAward > 0) {
          await awardXP(user._id, classroomId, xpToAward, 'spending bits (bazaar purchase)', cls.xpSettings);
        }
      }
    } catch (e) {
      console.warn('[bazaar] failed to award XP (buy):', e);
    }

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
  console.log(`[Checkout] User ${req.user._id} attempting checkout`);
  console.log("Received checkout request:", req.body);

  try {
    const { userId, items, classroomId } = req.body;  // Add classroomId to request body

    if (!userId || !items || !Array.isArray(items) || items.length === 0 || !classroomId) {
      console.error("Invalid checkout data:", { userId, items, classroomId });
      return res.status(400).json({ error: 'Invalid checkout data or missing classroomId' });
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
      const item = await Item.findById(itemData._id || itemData.id)
        .populate('mysteryBoxConfig.itemPool.item'); // ADD: populate for mystery boxes
      
      if (!item) {
        console.error("Item not found:", itemData._id);
        continue;
      }

      const ownedItemData = {
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
        bazaar: item.bazaar,
        category: item.category,
        primaryEffect: item.primaryEffect,
        primaryEffectValue: item.primaryEffectValue,
        secondaryEffects: item.secondaryEffects,
        // Ensure checkout-created owned item preserves canonical swapOptions (defensive checks)
        swapOptions: normalizeSwapOptionsServer(
          item.swapOptions ||
          item.swap_options ||
          (item.metadata && item.metadata.swapOptions) ||
          []
        ),
        owner: userId
      };
      
      console.log('[Checkout] ownedItemData.swapOptions ->', ownedItemData.swapOptions);
      
      // ADD: Copy mysteryBoxConfig for MysteryBox items
      if (item.category === 'MysteryBox' && item.mysteryBoxConfig) {
        console.log('[Checkout] Copying mysteryBoxConfig:', JSON.stringify({
          hasItemPool: !!item.mysteryBoxConfig.itemPool,
          itemPoolLength: item.mysteryBoxConfig.itemPool?.length
        }, null, 2));

        ownedItemData.mysteryBoxConfig = {
          luckMultiplier: item.mysteryBoxConfig.luckMultiplier,
          pityEnabled: item.mysteryBoxConfig.pityEnabled,
          guaranteedItemAfter: item.mysteryBoxConfig.guaranteedItemAfter,
          pityMinimumRarity: item.mysteryBoxConfig.pityMinimumRarity,
          maxOpensPerStudent: item.mysteryBoxConfig.maxOpensPerStudent,
          itemPool: item.mysteryBoxConfig.itemPool.map(p => ({
            item: p.item._id || p.item, // Handle both populated and non-populated
            rarity: p.rarity,
            baseDropChance: p.baseDropChance
          }))
        };

        console.log('[Checkout] Created mysteryBoxConfig with itemPool:', 
          ownedItemData.mysteryBoxConfig.itemPool.length, 'items');
      }

      const ownedItem = await Item.create(ownedItemData);
      
      console.log('[Checkout] Owned item created:', JSON.stringify({
        id: ownedItem._id,
        category: ownedItem.category,
        hasMysteryBoxConfig: !!ownedItem.mysteryBoxConfig,
        itemPoolLength: ownedItem.mysteryBoxConfig?.itemPool?.length
      }, null, 2));

      ownedItems.push(ownedItem);
    }

    // Deduct from per-classroom balance and create order/transaction
    updateClassroomBalance(user, classroomId, userBalance - total);

    const order = new Order({
      user: userId,
      items: ownedItems.map(i => i._id),
      total,
      classroom: classroomId,
      type: 'purchase',
      metadata: {
        itemDetails: ownedItems.map(i => ({
          _id: i._id,
          name: i.name,
          description: i.description,
          price: i.price,
          category: i.category,
          primaryEffect: i.primaryEffect,
          primaryEffectValue: i.primaryEffectValue,
          secondaryEffects: i.secondaryEffects,
          image: i.image
        }))
      }
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

    // ADD: award XP for spending bits at checkout
    try {
      const cls = await Classroom.findById(classroomId).select('xpSettings');
      if (cls?.xpSettings?.enabled) {
        const xpRate = cls.xpSettings.bitsSpent || 0;
        const xpBits = Math.abs(total); // amount actually spent
        const xpToAward = xpBits * xpRate;
        if (xpToAward > 0) {
          await awardXP(userId, classroomId, xpToAward, 'spending bits (bazaar checkout)', cls.xpSettings);
        }
      }
    } catch (e) {
      console.warn('[bazaar] failed to award XP (checkout):', e);
    }

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
        .populate('classroom', 'name code') // ADD: Populate classroom directly
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

// Get the inventory page for the user to see what items they have
router.get('/inventory/:userId', async (req, res) => {
  const { userId } = req.params;
  const { classroomId } = req.query;
  
  try {
    let items;
    if (classroomId) {
      items = await Item.find({ 
        owner: userId,
        consumed: { $ne: true }, // Filter out consumed items
        usesRemaining: { $gt: 0 } // Only show items with uses remaining
      })
        .populate({
          path: 'bazaar',
          populate: {
            path: 'classroom',
            select: '_id'
          }
        });
      
      items = items.filter(item => 
        item.bazaar && 
        item.bazaar.classroom && 
        item.bazaar.classroom._id.toString() === classroomId.toString()
      );
    } else {
      items = await Item.find({ 
        owner: userId,
        consumed: { $ne: true }, // Filter out consumed items
        usesRemaining: { $gt: 0 } // Only show items with uses remaining
      });
    }
    
    res.json({ items });
  } catch (err) {
    console.error('Failed to fetch inventory:', err);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Get populated Mystery Box details
router.get('/mystery-box/:itemId', ensureAuthenticated, async (req, res) => {
  try {
    const { itemId } = req.params;
    const box = await Item.findById(itemId)
      .populate('mysteryBoxConfig.itemPool.item');
    if (!box || box.category !== 'MysteryBox') {
      return res.status(404).json({ error: 'Mystery box not found' });
    }
    res.json({ item: box });
  } catch (e) {
    console.error('[MysteryBox details] error:', e);
    res.status(500).json({ error: 'Failed to load mystery box details' });
  }
});

// Delete a single owned inventory item
router.delete('/inventory/:itemId', ensureAuthenticated, async (req, res) => {
  try {
    const { itemId } = req.params;
    const classroomId = req.query.classroomId;
    const item = await Item.findById(itemId).populate('bazaar');

    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (String(item.owner) !== String(req.user._id))
      return res.status(403).json({ error: 'Not your item' });

    // Optional classroom scoping
    if (classroomId && (!item.bazaar || String(item.bazaar.classroom) !== String(classroomId)))
      return res.status(400).json({ error: 'Item not in this classroom' });

    // DO NOT delete the Item document — preserve it for historical Orders.
    // Instead mark it as consumed and remove ownership so it no longer appears in inventory.
    await Item.findByIdAndUpdate(itemId, {
      $set: { consumed: true, usesRemaining: 0 },
      $unset: { owner: "" }
    });

    req.app.get('io').to(`classroom-${classroomId || item.bazaar?.classroom}`).emit('inventory_update', {
      userId: req.user._id
    });

    res.json({ deleted: true });
  } catch (e) {
    console.error('[Inventory delete] error', e);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Clear all inventory items (self or teacher/admin on student)
router.delete('/inventory/user/:userId/clear', ensureAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;
    const classroomId = req.query.classroomId;

    const canManage =
      String(req.user._id) === String(userId) ||
      ['teacher', 'admin'].includes(req.user.role);

    if (!canManage) return res.status(403).json({ error: 'Not allowed' });

    // Build query
    const query = { owner: userId };

    if (classroomId) {
      // Need bazaar classroom match; fetch item ids first
      const scopedItems = await Item.find(query)
        .populate('bazaar', 'classroom')
        .select('_id bazaar');
      const ids = scopedItems
        .filter(i => i.bazaar && String(i.bazaar.classroom) === String(classroomId))
        .map(i => i._id);
      if (!ids.length) return res.json({ cleared: 0 });

      // Instead of deleting, mark consumed/unowned so Orders stay valid
      const result = await Item.updateMany(
        { _id: { $in: ids } },
        { $set: { consumed: true, usesRemaining: 0 }, $unset: { owner: "" } }
      );
      req.app.get('io').to(`classroom-${classroomId}`).emit('inventory_update', { userId });
      return res.json({ cleared: result.modifiedCount ?? result.nModified ?? 0 });
    }

    const result = await Item.updateMany(
      query,
      { $set: { consumed: true, usesRemaining: 0 }, $unset: { owner: "" } }
    );
    req.app.get('io').emit('inventory_update', { userId });
    res.json({ cleared: result.modifiedCount ?? result.nModified ?? 0 });
  } catch (e) {
    console.error('[Inventory clear] error', e);
    res.status(500).json({ error: 'Failed to clear inventory' });
  }
});

module.exports = router;
