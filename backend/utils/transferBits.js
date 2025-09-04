const User = require('../models/User');

async function transferBits({ fromUserId, recipients, amount, session = null, classroomId = null }) {
  console.log('⏳ transferBits:', { fromUserId: String(fromUserId), recipients: recipients.map(r => String(r)), amount });
  
  // Ensure the target user is NOT in the recipients list
  const filteredRecipients = recipients.filter(id => String(id) !== String(fromUserId));
  
  console.log('🔍 After filtering target user:', { 
    originalRecipients: recipients.map(r => String(r)),
    filteredRecipients: filteredRecipients.map(r => String(r)),
    targetUser: String(fromUserId)
  });
  
  if (filteredRecipients.length === 0) {
    throw new Error('No valid recipients for transfer');
  }
  
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

  // create sender transaction with detailed info
  from.transactions.push({
    amount: -amount,
    description: `Siphoned: ${amount} bits redistributed to ${filteredRecipients.length} group members`,
    classroom: classroomId || null,
    createdAt: new Date()
  });
  await from.save({ session });

  // distribute to recipients (excluding the target)
  const perPerson = Math.floor(amount / filteredRecipients.length); // This should be correct
  
  // But also check the remainder calculation:
  const remainder = amount - perPerson * filteredRecipients.length; // This should also use filteredRecipients.length
  for (let userId of filteredRecipients) {
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
      description: `Siphon: Received ${perPerson} bits from redistributed amount (${filteredRecipients.length} recipients)`,
      assignedBy: from._id,
      classroom: classroomId || null,
      createdAt: new Date()
    });
    await u.save({ session });
  }

  // handle remainder - give back to the first recipient, not the target
  if (remainder > 0 && filteredRecipients.length > 0) {
    const firstRecipient = await User.findById(filteredRecipients[0]).session(session);
    if (firstRecipient) {
      if (classroomId) {
        const cur = getClassroomBalance(firstRecipient, classroomId);
        updateClassroomBalance(firstRecipient, classroomId, cur + remainder);
      } else {
        firstRecipient.balance += remainder;
      }
      firstRecipient.transactions.push({
        amount: remainder,
        description: `Siphon remainder: ${remainder} additional bits`,
        assignedBy: from._id,
        classroom: classroomId || null,
        createdAt: new Date()
      });
      await firstRecipient.save({ session });
    }
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
