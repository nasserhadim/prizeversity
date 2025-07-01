const User = require('../models/User');

async function transferBits({ fromUserId, recipients, amount, session = null }) {
  console.log('⏳ transferBits:', { fromUserId, recipients, amount });


  const from = await User.findByIdAndUpdate(
    fromUserId,
    { $inc: { balance: -amount } },
    { new: true, session }
  );
  console.log('from balance now:', from.balance);


  const perPerson = Math.floor(amount / recipients.length);
  for (let userId of recipients) {
    const u = await User.findByIdAndUpdate(
      userId,
      { $inc: { balance: perPerson } },
      { new: true, session }
    );
    console.log(` to ${u._id} balance now:`, u.balance);
  }


  const remainder = amount - perPerson * recipients.length;
  if (remainder > 0) {
    console.log('💡 remainder bits:', remainder);
   
    await User.findByIdAndUpdate(fromUserId, { $inc: { balance: remainder } }, { session });
  }

  console.log('transferBits complete');
}

module.exports = { transferBits };
