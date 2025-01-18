import express from 'express';
import { ensureAuth } from '../middleware/authMiddleware.js';
import {
  getWallet,
  transferBalance,
  getTransactions
} from '../controllers/walletController.js';
import { transactionQueryValidation, validateRequest } from '../config/validate.js';

const router = express.Router();

router.get('/:classroomId', ensureAuth, getWallet);
router.post('/:classroomId/transfer', ensureAuth, transferBalance);
router.get('/:classroomId/transactions', ensureAuth, transactionQueryValidation, validateRequest, getTransactions);

export default router;
