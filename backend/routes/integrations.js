const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { ensureAuthenticated } = require('../config/auth');
const { requireScope } = require('../middleware/integrationAuth');
const IntegrationApp = require('../models/IntegrationApp');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const { awardXP } = require('../utils/awardXP');
const { logStatChanges } = require('../utils/statChangeLog');
const Notification = require('../models/Notification');
const { populateNotification } = require('../utils/notifications');
const { getScopedUserStats, isClassroomAdmin } = require('../utils/classroomStats');
const { dispatchWebhook } = require('../utils/webhookDispatcher');
const { getUserGroupMultiplier } = require('../utils/groupMultiplier');

// helper: classroom-scoped personal multiplier
function getPersonalMultiplierForClassroom(userDoc, classroomId) {
  if (!userDoc || !classroomId) return 1;
  const stats = Array.isArray(userDoc.classroomStats)
    ? userDoc.classroomStats.find(s => String(s.classroom) === String(classroomId))
    : null;
  if (!stats) return 1;
  const m = Number(stats.passiveAttributes?.multiplier ?? 1);
  return Number.isFinite(m) && m > 0 ? m : 1;
}

// helper: XP bits computation (same as wallet.js)
function computeXPBits({ numericAmount, adjustedAmount, xpSettings }) {
  if (!xpSettings) return numericAmount;
  const basis = xpSettings.bitsXPBasis || 'final';
  return Math.abs(basis === 'base' ? numericAmount : adjustedAmount);
}

// ═══════════════════════════════════════════════════════════════
//  APP MANAGEMENT (session-auth, teacher only)
// ═══════════════════════════════════════════════════════════════

// Create integration app
router.post('/apps', ensureAuthenticated, async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can create integration apps' });
  }

  try {
    const { name, description, icon, classrooms, scopes } = req.body;
    if (!name) return res.status(400).json({ error: 'App name is required' });

    const validScopes = (scopes || []).filter(s => IntegrationApp.VALID_SCOPES.includes(s));
    if (validScopes.length === 0) {
      return res.status(400).json({
        error: 'At least one valid scope is required',
        validScopes: IntegrationApp.VALID_SCOPES
      });
    }

    const credentials = IntegrationApp.generateCredentials();

    const app = new IntegrationApp({
      name,
      description: description || '',
      icon: icon || '🔌',
      ...credentials,
      owner: req.user._id,
      classrooms: classrooms || [],
      scopes: validScopes
    });

    await app.save();

    res.status(201).json({
      _id: app._id,
      name: app.name,
      clientId: app.clientId,
      apiKey: credentials.apiKey,
      scopes: app.scopes,
      classrooms: app.classrooms,
      createdAt: app.createdAt,
      message: 'Save the API key — it will not be shown again.'
    });
  } catch (err) {
    console.error('[integrations] create app error:', err);
    res.status(500).json({ error: 'Failed to create integration app' });
  }
});

// List teacher's apps (key masked)
router.get('/apps', ensureAuthenticated, async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const apps = await IntegrationApp.find({ owner: req.user._id })
      .select('-apiKey')
      .populate('classrooms', 'name code')
      .lean();

    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list integration apps' });
  }
});

// Get single app details
router.get('/apps/:id', ensureAuthenticated, async (req, res) => {
  try {
    const app = await IntegrationApp.findOne({ _id: req.params.id, owner: req.user._id })
      .select('-apiKey')
      .populate('classrooms', 'name code')
      .lean();
    if (!app) return res.status(404).json({ error: 'App not found' });
    res.json(app);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch app' });
  }
});

// Update app (name, description, scopes, classrooms)
router.patch('/apps/:id', ensureAuthenticated, async (req, res) => {
  try {
    const app = await IntegrationApp.findOne({ _id: req.params.id, owner: req.user._id });
    if (!app) return res.status(404).json({ error: 'App not found' });

    if (typeof req.body.active === 'boolean') {
      if (req.body.active && !app.active) {
        app.resumedAt = new Date();
      } else if (!req.body.active && app.active) {
        app.pausedAt = new Date();
      }
      app.active = req.body.active;
    }

    const { name, description, icon, scopes, classrooms, active } = req.body;
    if (name !== undefined) app.name = name;
    if (description !== undefined) app.description = description;
    if (icon !== undefined) app.icon = icon;
    if (active !== undefined) app.active = active;
    if (Array.isArray(scopes)) {
      app.scopes = scopes.filter(s => IntegrationApp.VALID_SCOPES.includes(s));
    }
    if (Array.isArray(classrooms)) app.classrooms = classrooms;

    await app.save();
    res.json(app);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update app' });
  }
});

