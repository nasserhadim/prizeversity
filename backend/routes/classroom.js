const express = require('express');
const path = require('path');
const multer = require('multer');
const Classroom = require('../models/Classroom');
const Group = require('../models/Group');
const GroupSet = require('../models/GroupSet');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { ensureAuthenticated } = require('../config/auth');
const blockIfFrozen = require('../middleware/blockIfFrozen');
const { populateNotification } = require('../utils/notifications');
const { logStatChanges } = require('../utils/statChangeLog'); // NEW: used for daily check-in + other stat logs
const { awardXP } = require('../utils/awardXP');

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
    // Join Classroom (use both banLog OR bannedRecords when checking)
    const classroom = await Classroom.findOne({ code: code.trim().toUpperCase(), archived: false });
    if (!classroom) {
      return res.status(404).json({ error: 'Invalid classroom code' });
    }

    // Block join if user is banned (supports legacy bannedStudents array and optional banLog/bannedRecords)
    const isBannedLegacy = Array.isArray(classroom.bannedStudents) && classroom.bannedStudents.map(String).includes(String(req.user._id));
    const isBannedLog = (Array.isArray(classroom.banLog) && classroom.banLog.some(br => String(br.user || br) === String(req.user._id)))
      || (Array.isArray(classroom.bannedRecords) && classroom.bannedRecords.some(br => String(br.user || br) === String(req.user._id)));
    if (isBannedLegacy || isBannedLog) {
      return res.status(403).json({ error: 'You are banned from this classroom' });
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
    // Populate teacher/students/bannedStudents and any banLog.user so frontend can read reason/timestamp reliably
    const classroom = await Classroom.findById(req.params.id)
      .populate('teacher', 'email role firstName lastName shortId createdAt')
      .populate('students', 'email role firstName lastName shortId createdAt')
      .populate('bannedStudents', 'email role firstName lastName shortId createdAt');
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    // Ensure bannedRecords exists, then populate its user refs
    classroom.bannedRecords = classroom.bannedRecords || [];
    await classroom.populate({ path: 'bannedRecords.user', select: 'email role firstName lastName shortId createdAt', strictPopulate: false });

    // Keep banLog alias for older frontend code
    classroom.banLog = classroom.banLog || classroom.bannedRecords || [];

    console.log('[Fetch Classroom] bannedRecords after populate:', classroom.bannedRecords);

    // Normalize id checks (handles populated objects or raw ObjectId strings)
    const userIdStr = String(req.user._id);
    const teacherIdStr = String(classroom.teacher?._id || classroom.teacher);
    const studentIds = Array.isArray(classroom.students) ? classroom.students.map(s => String(s._id || s)) : [];

    const isTeacherUser = teacherIdStr === userIdStr;
    const isStudentUser = studentIds.includes(userIdStr);

    // Only allow access to teacher/admin or to students who are members
    const hasAccess =
      req.user.role === 'admin' ||
      (req.user.role === 'teacher' && isTeacherUser) ||
      (req.user.role === 'student' && isStudentUser);

    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this classroom' });
    }

    // Deny access for banned students (supports objects or ids in bannedStudents and supports banLog)
    const bannedStudentsIds = Array.isArray(classroom.bannedStudents) ? classroom.bannedStudents.map(b => String(b._id || b)) : [];
    const isBannedLegacy = bannedStudentsIds.includes(userIdStr);
    const isBannedLog = Array.isArray(classroom.banLog) && classroom.banLog.some(br => String(br.user?._id || br.user) === userIdStr);
    if ((isBannedLegacy || isBannedLog) && req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You are banned from this classroom' });
    }

    // Ensure a canonical banLog is present (backend historically used banLog or bannedRecords)
    const classroomObj = classroom && classroom.toObject ? classroom.toObject() : classroom;
    classroomObj.banLog = classroomObj.banLog || classroomObj.bannedRecords || [];
    console.log('Fetched classroom banLog:', classroomObj.banLog);

    // Sanitize banLog for non-privileged viewers: remove the 'reason' field for students/others
    if (!['teacher', 'admin'].includes(req.user.role)) {
      classroomObj.banLog = (classroomObj.banLog || []).map(br => {
        return {
          user: br.user,
          bannedAt: br.bannedAt
          // intentionally omit `reason`
        };
      });
    }
    res.status(200).json(classroomObj);
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

    // Send notifications to all recipients
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

    // Emit classroom removal to all students (ensure string conversion)
    for (const studentId of classroom.students) {
      req.app.get('io').to(`user-${studentId}`).emit('classroom_removal', {
        classroomId: classroom._id.toString(), // Convert to string
        message: `Classroom "${classroom.name}" has been deleted`
      });
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
router.post('/:id/leave', ensureAuthenticated, blockIfFrozen, async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id);
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    // Prevent leaving classroom while there's an active siphon against this user
    const SiphonRequest = require('../models/SiphonRequest');
    const User = require('../models/User');
    const liveUser = await User.findById(req.user._id).select('isFrozen');
    if (liveUser?.isFrozen) {
      const active = await SiphonRequest.findOne({
        targetUser: req.user._id,
        status: { $in: ['pending', 'group_approved'] }
      });
      if (active) {
        return res.status(403).json({ error: 'You cannot leave the classroom while a siphon request against you is pending.' });
      }
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
    console.error('Leave classroom error:', err);
    res.status(500).json({ error: 'Failed to leave classroom' });
  }
});


