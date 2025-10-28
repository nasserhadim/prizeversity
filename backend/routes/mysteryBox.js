const express = require('express');
const router = express.Router();
const MysteryBox = require('../models/MysteryBox');
const Item = require('../models/Item');
const User = require('../models/User');
const Bazaar = require('../models/Bazaar');
const { ensureAuthenticated } = require('../config/auth');
const blockIfFrozen = require('../middleware/blockIfFrozen');

// Middleware: Only teachers
function ensureTeacher(req, res, next) {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can perform this action' });
  }
  next();
}

// Helper: Get classroom balance
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

// CREATE: Teacher creates mystery box for bazaar
router.post(
  '/classroom/:classroomId/bazaar/:bazaarId/mystery-box',
  ensureAuthenticated,
  ensureTeacher,
  async (req, res) => {
    try {
      const { bazaarId } = req.params;
      const { 
        name, 
        description, 
        price, 
        image, 
        itemPool, 
        pityEnabled, // ADD
        guaranteedItemAfter, 
        pityMinimumRarity,
        luckMultiplier, 
        maxOpensPerStudent 
      } = req.body;

      // VALIDATION 1: Check for duplicate items
      const itemIds = itemPool.map(p => p.itemId);
      const uniqueItemIds = new Set(itemIds);
      
      if (itemIds.length !== uniqueItemIds.size) {
        return res.status(400).json({ 
          error: 'Each item can only be added once to the mystery box. Please remove duplicates.' 
        });
      }

      // VALIDATION 2: Verify drop chances sum to 100%
      const totalChance = itemPool.reduce((sum, item) => sum + Number(item.baseDropChance), 0);
      if (Math.abs(totalChance - 100) > 0.01) {
        return res.status(400).json({ 
          error: `Drop chances must sum to 100% (currently ${totalChance.toFixed(2)}%)` 
        });
      }

      // VALIDATION 3: Verify all items exist in the bazaar
      const Item = require('../models/Item');
      const items = await Item.find({ 
        _id: { $in: itemIds },
        bazaar: bazaarId 
      });
      
      if (items.length !== itemIds.length) {
        return res.status(400).json({ 
          error: 'One or more items do not exist in this bazaar' 
        });
      }

      const mysteryBox = new MysteryBox({
        name,
        description,
        price,
        image: image || undefined,
        bazaar: bazaarId,
        itemPool: itemPool.map(item => ({
          item: item.itemId,
          rarity: item.rarity,
          baseDropChance: item.baseDropChance
        })),
        pityEnabled: !!pityEnabled, // ADD
        guaranteedItemAfter: guaranteedItemAfter || 10,
        pityMinimumRarity: pityMinimumRarity || 'rare',
        luckMultiplier: luckMultiplier || 1.5,
        maxOpensPerStudent: maxOpensPerStudent || null
      });

      await mysteryBox.save();

      res.status(201).json({ message: 'Mystery box created', mysteryBox });
    } catch (err) {
      console.error('[Create Mystery Box] error:', err);
      
      // Handle mongoose validation errors
      if (err.message.includes('Duplicate items')) {
        return res.status(400).json({ error: err.message });
      }
      
      res.status(500).json({ error: 'Failed to create mystery box', details: err.message });
    }
  }
);

// GET: Fetch all mystery boxes for a bazaar
router.get(
  '/classroom/:classroomId/bazaar/:bazaarId/mystery-boxes',
  ensureAuthenticated,
  async (req, res) => {
    try {
      const { bazaarId } = req.params;
      
      const mysteryBoxes = await MysteryBox.find({ bazaar: bazaarId, active: true })
        .populate({
          path: 'itemPool.item',
          select: 'name description image price category primaryEffect' // ENSURE these fields
        });

      res.json({ mysteryBoxes });
    } catch (err) {
      console.error('[Fetch Mystery Boxes] error:', err);
      res.status(500).json({ error: 'Failed to fetch mystery boxes' });
    }
  }
);

