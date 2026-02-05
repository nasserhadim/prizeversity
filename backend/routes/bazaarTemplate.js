const express = require('express');
const router = express.Router();
const BazaarTemplate = require('../models/BazaarTemplate');
const Bazaar = require('../models/Bazaar');
const Item = require('../models/Item');
const { ensureAuthenticated, ensureTeacher } = require('../middleware/auth');

// GET /api/bazaar-templates - Get all templates for the authenticated teacher
router.get('/', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const teacherId = req.user._id;
    const templates = await BazaarTemplate.find({ teacherId })
      .sort({ createdAt: -1 })
      .select('name bazaarData items sourceClassroom createdAt updatedAt'); // Added sourceClassroom here

    res.json({ templates });
  } catch (error) {
    console.error('Error fetching bazaar templates:', error);
    res.status(500).json({ message: 'Failed to fetch templates' });
  }
});

// POST /api/bazaar-templates - Create a new template from existing bazaar
router.post('/', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { name, bazaarId } = req.body;
    const teacherId = req.user._id;

    if (!name || !bazaarId) {
      return res.status(400).json({ message: 'Template name and bazaar ID are required' });
    }

    // Check if template name already exists for this teacher
    const existingTemplate = await BazaarTemplate.findOne({ 
      teacherId, 
      name: name.trim() 
    });

    if (existingTemplate) {
      return res.status(400).json({ message: 'A template with this name already exists' });
    }

    // Fetch the bazaar with properly populated items (including nested mystery box pool items)
    const bazaar = await Bazaar.findById(bazaarId).populate({
      path: 'items',
      populate: {
        path: 'mysteryBoxConfig.itemPool.item',
        select: 'name category'
      }
    });
    
    if (!bazaar) {
      return res.status(404).json({ message: 'Bazaar not found' });
    }

    // Verify teacher owns this bazaar's classroom
    const Classroom = require('../models/Classroom');
    const classroom = await Classroom.findById(bazaar.classroom);
    if (!classroom || classroom.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'Not authorized to save this bazaar as template' });
    }

    // Build a map of item IDs to names for fallback lookup
    const itemIdToName = new Map();
    for (const item of bazaar.items || []) {
      if (item?._id && item?.name) {
        itemIdToName.set(item._id.toString(), item.name);
      }
    }

    // Extract bazaar data (excluding classroom reference and _id)
    const bazaarData = {
      name: bazaar.name,
      description: bazaar.description,
      image: bazaar.image
    };

    // Extract items data (excluding owner, bazaar reference, and _id)
    const items = bazaar.items.map(item => {
      const baseItem = {
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.image,
        category: item.category,
        primaryEffect: item.primaryEffect,
        primaryEffectValue: item.primaryEffectValue,
        secondaryEffects: item.secondaryEffects || [],
        swapOptions: item.swapOptions || []
      };

      // Handle MysteryBox configuration
      if (item.category === 'MysteryBox' && item.mysteryBoxConfig) {
        const poolItems = (item.mysteryBoxConfig.itemPool || [])
          .map(p => {
            // Get item name from various possible sources
            let itemName = '';
            
            if (p?.itemName) {
              // Already has itemName (from previous template application)
              itemName = p.itemName;
            } else if (p?.item && typeof p.item === 'object' && p.item.name) {
              // Populated item object
              itemName = p.item.name;
            } else if (p?.item) {
              // Item is just an ID - look it up in our map
              const itemId = typeof p.item === 'string' ? p.item : p.item.toString();
              itemName = itemIdToName.get(itemId) || '';
            }

            if (!itemName) {
              console.warn('[Template Save] Could not resolve item name for pool entry:', p);
              return null;
            }

            return {
              itemName,
              rarity: p.rarity || 'common',
              baseDropChance: Number(p.baseDropChance || 0)
            };
          })
          .filter(p => p !== null && p.itemName);

        // Only include mysteryBoxConfig if we have valid pool items
        if (poolItems.length > 0) {
          baseItem.mysteryBoxConfig = {
            luckMultiplier: item.mysteryBoxConfig.luckMultiplier,
            pityEnabled: item.mysteryBoxConfig.pityEnabled,
            guaranteedItemAfter: item.mysteryBoxConfig.guaranteedItemAfter,
            pityMinimumRarity: item.mysteryBoxConfig.pityMinimumRarity,
            itemPool: poolItems
          };
        } else {
          console.warn('[Template Save] MysteryBox has no valid pool items, skipping config:', item.name);
        }
      }

      return baseItem;
    });

    // Store classroom info
    const template = new BazaarTemplate({
      name: name.trim(),
      teacherId,
      sourceClassroom: {
        classroomId: classroom._id,
        name: classroom.name,
        code: classroom.code
      },
      bazaarData,
      items
    });

    await template.save();

    res.status(201).json({ 
      message: 'Template created successfully',
      template: {
        _id: template._id,
        name: template.name,
        sourceClassroom: template.sourceClassroom,
        bazaarData: template.bazaarData,
        itemCount: template.items.length,
        mysteryBoxCount: template.items.filter(i => i.category === 'MysteryBox').length,
        createdAt: template.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating bazaar template:', error);
    res.status(500).json({ message: 'Failed to create template' });
  }
});

