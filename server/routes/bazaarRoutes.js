import express from 'express';
import {
  createBazaar,
  getBazaarsByClassroom,
  updateBazaar,
  deleteBazaar,
  createItem,
  getItemsByBazaar,
  updateItem,
  deleteItem,
  buyItem
} from '../controllers/bazaarController.js';
import { ensureAuth } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

// Bazaars
router.post('/:classroomId', ensureAuth, requireRole(['admin','teacher']), createBazaar);
router.get('/:classroomId', ensureAuth, getBazaarsByClassroom);
router.put('/:bazaarId', ensureAuth, requireRole(['admin','teacher']), updateBazaar);
router.delete('/:bazaarId', ensureAuth, requireRole(['admin','teacher']), deleteBazaar);

// Items
router.post('/:bazaarId/items', ensureAuth, requireRole(['admin','teacher']), createItem);
router.get('/:bazaarId/items', ensureAuth, getItemsByBazaar);
router.put('/items/:itemId', ensureAuth, requireRole(['admin','teacher']), updateItem);
router.delete('/items/:itemId', ensureAuth, requireRole(['admin','teacher']), deleteItem);

// Buy item
router.post('/items/:itemId/buy', ensureAuth, buyItem);

export default router;
