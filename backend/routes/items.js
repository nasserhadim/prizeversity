/*
This file has been commented out because is not being used.
It was replaced with the following items:
./backend/routes/attackItem.js
./backend/routes/defendItem.js
./backend/routes/passiveItem.js
./backend/routes/utilityItem.js

The reason was because we were having a lot of 500 error status with different categories of the items
So we concluded that it will be much efficient if we separate them in each file.
*/

// const express = require('express');
// const router = express.Router();
// const Item = require('../models/Item.js');
// const User = require('../models/User.js');
// const Group = require('../models/Group.js');
// const GroupSet = require('../models/GroupSet.js');

// // Use an item on a target student
// router.post('/:itemId/use', async (req, res) => {
//   const { userId, targetUserId } = req.body;
//   const { itemId } = req.params;

//   try {
//     const item = await Item.findById(itemId);
//     if (!item) return res.status(404).json({ error: 'Item not found' });

//     const user = await User.findById(userId);
//     if (!user) return res.status(404).json({ error: 'User not found' });

//     // --- ATTACK ITEMS HANDLING ---
//     if (item.category === 'Attack') {
//       if (!targetUserId) return res.status(400).json({ error: 'Target required' });

//       const target = await User.findById(targetUserId);
//       if (!target) return res.status(404).json({ error: 'Target user not found' });

//       // Shield protection
//       if (target.shieldActive) {
//         target.shieldActive = false;
//         await target.save();
//         await Item.findByIdAndDelete(itemId);
        
//         return res.status(200).json({
//           message: `${target.firstName} was protected by a shield!`,
//           protected: true
//         });
//       }

//       const targetUpdates = {};
//       let drainedAmount = 0;
      
//       // Handle primary effect
//       if (item.primaryEffect === 'halveBits') {
//         targetUpdates.balance = Math.floor(target.balance / 2);
//       } else if (item.primaryEffect === 'drainBits') {
//         drainedAmount = Math.floor(target.balance * 0.1 * (item.effectStrength || 1));
//         targetUpdates.balance = target.balance - drainedAmount;
//       }

//       // Handle secondary effects
//       if (item.secondaryEffects && item.secondaryEffects.length > 0) {
//         for (const effect of item.secondaryEffects) {
//           if (!effect.effectType) continue;
          
//           const strength = effect.strength || 1;
          
//           switch(effect.effectType) {
//             case 'attackLuck':
//               targetUpdates['passiveAttributes.luck'] = Math.max(
//                 (target.passiveAttributes?.luck || 1) - strength, 
//                 1
//               );
//               break;
//             case 'attackMultiplier':
//               targetUpdates['passiveAttributes.multiplier'] = Math.max(
//                 (target.passiveAttributes?.multiplier || 1) - strength, 
//                 1
//               );
//               break;
//             case 'attackGroupMultiplier':
//               // Handle group multiplier reduction
//               const groups = await Group.find({
//                 'members._id': targetUserId,
//                 'members.status': 'approved'
//               });
//               for (const group of groups) {
//                 group.groupMultiplier = Math.max(
//                   (group.groupMultiplier || 1) - strength, 
//                   1
//                 );
//                 await group.save();
//               }
//               break;
//           }
//         }
//       }

//       // Apply all updates to the target
//       if (Object.keys(targetUpdates).length > 0) {
//         await User.findByIdAndUpdate(targetUserId, { $set: targetUpdates });
//       }

//       // Update attacker's balance if bits were drained
//       if (drainedAmount > 0) {
//         await User.findByIdAndUpdate(userId, {
//           $inc: { balance: drainedAmount }
//         });
//       }

//       // Delete the used item
//       await Item.findByIdAndDelete(itemId);

//       // Get updated user balances for response
//       const updatedUser = await User.findById(userId);
//       const updatedTarget = await User.findById(targetUserId);

//       return res.json({
//         message: 'Attack successful!',
//         newBalance: {
//           user: updatedUser.balance,
//           target: updatedTarget.balance
//         }
//       });
//     }

//     // --- PASSIVE ITEMS HANDLING ---
//     if (item.category === 'Passive') {
//       const updates = {};
      
//       if (item.secondaryEffects) {
//         for (const effect of item.secondaryEffects) {
//           switch(effect) {
//             case 'grantsLuck':
//               updates['passiveAttributes.luck'] = (user.passiveAttributes?.luck || 1) + 1;
//               break;
//             case 'grantsMultiplier':
//               updates['passiveAttributes.multiplier'] = (user.passiveAttributes?.multiplier || 1) + 1;
//               break;
//             case 'grantsGroupMultiplier':
//               // Handle group multiplier increase
//               const groups = await Group.find({
//                 'members._id': userId,
//                 'members.status': 'approved'
//               });
//               for (const group of groups) {
//                 group.groupMultiplier = (group.groupMultiplier || 1) + 1;
//                 await group.save();
//               }
//               break;
//           }
//         }
//       }

//       if (Object.keys(updates).length > 0) {
//         await User.findByIdAndUpdate(userId, updates);
//       }

//       await Item.findByIdAndDelete(itemId);

//       return res.json({
//         message: 'Passive effects applied!',
//         itemConsumed: true
//       });
//     }

//     // --- UTILITY ITEMS HANDLING ---
//     if (item.category === 'Utility') {
//       if (item.primaryEffect === 'doubleEarnings') {
//         await User.findByIdAndUpdate(userId, {
//           $mul: { 'passiveAttributes.multiplier': 2 }
//         });
//         await Item.findByIdAndDelete(itemId);
//         return res.json({ message: 'Earnings multiplier activated!' });
//       }
      
//       if (item.primaryEffect === 'discountShop') {
//         user.discountShop = true;
//         await user.save();

//         setTimeout(async () => {
//           try {
//             const updatedUser = await User.findById(user._id);
//             if (updatedUser.discountShop) {
//               updatedUser.discountShop = false;
//               await updatedUser.save();
//               req.app.get('io').to(`user-${user._id}`).emit('discount_expired');
//             }
//           } catch (err) {
//             console.error('Error expiring discount:', err);
//           }
//         }, 3600000); // 1 hour

//         await Item.findByIdAndDelete(itemId);
//         return res.json({ message: 'Shop discount activated for 1 hour!' });
//       }
//     }

//     return res.status(400).json({ error: 'This item type is not supported' });

//   } catch (err) {
//     console.error('Item use error:', err);
//     return res.status(500).json({ error: 'Server error' });
//   }
// });

// module.exports = router;