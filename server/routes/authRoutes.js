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
  req.logout((err) => {
    if (err) { return res.status(500).json({ message: 'Logout error', error: err }); }
    // If using a session store, optionally destroy the session:
    req.session.destroy((err) => {
      if (err) { 
        console.log('Session destruction error', err);
      }
      res.clearCookie('connect.sid'); // Or whatever your cookie name is
      return res.json({ success: true, message: 'Logged out' });
    });
  });
});

export default router;
