function _sid(v) {
  return v == null ? '' : String(v);
}

function getClassroomIdFromReq(req) {
  return (
    req?.body?.classroomId ||
    req?.query?.classroomId ||
    req?.params?.classroomId ||
    req?.params?.classId ||
    null
  );
}

function getClassroomStatsEntry(user, classroomId) {
  if (!user || !classroomId) return null;
  const arr = Array.isArray(user.classroomStats) ? user.classroomStats : [];
  return arr.find(e => _sid(e.classroom) === _sid(classroomId)) || null;
}

function getOrCreateClassroomStatsEntry(user, classroomId) {
  if (!user || !classroomId) return null;
  if (!Array.isArray(user.classroomStats)) user.classroomStats = [];

  let entry = getClassroomStatsEntry(user, classroomId);
  if (!entry) {
    entry = {
      classroom: classroomId,
      passiveAttributes: { multiplier: 1, luck: 1, discount: 0 },
      shieldCount: 0,
      shieldActive: false,
    };
    user.classroomStats.push(entry);
  }

  if (!entry.passiveAttributes) entry.passiveAttributes = { multiplier: 1, luck: 1, discount: 0 };
  if (entry.passiveAttributes.multiplier == null) entry.passiveAttributes.multiplier = 1;
  if (entry.passiveAttributes.luck == null) entry.passiveAttributes.luck = 1;
  if (entry.passiveAttributes.discount == null) entry.passiveAttributes.discount = 0;
  if (entry.shieldCount == null) entry.shieldCount = 0;
  if (entry.shieldActive == null) entry.shieldActive = entry.shieldCount > 0;

  return entry;
}

/**
 * Returns { user, classroomId, cs, passive, shieldCount, shieldActive, saveTarget }
 * - If classroomId exists, reads/writes via user.classroomStats[].
 * - Else, falls back to legacy global fields for backwards compatibility.
 */
function getScopedUserStats(user, classroomId, { create = false } = {}) {
  const cs = classroomId
    ? (create ? getOrCreateClassroomStatsEntry(user, classroomId) : getClassroomStatsEntry(user, classroomId))
    : null;

  const passive = cs?.passiveAttributes || user.passiveAttributes || {};
  const shieldCount = cs ? (cs.shieldCount ?? 0) : (user.shieldCount ?? 0);
  const shieldActive = cs ? (cs.shieldActive ?? (shieldCount > 0)) : (user.shieldActive ?? (shieldCount > 0));

  return { classroomId, cs, passive, shieldCount, shieldActive };
}

module.exports = {
  getClassroomIdFromReq,
  getClassroomStatsEntry,
  getOrCreateClassroomStatsEntry,
  getScopedUserStats,
};