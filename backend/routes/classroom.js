const express = require('express');
const Classroom = require('../models/Classroom');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
const Notification = require('../models/Notification'); // Add this line
const { ensureAuthenticated } = require('../config/auth');
const { populateNotification } = require('../utils/notifications');
const router = express.Router();
const { User } = require('../models/User');

// Create Classroom
router.post('/create', ensureAuthenticated, async (req, res) => {
  const { name, code } = req.body;
  
  if (!name || !code) {
    return res.status(400).json({ error: 'Classroom name and code are required' });
  }

  try {
    // Check if classroom code already exists
    const existingClassroom = await Classroom.findOne({ code });
    if (existingClassroom) {
      return res.status(400).json({ error: 'A classroom with this code already exists' });
    }

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
    if (!classroom) return res.status(404).json({ error: 'Invalid classroom code' });

    if (classroom.students.includes(req.user._id)) {
      return res.status(400).json({ error: 'You have already joined this classroom' });
    }

    classroom.students.push(req.user._id);
    await classroom.save();

    // Populate and emit updated classroom
    const populatedClassroom = await Classroom.findById(classroom._id)
      .populate('students', 'email');
    req.app.get('io').to(`classroom-${classroom._id}`).emit('classroom_update', populatedClassroom);

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

    // Check if user has access
    const hasAccess = req.user.role === 'teacher' ? 
      classroom.teacher.toString() === req.user._id.toString() :
      classroom.students.includes(req.user._id);

    if (!hasAccess) {
      return res.status(403).json({ error: 'You no longer have access to this classroom' });
    }

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

    // Create notification for teacher and all students
    const notificationRecipients = [classroom.teacher, ...classroom.students];
    
    for (const recipientId of notificationRecipients) {
      const notification = await Notification.create({
        user: recipientId,
        type: 'classroom_deletion',
        message: `Classroom "${classroom.name}" has been deleted`,
        actionBy: req.user._id
      });

      const populatedNotification = await populateNotification(notification._id);
      req.app.get('io').to(`user-${recipientId}`).emit('notification', populatedNotification);
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
    const classroom = await Classroom.findById(req.params.id)
      .populate('teacher')
      .populate('students');
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    const oldName = classroom.name;
    const changes = {};
    if (name && name !== classroom.name) changes.name = name;
    if (image && image !== classroom.image) changes.image = image;

    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ message: 'No changes were made' });
    }

    Object.assign(classroom, changes);
    await classroom.save();

    // Include teacher and students in notifications
    const notificationRecipients = [classroom.teacher._id.toString(), ...classroom.students.map(s => s._id.toString())];
    
    if (changes.name) {
      for (const recipientId of notificationRecipients) {
        const notification = await Notification.create({
          user: recipientId,
          type: 'classroom_update',
          message: `Classroom "${oldName}" has been renamed to "${name}"`,
          classroom: classroom._id,
          actionBy: req.user._id
        });

        const populatedNotification = await populateNotification(notification._id);
        req.app.get('io').to(`user-${recipientId}`).emit('notification', populatedNotification);
      }
    }

    // Emit classroom update to all members
    const populatedClassroom = await Classroom.findById(classroom._id)
      .populate('teacher', 'email')
      .populate('students', 'email');
    
    req.app.get('io').to(`classroom-${classroom._id}`).emit('classroom_update', populatedClassroom);

    res.status(200).json(classroom);
  } catch (err) {
    console.error('Classroom update error:', err);
    res.status(500).json({ error: 'Failed to update classroom' });
  }
});

// Leave Classroom
router.post('/:id/leave', ensureAuthenticated, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id)
      .populate({
        path: 'groups',
        populate: {
          path: 'groups'
        }
      });
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    // Remove student from all groups in all groupsets of the classroom
    if (classroom.groups) {
      for (const groupSet of await GroupSet.find({ classroom: classroom._id })) {
        for (const groupId of groupSet.groups) {
          const group = await Group.findById(groupId);
          if (group) {
            group.members = group.members.filter(
              member => member._id.toString() !== req.user._id.toString()
            );
            await group.save();
          }
        }
      }
    }

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
    console.error('Error leaving classroom:', err);
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

    // Create and emit notification before removing student
    const notification = await Notification.create({
      user: req.params.studentId,
      type: 'classroom_removal',
      message: `You have been removed from classroom "${classroom.name}"`,
      classroom: classroom._id,
      actionBy: req.user._id
    });

    const populatedNotification = await populateNotification(notification._id);

    // Emit both notification and removal event simultaneously
    const io = req.app.get('io');
    io.to(`user-${req.params.studentId}`).emit('notification', populatedNotification);
    io.to(`user-${req.params.studentId}`).emit('classroom_removal', {
      classroomId: classroom._id,
      message: `You have been removed from classroom "${classroom.name}"`
    });

    // Remove student from classroom
    classroom.students = classroom.students.filter(
      studentId => studentId.toString() !== req.params.studentId
    );
    await classroom.save();

    // Emit updated classroom to all remaining members
    const populatedClassroom = await Classroom.findById(classroom._id)
      .populate('students', 'email');
    io.to(`classroom-${classroom._id}`).emit('classroom_update', populatedClassroom);

    res.status(200).json({ message: 'Student removed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove student' });
  }
});

router.get('/:classId/leaderboard', async (req, res) => {
  try {
    const classId = req.params.classId;
    const userId  = req.user._id;   

    // ensures the user is in this class
    const me = await User.findById(userId);
    if (!me.classrooms.includes(classId)) {
      return res.status(403).json({ error: 'Not enrolled in this class' });
    }

    // fetch and sort classmates by bits
    const leaderboard = await User.find({ classrooms: classId })
      .select('email balance')
      .sort({ balance: -1 })
      .limit(50);

    res.json(leaderboard);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;