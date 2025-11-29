const Notification = require('../models/Notification');
const { populateNotification } = require('../utils/notifications');

/**
 * Create "stats_adjusted" notification for the student only.
 * Optional:
 *  - details.effectsText: string appended after summary
 *  - forceLog: boolean -> create a log even if no tracked fields changed
 *  - extraChanges: array of { field, from, to } to include in the change list
 */
async function logStatChanges({
  io,
  classroomId,
  user,
  actionBy,
  prevStats = {},
  currStats = {},
  context = 'bazaar item',
  details,
  forceLog = false,
  extraChanges = []
}) {
  const fields = ['multiplier', 'luck', 'discount', 'shield', 'groupMultiplier'];

  const normalize = (field, v) => {
    if (v == null) return v;
    if (['multiplier','luck','groupMultiplier'].includes(field)) return Number(Number(v).toFixed(1));
    if (field === 'discount') return Math.round(Number(v));
    if (field === 'shield') return Math.max(0, parseInt(v, 10));
    return v;
  };

  const changes = [];
  for (const f of fields) {
    const beforeN = normalize(f, prevStats[f]);
    const afterN  = normalize(f, currStats[f]);
    if (beforeN === undefined && afterN === undefined) continue;
    if (String(beforeN) !== String(afterN)) changes.push({ field: f, from: beforeN, to: afterN });
  }

  // caller-supplied extra flags (e.g., attackResult)
  if (Array.isArray(extraChanges) && extraChanges.length) {
    for (const c of extraChanges) {
      if (c && c.field) changes.push({ field: c.field, from: c.from, to: c.to });
    }
  }
  if (!changes.length && !forceLog) return { created: false };

  const formatChange = (c) => {
    // support dotted fields like "target.shield" or "attacker.multiplier"
    const rawField = String(c.field || '');
    const parts = rawField.split('.');
    const base = parts.pop();
    const prefix = parts.length ? parts.join('.') + '.' : '';

    const safeNum = (v, dec = 1) => {
      if (v == null || v === '') return 0;
      const n = Number(v);
      if (Number.isNaN(n)) return 0;
      return dec === 0 ? Math.round(n) : Number(n.toFixed(dec));
    };

    // xp (integer)
    if (base === 'xp') {
      const from = safeNum(c.from, 0);
      const to = safeNum(c.to, 0);
      const delta = to - from;
      const sign = delta >= 0 ? `+${delta}` : `${delta}`;
      return `${prefix}xp: ${from} → ${to} (${sign} XP)`;
    }

    // multiplier / luck / groupMultiplier (one decimal)
    if (['multiplier', 'luck', 'groupMultiplier'].includes(base)) {
      const fromN = safeNum(c.from, 1);
      const toN = safeNum(c.to, 1);
      const from = fromN.toFixed(1);
      const to = toN.toFixed(1);
      const delta = (toN - fromN).toFixed(1);
      const sign = Number(delta) >= 0 ? `+${delta}` : `${delta}`;
      return `${prefix}${base}: ${from} → ${to} (${sign})`;
    }

    // discount (integer percent)
    if (base === 'discount') {
      const from = safeNum(c.from, 0);
      const to = safeNum(c.to, 0);
      const delta = to - from;
      const sign = delta >= 0 ? `+${delta}` : `${delta}`;
      return `${prefix}discount: ${from} → ${to} (${sign})`;
    }

    // shield (integer, show +/− delta)
    if (base === 'shield') {
      const from = safeNum(c.from, 0);
      const to = safeNum(c.to, 0);
      const delta = to - from;
      const sign = delta >= 0 ? `+${delta}` : `${delta}`;
      return `${prefix}shield: ${from} → ${to} (${sign})`;
    }

    // fallback: show raw
    return `${rawField}: ${c.from} → ${c.to}`;
  };

  const changeSummary = changes.map(formatChange).join('; ');
  const now = new Date();
  const effectsSuffix = details?.effectsText ? ` Effects: ${details.effectsText}.` : '';

  const studentNotification = await Notification.create({
    user: user._id,
    actionBy,
    type: 'stats_adjusted',
    message: `Your stats were updated via ${context}: ${changeSummary}.${effectsSuffix}`,
    classroom: classroomId || null,
    read: false,
    changes,
    targetUser: user._id,
    createdAt: now
  });

  try {
    const populated = await populateNotification(studentNotification._id);
    if (io && populated) io.to(`user-${user._id}`).emit('notification', populated);
  } catch (_) {}

  return { created: true, changes };
}

module.exports = { logStatChanges };