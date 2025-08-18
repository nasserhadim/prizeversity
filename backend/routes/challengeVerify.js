const express = require('express');
const router = express.Router();

// POST /verify-wayneaws - Proxy verification request to WayneAWS
router.post('/verify-wayneaws', async (req, res) => {
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
    const response = await fetch('http://localhost:5001/api/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username.trim(),
        secret: secret.trim()
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: data.message || 'Verification failed'
      });
    }

    // Return the verification result
    res.json({
      success: true,
      valid: data.valid,
      message: data.valid ? 'Credentials verified successfully' : 'Invalid credentials'
    });

  } catch (error) {
    console.error('Error verifying WayneAWS credentials:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during verification'
    });
  }
});

module.exports = router;
