const express = require('express');
const path = require('path');
const multer = require('multer');
const Classroom = require('../models/Classroom');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { ensureAuthenticated } = require('../config/auth');
const { populateNotification } = require('../utils/notifications');

const router = express.Router();

// Multer configuration for handling background image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });


// Create Classroom
router.post(
  '/create',
  ensureAuthenticated,
  upload.single('backgroundImage'),
  async (req, res) => {
    // Debug logs
    console.log('[Create Classroom] content-type:', req.headers['content-type']);
    console.log('[Create Classroom] req.body:', req.body);
    console.log('[Create Classroom] req.file:', req.file);

    const { name, code, color } = req.body;
    const backgroundImage = req.file ? `/uploads/${req.file.filename}` : undefined;

    if (!name || !code) {
      return res.status(400).json({ error: 'Classroom name and code are required' });
    }

    try {
      const existing = await Classroom.findOne({
        code,
        archived: false,
        teacher: req.user._id
      });
      if (existing) {
        return res.status(400).json({ error: 'A classroom with this code already exists' });
      }

      const classroom = new Classroom({
        name,
        code,
        teacher: req.user._id,
        students: [req.user._id],
        color: color || undefined,
        backgroundImage: backgroundImage || undefined
      });
      await classroom.save();
      res.status(201).json(classroom);
    } catch (err) {
      console.error('[Create Classroom] save error:', err);
      res.status(500).json({ error: 'Server error creating classroom' });
    }
  }
);


// Join Classroom
router.post('/join', ensureAuthenticated, async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Classroom code is required' });
  }
  try {
    const classroom = await Classroom.findOne({ code: code.trim(), archived: false });
    if (!classroom) {
      console.log('No classroom found with code: ', code);
      return res.status(404).json({ error: 'Invalid classroom code' });
    }

    if (classroom.students.includes(req.user._id)) {
      return res.status(400).json({ error: 'You have already joined this classroom' });
    }

    classroom.students.push(req.user._id);
    await classroom.save();

    const populatedClassroom = await Classroom.findById(classroom._id)
      .populate('students', 'email');
    req.app.get('io').to(`classroom-${classroom._id}`)
      .emit('classroom_update', populatedClassroom);

    // When student joins classroom
    req.app.get('io').to(`classroom-${classroom._id}`).emit('student_joined', {
      studentId: req.user._id,
      studentName: `${req.user.firstName} ${req.user.lastName}`,
      classroomId: classroom._id
    });

    res.status(200).json({ message: 'Joined classroom successfully', classroom });
  } catch (err) {
    console.error('[Join Classroom] error:', err);
    res.status(500).json({ error: 'Failed to join classroom' });
  }
});


// Fetch active Classrooms for Teacher
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    const classrooms = await Classroom.find({
      teacher: req.user._id,
      archived: false
    });
    res.status(200).json(classrooms);
  } catch (err) {
    console.error('[Fetch Classrooms] error:', err);
    res.status(500).json({ error: 'Failed to fetch classrooms' });
  }
});

// Fetch Archived Classrooms for Teacher
router.get('/archived', ensureAuthenticated, async (req, res) => {
  try {
    const archives = await Classroom.find({
      teacher: req.user._id,
      archived: true
    });
    res.status(200).json(archives);
  } catch (err) {
    console.error('[Fetch Archived Classrooms] error:', err);
    res.status(500).json({ error: 'Failed to fetch archived classrooms' });
  }
});


