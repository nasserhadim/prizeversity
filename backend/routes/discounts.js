const express = require('express');
const Bazaar = require('../models/Bazaar');
const Item = require('../models/Item');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const Discount = require('../models/Discount');
const { ensureAuthenticated } = require('../config/auth');
const router = express.Router();
const Order = require('../models/Order');
const blockIfFrozen = require('../middleware/blockIfFrozen');
const upload = require('../middleware/upload'); // reuse existing upload middleware
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');


// Get Discounts for a classroom (if any)
router.get('/classroom/:classroomId/user/:userId', ensureAuthenticated, async (req, res) => {
  const { classroomId } = req.params.classroomId;
  const { userId } = req.params.userId;

  try {
    const discounts = await Discounts.find(
        { classroom: classroomId },
        { owner: userId}
    );
    res.status(200).json({ discounts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch discounts' });
  }
});



