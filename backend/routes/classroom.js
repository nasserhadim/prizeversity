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

// Add conditional uploader so JSON requests (image URL) aren't passed through multer
const conditionalUpload = (req, res, next) => {
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (ct.startsWith('multipart/form-data')) {
    return upload.single('backgroundImage')(req, res, next);
  }
  return next();
};


// Helper to generate a random 6-character alphanumeric code
function generateClassroomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}


// Create Classroom
router.post(
  '/create',
  ensureAuthenticated,
  conditionalUpload,
  async (req, res) => {
    // Debug logs
    console.log('[Create Classroom] content-type:', req.headers['content-type']);
    console.log('[Create Classroom] req.body:', req.body);
    console.log('[Create Classroom] req.file:', req.file);

    const { name, color } = req.body;
    let code = req.body.code;
    // Accept uploaded file OR a backgroundImage URL passed in the request body
    let backgroundImage = req.file
      ? `/uploads/${req.file.filename}`
      : (req.body && req.body.backgroundImage ? String(req.body.backgroundImage).trim() : undefined);

    // Normalize URL: if a non-empty value was supplied without a scheme, assume https
    if (backgroundImage && !backgroundImage.startsWith('/') && !/^https?:\/\//.test(backgroundImage) && !backgroundImage.startsWith('data:')) {
      backgroundImage = `https://${backgroundImage}`;
    }
    console.log('[Create Classroom] final backgroundImage to save:', backgroundImage);

    if (!name) {
      return res.status(400).json({ error: 'Classroom name is required' });
    }

    try {
      // If no code is provided, generate a unique one
      if (!code) {
        let isUnique = false;
        while (!isUnique) {
          code = generateClassroomCode();
          const existing = await Classroom.findOne({ code });
          if (!existing) {
            isUnique = true;
          }
        }
      } else {
        // Standardize to uppercase and validate provided code
        code = code.toUpperCase();
        if (code.length < 5 || code.length > 6) {
          return res.status(400).json({ error: 'Classroom code must be 5-6 characters long!' });
        }
        const existing = await Classroom.findOne({ code, archived: false });
        if (existing) {
          return res.status(400).json({ error: 'A classroom with this code already exists' });
        }
      }

      const classroom = new Classroom({
        name,
        code,
        teacher: req.user._id,
        students: [], // Teacher should not be in the students list
        color: color || undefined,
        backgroundImage: backgroundImage || undefined
      });
      try {
        await classroom.save();

        // Add join date for the teacher who created the classroom
        const teacher = await User.findById(req.user._id);
        if (teacher) {
          if (!teacher.classroomJoinDates) {
            teacher.classroomJoinDates = [];
          }
          const alreadyHasJoinDate = teacher.classroomJoinDates.some(
            (d) => d.classroom.toString() === classroom._id.toString()
          );
          if (!alreadyHasJoinDate) {
            teacher.classroomJoinDates.push({
              classroom: classroom._id,
              joinedAt: classroom.createdAt, // Use classroom creation date as join date
            });
            await teacher.save();
          }
        }

        console.log('[Create Classroom] saved backgroundImage:', classroom.backgroundImage);
        res.status(201).json(classroom);
      } catch (err) {
        console.error('[Create Classroom] save error:', err);
        // Add this improved error handling:
        if (err.code === 11000) {
          return res.status(400).json({ error: 'A classroom with this code already exists. Please use a different code.' });
        }
        if (err.name === 'ValidationError') {
          return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Server error creating classroom' });
      }
    } catch (err) {
      console.error('[Create Classroom] error:', err);
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
    const classroom = await Classroom.findOne({ code: code.trim().toUpperCase(), archived: false });
    if (!classroom) {
      return res.status(404).json({ error: 'Invalid classroom code' });
    }

    if (classroom.students.includes(req.user._id)) {
      return res.status(400).json({ error: 'You have already joined this classroom' });
    }

    // Initialize per-classroom balance if not present
    const user = await User.findById(req.user._id);
    const existingBalance = user.classroomBalances.find(cb => cb.classroom.toString() === classroom._id.toString());
    if (!existingBalance) {
      user.classroomBalances.push({ classroom: classroom._id, balance: 0 });
    }

    // Add classroom join date tracking
    const existingJoinDate = user.classroomJoinDates?.find(cjd => cjd.classroom.toString() === classroom._id.toString());
    if (!existingJoinDate) {
      if (!user.classroomJoinDates) user.classroomJoinDates = [];
      user.classroomJoinDates.push({ 
        classroom: classroom._id, 
        joinedAt: new Date() 
      });
    }

    await user.save();

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


// GET route to retrieve whether students can view other students' stats
router.get('/:id/students-can-view-stats', ensureAuthenticated, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id).select('teacher studentsCanViewStats');
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
    
    // Only teacher can view this setting
    if (classroom.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the teacher can view this setting' });
    }
    
    res.json({ studentsCanViewStats: classroom.studentsCanViewStats !== false }); // Default to true
  } catch (err) {
    console.error('[Get students-can-view-stats] error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH route to update whether students can view other students' stats
router.patch('/:id/students-can-view-stats', ensureAuthenticated, async (req, res) => {
  try {
    const { studentsCanViewStats } = req.body;
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
    
    // Only teacher can change this setting
    if (classroom.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the teacher can change this setting' });
    }
    
    classroom.studentsCanViewStats = !!studentsCanViewStats;
    await classroom.save();
    
    // Emit the update to all clients in the classroom's room with proper populated data
    const populatedClassroom = await Classroom.findById(classroom._id)
      .populate('teacher', 'email')
      .populate('students', 'email');
    
    req.app.get('io').to(`classroom-${classroom._id}`).emit('classroom_update', populatedClassroom);

    res.json({ studentsCanViewStats: !!classroom.studentsCanViewStats });
  } catch (err) {
    console.error('[Patch students-can-view-stats] error:', err);
    res.status(500).json({ error: 'Server error' });
  }
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
      return res.status(403).json({ error: 'You do not have access to this classroom' });
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
  // Accept uploaded file OR a backgroundImage URL passed in the request body
  let backgroundImage = req.file
    ? `/uploads/${req.file.filename}`
    : (req.body && req.body.backgroundImage ? String(req.body.backgroundImage).trim() : undefined);

  // Normalize URL if necessary (assume https when missing scheme)
  if (backgroundImage && !backgroundImage.startsWith('/') && !/^https?:\/\//.test(backgroundImage) && !backgroundImage.startsWith('data:')) {
    backgroundImage = `https://${backgroundImage}`;
  }
  console.log('[Update Classroom] final backgroundImage:', backgroundImage);

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

    // Remove student from all groups in this classroom before leaving
    if (classroom.students.includes(req.user._id)) {
      const GroupSet = require('../models/GroupSet');
      const Group = require('../models/Group');
      
      // Find all groupsets in this classroom
      const groupSets = await GroupSet.find({ classroom: req.params.id });
      
      // Remove user from all groups in these groupsets
      for (const groupSet of groupSets) {
        const groups = await Group.find({ _id: { $in: groupSet.groups } });
        
        for (const group of groups) {
          const wasMember = group.members.some(member => member._id.equals(req.user._id));
          if (wasMember) {
            group.members = group.members.filter(member => !member._id.equals(req.user._id));
            await group.save();
            
            // Update group multiplier after member removal
            await group.updateMultiplier();
          }
        }
      }
    }

    if (classroom.teacher.toString() === req.user._id.toString()) {
      await Classroom.deleteOne({ _id: req.params.id });
    } else {
      classroom.students = classroom.students.filter(
        sid => sid.toString() !== req.user._id.toString()
      );
      await classroom.save();
    }

    // Remove classroomJoinDates entry for the leaving user so future rejoins get a fresh join date
    try {
      const User = require('../models/User');
      const leavingUser = await User.findById(req.user._id);
      if (leavingUser) {
        leavingUser.classroomJoinDates = (leavingUser.classroomJoinDates || [])
          .filter(cjd => String(cjd.classroom) !== String(req.params.id));
        await leavingUser.save();
      }
    } catch (e) {
      console.error('[Leave Classroom] failed to clear classroomJoinDates for user:', e);
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


// Fetch Students in Classroom (updated for per-classroom balances)
router.get('/:id/students', ensureAuthenticated, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id)
      .populate('teacher', 'email role firstName lastName shortId createdAt')
      .populate('students', 'email role firstName lastName shortId createdAt');
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    const allUsers = [...classroom.students];
    if (classroom.teacher) {
      // Ensure teacher is not duplicated if they are also in students list (edge case)
      if (!allUsers.some(s => s._id.equals(classroom.teacher._id))) {
        allUsers.unshift(classroom.teacher);
      }
    }

    // Fetch per-classroom balances for each student
    const usersWithData = await Promise.all(
      allUsers.map(async (person) => {
        const user = await User.findById(person._id).select('classroomBalances classroomJoinDates');
        const classroomBalance = user.classroomBalances.find(cb => cb.classroom.toString() === req.params.id);
        
        // Try to find classroom-specific join date, fall back to account creation date
        const classroomJoinDate = user.classroomJoinDates?.find(cjd => cjd.classroom.toString() === req.params.id);
        
        return {
          ...person.toObject(),
          balance: classroomBalance ? classroomBalance.balance : 0,
          joinedAt: classroomJoinDate?.joinedAt || person.createdAt
        };
      })
    );

    res.status(200).json(usersWithData);
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

    // Add group cleanup before removing from classroom
    const GroupSet = require('../models/GroupSet');
    const Group = require('../models/Group');
    
    // Find all groupsets in this classroom
    const groupSets = await GroupSet.find({ classroom: req.params.id });
    
    // Remove user from all groups in these groupsets
    for (const groupSet of groupSets) {
      const groups = await Group.find({ _id: { $in: groupSet.groups } });
      
      for (const group of groups) {
        const wasMember = group.members.some(member => member._id.toString() === req.params.studentId);
        if (wasMember) {
          // Remove the student from this group (whether pending, approved, or suspended)
          group.members = group.members.filter(member => member._id.toString() !== req.params.studentId);
          await group.save();
          
          // Update group multiplier after member removal
          await group.updateMultiplier();
          
          // Emit group update to inform other members
          const populatedGroup = await Group.findById(group._id)
            .populate('members._id', 'email firstName lastName');
          req.app.get('io').to(`classroom-${req.params.id}`).emit('group_update', { 
            groupSet: groupSet._id, 
            group: populatedGroup
          });
        }
      }
    }

    // Remove join-date entry for the removed student so a future rejoin records a new join date
    try {
      const User = require('../models/User');
      const removedUser = await User.findById(req.params.studentId);
      if (removedUser) {
        removedUser.classroomJoinDates = (removedUser.classroomJoinDates || [])
          .filter(cjd => String(cjd.classroom) !== String(req.params.id));
        await removedUser.save();
      }
    } catch (e) {
      console.error('[Remove Student] failed to clear classroomJoinDates for removed user:', e);
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

// Update siphon timeout setting
router.post('/:id/siphon-timeout', ensureAuthenticated, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    if (classroom.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the teacher can update siphon timeout' });
    }

    const { siphonTimeoutHours } = req.body;
    
    if (siphonTimeoutHours < 1 || siphonTimeoutHours > 168) {
      return res.status(400).json({ error: 'Siphon timeout must be between 1 and 168 hours' });
    }

    classroom.siphonTimeoutHours = siphonTimeoutHours;
    await classroom.save();

    res.json({ message: 'Siphon timeout updated successfully', siphonTimeoutHours });
  } catch (err) {
    console.error('[Update Siphon Timeout] error:', err);
    res.status(500).json({ error: 'Failed to update siphon timeout' });
  }
});

// Get siphon timeout setting
router.get('/:id/siphon-timeout', ensureAuthenticated, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id).select('siphonTimeoutHours');
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    res.json({ siphonTimeoutHours: classroom.siphonTimeoutHours || 72 });
  } catch (err) {
    console.error('[Get Siphon Timeout] error:', err);
    res.status(500).json({ error: 'Failed to get siphon timeout' });
  }
});

module.exports = router;