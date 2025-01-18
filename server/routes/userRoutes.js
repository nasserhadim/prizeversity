// server/routes/userRoutes.js
import express from 'express';
import { ensureAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * GET /api/users/me
 * Returns the authenticated user's info, including globalRole.
 */
router.get('/me', ensureAuth, (req, res) => {
  // `req.user` is populated by Passport if the user is authenticated
  // Return any fields you want the front-end to use
  const user = {
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    globalRole: req.user.globalRole
  };
  res.json(user);
});

export default router;
