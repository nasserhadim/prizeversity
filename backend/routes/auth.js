const express = require('express');
const passport = require('passport');
const User = require('../models/User'); // Add this line
const router = express.Router();
const { callbackBase, redirectBase } = require('../config/domain');

// Google OAuth Login
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth Callback
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  res.redirect(redirectBase); // This sends user back to frontend
});

// Microsoft OAuth Login
router.get('/microsoft', passport.authenticate('microsoft', { scope: ['user.read'] }));

// Microsoft OAuth Callback
router.get('/microsoft/callback', passport.authenticate('microsoft', { failureRedirect: '/' }), (req, res) => {
  res.redirect(redirectBase); // Also frontend
});

// Logout
// Though this clears the app session, it doesn’t revoke the user's session with Google or Microsoft. 
// This means that even though they’re logged out locally, the SSO provider still recognizes them as signed in, so re-login happens almost immediately. 
// To fully sign out at the provider, users typically need to log out directly from Google or Microsoft, there's no other way around it!
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to destroy session' });
      }
      res.clearCookie('connect.sid');

      // After clearing the local session, redirect to the homepage.
      // Inform the user that while they are logged out from our app,
      // they may remain signed in with their SSO provider.
      const redirectUrl = redirectBase;
      res.send(`
        <html>
          <head>
            <meta http-equiv="refresh" content="5; URL=${redirectUrl}" />
          </head>
          <body>
            <p>
              You are now logged out from the application.
              Note: If you used Google or Microsoft SSO, you may still be signed into their services.
              To completely sign out, please sign out from your SSO provider.
              Redirecting to the homepage in 5 seconds...
            </p>
          </body>
        </html>
      `);
    });
  });
});

// Get Current User
router.get('/current-user', (req, res) => {
  if (req.user) {
    return res.status(200).json(req.user);
  }
  res.status(401).json({ error: 'Not authenticated' });
});

// Update User Role
router.post('/update-role', async (req, res) => {
  const { role } = req.body;
  console.log('Request Body:', req.body); // Log the request body
  console.log('Authenticated User:', req.user); // Log the authenticated user

  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    console.log('Current User Role:', user.role); // Log the current role
    user.role = role;
    await user.save();

    console.log('Updated User Role:', user.role); // Log the updated role
    res.status(200).json({ message: 'Role updated successfully', user }); // Return the updated user
  } catch (err) {
    console.error('Error updating role:', err); // Log the error
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Get User by ID
router.get('/user/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ email: user.email });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;