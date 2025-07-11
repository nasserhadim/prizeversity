const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');

router.post('/', async (req, res) => {
  try {
    console.log('Received feedback:', req.body);// Log the received feedback for debugging
    const { rating, comment } = req.body;
    const feedback = new Feedback({ rating, comment });
    await feedback.save();
    console.log('Feedback saved successfully'); // Log success message
    res.status(201).json({ message: 'Feedback submitted successfully' });
  } catch (err) {
    
    console.error('Error submitting feedback:', err); // Log the error for debugging
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

module.exports = router;