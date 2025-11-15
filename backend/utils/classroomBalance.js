// backend/utils/classroomBalance.js
// Safely read/write a user's per-classroom balance subdoc
// while preserving XP/level/meta fields.

function ensureClassroomBalance(user, classroomId) {
  if (!Array.isArray(user.classroomBalances)) {
    user.classroomBalances = [];
  }
  let cb = user.classroomBalances.find(
    (c) => String(c.classroom) === String(classroomId)
  );
  if (!cb) {
    user.classroomBalances.push({
      classroom: classroomId,
      balance: 0,
      xp: 0,
      level: 1,
      meta: {},
    });
    cb = user.classroomBalances[user.classroomBalances.length - 1];
  } else {
    // harden existing subdoc so future writes never drop fields
    if (typeof cb.balance !== 'number') cb.balance = 0;
    if (typeof cb.xp !== 'number') cb.xp = 0;
    if (typeof cb.level !== 'number') cb.level = 1;
    if (!cb.meta || typeof cb.meta !== 'object') cb.meta = {};
  }
  return cb;
}

function findClassroomBalance(user, classroomId) {
  return (user.classroomBalances || []).find(
    (c) => String(c.classroom) === String(classroomId)
  ) || null;
}

function updateClassroomBalance(user, classroomId, newBalance) {
  const cb = ensureClassroomBalance(user, classroomId);
  cb.balance = Math.max(0, Number(newBalance) || 0);
  return cb.balance;
}

module.exports = {
  ensureClassroomBalance,
  findClassroomBalance,
  updateClassroomBalance,
};
