const User = require('../models/User');

async function transferBits({ fromUserId, recipients, amount, session = null, classroomId = null }) {
  console.log('⏳ transferBits:', { fromUserId, recipients, amount });
  // load sender
  const from = await User.findById(fromUserId).session(session);
  if (!from) throw new Error('Sender not found');
  from.balance = from.balance - amount;

  // create sender transaction
  from.transactions.push({
    amount: -amount,
    description: `Transferred ${amount} bits`,
    classroom: classroomId || null,
    createdAt: new Date()
  });
  await from.save({ session });

  const perPerson = Math.floor(amount / recipients.length);
  for (let userId of recipients) {
    const u = await User.findById(userId).session(session);
    if (!u) continue;
    u.balance = (u.balance || 0) + perPerson;
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

module.exports = { transferBits };
