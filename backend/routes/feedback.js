const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');

router.post('/', async (req, res) => {
  try {
    const { rating, comment, userId, anonymous } = req.body;
    const feedback = new Feedback({ 
      rating, 
      comment,
      userId: anonymous ? null : userId, // Set userId to null if anonymous
      anonymous: !!anonymous 
    });
    await feedback.save();
    console.log('Feedback saved successfully'); // Log success message
    res.status(201).json({ message: 'Feedback submitted successfully' });
  } catch (err) {
    
    console.error('Error submitting feedback:', err); // Log the error for debugging
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

router.post('/classroom', async (req, res) => {
  try {
    const { rating, comment, classroomId, userId, anonymous } = req.body;
    const feedback = new Feedback({ rating, comment, classroomId,
      userId: anonymous ? null : userId, // Set userId to null if anonymous
      anonymous: !!anonymous
     });
    await feedback.save();
    res.status(201).json({ message: 'Classroom feedback submitted successfully' });
  } catch (err) {
    console.error('Error submitting classroom feedback:', err);
    res.status(500).json({ error: 'Failed to submit classroom feedback' });
  }
});

router.get('/classroom/:id', async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ classroomId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'firstName lastName email'); // populate user info if exists
    res.json(feedbacks);
  } catch (err) {
    console.error('Error fetching classroom feedback:', err);
    res.status(500).json({ error: 'Failed to fetch classroom feedback' });
  }
});


module.exports = router;