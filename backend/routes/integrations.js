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
const Item = require('../models/Item');
const GroupSet = require('../models/GroupSet');
const Group = require('../models/Group');
const Badge = require('../models/Badge');
const { calculateNextLevelProgress } = require('../utils/xp');

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

// --- Match user names → IDs ---
router.post('/users/match', ensureAuthenticated, requireScope('users:match'), async (req, res) => {
  try {
    const { classroomId, users } = req.body;
    if (!classroomId || !Array.isArray(users)) {
      return res.status(400).json({ error: 'classroomId and users[] required' });
    }

    const classroom = await Classroom.findById(classroomId)
      .populate('students', 'firstName lastName email');
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    const enrolled = classroom.students || [];
    const matched = [];
    const unmatched = [];

    for (const s of users) {
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
          userId: found._id,
          matchedName: `${found.firstName || ''} ${found.lastName || ''}`.trim(),
          email: found.email
        });
      } else {
        unmatched.push({ ...s, reason: 'No matching user found' });
      }
    }

    res.json({ matched, unmatched, total: users.length });
  } catch (err) {
    console.error('[integrations/users/match]', err);
    res.status(500).json({ error: 'User matching failed' });
  }
});

// --- List classroom users ---
router.get('/users/list/:classroomId', ensureAuthenticated, requireScope('users:read'), async (req, res) => {
  try {
    const classroomId = req.params.classroomId;
    const extended = req.query.fields === 'extended';

    const selectFields = extended
      ? 'firstName lastName email shortId classroomBalances classroomJoinDates classroomXP classroomStats classroomActivityDurations groups'
      : 'firstName lastName email';

    const classroom = await Classroom.findById(classroomId)
      .populate('students', selectFields)
      .populate('admins', selectFields)
      .populate('teacher', selectFields);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    // Merge students + admins + teacher into a single deduplicated list
    const seenIds = new Set();
    const allMembers = [];
    for (const list of [classroom.students || [], classroom.admins || [], classroom.teacher ? [classroom.teacher] : []]) {
      for (const u of list) {
        if (!u || !u._id) continue;
        const uid = String(u._id);
        if (seenIds.has(uid)) continue;
        seenIds.add(uid);
        allMembers.push(u);
      }
    }

    if (!extended) {
      return res.json({
        classroomId: classroom._id,
        className: classroom.name,
        users: allMembers.map(s => ({
          userId: s._id,
          name: `${s.firstName || ''} ${s.lastName || ''}`.trim(),
          email: s.email
        }))
      });
    }

    // --- Extended mode: batch-load supporting data ---
    const memberIds = allMembers.map(s => s._id);
    const adminIdSet = new Set((classroom.admins || []).map(a => String(a._id || a)));
    const teacherId = classroom.teacher ? String(classroom.teacher._id || classroom.teacher) : null;

    // Load items for all members in this classroom's bazaar
    const allItems = await Item.find({ owner: { $in: memberIds } })
      .populate({ path: 'bazaar', select: 'classroom' })
      .lean();
    const itemsByUser = {};
    for (const item of allItems) {
      if (!item.bazaar || String(item.bazaar.classroom) !== String(classroomId)) continue;
      const ownerId = String(item.owner);
      if (!itemsByUser[ownerId]) itemsByUser[ownerId] = [];
      itemsByUser[ownerId].push(item);
    }

    // Aggregate total spent per user (sum of negative classroom-scoped transactions,
    // excluding teacher/admin adjustments to match People page behavior)
    const teacherAndAdminIds = [
      ...(classroom.admins || []).map(a => a._id || a),
      ...(teacherId ? [classroom.teacher._id || classroom.teacher] : [])
    ];
    const spentAgg = await User.aggregate([
      { $match: { _id: { $in: memberIds } } },
      { $unwind: '$transactions' },
      { $match: {
        'transactions.classroom': classroom._id,
        'transactions.amount': { $lt: 0 },
        ...(teacherAndAdminIds.length > 0
          ? { 'transactions.assignedBy': { $nin: teacherAndAdminIds } }
          : {})
      }},
      { $group: { _id: '$_id', totalSpent: { $sum: '$transactions.amount' } } }
    ]);
    const totalSpentByUser = {};
    for (const row of spentAgg) {
      totalSpentByUser[String(row._id)] = Math.abs(row.totalSpent);
    }

    // Load groups for this classroom
    const groupSets = await GroupSet.find({ classroom: classroomId })
      .populate({ path: 'groups', populate: { path: 'members._id', select: '_id' } })
      .lean();

    // Load all badges for this classroom (for earned/equipped badge lookups)
    const classroomBadges = await Badge.find({ classroom: classroomId })
      .select('name description icon image levelRequired')
      .lean();
    const badgesById = {};
    for (const b of classroomBadges) badgesById[String(b._id)] = b;

    // XP settings for level progress calculation
    const formula = classroom.xpSettings?.levelingFormula || 'exponential';
    const baseXP = classroom.xpSettings?.baseXPForLevel2 || 100;

    // Build per-user group info and group multiplier
    function getUserGroups(userId) {
      const uid = String(userId);
      const result = [];
      let groupMultiplier = 1;
      for (const gs of groupSets) {
        for (const g of (gs.groups || [])) {
          const isMember = (g.members || []).some(
            m => String(m._id?._id || m._id) === uid && m.status === 'approved'
          );
          if (isMember) {
            result.push({ groupSetId: gs._id, groupSetName: gs.name, groupId: g._id, groupName: g.name });
            const mult = g.groupMultiplier || 1;
            if (mult > 1) groupMultiplier += (mult - 1);
          }
        }
      }
      return { groups: result, groupMultiplier };
    }

    // Banned records lookup
    const bannedRecords = {};
    for (const rec of (classroom.bannedRecords || [])) {
      bannedRecords[String(rec.user)] = rec;
    }
    const bannedSet = new Set((classroom.bannedStudents || []).map(id => String(id)));

    const attackEffects = ['halveBits', 'drainBits', 'swapper', 'nullify'];

    const users = allMembers.map(s => {
      const uid = String(s._id);
      const items = itemsByUser[uid] || [];

      // Balance
      const cb = (s.classroomBalances || []).find(b => String(b.classroom) === String(classroomId));
      const balance = cb ? cb.balance : 0;

      // Total spent
      const totalSpent = totalSpentByUser[uid] || 0;

      // Join date & last accessed
      const joinEntry = (s.classroomJoinDates || []).find(j => String(j.classroom) === String(classroomId));

      // XP, Level & Badges
      const xpEntry = (s.classroomXP || []).find(x => String(x.classroom) === String(classroomId));
      const currentXP = xpEntry?.xp || 0;
      const currentLevel = xpEntry?.level || 1;
      const xpProgress = calculateNextLevelProgress(currentXP, currentLevel, formula, baseXP);

      // Earned badges
      const earnedBadges = (xpEntry?.earnedBadges || []).map(eb => {
        const badge = badgesById[String(eb.badge)];
        return badge ? { badgeId: eb.badge, name: badge.name, description: badge.description, icon: badge.icon, image: badge.image, levelRequired: badge.levelRequired, earnedAt: eb.earnedAt } : null;
      }).filter(Boolean);

      // Equipped badge
      const equippedBadgeData = xpEntry?.equippedBadge ? badgesById[String(xpEntry.equippedBadge)] : null;

      // Stats (classroom-scoped)
      const cs = (s.classroomStats || []).find(c => String(c.classroom) === String(classroomId));
      const passive = cs?.passiveAttributes || {};
      const shieldCount = cs?.shieldCount ?? 0;
      const shieldActive = cs?.shieldActive ?? (shieldCount > 0);

      // Activity
      const actEntry = (s.classroomActivityDurations || []).find(a => String(a.classroom) === String(classroomId));
      const totalActivitySeconds = actEntry?.totalSeconds || 0;

      // Item-based stats
      const passiveItems = items.filter(i => i.category === 'Passive');
      const attackCount = items.filter(i => {
        const effect = i.primaryEffect || i.effect;
        const hasUses = (i.usesRemaining ?? 1) > 0 && !i.consumed;
        return hasUses && i.category === 'Attack' && attackEffects.includes(effect);
      }).length;
      const hasEffect = (name) => passiveItems.some(i => i.primaryEffect === name);

      // Groups
      const { groups, groupMultiplier } = getUserGroups(s._id);

      // Role
      let role = 'student';
      if (teacherId === uid) role = 'teacher';
      else if (adminIdSet.has(uid)) role = 'admin';

      // Ban info
      const isBanned = bannedSet.has(uid);
      const banRecord = bannedRecords[uid];

      return {
        userId: s._id,
        shortId: s.shortId,
        name: `${s.firstName || ''} ${s.lastName || ''}`.trim(),
        firstName: s.firstName || '',
        lastName: s.lastName || '',
        email: s.email,
        role,
        balance: Math.round(balance * 100) / 100,
        totalSpent: Math.round(totalSpent * 100) / 100,
        joinedDate: joinEntry?.joinedAt || null,
        lastAccessed: joinEntry?.lastAccessed || null,
        totalActivitySeconds,
        level: currentLevel,
        xp: currentXP,
        xpProgress: {
          xpForCurrentLevel: xpProgress.xpForCurrentLevel,
          xpForNextLevel: xpProgress.xpForNextLevel,
          xpInCurrentLevel: xpProgress.xpInCurrentLevel,
          xpRequiredForLevel: xpProgress.xpRequiredForLevel,
          xpNeeded: xpProgress.xpNeeded,
          progress: xpProgress.progress
        },
        earnedBadges,
        equippedBadge: equippedBadgeData ? { badgeId: equippedBadgeData._id, name: equippedBadgeData.name, icon: equippedBadgeData.icon, image: equippedBadgeData.image } : null,
        stats: {
          luck: passive.luck || 1,
          multiplier: passive.multiplier || 1,
          groupMultiplier,
          shieldActive,
          shieldCount,
          attackPower: attackCount,
          doubleEarnings: hasEffect('doubleEarnings'),
          discountShop: (passive.discount != null) ? passive.discount : (hasEffect('discountShop') ? 20 : 0),
          passiveItemsCount: passiveItems.length
        },
        groups,
        ...(isBanned ? { isBanned: true, banReason: banRecord?.reason || null, bannedAt: banRecord?.bannedAt || null } : {})
      };
    });

    res.json({
      classroomId: classroom._id,
      className: classroom.name,
      users
    });
  } catch (err) {
    console.error('[integrations/users/list]', err);
    res.status(500).json({ error: 'Failed to list users' });
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
      userCount: classroom.students?.length || 0
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
    const io = req.app.get('io'); // ← ADD THIS LINE

    const results = { updated: 0, skipped: [], details: [] };

    for (const { userId, amount } of updates) {
      try {
        const numericAmount = Number(amount);
        if (!userId || isNaN(numericAmount) || numericAmount === 0) {
          results.skipped.push({ userId, reason: 'Invalid userId or amount' });
          continue;
        }

        const targetUser = await User.findById(userId);
        if (!targetUser) {
          results.skipped.push({ userId, reason: 'User not found' });
          continue;
        }

        // Multipliers
        const groupMultiplier = (applyGroupMultipliers && numericAmount > 0)
          ? await getUserGroupMultiplier(userId, classroomId)
          : 1;
        const personalMultiplier = (applyPersonalMultipliers && numericAmount > 0)
          ? getPersonalMultiplierForClassroom(targetUser, classroomId)
          : 1;

        // Additive multiplier (same logic as wallet.js)
        let finalMultiplier = 1;
        if (numericAmount > 0) {
          if (applyGroupMultipliers) finalMultiplier += (groupMultiplier - 1);
          if (applyPersonalMultipliers) finalMultiplier += (personalMultiplier - 1);
        }

        const adjustedAmount = Math.round(numericAmount * finalMultiplier);

        // Update classroom-scoped balance
        let cb = (targetUser.classroomBalances || []).find(b => String(b.classroom) === String(classroomId));
        if (cb) {
          cb.balance = (cb.balance || 0) + adjustedAmount;
        } else {
          if (!targetUser.classroomBalances) targetUser.classroomBalances = [];
          targetUser.classroomBalances.push({ classroom: classroomId, balance: adjustedAmount });
        }

        // Update classroomStats balance too
        let cs = (targetUser.classroomStats || []).find(s => String(s.classroom) === String(classroomId));
        if (cs) {
          cs.balance = (cs.balance || 0) + adjustedAmount;
        }

        // Transaction record
        targetUser.transactions.push({
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

        await targetUser.save();

        // === NEW: Create wallet transaction notification (like normal wallet assign) ===
        try {
          const notification = await Notification.create({
            user: userId,
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
            io.to(`user-${userId}`).emit('notification', populated);
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
                const xpRes = await awardXP(userId, classroomId, xpToAward, `earning bits (${appLabel})`, classroom.xpSettings);
                if (xpRes && typeof xpRes.oldXP !== 'undefined' && typeof xpRes.newXP !== 'undefined' && xpRes.newXP !== xpRes.oldXP) {
                  try {
                    // logStatChanges needs the full user doc, reload to get fresh state
                    const freshUser = await User.findById(userId).select('firstName lastName');
                    if (freshUser) {
                      await logStatChanges({
                        io: ioInstance,
                        classroomId,
                        user: freshUser,
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
            io.to(`user-${userId}`).emit('balance_update', {
              userId,
              classroomId,
              newBalance
            });
            io.to(`classroom-${classroomId}`).emit('balance_update', {
              userId,
              classroomId,
              newBalance
            });
          }
        } catch (socketErr) {
          console.warn('[integration] socket emit failed:', socketErr);
        }

        results.updated++;
        results.details.push({
          userId,
          name: `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim(),
          baseAmount: numericAmount,
          finalAmount: adjustedAmount,
          multiplier: finalMultiplier,
          personalMultiplier,
          groupMultiplier
        });

      } catch (userErr) {
        results.skipped.push({ userId, reason: userErr.message });
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
    const { classroomId, userId, itemId, redemptionData } = req.body;
    if (!classroomId || !userId || !itemId) {
      return res.status(400).json({ error: 'classroomId, userId, and itemId are required' });
    }

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(classroomId) ||
        !mongoose.Types.ObjectId.isValid(userId) ||
        !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ error: 'classroomId, userId, and itemId must be valid 24-character MongoDB ObjectIds' });
    }

    const app = req.integrationApp;
    if (!app.classrooms.map(String).includes(String(classroomId))) {
      return res.status(403).json({ error: 'App not authorized for this classroom' });
    }

    const Item = require('../models/Item');
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (String(item.owner) !== String(userId)) {
      return res.status(403).json({ error: 'Item not owned by this user' });
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
      userId,
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

// --- Read user inventory via integration API ---
router.get('/inventory/:userId', ensureAuthenticated, requireScope('inventory:read'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { classroomId } = req.query;

    if (!classroomId) {
      return res.status(400).json({ error: 'classroomId query param is required' });
    }

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(classroomId)) {
      return res.status(400).json({ error: 'Invalid userId or classroomId' });
    }

    const app = req.integrationApp;
    if (!app.classrooms.map(String).includes(String(classroomId))) {
      return res.status(403).json({ error: 'App not authorized for this classroom' });
    }

    const Item = require('../models/Item');
    const items = await Item.find({
      owner: userId,
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
      userId,
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