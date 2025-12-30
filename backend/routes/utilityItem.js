const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const { ensureAuthenticated } = require('../config/auth');
const Classroom = require('../models/Classroom');
const { awardXP } = require('../utils/awardXP');
const { logStatChanges } = require('../utils/statChangeLog');
const { getClassroomIdFromReq, getScopedUserStats } = require('../utils/classroomStats');

// Utility item is another category for items in the bazaar workign with a discount and multipleir
router.post('/use/:itemId', ensureAuthenticated, async (req, res) => {
  try {
    const classroomId = getClassroomIdFromReq(req);

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const item = await Item.findById(req.params.itemId);
    if (!item || item.owner.toString() !== user._id.toString()) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // classroom-scoped snapshot before (from the SAME doc we will mutate/save)
    const scopedBefore = getScopedUserStats(user, classroomId, { create: true });
    const before = {
      multiplier: scopedBefore.passive?.multiplier ?? 1,
      discount: scopedBefore.passive?.discount ?? 0,
      luck: scopedBefore.passive?.luck ?? 1,
      shield: scopedBefore.shieldCount ?? 0
    };

    // Write target: classroom-scoped entry if available, else legacy global
    const passiveTarget = scopedBefore.cs
      ? scopedBefore.cs.passiveAttributes
      : (user.passiveAttributes ||= {});

    // Apply utility effect (MUTATE `user`, not `req.user`)
    switch (item.primaryEffect) {
      case 'doubleEarnings': {
        passiveTarget.multiplier = (Number(passiveTarget.multiplier ?? 1) || 1) * 2;
        // optional: round to 1 decimal for consistent UI/logging
        passiveTarget.multiplier = Math.round(passiveTarget.multiplier * 10) / 10;
        break;
      }

      case 'discountShop': {
        const pct = Math.round(Number(item.primaryEffectValue ?? 20) || 20);
        passiveTarget.discount = Math.max(0, Math.min(100, pct));

        // Clear discount after 24h (fetch fresh doc; update classroom-scoped entry)
        setTimeout(async () => {
          try {
            const fresh = await User.findById(user._id);
            if (!fresh) return;

            const scoped = getScopedUserStats(fresh, classroomId, { create: true });
            const pt = scoped.cs ? scoped.cs.passiveAttributes : (fresh.passiveAttributes ||= {});
            pt.discount = 0;

            await fresh.save();
            req.app?.get('io')?.to(`user-${fresh._id}`).emit('discount_expired');
          } catch (e) {
            console.warn('[utilityItem] discount expiration handler failed:', e);
          }
        }, 24 * 60 * 60 * 1000);

        break;
      }

      default:
        return res.status(400).json({ error: 'Unsupported utility effect' });
    }

    await user.save();

    item.usesRemaining = Math.max(0, (item.usesRemaining || 1) - 1);
    item.consumed = item.usesRemaining === 0;
    item.active = true;
    item.activatedAt = new Date();
    await item.save();

    // classroom-scoped after snapshot (again from SAME doc + scope)
    const scopedAfter = getScopedUserStats(user, classroomId, { create: true });
    const after = {
      multiplier: scopedAfter.passive?.multiplier ?? 1,
      discount: scopedAfter.passive?.discount ?? 0,
      luck: scopedAfter.passive?.luck ?? 1,
      shield: scopedAfter.shieldCount ?? 0
    };

    // Award XP (based on classroom-scoped before/after)
    let xpResForStats = null;
    try {
      if (classroomId) {
        let statCount = 0;
        if (Number(after.multiplier) !== Number(before.multiplier)) statCount += 1;
        if (Number(after.discount) > Number(before.discount)) statCount += 1;

        const cls = await Classroom.findById(classroomId).select('xpSettings');
        const rate = cls?.xpSettings?.enabled ? (cls.xpSettings.statIncrease || 0) : 0;
        const xp = statCount * rate;

        if (xp > 0) {
          xpResForStats = await awardXP(user._id, classroomId, xp, 'stat increase (bazaar item)', cls.xpSettings);
          if (xpResForStats?.newXP !== xpResForStats?.oldXP) {
            let effectsTextForXP;
            if (item.primaryEffect === 'doubleEarnings') effectsTextForXP = 'Double Earnings (2x multiplier)';
            if (item.primaryEffect === 'discountShop') effectsTextForXP = `${after.discount}% shop discount`;

            await logStatChanges({
              io: req.app?.get ? req.app.get('io') : null,
              classroomId,
              user,
              actionBy: user._id,
              prevStats: { xp: xpResForStats.oldXP },
              currStats: { xp: xpResForStats.newXP },
              context: `Bazaar - ${item.name}`,
              details: { effectsText: effectsTextForXP },
              forceLog: true
            });
          }
        }
      }
    } catch (e) {
      console.warn('[utilityItem] XP award/log failed:', e);
    }

    // Stat-change notification (now consistent)
    let effectsText;
    if (item.primaryEffect === 'doubleEarnings') effectsText = 'Double Earnings (2x multiplier)';
    if (item.primaryEffect === 'discountShop') effectsText = `${after.discount}% shop discount`;

    await logStatChanges({
      io: req.app.get('io'),
      classroomId,
      user,
      actionBy: user._id,
      prevStats: before,
      currStats: after,
      context: `Bazaar - ${item.name}`,
      details: { effectsText }
    });

    return res.json({
      message: 'Utility item used',
      effect: item.primaryEffect,
      stats: scopedAfter.passive,     // classroom-scoped stats
      discount: after.discount
    });
  } catch (err) {
    console.error('Utility use error:', err);
    return res.status(500).json({ error: 'Failed to use item', details: err.message });
  }
});

module.exports = router;