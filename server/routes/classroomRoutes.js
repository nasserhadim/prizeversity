import express from 'express';
import {
  createClassroom,
  getClassroomsForUser,
  joinClassroom,
  leaveClassroom,
  deleteClassroom,
  assignBalance
} from '../controllers/classroomController.js';
import { ensureAuth } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { createClassroomValidation, validateRequest } from '../config/validate.js';

const router = express.Router();

// Create classroom (teacher or admin at a global sense, but let's keep it simple)
router.post('/', ensureAuth, createClassroomValidation, validateRequest, createClassroom);

// List user’s classrooms
router.get('/', ensureAuth, getClassroomsForUser);

// Join
router.post('/:id/join', ensureAuth, joinClassroom);

// Leave
router.post('/:id/leave', ensureAuth, leaveClassroom);

// Delete (admin only in that classroom)
router.delete('/:id', ensureAuth, deleteClassroom);

// Assign balance (admin/teacher in that classroom)
router.post('/:id/assign-balance', ensureAuth, requireRole(['admin','teacher']), assignBalance);

export default router;
