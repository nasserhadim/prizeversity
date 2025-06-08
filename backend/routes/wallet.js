const express = require('express');
const { ensureAuthenticated } = require('../config/auth');
const User = require('../models/User');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/transactions/all', ensureAuthenticated, async (req, res) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { studentId } = req.query;
    if (studentId && !mongoose.Types.ObjectId.isValid(studentId)) {
     return res.status(400).json({ error: 'Bad studentId' });
    }
   
  const criteria = studentId ? { _id: studentId } : {};
  const users = await User
     .find(criteria)
      .select('_id email transactions')
      .lean();         
   

    
    const txs = [];
    users.forEach((u) => {
      u.transactions.forEach((t) => {
        txs.push({
          ...(t.toObject ? t.toObject() : t),  
          studentId: u._id,
          studentEmail: u.email,
        });
      });
    });

    
    txs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(txs);
  } catch (err) {
    console.error('Failed to fetch all transactions:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign Balance to Student
router.post('/assign', ensureAuthenticated, async (req, res) => {
  const { studentId, amount, description } = req.body;
  try {
    const student = await User.findById(studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const numericAmount = Number(amount);
    if (isNaN(numericAmount)) {
      return res.status(400).json({ error: 'Amount must be a number' });
    }

    student.balance += numericAmount;
    student.transactions.push({
      amount: numericAmount,
      description,
      assignedBy: req.user._id,
    });

    try {
      await student.save();
      console.log('Student saved successfully');
    } catch (saveErr) {
      console.error('Failed to save student:', saveErr);
    }

    res.status(200).json({ message: 'Balance assigned successfully' });
  } catch (err) {
    console.error('Failed to assign balance:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/assign/bulk', ensureAuthenticated, async (req, res) => {
  if (!['teacher', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only teachers or admins can bulk‑assign' });
  }

  const { updates, description = 'Bulk adjustment by teacher' } = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: 'No updates supplied' });
  }

  try {
    let updated = 0;
    const skipped = [];

    for (const { studentId, amount } of updates) {
      const numericAmount = Number(amount);
      if (isNaN(numericAmount)) {
        skipped.push({ studentId, reason: 'Amount not numeric' });
        continue;
      }

      const student = await User.findById(studentId);
      if (!student) {
        skipped.push({ studentId, reason: 'Student not found' });
        continue;
      }

      student.balance += numericAmount;
      student.transactions.push({
        amount: numericAmount,
        description,
        assignedBy: req.user._id,
      });

      await student.save();
      updated += 1;
    }

    res.json({
      message: `Bulk assignment complete (${updated} updated, ${skipped.length} skipped)`,
      updated,
      skipped,
    });
  } catch (err) {
    console.error('Bulk assign failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// View Wallet Transactions
router.get('/transactions', ensureAuthenticated, async (req, res) => {
  try {
    // const user = await User.findById(req.user._id).populate('transactions');
    const user = await User.findById(req.user._id);
    res.status(200).json(user.transactions);
  } catch (err) {
    console.error('Failed to fetch transactions:', err.message);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Wallet Transfer
router.post('/transfer', ensureAuthenticated, async (req, res) => {
  const { recipientId, amount } = req.body;

  // Check it's a valid number and not negative or zero
  if (
    typeof amount !== 'number' ||
    isNaN(amount) ||
    amount < 1
  ) {
    return res.status(400).json({ error: 'Transfer amount must be at least 1 bit' });
  }

  try {
    const sender = await User.findById(req.user._id);
    const recipient = await User.findById(recipientId);

    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
    if (sender.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

    sender.balance -= amount;
    recipient.balance += amount;

    sender.transactions.push({ amount: -amount, description: `Transferred to ${recipient.email}` });
    recipient.transactions.push({ amount, description: `Received from ${sender.email}`});

    await sender.save();
    await recipient.save();

    res.status(200).json({ message: 'Transfer successful' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to transfer balance' });
  }
});

module.exports = router;