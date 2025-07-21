
require('dotenv').config();              
const mongoose = require('mongoose');
const User = require('./models/User');    

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
    });

    const users = await User.find({ shortId: { $exists: false } });
    for (const u of users) await u.save();   // triggers the pre‑validate hook you added
    console.log(`Back‑filled ${users.length} user(s)`);

  } catch (err) {
    console.error('Back‑fill error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
