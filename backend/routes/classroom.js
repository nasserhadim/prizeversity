const express = require('express');
const Classroom = require('../models/Classroom');
const { ensureAuthenticated } = require('../config/auth');
const router = express.Router();

// Create Classroom
router.post('/create', ensureAuthenticated, async (req, res) => {
  const { name, code } = req.body;
  try {
    const classroom = new Classroom({ name, code, teacher: req.user._id });
    await classroom.save();
    res.status(201).json(classroom);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create classroom' });
  }
});

// Join Classroom
router.post('/join', ensureAuthenticated, async (req, res) => {
  const { code } = req.body;
  try {
    const classroom = await Classroom.findOne({ code });
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    if (classroom.students.includes(req.user._id)) {
      return res.status(400).json({ error: 'Already joined this classroom' });
    }

    classroom.students.push(req.user._id);
    await classroom.save();
    res.status(200).json({ message: 'Joined classroom successfully', classroom });
  } catch (err) {
    res.status(500).json({ error: 'Failed to join classroom' });
  }
});

// Fetch Classrooms
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const classrooms = await Classroom.find({ teacher: req.user._id });
    res.status(200).json(classrooms);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch classrooms' });
  }
});

module.exports = router;