const express = require('express');
const router = express.Router();

// Import all the modular route handlers
const challengeRoutes = require('./challenge/index');

// Use the modular routes
router.use('/', challengeRoutes);

module.exports = router;
