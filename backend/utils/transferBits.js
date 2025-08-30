const User = require('../models/User');

async function transferBits({ fromUserId, recipients, amount, session = null, classroomId = null }) {
  console.log('⏳ transferBits:', { fromUserId, recipients, amount });
  // load sender
  const from = await User.findById(fromUserId).session(session);
  if (!from) throw new Error('Sender not found');

  if (classroomId) {
    const current = getClassroomBalance(from, classroomId);
    if (current < amount) throw new Error('Insufficient balance');
    updateClassroomBalance(from, classroomId, current - amount);
  } else {
    from.balance = (from.balance || 0) - amount;
  }

  // create sender transaction
  from.transactions.push({
    amount: -amount,
    description: `Transferred ${amount} bits`,
    classroom: classroomId || null,
    createdAt: new Date()
  });
  await from.save({ session });

  // distribute to recipients
  const perPerson = Math.floor(amount / recipients.length);
  for (let userId of recipients) {
    const u = await User.findById(userId).session(session);
    if (!u) continue;
    if (classroomId) {
      const cur = getClassroomBalance(u, classroomId);
      updateClassroomBalance(u, classroomId, cur + perPerson);
    } else {
      u.balance = (u.balance || 0) + perPerson;
    }
    u.transactions.push({
      amount: perPerson,
      description: `Received ${perPerson} bits (split)`,
      assignedBy: from._id,
      classroom: classroomId || null,
      createdAt: new Date()
    });
    await u.save({ session });
  }

  // handle remainder
  const remainder = amount - perPerson * recipients.length;
  if (remainder > 0) {
    from.balance += remainder;
    await from.save({ session });
  }

  console.log('transferBits complete');
}

// Local helpers if this file can't import the shared helpers
const getClassroomBalance = (user, classroomId) => {
  if (!Array.isArray(user.classroomBalances)) return 0;
  const cb = user.classroomBalances.find(cb => String(cb.classroom) === String(classroomId));
  return cb ? cb.balance : 0;
};
const updateClassroomBalance = (user, classroomId, newBalance) => {
  if (!Array.isArray(user.classroomBalances)) user.classroomBalances = [];
  const idx = user.classroomBalances.findIndex(cb => String(cb.classroom) === String(classroomId));
  if (idx >= 0) {
    user.classroomBalances[idx].balance = Math.max(0, newBalance);
  } else {
    user.classroomBalances.push({ classroom: classroomId, balance: Math.max(0, newBalance) });
  }
};

module.exports = { transferBits };
