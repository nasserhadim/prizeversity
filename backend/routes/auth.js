const express = require('express');
const passport = require('passport');
const User = require('../models/User'); // Add this line
const router = express.Router();

// Google OAuth Login
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth Callback
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
  res.redirect('http://localhost:5173'); // Redirect to the frontend
});

// Microsoft OAuth Login
router.get('/microsoft', passport.authenticate('microsoft', { scope: ['user.read'] }));

// Microsoft OAuth Callback
router.get('/microsoft/callback', passport.authenticate('microsoft', { failureRedirect: '/' }), (req, res) => {
  res.redirect('http://localhost:5173'); // Redirect to the frontend
});

// Logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Failed to logout' });
    res.redirect('http://localhost:5173'); // Redirect to the frontend
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

module.exports = router;