// Get the Admin/TA bit policy (the Admin/TA that will be able to assign bits or no)
router.get('/:id/ta-bit-policy', ensureAuthenticated, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id).select('teacher taBitPolicy');
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
    if (classroom.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the teacher can view this policy' });
    }
    res.json({ taBitPolicy: classroom.taBitPolicy });
  } catch (err) {
    console.error('[Get TA‑bit policy] error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update which Admin/TA can assign bits
router.patch('/:id/ta-bit-policy', ensureAuthenticated, async (req, res) => {
  const { taBitPolicy } = req.body;
  const valid = ['full', 'approval', 'none'];
  if (!valid.includes(taBitPolicy)) {
    return res.status(400).json({ error: 'Invalid policy value' });
  }
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
    if (classroom.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the teacher can change this policy' });
    }
    classroom.taBitPolicy = taBitPolicy;
    await classroom.save();
    res.json({ taBitPolicy });
  } catch (err) {
    console.error('[Patch Admin/TA‑bit policy] error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// GET route to retrieve whether students can send items in a specific classroom.
// Only the teacher of the classroom is allowed to access this setting.
router.get('/:id/student-send-enabled', ensureAuthenticated, async (req, res) => {
  const c = await Classroom.findById(req.params.id).select('teacher studentSendEnabled');
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (c.teacher.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json({ studentSendEnabled: !!c.studentSendEnabled });
});

// PATCH route to update whether students can send items in a specific classroom.
// Only the classroom's teacher can perform this update.
router.patch('/:id/student-send-enabled', ensureAuthenticated, async (req, res) => {
  const { studentSendEnabled } = req.body;
  const c = await Classroom.findById(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  if (c.teacher.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  c.studentSendEnabled = !!studentSendEnabled;
  await c.save();
 res.json({ studentSendEnabled: !!c.studentSendEnabled });
});


// Unarchive a Classroom
router.put('/:id/unarchive', ensureAuthenticated, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }
    if (classroom.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to unarchive this classroom' });
    }
    classroom.archived = false;
    await classroom.save();
    res.status(200).json(classroom);
  } catch (err) {
    console.error('[Unarchive Classroom] error:', err);
    res.status(500).json({ error: 'Failed to unarchive classroom' });
  }
});


// Fetch Classrooms for Student/Admin
router.get('/student', ensureAuthenticated, async (req, res) => {
  try {
    const classrooms = await Classroom.find({
      students: req.user._id,
      archived: false
    });
    res.status(200).json(classrooms);
  } catch (err) {
    console.error('[Fetch Student Classrooms] error:', err);
    res.status(500).json({ error: 'Failed to fetch classrooms' });
  }
});

// Fetch Specific Classroom
router.get('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    const hasAccess = req.user.role === 'teacher'
      ? classroom.teacher.toString() === req.user._id.toString()
      : classroom.students.includes(req.user._id);

    if (!hasAccess) {
      return res.status(403).json({ error: 'You no longer have access to this classroom' });
    }

    res.status(200).json(classroom);
  } catch (err) {
    console.error('[Fetch Classroom] error:', err);
    res.status(500).json({ error: 'Failed to fetch classroom' });
  }
});


// Delete Classroom
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    if (classroom.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this classroom' });
    }

    const recipients = [classroom.teacher, ...classroom.students];
    for (const recipientId of recipients) {
      const notification = await Notification.create({
        user: recipientId,
        type: 'classroom_deletion',
        message: `Classroom "${classroom.name}" has been deleted`,
        actionBy: req.user._id
      });
      const populated = await populateNotification(notification._id);
      req.app.get('io').to(`user-${recipientId}`).emit('notification', populated);
    }

    await Classroom.deleteOne({ _id: req.params.id });
    res.status(200).json({ message: 'Classroom deleted successfully' });
  } catch (err) {
    console.error('[Delete Classroom] error:', err);
    res.status(500).json({ error: 'Failed to delete classroom' });
  }
});