// POST: Student opens mystery box
router.post(
  '/classroom/:classroomId/mystery-box/:boxId/open',
  ensureAuthenticated,
  blockIfFrozen,
  async (req, res) => {
    try {
      const { classroomId, boxId } = req.params;
      const userId = req.user._id;

      // FETCH WITH POPULATED ITEMS
      const mysteryBox = await MysteryBox.findById(boxId).populate('itemPool.item');
      if (!mysteryBox) {
        return res.status(404).json({ error: 'Mystery box not found' });
      }

      const user = await User.findById(userId);
      const userBalance = getClassroomBalance(user, classroomId);

      // Check balance
      if (userBalance < mysteryBox.price) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }

      // Check max opens limit
      if (mysteryBox.maxOpensPerStudent) {
        const openCount = user.transactions.filter(
          t => t.description && t.description.includes(`Opened ${mysteryBox.name}`)
        ).length;
        
        if (openCount >= mysteryBox.maxOpensPerStudent) {
          return res.status(400).json({ error: 'Maximum opens reached for this mystery box' });
        }
      }

      // FIXED PITY SYSTEM: Check consecutive bad luck since last good drop
      let isPityTriggered = false;

      if (mysteryBox.pityEnabled) {
        const pityMinRarityOrder = { uncommon: 2, rare: 3, epic: 4, legendary: 5 };
        const minRarityValue = pityMinRarityOrder[mysteryBox.pityMinimumRarity] || 3;

        // Get ALL opens for this mystery box, sorted newest first
        const allOpens = user.transactions
          .filter(t => t.description && t.description.includes(`Opened ${mysteryBox.name}`))
          .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

        console.log('[Mystery Box] Total opens found:', allOpens.length);

        // Count consecutive opens WITHOUT a high-rarity item (starting from most recent)
        let consecutiveBadLuck = 0;
        
        for (const openTx of allOpens) {
          // Extract rarity from description: "Opened BoxName - Won ItemName (rarity)"
          const match = openTx.description.match(/\((\w+)\)(?:\s*\[PITY\])?$/);
          
          if (!match) {
            // No rarity found - treat as bad luck and continue counting
            consecutiveBadLuck++;
            continue;
          }

          const wonRarity = match[1].toLowerCase();
          const wonRarityValue = pityMinRarityOrder[wonRarity] || 0;

          console.log('[Mystery Box] Checking open:', {
            description: openTx.description,
            wonRarity,
            wonRarityValue,
            minRequired: minRarityValue
          });

          if (wonRarityValue >= minRarityValue) {
            // Found a good drop - stop counting
            console.log('[Mystery Box] Found qualifying drop, stopping count');
            break;
          } else {
            // Bad luck - keep counting
            consecutiveBadLuck++;
          }
        }

        console.log('[Mystery Box] Consecutive bad luck:', consecutiveBadLuck, '/', mysteryBox.guaranteedItemAfter);

        // Trigger pity if consecutive bad luck >= threshold
        isPityTriggered = consecutiveBadLuck >= mysteryBox.guaranteedItemAfter;

        if (isPityTriggered) {
          console.log(`[Mystery Box] PITY TRIGGERED for user ${userId} after ${consecutiveBadLuck} bad opens`);
        }
      }

      // Calculate luck bonus
      const userLuck = user.passiveAttributes?.luck || 1;
      const luckBonus = (userLuck - 1) * mysteryBox.luckMultiplier;

      // Determine won item
      let wonPoolItem; // This is the pool item with rarity/baseDropChance
      let wonItemDoc;  // This is the actual Item document

      if (isPityTriggered) {
        const pityMinRarityOrder = { uncommon: 2, rare: 3, epic: 4, legendary: 5 };
        const minRarityValue = pityMinRarityOrder[mysteryBox.pityMinimumRarity] || 3;
        
        // Filter items that meet minimum rarity requirement
        const eligibleItems = mysteryBox.itemPool.filter(
          p => pityMinRarityOrder[p.rarity] >= minRarityValue
        );

        if (eligibleItems.length === 0) {
          console.error('[Mystery Box] No eligible items for pity!');
          return res.status(500).json({ error: 'Pity system misconfigured - no eligible items' });
        }

        // Randomly select from eligible high-rarity items
        wonPoolItem = eligibleItems[Math.floor(Math.random() * eligibleItems.length)];
        console.log(`[Mystery Box] Pity selected:`, wonPoolItem.rarity);
      } else {
        // Normal weighted selection with luck
        wonPoolItem = selectItemWithLuck(mysteryBox.itemPool, luckBonus);
      }

      console.log('[Mystery Box] Won pool item structure:', {
        hasItem: !!wonPoolItem.item,
        hasDocItem: !!wonPoolItem._doc?.item,
        itemType: typeof wonPoolItem.item,
        keys: Object.keys(wonPoolItem)
      });

      // Extract item from Mongoose document structure
      if (wonPoolItem._doc && wonPoolItem._doc.item) {
        wonItemDoc = wonPoolItem._doc.item;
      } else if (wonPoolItem.item && typeof wonPoolItem.item === 'object' && wonPoolItem.item._id) {
        wonItemDoc = wonPoolItem.item;
      } else if (wonPoolItem.item) {
        wonItemDoc = await Item.findById(wonPoolItem.item);
      } else {
        console.error('[Mystery Box] Cannot resolve item. Full wonPoolItem:', JSON.stringify(wonPoolItem, null, 2));
        return res.status(500).json({ error: 'Failed to determine reward - item structure invalid' });
      }

      if (!wonItemDoc || !wonItemDoc._id) {
        console.error('[Mystery Box] wonItemDoc is invalid:', wonItemDoc);
        return res.status(500).json({ error: 'Failed to resolve won item' });
      }

      // Extract rarity from wonPoolItem (could be in _doc or top level)
      const wonRarity = wonPoolItem._doc?.rarity || wonPoolItem.rarity;

      console.log('[Mystery Box] Resolved item:', {
        itemId: wonItemDoc._id,
        itemName: wonItemDoc.name,
        rarity: wonRarity,
        isPity: isPityTriggered
      });

      // Create owned item (clone from template)
      const ownedItem = await Item.create({
        name: wonItemDoc.name,
        description: wonItemDoc.description,
        price: wonItemDoc.price,
        image: wonItemDoc.image,
        bazaar: mysteryBox.bazaar,
        category: wonItemDoc.category,
        primaryEffect: wonItemDoc.primaryEffect,
        primaryEffectValue: wonItemDoc.primaryEffectValue,
        secondaryEffects: wonItemDoc.secondaryEffects,
        owner: userId
      });

      // Deduct balance
      updateClassroomBalance(user, classroomId, userBalance - mysteryBox.price);

      // Record transaction with clear pity indicator
      user.transactions.push({
        amount: -mysteryBox.price,
        description: `Opened ${mysteryBox.name} - Won ${wonItemDoc.name} (${wonRarity})${isPityTriggered ? ' [PITY]' : ''}`,
        assignedBy: userId,
        classroom: classroomId,
        type: 'mystery_box',
        date: new Date(),
        items: [{
          id: ownedItem._id,
          name: ownedItem.name,
          description: ownedItem.description,
          price: ownedItem.price,
          category: ownedItem.category,
          image: ownedItem.image || null
        }]
      });

      await user.save();

      // Notify classroom
      req.app.get('io').to(`classroom-${classroomId}`).emit('mystery_box_opened', {
        userId,
        boxName: mysteryBox.name,
        wonItem: {
          name: wonItemDoc.name,
          rarity: wonRarity
        },
        isPity: isPityTriggered
      });

      res.json({
        message: 'Mystery box opened!',
        wonItem: {
          ...ownedItem.toObject(),
          rarity: wonRarity
        },
        userLuck,
        luckBonus: luckBonus.toFixed(2),
        isPityTriggered
      });
    } catch (err) {
      console.error('[Open Mystery Box] error:', err);
      res.status(500).json({ error: 'Failed to open mystery box', details: err.message });
    }
  }
);

