const express = require('express');
const router = express.Router();
const BazaarTemplate = require('../models/BazaarTemplate');
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

    // Fetch the bazaar with populated items
    const Bazaar = require('../models/Bazaar');
    const bazaar = await Bazaar.findById(bazaarId)
      .populate('items')
      .populate('items.mysteryBoxConfig.itemPool.item'); // NEW: needed to capture pool item names
    
    if (!bazaar) {
      return res.status(404).json({ message: 'Bazaar not found' });
    }

    // Verify teacher owns this bazaar's classroom
    const Classroom = require('../models/Classroom');
    const classroom = await Classroom.findById(bazaar.classroom);
    if (!classroom || classroom.teacher.toString() !== teacherId.toString()) {
      return res.status(403).json({ message: 'Not authorized to save this bazaar as template' });
    }

    // Extract bazaar data (excluding classroom reference and _id)
    const bazaarData = {
      name: bazaar.name,
      description: bazaar.description,
      image: bazaar.image
    };

    // Extract items data (excluding owner, bazaar reference, and _id)
    const items = bazaar.items.map(item => ({
      name: item.name,
      description: item.description,
      price: item.price,
      image: item.image,
      category: item.category,
      primaryEffect: item.primaryEffect,
      primaryEffectValue: item.primaryEffectValue,
      secondaryEffects: item.secondaryEffects || [],
      swapOptions: item.swapOptions || [],

      // NEW: MysteryBox support
      mysteryBoxConfig: item.category === 'MysteryBox' && item.mysteryBoxConfig
        ? {
            luckMultiplier: item.mysteryBoxConfig.luckMultiplier,
            pityEnabled: item.mysteryBoxConfig.pityEnabled,
            guaranteedItemAfter: item.mysteryBoxConfig.guaranteedItemAfter,
            pityMinimumRarity: item.mysteryBoxConfig.pityMinimumRarity,
            maxOpensPerStudent: item.mysteryBoxConfig.maxOpensPerStudent ?? null,
            itemPool: (item.mysteryBoxConfig.itemPool || [])
              .map(p => ({
                itemName:
                  (p?.itemName) ||
                  (p?.item && typeof p.item === 'object' ? p.item.name : '') ||
                  '',
                rarity: p.rarity || 'common',
                baseDropChance: Number(p.baseDropChance || 0)
              }))
              .filter(p => p.itemName) // drop broken entries
          }
        : undefined
    }));

    // NEW: Store classroom info
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
      message: 'Template saved successfully',
      template: {
        _id: template._id,
        name: template.name,
        sourceClassroom: template.sourceClassroom,
        bazaarData: template.bazaarData,
        itemCount: template.items.length,
        createdAt: template.createdAt
      }
    });
  } catch (error) {
    console.error('Error saving bazaar template:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A template with this name already exists' });
    }
    res.status(500).json({ message: 'Failed to save template' });
  }
});