// Update Classroom (name, color, backgroundImage, archived flag, etc.)
router.put('/:id', ensureAuthenticated, upload.single('backgroundImage'), async (req, res) => {
  console.log(' UPDATE req.body:', req.body);
  const { name, color, archived } = req.body;
  const backgroundImage = req.file ? `/uploads/${req.file.filename}` : undefined;

  try {
    const classroom = await Classroom.findById(req.params.id)
      .populate('teacher')
      .populate('students');
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    const oldName = classroom.name;
    const changes = {};
    if (name && name !== classroom.name) changes.name = name;
    if (color && color !== classroom.color) changes.color = color;
    if (backgroundImage) changes.backgroundImage = backgroundImage;
    if (typeof archived !== 'undefined' && archived !== classroom.archived) {
      changes.archived = archived;
    }

    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ error: 'No changes were made' });
    }

    Object.assign(classroom, changes);
    await classroom.save();

    const recipients = [classroom.teacher._id.toString(), ...classroom.students.map(s => s._id.toString())];
    if (changes.name) {
      for (const recipientId of recipients) {
        const notification = await Notification.create({
          user: recipientId,
          type: 'classroom_update',
          message: `Classroom "${oldName}" has been renamed to "${name}"`,
          classroom: classroom._id,
          actionBy: req.user._id
        });
        const populated = await populateNotification(notification._id);
        req.app.get('io').to(`user-${recipientId}`).emit('notification', populated);
      }
    }

    const populatedClassroom = await Classroom.findById(classroom._id)
      .populate('teacher', 'email')
      .populate('students', 'email');
    req.app.get('io').to(`classroom-${classroom._id}`).emit('classroom_update', populatedClassroom);

    // After classroom settings update
    req.app.get('io').to(`classroom-${classroom._id}`).emit('classroom_settings_update', {
      classroomId: classroom._id,
      newSettings: populatedClassroom
    });

    res.status(200).json(classroom);
  } catch (err) {
    console.error('[Update Classroom] error:', err);
    res.status(500).json({ error: 'Failed to update classroom' });
  }
});


// Leave Classroom
router.post('/:id/leave', ensureAuthenticated, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    if (classroom.teacher.toString() === req.user._id.toString()) {
      await Classroom.deleteOne({ _id: req.params.id });
    } else {
      classroom.students = classroom.students.filter(
        sid => sid.toString() !== req.user._id.toString()
      );
      await classroom.save();
    }

    // When student leaves/is removed
    req.app.get('io').to(`classroom-${req.params.id}`).emit('student_left', {
      studentId: req.user._id,
      studentName: `${req.user.firstName} ${req.user.lastName}`,
      classroomId: req.params.id
    });

    res.status(200).json({ message: 'Left classroom successfully' });
  } catch (err) {
    console.error('[Leave Classroom] error:', err);
    res.status(500).json({ error: 'Failed to leave classroom' });
  }
});


// Fetch & Remove Students
router.get('/:id/students', ensureAuthenticated, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id)
      .populate(
        'students',
        'email role firstName lastName balance shortId'
      );
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }
    res.status(200).json(classroom.students);
  } catch (err) {
    console.error('[Fetch Students] error:', err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Will remove a student from classroom
router.delete('/:id/students/:studentId', ensureAuthenticated, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    const notification = await Notification.create({
      user: req.params.studentId,
      type: 'classroom_removal',
      message: `You have been removed from classroom "${classroom.name}"`,
      classroom: classroom._id,
      actionBy: req.user._id
    });
    const populated = await populateNotification(notification._id);
    req.app.get('io').to(`user-${req.params.studentId}`).emit('notification', populated);
    req.app.get('io').to(`user-${req.params.studentId}`).emit('classroom_removal', {
      classroomId: classroom._id,
      message: `You have been removed from classroom "${classroom.name}"`
    });

    classroom.students = classroom.students.filter(
      sid => sid.toString() !== req.params.studentId
    );
    await classroom.save();

    const updated = await Classroom.findById(classroom._id).populate('students', 'email');
    req.app.get('io').to(`classroom-${classroom._id}`).emit('classroom_update', updated);

    res.status(200).json({ message: 'Student removed successfully' });
  } catch (err) {
    console.error('[Remove Student] error:', err);
    res.status(500).json({ error: 'Failed to remove student' });
  }
});


// Change User Role
router.patch('/:classId/users/:userId/role', ensureAuthenticated, async (req, res) => {
  try {
    const { classId, userId } = req.params;
    const { role } = req.body;
    const validRoles = ['student', 'teacher', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role value' });
    }

    const classroom = await Classroom.findById(classId);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }
    if (req.user._id.toString() !== classroom.teacher.toString()) {
      return res.status(403).json({ error: 'Only the teacher can change roles' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true, runValidators: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    req.app.get('io').to(`classroom-${classId}`).emit('role_change', { userId, role });
    res.json({ success: true, role });
  } catch (err) {
    console.error('[Change Role] error:', err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

module.exports = router;