// Deactivate app
router.delete('/apps/:id', ensureAuthenticated, async (req, res) => {
  try {
    const app = await IntegrationApp.findOne({ _id: req.params.id, owner: req.user._id });
    if (!app) return res.status(404).json({ error: 'App not found' });

    app.active = false;
    app.deactivatedAt = new Date();
    await app.save();
    res.json({ message: 'Integration app deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate app' });
  }
});

// Regenerate API key
router.post('/apps/:id/regenerate-key', ensureAuthenticated, async (req, res) => {
  try {
    const app = await IntegrationApp.findOne({ _id: req.params.id, owner: req.user._id });
    if (!app) return res.status(404).json({ error: 'App not found' });

    const { apiKey } = IntegrationApp.generateCredentials();
    app.apiKey = apiKey;
    app.keyRegeneratedAt = new Date();
    await app.save();

    res.json({
      apiKey,
      message: 'New API key generated. Save it — it will not be shown again.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to regenerate key' });
  }
});

// ═══════════════════════════════════════════════════════════════
//  WEBHOOK MANAGEMENT
// ═══════════════════════════════════════════════════════════════

router.post('/apps/:id/webhooks', ensureAuthenticated, async (req, res) => {
  try {
    const app = await IntegrationApp.findOne({ _id: req.params.id, owner: req.user._id });
    if (!app) return res.status(404).json({ error: 'App not found' });

    const { event, url } = req.body;
    if (!event || !url) return res.status(400).json({ error: 'event and url required' });

    const secret = crypto.randomBytes(32).toString('hex');
    app.webhooks.push({ event, url, secret });
    await app.save();

    const hook = app.webhooks[app.webhooks.length - 1];
    res.status(201).json({
      _id: hook._id,
      event,
      url,
      secret,
      message: 'Save the webhook secret — it will not be shown again.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

router.delete('/apps/:id/webhooks/:hookId', ensureAuthenticated, async (req, res) => {
  try {
    const app = await IntegrationApp.findOne({ _id: req.params.id, owner: req.user._id });
    if (!app) return res.status(404).json({ error: 'App not found' });

    app.webhooks = app.webhooks.filter(w => w._id.toString() !== req.params.hookId);
    await app.save();
    res.json({ message: 'Webhook removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove webhook' });
  }
});

// ═══════════════════════════════════════════════════════════════
//  INTEGRATION API ENDPOINTS (API key auth)
// ═══════════════════════════════════════════════════════════════

// --- Match student names → IDs ---
router.post('/users/match', ensureAuthenticated, requireScope('users:match'), async (req, res) => {
  try {
    const { classroomId, students } = req.body;
    if (!classroomId || !Array.isArray(students)) {
      return res.status(400).json({ error: 'classroomId and students[] required' });
    }

    const classroom = await Classroom.findById(classroomId)
      .populate('students', 'firstName lastName email');
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    const enrolled = classroom.students || [];
    const matched = [];
    const unmatched = [];

    for (const s of students) {
      const inputName = (s.name || '').trim().toLowerCase();
      if (!inputName) { unmatched.push({ ...s, reason: 'Empty name' }); continue; }

      let found = null;

      // 1. Exact: "First Last"
      if (!found) found = enrolled.find(u =>
        `${u.firstName || ''} ${u.lastName || ''}`.trim().toLowerCase() === inputName
      );
      // 2. Reversed: "Last First"
      if (!found) found = enrolled.find(u =>
        `${u.lastName || ''} ${u.firstName || ''}`.trim().toLowerCase() === inputName
      );
      // 3. "Last, First"
      if (!found && inputName.includes(',')) {
        const [l, f] = inputName.split(',').map(p => p.trim());
        found = enrolled.find(u =>
          (u.lastName || '').toLowerCase() === l && (u.firstName || '').toLowerCase() === f
        );
      }
      // 4. Token match (both first and last appear in input)
      if (!found) {
        const tokens = inputName.split(/\s+/);
        found = enrolled.find(u => {
          const f = (u.firstName || '').toLowerCase();
          const l = (u.lastName || '').toLowerCase();
          return f && l && tokens.includes(f) && tokens.includes(l);
        });
      }
      // 5. Email match
      if (!found && inputName.includes('@')) {
        found = enrolled.find(u => (u.email || '').toLowerCase() === inputName);
      }

      if (found) {
        matched.push({
          ...s,
          studentId: found._id,
          matchedName: `${found.firstName || ''} ${found.lastName || ''}`.trim(),
          email: found.email
        });
      } else {
        unmatched.push({ ...s, reason: 'No matching student found' });
      }
    }

    res.json({ matched, unmatched, total: students.length });
  } catch (err) {
    console.error('[integrations/users/match]', err);
    res.status(500).json({ error: 'Student matching failed' });
  }
});

// --- List classroom students ---
router.get('/users/list/:classroomId', ensureAuthenticated, requireScope('users:read'), async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.classroomId)
      .populate('students', 'firstName lastName email');
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    res.json({
      classroomId: classroom._id,
      className: classroom.name,
      students: (classroom.students || []).map(s => ({
        studentId: s._id,
        name: `${s.firstName || ''} ${s.lastName || ''}`.trim(),
        email: s.email
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list students' });
  }
});

// --- Classroom info ---
router.get('/classroom/:classroomId', ensureAuthenticated, requireScope('classroom:read'), async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.classroomId)
      .select('name code students');
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    res.json({
      _id: classroom._id,
      name: classroom.name,
      code: classroom.code,
      studentCount: classroom.students?.length || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read classroom' });
  }
});

// --- Bulk wallet adjustment ---
router.post('/wallet/adjust', ensureAuthenticated, requireScope('wallet:adjust'), async (req, res) => {
  try {
    const {
      classroomId,
      updates,
      description = '',
      applyGroupMultipliers = true,
      applyPersonalMultipliers = true
    } = req.body;

    if (!classroomId || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'classroomId and updates[] required' });
    }

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    const appName = req.integrationApp?.name || 'Unknown Integration';
    const appLabel = `App Integration "${appName}"`;

    const results = { updated: 0, skipped: [], details: [] };

    for (const { studentId, amount } of updates) {
      try {
        const numericAmount = Number(amount);
        if (!studentId || isNaN(numericAmount) || numericAmount === 0) {
          results.skipped.push({ studentId, reason: 'Invalid studentId or amount' });
          continue;
        }

        const student = await User.findById(studentId);
        if (!student) {
          results.skipped.push({ studentId, reason: 'Student not found' });
          continue;
        }

        // Multipliers
        const groupMultiplier = (applyGroupMultipliers && numericAmount > 0)
          ? await getUserGroupMultiplier(studentId, classroomId)
          : 1;
        const personalMultiplier = (applyPersonalMultipliers && numericAmount > 0)
          ? getPersonalMultiplierForClassroom(student, classroomId)
          : 1;

        // Additive multiplier (same logic as wallet.js)
        let finalMultiplier = 1;
        if (numericAmount > 0) {
          if (applyGroupMultipliers) finalMultiplier += (groupMultiplier - 1);
          if (applyPersonalMultipliers) finalMultiplier += (personalMultiplier - 1);
        }

        const adjustedAmount = Math.round(numericAmount * finalMultiplier);

        // Update classroom-scoped balance
        let cb = (student.classroomBalances || []).find(b => String(b.classroom) === String(classroomId));
        if (cb) {
          cb.balance = (cb.balance || 0) + adjustedAmount;
        } else {
          if (!student.classroomBalances) student.classroomBalances = [];
          student.classroomBalances.push({ classroom: classroomId, balance: adjustedAmount });
        }

        // Update classroomStats balance too
        let cs = (student.classroomStats || []).find(s => String(s.classroom) === String(classroomId));
        if (cs) {
          cs.balance = (cs.balance || 0) + adjustedAmount;
        }

        // Transaction record
        student.transactions.push({
          amount: adjustedAmount,
          description: description
            ? `${description} (${appLabel})`
            : `Adjustment via ${appLabel}`,
          type: numericAmount >= 0 ? 'credit' : 'debit',
          classroom: classroomId,
          assignedBy: req.user._id,
          calculation: finalMultiplier !== 1 ? {
            baseAmount: numericAmount,
            personalMultiplier,
            groupMultiplier,
            totalMultiplier: finalMultiplier,
            finalAmount: adjustedAmount
          } : undefined,
          createdAt: new Date()
        });

        await student.save();

        // === NEW: Create wallet transaction notification (like normal wallet assign) ===
        try {
          const notification = await Notification.create({
            user: studentId,
            actionBy: req.user._id,
            type: 'wallet_transaction',
            message: `You were ${numericAmount >= 0 ? 'credited' : 'debited'} ${Math.abs(adjustedAmount)} ₿ via ${appLabel}.`,
            classroom: classroomId,
            amount: adjustedAmount,
            read: false,
            createdAt: new Date()
          });
          const populated = await populateNotification(notification._id);
          if (io && populated) {
            io.to(`user-${studentId}`).emit('notification', populated);
          }
        } catch (notifErr) {
          console.warn('[integration] failed to create wallet notification:', notifErr);
        }

        // ── XP award + stat-change log ──
        if (adjustedAmount > 0 && classroom?.xpSettings?.enabled) {
          const xpRate = (classroom.xpSettings.bitsEarned || 0);
          if (xpRate > 0) {
            const xpBits = computeXPBits({
              numericAmount,
              adjustedAmount,
              xpSettings: classroom.xpSettings
            });
            const xpToAward = xpBits * xpRate;
            if (xpToAward > 0) {
              try {
                const ioInstance = req.app && req.app.get ? req.app.get('io') : null;
                const xpRes = await awardXP(studentId, classroomId, xpToAward, `earning bits (${appLabel})`, classroom.xpSettings);
                if (xpRes && typeof xpRes.oldXP !== 'undefined' && typeof xpRes.newXP !== 'undefined' && xpRes.newXP !== xpRes.oldXP) {
                  try {
                    // logStatChanges needs the full user doc, reload to get fresh state
                    const freshStudent = await User.findById(studentId).select('firstName lastName');
                    if (freshStudent) {
                      await logStatChanges({
                        io: ioInstance,
                        classroomId,
                        user: freshStudent,
                        actionBy: req.user ? req.user._id : undefined,
                        prevStats: { xp: xpRes.oldXP },
                        currStats: { xp: xpRes.newXP },
                        context: `integration adjustment (${appLabel})`,
                        details: { effectsText: `Balance adjustment: ${adjustedAmount} ₿ via ${appLabel}` },
                        forceLog: true
                      });
                    }
                  } catch (logErr) {
                    console.warn('[integration] failed to log XP stat change:', logErr);
                  }
                }
              } catch (xpErr) {
                console.warn('[integration] awardXP failed:', xpErr);
              }
            }
          }
        }

        // Emit balance_update to both user AND classroom rooms
        try {
          if (io) {
            const newBalance = cb ? cb.balance : adjustedAmount;
            io.to(`user-${studentId}`).emit('balance_update', {
              userId: studentId,
              classroomId,
              newBalance
            });
            io.to(`classroom-${classroomId}`).emit('balance_update', {
              studentId,
              classroomId,
              newBalance
            });
          }
        } catch (socketErr) {
          console.warn('[integration] socket emit failed:', socketErr);
        }

        results.updated++;
        results.details.push({
          studentId,
          name: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
          baseAmount: numericAmount,
          finalAmount: adjustedAmount,
          multiplier: finalMultiplier,
          personalMultiplier,
          groupMultiplier
        });

      } catch (studentErr) {
        results.skipped.push({ studentId, reason: studentErr.message });
      }
    }

    // Dispatch webhook
    dispatchWebhook('wallet.updated', classroomId, {
      source: appName,
      updated: results.updated,
      description
    });

    res.json({
      message: `${results.updated} updated, ${results.skipped.length} skipped`,
      ...results
    });
  } catch (err) {
    console.error('[integrations/wallet/adjust]', err);
    res.status(500).json({ error: 'Wallet adjustment failed' });
  }
});

// Redeem an inventory item via integration API
router.post('/inventory/redeem', ensureAuthenticated, requireScope('inventory:use'), async (req, res) => {
  try {
    const { classroomId, studentId, itemId, redemptionData } = req.body;
    if (!classroomId || !studentId || !itemId) {
      return res.status(400).json({ error: 'classroomId, studentId, and itemId are required' });
    }

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(classroomId) ||
        !mongoose.Types.ObjectId.isValid(studentId) ||
        !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ error: 'classroomId, studentId, and itemId must be valid 24-character MongoDB ObjectIds' });
    }

    const app = req.integrationApp;
    if (!app.classrooms.map(String).includes(String(classroomId))) {
      return res.status(403).json({ error: 'App not authorized for this classroom' });
    }

    const Item = require('../models/Item');
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (String(item.owner) !== String(studentId)) {
      return res.status(403).json({ error: 'Item not owned by this student' });
    }
    if (item.consumed) {
      return res.status(400).json({ error: 'Item already consumed' });
    }

    // Only allow redemption of passive items with no secondary effects.
    // Items with effects (Attack, Defend, Utility, MysteryBox, or Passive items
    // with secondary effects) must be used through their dedicated in-app flows
    // to ensure effects are properly applied, orders recorded, and stats updated.
    if (item.category !== 'Passive') {
      return res.status(400).json({
        error: `Only passive items without effects can be redeemed through the API. This item is a ${item.category} item — it must be used through the Prizeversity app.`
      });
    }

    if (item.secondaryEffects && item.secondaryEffects.length > 0) {
      return res.status(400).json({
        error: 'This passive item has secondary effects (e.g., luck, multiplier boosts) and must be equipped through the Prizeversity app so effects are properly applied.'
      });
    }

    // Mark as redeemed
    item.consumed = true;
    item.usesRemaining = 0;
    if (redemptionData) item.redemptionData = redemptionData;
    await item.save();

    // Dispatch webhook
    dispatchWebhook('item.redeemed', classroomId, {
      studentId,
      itemId: item._id,
      itemName: item.name,
      category: item.category,
      redemptionData
    });

    res.json({
      message: 'Item redeemed successfully',
      item: {
        _id: item._id,
        name: item.name,
        category: item.category,
        redemptionData
      }
    });
  } catch (err) {
    console.error('[Integration redeem]', err);
    res.status(500).json({ error: 'Failed to redeem item' });
  }
});

// --- Read student inventory via integration API ---
router.get('/inventory/:studentId', ensureAuthenticated, requireScope('inventory:read'), async (req, res) => {
  try {
    const { studentId } = req.params;
    const { classroomId } = req.query;

    if (!classroomId) {
      return res.status(400).json({ error: 'classroomId query param is required' });
    }

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(studentId) || !mongoose.Types.ObjectId.isValid(classroomId)) {
      return res.status(400).json({ error: 'Invalid studentId or classroomId' });
    }

    const app = req.integrationApp;
    if (!app.classrooms.map(String).includes(String(classroomId))) {
      return res.status(403).json({ error: 'App not authorized for this classroom' });
    }

    const Item = require('../models/Item');
    const items = await Item.find({
      owner: studentId,
      consumed: { $ne: true },
      usesRemaining: { $gt: 0 }
    }).populate({
      path: 'bazaar',
      populate: { path: 'classroom', select: '_id' }
    });

    // Filter to only items from this classroom
    const filtered = items.filter(item =>
      item.bazaar && item.bazaar.classroom && String(item.bazaar.classroom._id) === String(classroomId)
    );

    res.json({
      studentId,
      classroomId,
      items: filtered.map(item => ({
        _id: item._id,
        name: item.name,
        description: item.description,
        category: item.category,
        price: item.price,
        active: item.active,
        consumed: item.consumed,
        usesRemaining: item.usesRemaining,
        secondaryEffects: item.secondaryEffects || [],
        redeemableViaAPI: item.category === 'Passive' && (!item.secondaryEffects || item.secondaryEffects.length === 0)
      }))
    });
  } catch (err) {
    console.error('[Integration inventory read]', err);
    res.status(500).json({ error: 'Failed to read inventory' });
  }
});

module.exports = router;