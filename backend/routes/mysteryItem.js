const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); 
const Item = require('../models/Item');
const User = require('../models/User');
const { ensureAuthenticated } = require('../config/auth');

//drawAward function will decide which reward item comes from the mystery box
//each reward has a weight that affects the probability of being drawn
//well also add a small bonsu of the student has a luck stat
router.get('/boxes', ensureAuthenticated, async (req, res) => {
  const { bazaarId } = req.query;
  const q = { category: 'Mystery', kind: 'mystery_box' };
  if (bazaarId) q.bazaar = bazaarId;
  const boxes = await Item.find(q)
    .sort('-createdAt')
    .select('name description price image bazaar metadata.reward createdAt');
  res.json(boxes);
});

function getClassroomBalance(user, classroomId) { //reads a stsudent per classroom balance if a classroomID is provided
  const arr = Array.isArray(user.classroomBalances) ? user.classroomBalances : [];
  const entry = arr.find(cb => String(cb.classroom) === String(classroomId));
  return entry ? Number(entry.balance || 0) : 0;
}
//function to update the classroom balance of a user
function updateClassroomBalance(user, classroomId, newBalance) { //writes back to the student per classroom balanc
  if (!Array.isArray(user.classroomBalances)) user.classroomBalances = [];
  const i = user.classroomBalances.findIndex(cb => String(cb.classroom) === String(classroomId));
  if (i >= 0) {
    user.classroomBalances[i].balance = Math.max(0, Number(newBalance) || 0);
  } else {
    user.classroomBalances.push({ classroom: classroomId, balance: Math.max(0, Number(newBalance) || 0) }); //ensuring no negative balance
  }
}

function drawAward(rewards, luck) {
  const L = Math.max(0, Math.min(1, Number(luck) / 100 || 0)); // Ensure luck is between 0 and 1 (normalize 0..100 -> 0..1)

  //creating possible rewards 
  //each reward gets an effective weight based on the weight ; weight times (1 + luck)
  const possibleReward = (rewards || [])  //use the function arg passed in
    .filter(r => Number(r.weight) > 0 && r.itemId) //ignore if weight is 0 or negative
    .map(r => ({
      itemId: r.itemId, //the id of the reward 
      eff: Number(r.weight) * (1 + L) //effective weight by luck
    }));

  //if no valid rewards, return error
  if (!possibleReward.length) throw new Error('No valid rewards in mystery box');

  //calculate total weight of all possible rewards
  const total = possibleReward.reduce((sum, r) => sum + r.eff, 0);

  //generating a random num between 0 and total weight
  let roll = Math.random() * total;

  //creating a loop to go through each reward and see if the roll falls within its effective weight range
  for (const r of possibleReward) {
    if (roll < r.eff) {
      return r.itemId; //return the itemId of the reward
    }
    roll -= r.eff; //decrease roll by the effective weight
  }

  //return last award if something goes wrong
  return possibleReward[possibleReward.length - 1].itemId;
}

//student opening the mystery box
router.post('/open/:itemId', ensureAuthenticated, async (req, res) => {
  const session = await mongoose.startSession();      //use mongoose.startSession()
  session.startTransaction();
  try {
    const itemId = req.params.itemId; //the mystery box item id
    const userId = req.user._id; //the student opening the box
    const classroomId = req.body.classroomId || req.query?.classroomId || null; //the classroom context for the box opening (if any)

    //find the mystery box 
    const box = await Item.findById(itemId).session(session);
    if (!box || box.category !== 'Mystery' || box.kind !== 'mystery_box') { //do NOT require owner === student
      throw new Error('Mystery box not found');
    }

    //load student and check balance
    const user = await User.findById(userId).session(session);
    if (!user) throw new Error('User not found');

    const price = Number(box.price || 0);
    const balance = classroomId ? getClassroomBalance(user, classroomId) : Number(user.balance || 0);
    if (balance < price) {
      throw new Error('Not enough balance to open the mystery box');
    }

    //deduct price from balance
    if (classroomId) {
      updateClassroomBalance(user, classroomId, balance - price); // fixed function name
    } else {
      user.balance = Math.max(0, balance - price);
    }

    //roll the rewards
    const luck = Number(user.passiveAttributes?.luck || 0);
    const reward = box.metadata?.reward || [];
    const rewardItemId = drawAward(reward, luck);

    //record the box transacatoions
    if (!Array.isArray(user.transactions)) user.transactions = [];
    user.transactions.push({
      amount: -price,
      description: `Opened mystery box: ${box.name || 'Unnamed Box'}`,
      classroom: classroomId,
      date: new Date(),
      meta: { boxId: box._id, awardedItem: rewardItemId, luckAtOpen: luck } //use rewardItemId
    });
    await user.save({ session });

    //commit the transaction and respons
    await session.commitTransaction();
    session.endSession();

    const newBalance = classroomId ? getClassroomBalance(user, classroomId) : user.balance;
    res.json({
      boxId: box._id,
      awardedItem: rewardItemId, price,
      wallet: { newBalance },
      luckUsed: luck, classroomId
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error opening mystery box:', error);
    res.status(400).json({ error: error.message || 'Failed to open mystery box' });
  }
});

module.exports = router;