// GET /api/bazaar-templates - Get all templates for teacher
router.get('/', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const teacherId = req.user._id;
    const templates = await BazaarTemplate.find({ teacherId }).sort({ createdAt: -1 });
    
    res.json({
      templates: templates.map(t => ({
        _id: t._id,
        name: t.name,
        itemCount: t.items?.length || 0,
        mysteryBoxCount: (t.items || []).filter(i => i.category === 'MysteryBox').length,
        sourceClassroom: t.sourceClassroom,
        createdAt: t.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching bazaar templates:', error);
    res.status(500).json({ message: 'Failed to fetch templates' });
  }
});

// GET /api/bazaar-templates/:templateId - Get specific template
router.get('/:templateId', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { templateId } = req.params;
    const teacherId = req.user._id;

    const template = await BazaarTemplate.findById(templateId);
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    if (template.teacherId.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this template' });
    }

    res.json({ template });
  } catch (error) {
    console.error('Error fetching bazaar template:', error);
    res.status(500).json({ message: 'Failed to fetch template' });
  }
});

// DELETE /api/bazaar-templates/:templateId - Delete a template
router.delete('/:templateId', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { templateId } = req.params;
    const teacherId = req.user._id;

    const template = await BazaarTemplate.findById(templateId);
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    if (template.teacherId.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this template' });
    }

    await BazaarTemplate.findByIdAndDelete(templateId);
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting bazaar template:', error);
    res.status(500).json({ message: 'Failed to delete template' });
  }
});

