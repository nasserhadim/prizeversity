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

// Fetch Classrooms for Students
router.get('/student', ensureAuthenticated, async (req, res) => {
  try {
    const classrooms = await Classroom.find({ students: req.user._id });
    res.status(200).json(classrooms);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch classrooms' });
  }
});

// Fetch Specific Classroom
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
    res.status(200).json(classroom);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch classroom' });
  }
});

// Delete Classroom
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    if (classroom.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this classroom' });
    }

    await Classroom.deleteOne({ _id: req.params.id });
    res.status(200).json({ message: 'Classroom deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete classroom' });
  }
});

// Update Classroom
router.put('/:id', ensureAuthenticated, async (req, res) => {
  const { name, image } = req.body;
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    if (classroom.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to update this classroom' });
    }

    classroom.name = name || classroom.name;
    classroom.image = image || classroom.image;
    await classroom.save();
    res.status(200).json(classroom);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update classroom' });
  }
});

// Leave Classroom
router.post('/:id/leave', ensureAuthenticated, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    if (classroom.teacher.toString() === req.user._id.toString()) {
      // Teacher leaving the classroom (delete it)
      await Classroom.deleteOne({ _id: req.params.id });
    } else {
      // Student leaving the classroom
      classroom.students = classroom.students.filter(
        (studentId) => studentId.toString() !== req.user._id.toString()
      );
      await classroom.save();
    }
    res.status(200).json({ message: 'Left classroom successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to leave classroom' });
  }
});

// Fetch Students in Classroom
router.get('/:id/students', ensureAuthenticated, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id).populate('students');
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    res.status(200).json(classroom.students);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Remove Student from Classroom
router.delete('/:id/students/:studentId', ensureAuthenticated, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    classroom.students = classroom.students.filter(
      (studentId) => studentId.toString() !== req.params.studentId
    );
    await classroom.save();
    res.status(200).json({ message: 'Student removed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove student' });
  }
});

module.exports = router;