// PUT /api/bazaar-templates/:templateId - Update an existing template
router.put('/:templateId', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { templateId } = req.params;
    const { name, bazaarData, items } = req.body;
    const teacherId = req.user._id;

    if (!name) {
      return res.status(400).json({ message: 'Template name is required' });
    }

    const template = await BazaarTemplate.findOne({ 
      _id: templateId, 
      teacherId 
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Check if new name conflicts with existing template (excluding current one)
    if (name.trim() !== template.name) {
      const existingTemplate = await BazaarTemplate.findOne({ 
        teacherId, 
        name: name.trim(),
        _id: { $ne: templateId }
      });

      if (existingTemplate) {
        return res.status(400).json({ message: 'A template with this name already exists' });
      }
    }

    template.name = name.trim();
    if (bazaarData) template.bazaarData = bazaarData;
    if (items) template.items = items;
    
    await template.save();

    res.json({ 
      message: 'Template updated successfully',
      template: {
        _id: template._id,
        name: template.name,
        bazaarData: template.bazaarData,
        itemCount: template.items.length,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating bazaar template:', error);
    res.status(500).json({ message: 'Failed to update template' });
  }
});

// DELETE /api/bazaar-templates/:templateId - Delete a template
router.delete('/:templateId', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { templateId } = req.params;
    const teacherId = req.user._id;

    const template = await BazaarTemplate.findOneAndDelete({ 
      _id: templateId, 
      teacherId 
    });

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

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
        .map(s => s?.name)
        .filter(Boolean)
        .slice(0, 5);

      return {
        createdTotal: created.length,
        createdRegular,
        createdMystery,
        skippedTotal: skipped.length,
        skippedByReason,
        topSkippedNames
      };
    };

    if (!classroomId) {
      return res.status(400).json({ message: 'Classroom ID is required' });
    }

    const template = await BazaarTemplate.findOne({ _id: templateId, teacherId });
    if (!template) return res.status(404).json({ message: 'Template not found' });

    const Classroom = require('../models/Classroom');
    const classroom = await Classroom.findOne({ _id: classroomId, teacher: teacherId });
    if (!classroom) return res.status(404).json({ message: 'Classroom not found or unauthorized' });

    const Bazaar = require('../models/Bazaar');
    const Item = require('../models/Item');

    const normalizeName = (s) => String(s || '').trim().toLowerCase();

    const resolvePool = (byName, itemData) => {
      const pool = itemData?.mysteryBoxConfig?.itemPool || [];
      const resolved = [];
      const missing = [];

      for (const p of pool) {
        // Back-compat: accept multiple shapes
        const poolItemName =
          p?.itemName ||
          p?.name ||
          p?.item?.name || // legacy: { item: { name } }
          p?.item?.title || // (just in case)
          '';

        const key = normalizeName(poolItemName);
        const found = key ? byName.get(key) : null;

        if (!found) {
          // If we *only* have an id (legacy templates), surface that clearly
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

      const byName = new Map(
        (existingBazaar.items || [])
          .filter(i => i?.name)
          .map(i => [normalizeName(i.name), i])
      );

      const created = [];
      const skipped = [];
      const pendingMystery = [];

      // Pass 1: create non-mystery items
      for (const itemData of template.items || []) {
        const nameKey = normalizeName(itemData?.name);
        if (!nameKey || byName.has(nameKey)) {
          skipped.push({ name: itemData?.name, reason: !nameKey ? 'missing-name' : 'name-conflict' });
          continue;
        }

        if (itemData?.category === 'MysteryBox') {
          pendingMystery.push(itemData);
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
        if (!nameKey || byName.has(nameKey)) {
          skipped.push({ name: itemData?.name, reason: !nameKey ? 'missing-name' : 'name-conflict' });
          continue;
        }

        const { resolved, missing } = resolvePool(byName, itemData);
        if (!resolved.length || missing.length) {
          skipped.push({ name: itemData?.name, reason: 'missing-pool-items', missing });
          continue;
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
            maxOpensPerStudent: itemData.mysteryBoxConfig?.maxOpensPerStudent ?? null,
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

    // (No bazaar exists) -> create bazaar + items (two-pass for MysteryBox)
    const bazaar = new Bazaar({
      name: template.bazaarData.name,
      description: template.bazaarData.description,
      image: template.bazaarData.image,
      classroom: classroomId
    });
    await bazaar.save();

    const byName = new Map();
    const createdIds = [];
    const pendingMystery = [];
    const skipped = []; // ADD: track skipped items (reasons)

    // Pass 1: create non-mystery items
    for (const itemData of template.items || []) {
      if (itemData?.category === 'MysteryBox') {
        pendingMystery.push(itemData);
        continue;
      }

      const item = new Item({
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

      await item.save();
      createdIds.push(item._id);
      byName.set(normalizeName(item.name), item);
    }

    // Pass 2: create mystery boxes
    for (const itemData of pendingMystery) {
      const { resolved, missing } = resolvePool(byName, itemData);

      // CHANGE: skip instead of failing the entire apply
      if (!resolved.length || missing.length) {
        skipped.push({ name: itemData?.name, reason: 'missing-pool-items', missing });
        continue;
      }

      const item = new Item({
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
          maxOpensPerStudent: itemData.mysteryBoxConfig?.maxOpensPerStudent ?? null,
          itemPool: resolved
        }
      });

      await item.save();
      createdIds.push(item._id);
      byName.set(normalizeName(item.name), item);
    }

    bazaar.items = createdIds;
    await bazaar.save();
    await bazaar.populate('items');

    const createdDocs = await Item.find({ _id: { $in: createdIds } }, { name: 1, category: 1 });
    const summary = summarizeApply(createdDocs, skipped);

    return res.status(201).json({
      message:
        `Applied template and created bazaar. ` +
        `Created ${summary.createdTotal} item(s) ` +
        `(${summary.createdRegular} regular, ${summary.createdMystery} MysteryBox). ` +
        `Skipped ${summary.skippedTotal}.`,
      bazaar,
      created: createdDocs.map(d => ({ _id: d._id, name: d.name, category: d.category })),
      skipped,
      summary
    });
  } catch (error) {
    console.error('Error applying bazaar template:', error);
    res.status(500).json({ message: 'Failed to apply template' });
  }
});

module.exports = router;