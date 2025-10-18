const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const Discount = require('../models/Discount');
const { ensureAuthenticated } = require('../config/auth');

// Utility item is another category for items in the bazaar workign with a discount and multipleir
router.post('/use/:itemId/:classroomId', ensureAuthenticated, async (req, res) => {
  try {
    const item = await Item.findById(req.params.itemId);
    if (!item || item.owner.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Apply utility effect
    switch(item.primaryEffect) {
      case 'doubleEarnings':
        req.user.passiveAttributes.multiplier = (req.user.passiveAttributes.multiplier || 1) * 2;
        break;
      case 'discountShop':
         const discountPct = Number(item.primaryEffectValue) || 20;
         const durationHours = Number(item.primaryEffectDuration) || 1; // optional window
         const apply = new Date(Date.now());
         const expire = new Date(Date.now() + (60 * 60 * 1000 * durationHours));
         
        // Creates the discount
        Discount.insertOne({
            classroom: req.params.classroomId,
            owner: req.user._id,
            appliedAt: apply,
            expiresAt: expire, 
            discountPercent: discountPct
         });
         

         /* Editing out this portion to replace with 'create discount' portion
         req.user.discountPercent = discountPct;
      // this will keep the old boolean for backward compatibility anywhere even if it’s still checked
         req.user.discountShop = discountPct > 0;
         req.user.discountExpiresAt = new Date(Date.now() + durationHours * 3600 * 1000);
         */


  // Best-effort expiry; DB timestamp is the source of truth
  setTimeout(async () => {
    try {
      const u = await User.findById(req.user._id);
      if (!u) return;
      if (u.discountExpiresAt && new Date() >= new Date(u.discountExpiresAt)) {
        u.discountShop = false;
        u.discountPercent = 0;
        u.discountExpiresAt = null;
        await u.save();
        req.app.get('io')?.to(`user-${u._id}`).emit('discount_expired');
      }
    } catch (e) {
      console.error('Failed to revert discount after timeout', e);
    }
  }, durationHours * 3600 * 1000);

  break;
  }

    await req.user.save();
    await Item.findByIdAndDelete(item._id); // Remove after use

    res.json({ 
      message: 'Utility item applied',
      effect: item.primaryEffect
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to use item' });
  }
});

module.exports = router;