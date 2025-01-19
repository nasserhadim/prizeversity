import express from 'express';
import passport from 'passport';
import { selectRole } from '../controllers/authController.js';

const router = express.Router();

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: 'http://localhost:3000/login?error=google' }),
  (req, res) => {
    res.redirect('http://localhost:3000/role-selection');
  }
);

router.get('/microsoft',
  passport.authenticate('azure_ad_openidconnect', {
    scope: ['openid','profile','email'],
    failWithError: true
  }),
  (err, req, res, next) => {
    // If there's an immediate error, it should come here
    console.error('Passport immediate error:', err);
    return res.status(401).json({ message: err.message });
  }
);
router.post('/microsoft/callback',
  passport.authenticate('azure_ad_openidconnect', { failureRedirect: 'http://localhost:3000/login?error=microsoft' }),
  (req, res) => {
    res.redirect('http://localhost:3000/role-selection');
  }
);

// After OAuth, user chooses role
router.post('/select-role', selectRole);

// Logout
router.get('/logout', (req, res) => {
  req.logout(() => {});
  res.send({ success: true, message: 'Logged out' });
});

export default router;
