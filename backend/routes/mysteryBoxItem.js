const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const { ensureAuthenticated } = require('../config/auth');
const blockIfFrozen = require('../middleware/blockIfFrozen');
const Classroom = require('../models/Classroom');
const { awardXP } = require('../utils/awardXP');
const { logStatChanges } = require('../utils/statChangeLog');

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

// Helper: Weighted random selection with luck
function selectItemWithLuck(itemPool, luckBonus) {
  const rarityOrder = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
  
  // Apply luck bonus to rare items
  const adjustedPool = itemPool.map(poolItem => {
    const rarityMultiplier = rarityOrder[poolItem.rarity] / 5;
    const luckAdjustment = luckBonus * rarityMultiplier * 10;
    
    return {
      originalPoolItem: poolItem, // KEEP REFERENCE to original
      rarity: poolItem.rarity,
      baseDropChance: poolItem.baseDropChance,
      item: poolItem.item, // PRESERVE item reference
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

  return normalizedPool[normalizedPool.length - 1];
}

// POST: Student opens mystery box item
router.post('/open/:itemId', ensureAuthenticated, blockIfFrozen, async (req, res) => {
  try {
    const classroomId = req.body.classroomId || req.query.classroomId;
    const userId = req.user._id;

    // Fetch mystery box item WITHOUT populate first to see raw data
    const mysteryBoxItemRaw = await Item.findById(req.params.itemId);
    
    console.log('[Mystery Box Item] RAW mysteryBoxConfig:', JSON.stringify(mysteryBoxItemRaw.mysteryBoxConfig, null, 2));

    // Then fetch with populate
    const mysteryBoxItem = await Item.findById(req.params.itemId)
      .populate('mysteryBoxConfig.itemPool.item');

    if (!mysteryBoxItem || mysteryBoxItem.category !== 'MysteryBox') {
      return res.status(404).json({ error: 'Mystery box not found' });
    }

    if (mysteryBoxItem.owner && mysteryBoxItem.owner.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Not your mystery box' });
    }

    const user = await User.findById(userId);
    const config = mysteryBoxItem.mysteryBoxConfig;

    console.log('[Mystery Box Item] Config after populate:', JSON.stringify({
      hasItemPool: !!config.itemPool,
      itemPoolLength: config.itemPool?.length,
      firstItem: config.itemPool?.[0]
    }, null, 2));

    // Check if itemPool exists
    if (!config.itemPool || config.itemPool.length === 0) {
      return res.status(500).json({ 
        error: 'Mystery box has no items configured',
        debug: {
          rawConfig: mysteryBoxItemRaw.mysteryBoxConfig,
          populatedConfig: config
        }
      });
    }

    // Check max opens limit (if this is a template mystery box, not owned)
    if (!mysteryBoxItem.owner && config.maxOpensPerStudent) {
      const openCount = user.transactions.filter(
        t => t.description && t.description.includes(`Opened ${mysteryBoxItem.name}`)
      ).length;
      
      if (openCount >= config.maxOpensPerStudent) {
        return res.status(400).json({ error: 'Maximum opens reached for this mystery box' });
      }
    }

    // PITY SYSTEM: Check consecutive bad luck
    let isPityTriggered = false;

    if (config.pityEnabled) {
      const pityMinRarityOrder = { uncommon: 2, rare: 3, epic: 4, legendary: 5 };
      const minRarityValue = pityMinRarityOrder[config.pityMinimumRarity] || 3;

      const allOpens = user.transactions
        .filter(t => t.description && t.description.includes(`Opened ${mysteryBoxItem.name}`))
        .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

      let consecutiveBadLuck = 0;
      for (const openTx of allOpens) {
        const match = openTx.description.match(/\((\w+)\)(?:\s*\[PITY\])?$/);
        
        if (!match) {
          consecutiveBadLuck++;
          continue;
        }

        const wonRarity = match[1].toLowerCase();
        const wonRarityValue = pityMinRarityOrder[wonRarity] || 0;

        if (wonRarityValue >= minRarityValue) {
          break;
        } else {
          consecutiveBadLuck++;
        }
      }

      isPityTriggered = consecutiveBadLuck >= config.guaranteedItemAfter;
    }

    // Calculate luck bonus
    const userLuck = user.passiveAttributes?.luck || 1;
    const luckBonus = (userLuck - 1) * config.luckMultiplier;

    console.log('[Mystery Box Item] Item pool structure:', JSON.stringify(config.itemPool.map(p => ({
      hasItem: !!p.item,
      itemType: typeof p.item,
      itemId: p.item?._id || p.item,
      rarity: p.rarity
    })), null, 2));

    // Determine won item
    let wonPoolItem;
    let wonItemDoc;
    let wonRarity;

    if (isPityTriggered) {
      const pityMinRarityOrder = { uncommon: 2, rare: 3, epic: 4, legendary: 5 };
      const minRarityValue = pityMinRarityOrder[config.pityMinimumRarity] || 3;
      
      const eligibleItems = config.itemPool.filter(
        p => pityMinRarityOrder[p.rarity] >= minRarityValue
      );

      if (eligibleItems.length === 0) {
        return res.status(500).json({ error: 'Pity system misconfigured - no eligible items' });
      }

      // Randomly select from eligible items
      const selected = eligibleItems[Math.floor(Math.random() * eligibleItems.length)];
      wonRarity = selected.rarity;
      
      // Extract the item document
      if (selected.item && selected.item._id) {
        wonItemDoc = selected.item; // Already populated
      } else {
        wonItemDoc = await Item.findById(selected.item);
      }
    } else {
      // Normal luck-based selection
      wonPoolItem = selectItemWithLuck(config.itemPool, luckBonus);
      wonRarity = wonPoolItem.rarity;

      console.log('[Mystery Box Item] Won pool item:', {
        hasItem: !!wonPoolItem.item,
        itemType: typeof wonPoolItem.item,
        rarity: wonPoolItem.rarity
      });

      // Extract item from the result
      if (wonPoolItem.item && wonPoolItem.item._id) {
        // Already populated
        wonItemDoc = wonPoolItem.item;
      } else if (wonPoolItem.item) {
        // Need to fetch manually (item is just an ID)
        wonItemDoc = await Item.findById(wonPoolItem.item);
      } else {
        console.error('[Mystery Box Item] wonPoolItem has no item field:', wonPoolItem);
        return res.status(500).json({ error: 'Failed to determine won item' });
      }
    }

    if (!wonItemDoc || !wonItemDoc._id) {
      console.error('[Mystery Box Item] Failed to resolve won item document');
      return res.status(500).json({ error: 'Failed to resolve won item' });
    }

    console.log('[Mystery Box Item] Successfully resolved:', {
      itemName: wonItemDoc.name,
      rarity: wonRarity
    });

    // Create owned item (clone from template)
    const ownedItem = await Item.create({
      name: wonItemDoc.name,
      description: wonItemDoc.description,
      price: wonItemDoc.price,
      image: wonItemDoc.image,
      bazaar: mysteryBoxItem.bazaar,
      category: wonItemDoc.category,
      primaryEffect: wonItemDoc.primaryEffect,
      primaryEffectValue: wonItemDoc.primaryEffectValue,
      secondaryEffects: wonItemDoc.secondaryEffects,
      swapOptions: wonItemDoc.swapOptions,
      owner: userId
    });

    // Record transaction
    user.transactions.push({
      amount: 0, // No cost for owned mystery box
      description: `Opened ${mysteryBoxItem.name} - Won ${wonItemDoc.name} (${wonRarity})${isPityTriggered ? ' [PITY]' : ''}`,
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

    // ADD: Create an Order for the mystery box open (for order history transparency)
    const Order = require('../models/Order');
    const Classroom = require('../models/Classroom');
    
    // Fetch classroom info for description
    const classroom = await Classroom.findById(classroomId).select('name code');
    const classroomLabel = classroom ? `${classroom.name}${classroom.code ? ` (${classroom.code})` : ''}` : 'Classroom';
    
    const mysteryBoxOrder = await Order.create({
      user: userId,
      items: [ownedItem._id],
      total: 0, // Free (already paid when purchasing the mystery box)
      classroom: classroomId, // ADD: Set classroom reference
      description: `Mystery Box: ${mysteryBoxItem.name} → Won ${wonItemDoc.name} in ${classroomLabel}`, // ENHANCED
      type: 'mystery_box',
      metadata: {
        mysteryBoxName: mysteryBoxItem.name,
        wonItemName: wonItemDoc.name,
        wonItemRarity: wonRarity,
        isPityTriggered,
        originalMysteryBoxId: mysteryBoxItem._id,
        classroomName: classroom?.name, // ADD: For easy filtering
        classroomCode: classroom?.code // ADD: For easy filtering
      }
    });

    // Link the order to the transaction
    const lastTransaction = user.transactions[user.transactions.length - 1];
    lastTransaction.orderId = mysteryBoxOrder._id;

    // Delete mystery box item after use (if owned)
    if (mysteryBoxItem.owner) {
      mysteryBoxItem.usesRemaining = 0; // Mark as depleted
      mysteryBoxItem.active = false; // Mark as inactive
      await mysteryBoxItem.save();
      
      // Optional: Remove from user's active inventory (but keep in database for history)
      // The frontend can filter out items with usesRemaining === 0
    }

    await user.save();

    // Award XP
    try {
      const cls = await Classroom.findById(classroomId).select('xpSettings');
      if (cls?.xpSettings?.enabled) {
        const useRate = cls.xpSettings.mysteryBox || 0;
        if (useRate > 0) {
          try {
            const xpRes = await awardXP(userId, classroomId, useRate, 'mystery box use', cls.xpSettings);
            if (xpRes && typeof xpRes.oldXP !== 'undefined' && typeof xpRes.newXP !== 'undefined' && xpRes.newXP !== xpRes.oldXP) {
              try {
                const effectsText = `Mystery Box: ${mysteryBoxItem.name} → Won ${wonItemDoc.name}${wonRarity ? ` (${wonRarity})` : ''} — ${Math.round(useRate)} XP`;
                await logStatChanges({
                  io: req.app && req.app.get ? req.app.get('io') : null,
                  classroomId,
                  user: userId ? { _id: userId, firstName: undefined } : req.user, // keep same shape used elsewhere
                  actionBy: req.user ? req.user._id : undefined,
                  prevStats: { xp: xpRes.oldXP },
                  currStats: { xp: xpRes.newXP },
                  context: 'mystery box use',
                  details: { effectsText },
                  forceLog: true
                });
              } catch (logErr) {
                console.warn('[mysteryBoxItem] failed to log XP stat change (open):', logErr);
              }
            }
          } catch (xpErr) {
            console.warn('[mysteryBoxItem] awardXP failed (open):', xpErr);
          }
        }
      }
    } catch (e) {
      console.warn('[mysteryBoxItem] awardXP failed:', e);
    }

    // Notify classroom
    req.app.get('io').to(`classroom-${classroomId}`).emit('mystery_box_opened', {
      userId,
      boxName: mysteryBoxItem.name,
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
    console.error('[Open Mystery Box Item] error:', err);
    res.status(500).json({ error: 'Failed to open mystery box', details: err.message });
  }
});

module.exports = router;