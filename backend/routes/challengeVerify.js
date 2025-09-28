const express = require('express');
const axios = require('axios');
const router = express.Router();

// POST /verify-wayneaws - Proxy verification request to WayneAWS
router.post('/verify', async (req, res) => {
  try {
    const { username, secret } = req.body;

    // Validate input
    if (!username || !secret) {
      return res.status(400).json({
        success: false,
        message: 'Username and secret are required'
      });
    }

    // Make request to WayneAWS API
    const response = await axios.post('https://wayneaws.dev/verify', {
      username: username.trim(),
      secret: secret.trim()
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000 // 10 second timeout
    });

    const data = response.data;

    // Return the verification result
    res.json({
      success: true,
      valid: data.valid,
      message: data.valid ? 'Credentials verified successfully' : 'Invalid credentials'
    });

  } catch (error) {
    console.error('Error verifying WayneAWS credentials:', error);
    
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: error.response.data?.message || 'Verification failed'
      });
    } else if (error.request) {
      return res.status(503).json({
        success: false,
        message: 'WayneAWS service unavailable'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Internal server error during verification'
      });
    }
  }
});

module.exports = router;
