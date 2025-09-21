const express = require('express');
const router = express.Router();

// simple health check for now
router.get('/health', (req, res) => {
  res.json({ ok: true, route: 'something' });
});

module.exports = router;

//created this because im having trouble with backend. keeps crashing. 