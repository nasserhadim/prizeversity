const express = require('express');
const passport = require('passport');
const router = express.Router();

// Google OAuth Login
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth Callback
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  res.redirect('/');
});

// Microsoft OAuth Login
router.get('/microsoft', passport.authenticate('microsoft', { scope: ['user.read'] }));

// Microsoft OAuth Callback
router.get('/microsoft/callback', passport.authenticate('microsoft', { failureRedirect: '/' }), (req, res) => {
  res.redirect('/');
});

// Logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Failed to logout' });
    res.redirect('/');
  });
});

// Get Current User
router.get('/current-user', (req, res) => {
    if (req.user) {
      return res.status(200).json(req.user);
    }
    res.status(401).json({ error: 'Not authenticated' });
  });

module.exports = router;