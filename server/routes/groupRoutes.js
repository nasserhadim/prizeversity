// server/routes/groupRoutes.js
import express from 'express';
import {
  createGroups,
  listGroups,
  updateGroup,
  deleteGroup,
  joinGroup,
  leaveGroup,
  getGroupApprovals,
  approveOrRejectRequests,
  suspendMember
} from '../controllers/groupController.js';
import { ensureAuth } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

/**
 * For creation & updates, we often allow admin/teacher roles in a classroom
 */
router.post('/:classroomId', ensureAuth, requireRole(['admin','teacher']), createGroups);
router.get('/:classroomId', ensureAuth, listGroups);

router.put('/:groupId', ensureAuth, requireRole(['admin','teacher']), updateGroup);
router.delete('/:groupId', ensureAuth, requireRole(['admin','teacher']), deleteGroup);

// Join/Leave
router.post('/:groupId/join', ensureAuth, joinGroup);
router.post('/:groupId/leave', ensureAuth, leaveGroup);

// Approvals
router.get('/:groupId/approvals', ensureAuth, requireRole(['admin','teacher']), getGroupApprovals);
router.post('/:groupId/approvals', ensureAuth, requireRole(['admin','teacher']), approveOrRejectRequests);

// Suspend
router.post('/:groupId/suspend', ensureAuth, requireRole(['admin','teacher']), suspendMember);

export default router;