// Fetch Students in Classroom (updated for per-classroom balances)
router.get('/:id/students', ensureAuthenticated, async (req, res) => {
  try {
    // Quick ban check before returning students (so banned users are blocked)
    const classroomCheck = await Classroom.findById(req.params.id).select('bannedStudents banLog teacher');
    if (!classroomCheck) return res.status(404).json({ error: 'Classroom not found' });
    const userIdStr = String(req.user._id);
    const isBannedLegacy = Array.isArray(classroomCheck.bannedStudents) && classroomCheck.bannedStudents.map(b => (b._id ? String(b._id) : String(b))).includes(userIdStr);
    const isBannedLog = Array.isArray(classroomCheck.banLog) && classroomCheck.banLog.some(br => String(br.user?._id || br.user) === userIdStr);
    if ((isBannedLegacy || isBannedLog) && req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You are banned from this classroom' });
    }

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
        const classroomJoinDate = user.classroomJoinDates?.find(cjd => cjd.classroom.toString() === req.params.id);

        return {
          ...person.toObject(),
          balance: classroomBalance ? classroomBalance.balance : 0,
          joinedAt: classroomJoinDate?.joinedAt || person.createdAt,
          // NEW: expose lastAccessed
          lastAccessed: classroomJoinDate?.lastAccessed || null,
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
      classroomId: classroom._id.toString(), // Convert to string
      message: `You have been removed from classroom "${classroom.name}"`
    });

    classroom.students = classroom.students.filter(
      sid => sid.toString() !== req.params.studentId
    );
    await classroom.save();

    const updated = await Classroom.findById(classroom._id)
      .populate('students', 'email');
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

// Ban a student (teacher only) - student is removed from students and added to bannedStudents
router.post('/:id/students/:studentId/ban', ensureAuthenticated, async (req, res) => {
  try {
    const { id, studentId } = req.params;
    const reason = req.body?.reason ? String(req.body.reason).trim() : '';
    const classroom = await Classroom.findById(id).populate('students', 'email');
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    if (classroom.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the teacher can ban students' });
    }

    if (!classroom.students.map(s => s._id.toString()).includes(studentId)) {
      return res.status(400).json({ error: 'Student is not in this classroom' });
    }

    // NOTE: do NOT remove the student from classroom.students here.
    // Keep them listed so the teacher can later unban (and so unban logic that looks at bannedStudents/banLog still works).
    // We still record the ban (bannedStudents + banLog) and emit classroom_removal so the client is booted.
    classroom.bannedStudents = classroom.bannedStudents || [];
    if (!classroom.bannedStudents.map(b => b.toString()).includes(studentId)) {
      classroom.bannedStudents.push(studentId);
    }
    await classroom.save();

    // Persist minimal ban record (reason + timestamp) using atomic update so it's stored even if schema isn't updated.
    classroom.banLog = classroom.banLog || [];
    console.log('[Ban] banLog before push:', classroom.banLog);
    classroom.banLog.push({ user: studentId, reason: reason || '', bannedAt: new Date() });
    console.log('[Ban] banLog after push:', classroom.banLog);
    await classroom.save();  // This now saves both bannedStudents and banLog
    console.log('[Ban] banLog after save:', classroom.banLog);

    // Ban a student — persist into the schema field 'bannedRecords' (and mirror to banLog)
    classroom.bannedRecords = classroom.bannedRecords || [];
    classroom.bannedRecords.push({ user: studentId, reason: reason || '', bannedAt: new Date() });
    console.log('[Ban] bannedRecords after push:', classroom.bannedRecords);

    // keep legacy alias in-memory so emits/readers that expect banLog still work
    classroom.banLog = classroom.banLog || classroom.bannedRecords;

    await classroom.save();
    console.log('[Ban] bannedRecords after save:', classroom.bannedRecords);

    // Create and emit notification to the banned student
    const notification = await Notification.create({
      user: studentId,
      type: 'classroom_ban',
      message: `You have been banned from classroom "${classroom.name}"` + (reason ? ` — Reason: ${reason}` : ''),
      classroom: classroom._id,
      actionBy: req.user._id,
      createdAt: new Date()
    });
    const populated = await populateNotification(notification._id);
    try { req.app.get('io').to(`user-${studentId}`).emit('notification', populated); } catch(e){/*ignore*/}

    // Also emit classroom_removal so client boots the user similar to removal flow
    try {
      req.app.get('io').to(`user-${studentId}`).emit('classroom_removal', {
        classroomId: classroom._id.toString(),
        userId: studentId, // Add this to identify the recipient
        message: `You have been banned from classroom "${classroom.name}"` + (reason ? ` — Reason: ${reason}` : '')
      });
    } catch (e) { /* ignore */ }

    // Emit classroom update to classroom room
    const updated = await Classroom.findById(classroom._id)
      .populate('students', 'email')
      .populate('bannedStudents', 'email firstName lastName')
      .populate({ path: 'banLog.user', select: 'email firstName lastName', strictPopulate: false })
      .populate({ path: 'bannedRecords.user', select: 'email firstName lastName', strictPopulate: false });
    const updatedObj = updated && updated.toObject ? updated.toObject() : updated;
    updatedObj.banLog = updatedObj.banLog || updatedObj.bannedRecords || [];
    try { req.app.get('io').to(`classroom-${classroom._id}`).emit('classroom_update', updatedObj); } catch(e){/*ignore*/}

    res.status(200).json({ message: 'Student banned successfully' });
  } catch (err) {
    console.error('[Ban Student] error:', err);
    res.status(500).json({ error: 'Failed to ban student' });
  }
});

// Unban a student (teacher only) - remove from bannedStudents
router.post('/:id/students/:studentId/unban', ensureAuthenticated, async (req, res) => {
  try {
    const { id, studentId } = req.params;
    const classroom = await Classroom.findById(id).populate('bannedStudents', 'email firstName lastName');
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    if (classroom.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the teacher can unban students' });
    }

    if (!classroom.bannedStudents || !classroom.bannedStudents.map(b => b._id ? b._id.toString() : b.toString()).includes(studentId)) {
      return res.status(400).json({ error: 'Student is not banned' });
    }

    classroom.bannedStudents = (classroom.bannedStudents || []).filter(b => {
      const idStr = b._id ? b._id.toString() : b.toString();
      return idStr !== studentId;
    });

    await classroom.save();

    // Remove any banLog entries for this user
    await Classroom.updateOne(
      { _id: classroom._id },
      { $pull: { banLog: { user: studentId }, bannedRecords: { user: studentId } } }
    );

    // Notify the student they have been unbanned
    const notification = await Notification.create({
      user: studentId,
      type: 'classroom_unban',
      message: `You have been unbanned from classroom "${classroom.name}". You may now rejoin.`,
      classroom: classroom._id,
      actionBy: req.user._id,
      createdAt: new Date()
    });
    const populated = await populateNotification(notification._id);
    try { req.app.get('io').to(`user-${studentId}`).emit('notification', populated); } catch(e){/*ignore*/}

    // Emit classroom update to classroom room
    const updated = await Classroom.findById(classroom._id)
      .populate('students', 'email')
      .populate('bannedStudents', 'email firstName lastName')
      .populate({ path: 'banLog.user', select: 'email firstName lastName', strictPopulate: false })
      .populate({ path: 'bannedRecords.user', select: 'email firstName lastName', strictPopulate: false });
    const updatedObj = updated && updated.toObject ? updated.toObject() : updated;
    updatedObj.banLog = updatedObj.banLog || updatedObj.bannedRecords || [];
    try { req.app.get('io').to(`classroom-${classroom._id}`).emit('classroom_update', updatedObj); } catch(e){/*ignore*/}

    res.status(200).json({ message: 'Student unbanned successfully' });
  } catch (err) {
    console.error('[Unban Student] error:', err);
    res.status(500).json({ error: 'Failed to unban student' });
  }
});

// GET classroom feedback reward config (teacher only)
router.get('/:id/feedback-reward', ensureAuthenticated, async (req, res) => {
  try {
    const c = await Classroom.findById(req.params.id).select('teacher feedbackRewardEnabled feedbackRewardBits feedbackRewardApplyGroupMultipliers feedbackRewardApplyPersonalMultipliers feedbackRewardAllowAnonymous');
    if (!c) return res.status(404).json({ error: 'Not found' });
    // Only the teacher may view this config
    if (c.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json({
      feedbackRewardEnabled: !!c.feedbackRewardEnabled,
      feedbackRewardBits: c.feedbackRewardBits || 0,
      feedbackRewardApplyGroupMultipliers: !!c.feedbackRewardApplyGroupMultipliers,
      feedbackRewardApplyPersonalMultipliers: !!c.feedbackRewardApplyPersonalMultipliers,
      feedbackRewardAllowAnonymous: !!c.feedbackRewardAllowAnonymous
    });
  } catch (err) {
    console.error('[Get feedback-reward] error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH update classroom feedback reward config (teacher only)
router.patch('/:id/feedback-reward', ensureAuthenticated, async (req, res) => {
  try {
    const { feedbackRewardEnabled, feedbackRewardBits, feedbackRewardApplyGroupMultipliers, feedbackRewardApplyPersonalMultipliers, feedbackRewardAllowAnonymous } = req.body;
    const c = await Classroom.findById(req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    if (c.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (feedbackRewardEnabled !== undefined) c.feedbackRewardEnabled = !!feedbackRewardEnabled;
    if (feedbackRewardBits !== undefined) c.feedbackRewardBits = Math.max(0, Number(feedbackRewardBits) || 0);
    if (feedbackRewardApplyGroupMultipliers !== undefined) c.feedbackRewardApplyGroupMultipliers = !!feedbackRewardApplyGroupMultipliers;
    if (feedbackRewardApplyPersonalMultipliers !== undefined) c.feedbackRewardApplyPersonalMultipliers = !!feedbackRewardApplyPersonalMultipliers;
    if (feedbackRewardAllowAnonymous !== undefined) c.feedbackRewardAllowAnonymous = !!feedbackRewardAllowAnonymous;

    await c.save();
    // emit classroom_update so frontends can react (consistent with other settings)
    const populated = await Classroom.findById(c._id).populate('teacher', 'email').populate('students', 'email');
    try { req.app.get('io').to(`classroom-${c._id}`).emit('classroom_update', populated); } catch(e){/*ignore*/}

    res.json({
      feedbackRewardEnabled: c.feedbackRewardEnabled,
      feedbackRewardBits: c.feedbackRewardBits,
      feedbackRewardApplyGroupMultipliers: c.feedbackRewardApplyGroupMultipliers,
      feedbackRewardApplyPersonalMultipliers: c.feedbackRewardApplyPersonalMultipliers,
      feedbackRewardAllowAnonymous: c.feedbackRewardAllowAnonymous
    });
  } catch (err) {
    console.error('[Patch feedback-reward] error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Patch: allow teacher to set per-student stats (multiplier, luck, discount)
router.patch('/:classId/users/:userId/stats', ensureAuthenticated, async (req, res) => {
  try {
    const { classId, userId } = req.params;
    const { multiplier, luck, discount, xp, shield } = req.body; // xp is absolute desired XP; shield = shield count (integer)

    const classroom = await Classroom.findById(classId);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
    if (classroom.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the teacher can update student stats' });
    }

    const student = await User.findById(userId);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (student.role === 'teacher') return res.status(400).json({ error: 'Cannot adjust teacher stats' });

    if (!student.passiveAttributes) student.passiveAttributes = {};

    // Capture previous values for change log
    const prev = {
      multiplier: student.passiveAttributes.multiplier ?? 1,
      luck: student.passiveAttributes.luck ?? 1,
      discount: student.passiveAttributes.discount ?? null,
      shield: student.shieldCount ?? 0
    };

    // Apply updates for multiplier/luck/discount like before
    if (typeof multiplier !== 'undefined') {
      student.passiveAttributes.multiplier = Number(multiplier) || 1;
    }
    if (typeof luck !== 'undefined') {
      student.passiveAttributes.luck = Number(luck) || 1;
    }
    if (typeof discount !== 'undefined') {
      const d = Number(discount);
      if (!d) {
        delete student.passiveAttributes.discount;
      } else {
        student.passiveAttributes.discount = d;
      }
    }

    // Apply shield update if provided: shield is treated as count; activate shield if > 0
    if (typeof shield !== 'undefined') {
      const sc = Math.max(0, parseInt(shield, 10) || 0);
      student.shieldCount = sc;
      student.shieldActive = sc > 0;
    }

    // --- NEW: handle xp adjustment (absolute value) ---
    let xpChangeRecorded = false;
    let xpFrom = null;
    let xpTo = null;
    if (typeof xp !== 'undefined' && xp !== null && xp !== '') {
      // enforce XP system enabled
      if (!classroom.xpSettings?.enabled) {
        return res.status(400).json({ error: 'XP system is not enabled for this classroom' });
      }

      // ensure classroomXP array exists
      if (!Array.isArray(student.classroomXP)) student.classroomXP = [];

      let classroomXPEntry = student.classroomXP.find(cx => String(cx.classroom) === String(classId));
      if (!classroomXPEntry) {
        classroomXPEntry = { classroom: classId, xp: 0, level: 1, earnedBadges: [] };
        student.classroomXP.push(classroomXPEntry);
      }

      xpFrom = Number(classroomXPEntry.xp || 0);
      xpTo = Math.max(0, Number(xp) || 0); // absolute new value
      if (Number.isNaN(xpTo)) {
        return res.status(400).json({ error: 'Invalid XP value' });
      }

      if (xpFrom !== xpTo) {
        classroomXPEntry.xp = xpTo;

        // recompute level from xp using shared helper
        const { calculateLevelFromXP } = require('../utils/xp');
        const newLevel = calculateLevelFromXP(xpTo, classroom.xpSettings?.levelingFormula || 'exponential', classroom.xpSettings?.baseXPForLevel2 || 100);
        classroomXPEntry.level = newLevel;

        xpChangeRecorded = true;
      }
    }
    // --- END: xp adjustment ---

    // Build changes array (including xp if adjusted)
    const changes = [];
    const now = new Date();
    const curr = {
      multiplier: student.passiveAttributes.multiplier ?? 1,
      luck: student.passiveAttributes.luck ?? 1,
      discount: student.passiveAttributes.discount ?? null,
      shield: student.shieldCount ?? 0
    };

    ['multiplier', 'luck', 'discount', 'shield'].forEach((f) => {
      const before = prev[f];
      const after = curr[f];
      if (String(before) !== String(after)) {
        changes.push({ field: f, from: before, to: after });
      }
    });

    if (xpChangeRecorded) {
      changes.push({ field: 'xp', from: xpFrom, to: xpTo });
    }

    await student.save();

    // Helper to render a readable value for summary (special-case xp to include delta)
    const renderValue = (field, v) => {
      if (v === null || v === undefined) {
        if (field === 'multiplier' || field === 'luck') return 1;
        if (field === 'discount') return 0;
        if (field === 'xp') return 0;
        return 0;
      }
      return v;
    };

    const formatChangeSummary = (changes) => {
      if (!Array.isArray(changes) || changes.length === 0) return '';
      const fmtNum1 = (n) => Number((Number(n) || 0)).toFixed(1);
      const fmtInt = (n) => Math.round(Number(n) || 0);
  
      const formatOne = (c) => {
        const f = c.field;
        if (f === 'xp') {
          const from = fmtInt(renderValue('xp', c.from));
          const to = fmtInt(renderValue('xp', c.to));
          const delta = to - from;
          const sign = delta >= 0 ? `+${delta}` : `${delta}`;
          return `xp: ${from} → ${to} (${sign} XP)`;
        }
        if (['multiplier','luck','groupMultiplier'].includes(f)) {
          const from = Number(renderValue(f, c.from) ?? 1);
          const to = Number(renderValue(f, c.to) ?? 1);
          const delta = Number((to - from).toFixed(1));
          const sign = delta >= 0 ? `+${delta.toFixed(1)}` : `${delta.toFixed(1)}`;
          return `${f}: ${from.toFixed(1)} → ${to.toFixed(1)} (${sign})`;
        }
        if (f === 'discount') {
          const from = fmtInt(renderValue('discount', c.from));
          const to = fmtInt(renderValue('discount', c.to));
          const delta = to - from;
          const sign = delta >= 0 ? `+${delta}` : `${delta}`;
          return `discount: ${from} → ${to} (${sign})`;
        }
        // generic fallback
        const from = renderValue(c.field, c.from);
        const to = renderValue(c.field, c.to);
        return `${c.field}: ${String(from)} → ${String(to)}`;
      };
  
      return changes.map(formatOne).join('; ');
    };

    const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.email;
    const summary = formatChangeSummary(changes) || 'updated by teacher';

    // Create notification for the student (log entry, included in stat-changes)
    const studentNotification = await Notification.create({
      user: student._id,
      actionBy: req.user._id,
      type: 'stats_adjusted',
      message: `Your stats were updated by your teacher: ${summary}.`,
      classroom: classId,
      read: false,
      changes,
      targetUser: student._id,
      createdAt: now
    });

    // Create a separate notification for the teacher's realtime feedback (not a log entry)
    const teacherNotification = await Notification.create({
      user: req.user._id, // Target the teacher
      actionBy: req.user._id,
      type: 'stats_adjusted',
      message: `You updated stats for ${fullName}: ${summary}.`,
      classroom: classId,
      read: false,
      changes,
      targetUser: student._id,
      isLogEntry: false,
      createdAt: now
    });

    // Notify the student in real-time
    const populatedStudentNotification = await populateNotification(studentNotification._id);
    try { req.app.get('io').to(`user-${student._id}`).emit('notification', populatedStudentNotification); } catch(e){/*ignore*/}

    // Notify the teacher in real-time
    const populatedTeacherNotification = await populateNotification(teacherNotification._id);
    try { req.app.get('io').to(`user-${req.user._id}`).emit('notification', populatedTeacherNotification); } catch(e){/*ignore*/}

    // emit stats update for the student so clients refresh displays
    try {
      req.app.get('io').to(`user-${student._id}`).emit('user_stats_update', { userId: student._id, passiveAttributes: student.passiveAttributes });
    } catch(e){/*ignore*/}

    res.json({ message: 'Stats updated', passiveAttributes: student.passiveAttributes, changes });
  } catch (err) {
    console.error('[Patch student stats] error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// NEW: Fetch recent stat-change notifications for a classroom (teacher/admin access)
router.get('/:id/stat-changes', ensureAuthenticated, async (req, res) => {
  try {
    const classroomId = req.params.id;
    const classroom = await Classroom.findById(classroomId);
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    // allow classroom teacher or platform admins
    const isTeacherOrAdmin = String(classroom.teacher) === String(req.user._id) || req.user.role === 'admin';

    if (!isTeacherOrAdmin && req.user.role !== 'student') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let query;
    if (isTeacherOrAdmin) {
      // Teachers/Admins see all stat changes in the classroom
      query = {
        classroom: classroomId,
        type: 'stats_adjusted',
        isLogEntry: { $ne: false } // Exclude non-log entries
      };
    } else {
      // Students only see their own stat changes
      query = {
        classroom: classroomId,
        type: 'stats_adjusted',
        $or: [
          { user: req.user._id },
          { targetUser: req.user._id }
        ]
      };
    }

    const logs = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('actionBy', 'firstName lastName')
      .populate('targetUser', 'firstName lastName email') // This was missing
      .lean();

    res.json(logs);
  } catch (err) {
    console.error('[Get stat-changes] error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Record classroom access (students, teachers, admins)
router.post('/:id/access', ensureAuthenticated, async (req, res) => {
  try {
    const classroomId = req.params.id;
    const classroom = await Classroom.findById(classroomId).select('_id teacher students');
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    const uid = String(req.user._id);
    const isTeacher = String(classroom.teacher) === uid;
    const isStudent = Array.isArray(classroom.students) && classroom.students.map(String).includes(uid);
    const isAdmin = req.user.role === 'admin';

    if (!(isTeacher || isStudent || isAdmin)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const user = await User.findById(req.user._id).select('classroomJoinDates');
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!Array.isArray(user.classroomJoinDates)) user.classroomJoinDates = [];

    const entry = user.classroomJoinDates.find(
      cjd => String(cjd.classroom) === String(classroomId)
    );
    const now = new Date();

    if (entry) {
      entry.lastAccessed = now;
    } else {
      user.classroomJoinDates.push({
        classroom: classroom._id,
        joinedAt: now,
        lastAccessed: now
      });
    }

    await user.save();
    res.json({ ok: true, lastAccessed: now });
  } catch (err) {
    console.error('[Record classroom access] error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add new endpoint for daily check-in
router.post('/:classroomId/checkin', ensureAuthenticated, async (req, res) => {
  console.info(`[checkin] route entry: user=${req.user?._id} params.classroomId=${req.params.classroomId}`);
     try {
       const { classroomId } = req.params;
       const userId = req.user._id;

       const user = await User.findById(userId);
       const classroom = await Classroom.findById(classroomId).select('xpSettings students');
    
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    if (!classroom.students.includes(userId)) {
      return res.status(403).json({ error: 'Not a member of this classroom' });
    }

    if (!classroom.xpSettings?.enabled) {
      return res.json({ message: 'XP system not enabled', xpAwarded: 0 });
    }

    // Find classroom XP entry
    let classroomXP = user.classroomXP.find(
      cx => cx.classroom.toString() === classroomId.toString()
    );

    if (!classroomXP) {
      classroomXP = {
        classroom: classroomId,
        xp: 0,
        level: 1,
        earnedBadges: []
      };
      user.classroomXP.push(classroomXP);
    }

    // Check if already checked in today
    const now = new Date();
    const lastCheckIn = classroomXP.lastDailyCheckIn;
    
    if (lastCheckIn) {
      const lastDate = new Date(lastCheckIn);
      const isSameDay = 
        lastDate.getFullYear() === now.getFullYear() &&
        lastDate.getMonth() === now.getMonth() &&
        lastDate.getDate() === now.getDate();

      if (isSameDay) {
        return res.json({ 
          message: 'Already checked in today', 
          xpAwarded: 0,
          alreadyCheckedIn: true
        });
      }
    }

    // Award daily check-in XP
    classroomXP.lastDailyCheckIn = now;
    await user.save();

    const xpToAward = classroom.xpSettings.dailyCheckIn || 5;
    // pass the loaded user document to awardXP to avoid concurrent-save version conflicts
    const result = await awardXP(userId, classroomId, xpToAward, 'daily check-in', classroom.xpSettings, { user });
    // DEBUG: log awardXP result and io presence so we can confirm emission path
    try {
      console.info('[checkin] awardXP result:', { userId, classroomId, xpToAward, result });
      const ioInstance = req.app && req.app.get ? req.app.get('io') : null;
      console.info('[checkin] io present?', !!ioInstance);
    } catch (e) {
      console.warn('[checkin] debug logging failed', e);
    }
    // Log & emit stat-change so frontend shows "xp: A → B (+Δ)" in realtime
    try {
      if (result && typeof result.oldXP !== 'undefined' && typeof result.newXP !== 'undefined' && result.newXP !== result.oldXP) {
        try {
          await logStatChanges({
            io: req.app && req.app.get ? req.app.get('io') : null,
            classroomId,
            user,                 // user doc loaded earlier in this route
            actionBy: null,       // system action (no specific actor)
            prevStats: { xp: result.oldXP },
            currStats: { xp: result.newXP },
            context: 'daily check-in',
            details: { effectsText: `Daily check-in: +${xpToAward} XP` },
            forceLog: true
          });
        } catch (logErr) {
          console.warn('[classroom] failed to log daily check-in stat change:', logErr);
        }
      }
    } catch (e) {
      console.warn('[classroom] daily check-in logging failed:', e);
    }

    res.json({
      message: 'Daily check-in successful!',
      xpAwarded: xpToAward,
      ...result
    });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;