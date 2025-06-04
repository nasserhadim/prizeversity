const express = require('express');
const { ensureAuthenticated } = require('../config/auth');
const User = require('../models/User');
const router = express.Router();

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