// Helper: Weighted random selection with luck
function selectItemWithLuck(itemPool, luckBonus) {
  // Sort by rarity (legendary -> common)
  const rarityOrder = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
  const sortedPool = [...itemPool].sort((a, b) => rarityOrder[b.rarity] - rarityOrder[a.rarity]);

  // Apply luck bonus to rare items
  const adjustedPool = sortedPool.map(poolItem => {
    const rarityMultiplier = rarityOrder[poolItem.rarity] / 5; // 0.2 to 1.0
    const luckAdjustment = luckBonus * rarityMultiplier * 10; // Higher luck = better rare chances
    
    return {
      ...poolItem,
      adjustedChance: Math.min(poolItem.baseDropChance + luckAdjustment, 100)
    };
  });

  // Normalize chances to sum to 100
  const totalChance = adjustedPool.reduce((sum, item) => sum + item.adjustedChance, 0);
  const normalizedPool = adjustedPool.map(item => ({
    ...item,
    normalizedChance: (item.adjustedChance / totalChance) * 100
  }));

  // Random selection
  const roll = Math.random() * 100;
  let cumulative = 0;

  for (const poolItem of normalizedPool) {
    cumulative += poolItem.normalizedChance;
    if (roll <= cumulative) {
      return poolItem;
    }
  }

  // Fallback to most common item
  return normalizedPool[normalizedPool.length - 1];
}

// DELETE: Remove mystery box
router.delete(
  '/classroom/:classroomId/mystery-box/:boxId',
  ensureAuthenticated,
  ensureTeacher,
  async (req, res) => {
    try {
      const { boxId } = req.params;
      await MysteryBox.findByIdAndDelete(boxId);
      res.json({ message: 'Mystery box deleted' });
    } catch (err) {
      console.error('[Delete Mystery Box] error:', err);
      res.status(500).json({ error: 'Failed to delete mystery box' });
    }
  }
);

module.exports = router;