// POST /api/bazaar-templates/:templateId/apply - Apply template to create/restore bazaar
router.post('/:templateId/apply', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { templateId } = req.params;
    const { classroomId } = req.body;
    const teacherId = req.user._id;

    const mode = String(req.query.mode || req.body.mode || 'replace').toLowerCase(); // 'replace' | 'merge'

    // ADD: shared helper (used by both merge + create branches)
    const summarizeApply = (created = [], skipped = []) => {
      const createdMystery = created.filter(i => i?.category === 'MysteryBox').length;
      const createdRegular = created.length - createdMystery;

      const skippedByReason = skipped.reduce((acc, s) => {
        const r = s?.reason || 'unknown';
        acc[r] = (acc[r] || 0) + 1;
        return acc;
      }, {});

      const topSkippedNames = skipped
        .slice(0, 5)
        .map(s => s?.name || '(unnamed)')
        .filter(Boolean);

      return {
        createdTotal: created.length,
        createdRegular,
        createdMystery,
        skippedTotal: skipped.length,
        skippedByReason,
        topSkippedNames
      };
    };

    // Validate
    if (!classroomId) {
      return res.status(400).json({ message: 'Classroom ID is required' });
    }

    // Verify teacher owns classroom
    const Classroom = require('../models/Classroom');
    const classroom = await Classroom.findById(classroomId);
    if (!classroom || classroom.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'Not authorized for this classroom' });
    }

    // Fetch template
    const template = await BazaarTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Verify teacher owns template
    if (template.teacherId.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'Not authorized to use this template' });
    }

    const normalizeName = (n) => (n || '').toLowerCase().trim();

    // Helper to resolve mystery box pool items by name
    const resolvePool = (byName, itemData) => {
      const pool = itemData?.mysteryBoxConfig?.itemPool || [];
      const resolved = [];
      const missing = [];

      for (const p of pool) {
        // Back-compat: accept multiple shapes
        const poolItemName =
          p?.itemName ||
          p?.name ||
          p?.item?.name ||
          p?.item?.title ||
          '';

        const key = normalizeName(poolItemName);
        const found = key ? byName.get(key) : null;

        if (!found) {
          const legacyId = p?.item || p?.itemId || p?.id;
          missing.push(
            poolItemName
              ? poolItemName
              : legacyId
                ? `(legacy pool ref missing itemName: ${legacyId})`
                : '(missing name)'
          );
          continue;
        }

        if (found.category === 'MysteryBox') {
          missing.push(`${found.name} (is MysteryBox)`);
          continue;
        }

        resolved.push({
          item: found._id,
          rarity: p?.rarity || 'common',
          baseDropChance: Number(p?.baseDropChance || 0)
        });
      }

      return { resolved, missing };
    };

    const existingBazaar = await Bazaar.findOne({ classroom: classroomId }).populate('items');

    // If bazaar exists: either block (replace mode) OR merge items
    if (existingBazaar) {
      if (mode !== 'merge') {
        return res.status(400).json({
          message: 'Bazaar already exists for this classroom. Delete it first to apply template.'
        });
      }

      // Build byName map from existing bazaar items
      const byName = new Map(
        (existingBazaar.items || [])
          .filter(i => i?.name)
          .map(i => [normalizeName(i.name), i])
      );

      const created = [];
      const skipped = [];
      const pendingMystery = [];

      // Pass 1: create non-mystery items (or queue mystery boxes)
      for (const itemData of template.items || []) {
        const nameKey = normalizeName(itemData?.name);
        if (!nameKey) {
          skipped.push({ name: itemData?.name, reason: 'missing-name' });
          continue;
        }

        // Queue mystery boxes for Pass 2
        if (itemData?.category === 'MysteryBox') {
          // Only skip if a MysteryBox with same name already exists
          if (byName.has(nameKey) && byName.get(nameKey).category === 'MysteryBox') {
            skipped.push({ name: itemData?.name, reason: 'name-conflict' });
          } else {
            pendingMystery.push(itemData);
          }
          continue;
        }

        // For non-mystery items, skip if name already exists
        if (byName.has(nameKey)) {
          skipped.push({ name: itemData?.name, reason: 'name-conflict' });
          continue;
        }

        const doc = new Item({
          name: itemData.name,
          description: itemData.description,
          price: itemData.price,
          image: itemData.image,
          category: itemData.category,
          primaryEffect: itemData.primaryEffect,
          primaryEffectValue: itemData.primaryEffectValue,
          secondaryEffects: itemData.secondaryEffects || [],
          swapOptions: itemData.swapOptions || [],
          bazaar: existingBazaar._id
        });

        await doc.save();
        created.push(doc);
        byName.set(nameKey, doc);
      }

      // Pass 2: create mystery boxes (resolve pool by itemName)
      for (const itemData of pendingMystery) {
        const nameKey = normalizeName(itemData?.name);
        
        // Check if mystery box with same name already exists (shouldn't happen due to Pass 1 filter, but double-check)
        if (byName.has(nameKey) && byName.get(nameKey).category === 'MysteryBox') {
          skipped.push({ name: itemData?.name, reason: 'name-conflict' });
          continue;
        }

        const { resolved, missing } = resolvePool(byName, itemData);
        
        // Only skip if NO pool items could be resolved
        if (resolved.length === 0) {
          skipped.push({ name: itemData?.name, reason: 'missing-pool-items', missing });
          continue;
        }
        
        // Warn but continue if some pool items are missing
        if (missing.length > 0) {
          console.warn(`[Template Apply] MysteryBox "${itemData?.name}" created with partial pool (${resolved.length} resolved, ${missing.length} missing). Missing: ${missing.join(', ')}`);
        }

        const doc = new Item({
          name: itemData.name,
          description: itemData.description,
          price: itemData.price,
          image: itemData.image,
          category: 'MysteryBox',
          bazaar: existingBazaar._id,
          mysteryBoxConfig: {
            luckMultiplier: Number(itemData.mysteryBoxConfig?.luckMultiplier || 1.5),
            pityEnabled: !!itemData.mysteryBoxConfig?.pityEnabled,
            guaranteedItemAfter: Number(itemData.mysteryBoxConfig?.guaranteedItemAfter || 10),
            pityMinimumRarity: itemData.mysteryBoxConfig?.pityMinimumRarity || 'rare',
            itemPool: resolved
          }
        });

        await doc.save();
        created.push(doc);
        byName.set(nameKey, doc);
      }

      await Bazaar.findByIdAndUpdate(existingBazaar._id, {
        $push: { items: { $each: created.map(d => d._id) } }
      });
      
      await existingBazaar.populate('items');

      const summary = summarizeApply(created, skipped);

      return res.status(200).json({
        message:
          `Imported ${summary.createdTotal} item(s) ` +
          `(${summary.createdRegular} regular, ${summary.createdMystery} MysteryBox). ` +
          `Skipped ${summary.skippedTotal}.`,
        bazaar: existingBazaar,
        created: created.map(d => ({ _id: d._id, name: d.name, category: d.category })),
        skipped,
        summary
      });
    }

    // No existing bazaar → create fresh
    const bazaar = new Bazaar({
      classroom: classroomId,
      name: template.bazaarData?.name || 'Bazaar',
      description: template.bazaarData?.description || '',
      image: template.bazaarData?.image || ''
    });
    await bazaar.save();

    const created = [];
    const skipped = [];

    // Build name → doc map for mystery box pool resolution
    const byName = new Map();
    const pendingMystery = [];

    // Pass 1: create non-MysteryBox items first
    for (const itemData of template.items || []) {
      if (itemData?.category === 'MysteryBox') {
        pendingMystery.push(itemData);
        continue;
      }

      const nameKey = normalizeName(itemData?.name);
      if (!nameKey) {
        skipped.push({ name: itemData?.name, reason: 'missing-name' });
        continue;
      }

      const doc = new Item({
        name: itemData.name,
        description: itemData.description,
        price: itemData.price,
        image: itemData.image,
        category: itemData.category,
        primaryEffect: itemData.primaryEffect,
        primaryEffectValue: itemData.primaryEffectValue,
        secondaryEffects: itemData.secondaryEffects || [],
        swapOptions: itemData.swapOptions || [],
        bazaar: bazaar._id
      });

      await doc.save();
      created.push(doc);
      byName.set(nameKey, doc);
    }

    // Pass 2: create MysteryBox items (now pool items exist)
    for (const itemData of pendingMystery) {
      const nameKey = normalizeName(itemData?.name);
      if (!nameKey) {
        skipped.push({ name: itemData?.name, reason: 'missing-name' });
        continue;
      }

      const { resolved, missing } = resolvePool(byName, itemData);

      // Only skip if NO pool items could be resolved
      if (resolved.length === 0) {
        skipped.push({ name: itemData?.name, reason: 'missing-pool-items', missing });
        continue;
      }

      // Warn but continue if some pool items are missing
      if (missing.length > 0) {
        console.warn(`[Template Apply] MysteryBox "${itemData?.name}" created with partial pool (${resolved.length} resolved, ${missing.length} missing). Missing: ${missing.join(', ')}`);
      }

      const doc = new Item({
        name: itemData.name,
        description: itemData.description,
        price: itemData.price,
        image: itemData.image,
        category: 'MysteryBox',
        bazaar: bazaar._id,
        mysteryBoxConfig: {
          luckMultiplier: Number(itemData.mysteryBoxConfig?.luckMultiplier || 1.5),
          pityEnabled: !!itemData.mysteryBoxConfig?.pityEnabled,
          guaranteedItemAfter: Number(itemData.mysteryBoxConfig?.guaranteedItemAfter || 10),
          pityMinimumRarity: itemData.mysteryBoxConfig?.pityMinimumRarity || 'rare',
          itemPool: resolved
        }
      });

      await doc.save();
      created.push(doc);
      byName.set(nameKey, doc);
    }

    // Link items to bazaar
    bazaar.items = created.map(d => d._id);
    await bazaar.save();

    const summary = summarizeApply(created, skipped);

    res.status(201).json({
      message:
        `Created ${summary.createdTotal} item(s) ` +
        `(${summary.createdRegular} regular, ${summary.createdMystery} MysteryBox). ` +
        (summary.skippedTotal > 0
          ? `Skipped ${summary.skippedTotal} (missing-pool-items: ${summary.skippedByReason['missing-pool-items'] || 0}). Examples: ${summary.topSkippedNames.join(', ')}.`
          : ''),
      bazaar,
      created: created.map(d => ({ _id: d._id, name: d.name, category: d.category })),
      skipped,
      summary
    });

  } catch (error) {
    console.error('Error applying bazaar template:', error);
    res.status(500).json({ message: 'Failed to apply template' });
  }
});

module.exports = router;