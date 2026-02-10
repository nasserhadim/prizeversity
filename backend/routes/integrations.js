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
const { getScopedUserStats, isClassroomAdmin } = require('../utils/classroomStats');
const { dispatchWebhook } = require('../utils/webhookDispatcher');

// helper: classroom-scoped personal multiplier
function getPersonalMultiplierForClassroom(userDoc, classroomId) {
  if (!userDoc || !classroomId) return 1;
  const stats = Array.isArray(userDoc.classroomStats)
    ? userDoc.classroomStats.find(s => String(s.classroom) === String(classroomId))
    : null;
  return stats?.multiplier ?? 1;
}

// helper: group multiplier
async function getGroupMultiplierForStudent(studentId, classroomId) {
  try {
    const GroupSet = require('../models/GroupSet');
    const groupSets = await GroupSet.find({ classroom: classroomId }).populate('groups');
    for (const gs of groupSets) {
      for (const g of gs.groups) {
        const isMember = (g.members || []).some(m => {
          const mid = m._id ? (m._id._id || m._id) : m;
          return String(mid) === String(studentId) && m.status === 'approved';
        });
        if (isMember && g.multiplier && g.multiplier !== 1) {
          return g.multiplier;
        }
      }
    }
    return 1;
  } catch {
    return 1;
  }
}

// helper: XP bits computation (same as wallet.js)
function computeXPBits({ numericAmount, adjustedAmount, xpSettings }) {
  if (!xpSettings) return numericAmount;
  const basis = xpSettings.xpBasis || 'base';
  return basis === 'adjusted' ? adjustedAmount : numericAmount;
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

    const appName = req.integrationApp?.name || 'External Integration';
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
          ? await getGroupMultiplierForStudent(studentId, classroomId)
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
          description: description || `${appName} adjustment`,
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

        // XP award
        if (adjustedAmount > 0 && classroom.xpSettings?.enabled) {
          const xpRate = classroom.xpSettings.bitsEarned || 0;
          if (xpRate > 0) {
            const xpBits = computeXPBits({
              numericAmount,
              adjustedAmount,
              xpSettings: classroom.xpSettings
            });
            const xpToAward = xpBits * xpRate;
            if (xpToAward > 0) {
              try {
                const xpRes = await awardXP(studentId, classroomId, xpToAward, `earning bits (${appName})`, classroom.xpSettings);
                if (xpRes && typeof xpRes.oldXP !== 'undefined' && typeof xpRes.newXP !== 'undefined' && xpRes.newXP !== xpRes.oldXP) {
                  try {
                    await logStatChanges({
                      io: req.app?.get?.('io') || null,
                      classroomId,
                      user: student,
                      actionBy: req.user._id,
                      changes: [{ stat: 'xp', from: xpRes.oldXP, to: xpRes.newXP }],
                      source: appName
                    });
                  } catch (logErr) {
                    console.warn('[integration] logStatChanges failed:', logErr);
                  }
                }
              } catch (xpErr) {
                console.warn('[integration] awardXP failed:', xpErr);
              }
            }
          }
        }

        // Socket event
        try {
          const io = req.app?.get?.('io');
          if (io) {
            const newBalance = (student.classroomBalances || [])
              .find(b => String(b.classroom) === String(classroomId))?.balance || 0;
            io.to(`user-${studentId}`).emit('balance_update', {
              userId: studentId,
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

module.exports = router;