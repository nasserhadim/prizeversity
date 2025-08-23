const express = require('express');
const upload = require('../middleware/upload');
const router = express.Router();
const User = require('../models/User.js');
const { ensureAuthenticated } = require('../config/auth.js');
const fs = require('fs');
const path = require('path');

// GET /api/profile/student/:id
// Will get the profile for a student by ID
router.get('/student/:id', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('classrooms') // Will include the classrooms the user belongs to
      .populate('groups') // Will include the groups the user belongs to
      .populate('transactions.assignedBy', 'firstName lastName email'); // just enough info
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/profile/student/:id
// Update the student profile (only the user themself can do this)
router.put('/student/:id', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.params.id;

    // Only allow users to update their own profile
    if (req.user._id.toString() !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { firstName, lastName, avatar } = req.body;

    // If client attempted to update name fields, require at least one non-empty name.
    // Use undefined check to allow partial updates that don't include name fields.
    if (firstName !== undefined || lastName !== undefined) {
      const fn = (firstName || '').toString().trim();
      const ln = (lastName || '').toString().trim();
      if (!fn && !ln) {
        return res.status(400).json({ error: 'At least one of firstName or lastName must be provided' });
      }
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Update fields if they exist in the request
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    res.json(user);
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// adding the statistics for each item you have
// GET /api/profile/student/:id/stats
router.get('/student/:id/stats', ensureAuthenticated, async (req, res) => {
  try {

    // Read the user to check if the shield is active 
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // it will load all items owned by that user nad check if any item effects match known passive items
    const items = await require('../models/Item').find({ owner: userId });

    const hasEffect = (effectName) =>
      items.some((item) => item.effect === effectName);

    const attackCount = items.filter((item) =>
      ['halveBits', 'stealBits'].includes(item.effect)
    ).length;

    return res.json({
      shieldActive: user.shieldActive || false,
      doubleEarnings: hasEffect('doubleEarnings'),
      discountShop: hasEffect('discountShop'),
      bitInterest: hasEffect('bitInterest'),
      attackPower: attackCount,
    });
  } catch (error) {
    console.error('Stats route error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
})

// Will upload an avatar image for the current user
router.post('/upload-avatar', ensureAuthenticated, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // req.user is authenticated user
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // store just the filename
    user.avatar = req.file.filename;
    await user.save();

    res.json(user);
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Will remove avatar from current user's profile
router.delete('/remove-avatar', ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const trashDir = path.join(uploadsDir, 'trash');
    if (!fs.existsSync(trashDir)) fs.mkdirSync(trashDir, { recursive: true });

    // If avatar is missing or looks like a remote/data URL, just clear the field
    if (!user.avatar || typeof user.avatar !== 'string' || /^(https?:|data:)/.test(user.avatar)) {
      user.avatar = undefined;
      await user.save();
      return res.json({ user, deletedFilename: null });
    }

    // Prevent removing shared placeholder
    const basename = path.basename(user.avatar);
    if (basename === 'placeholder.jpg') {
      user.avatar = undefined;
      await user.save();
      return res.json({ user, deletedFilename: null });
    }

    const src = path.join(uploadsDir, basename);
    const dst = path.join(trashDir, basename);

    // If file exists move to trash; otherwise just clear DB field
    if (fs.existsSync(src)) {
      try {
        // overwrite if exists in trash
        if (fs.existsSync(dst)) {
          // rename collision: prefix with timestamp
          const renamed = `${Date.now()}-${basename}`;
          fs.renameSync(src, path.join(trashDir, renamed));
          // save the deleted filename that client can use to request restore (original basename)
        } else {
          fs.renameSync(src, dst);
        }
      } catch (moveErr) {
        console.error('Failed to move avatar to trash:', moveErr);
        // if move fails, still clear DB but return error status
        user.avatar = undefined;
        await user.save();
        return res.status(500).json({ error: 'Failed to remove avatar file' });
      }
    }

    // Clear avatar on user and persist
    user.avatar = undefined;
    await user.save();

    // Return the basename so client can request restore if needed
    res.json({ user, deletedFilename: basename });
  } catch (err) {
    console.error('Remove avatar error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Restore avatar previously moved to trash (current user)
router.post('/restore-avatar', ensureAuthenticated, async (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'filename required' });

    // sanitize filename
    const safeName = path.basename(String(filename));
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const trashDir = path.join(uploadsDir, 'trash');
    const src = path.join(trashDir, safeName);
    const dst = path.join(uploadsDir, safeName);

    if (!fs.existsSync(src)) {
      return res.status(404).json({ error: 'Trash file not found' });
    }

    // Move back to uploads (overwrite if exists)
    try {
      if (fs.existsSync(dst)) {
        // remove existing destination first to ensure rename works
        fs.unlinkSync(dst);
      }
      fs.renameSync(src, dst);
    } catch (moveErr) {
      console.error('Failed to restore avatar file:', moveErr);
      return res.status(500).json({ error: 'Failed to restore avatar file' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.avatar = safeName;
    await user.save();
    res.json(user);
  } catch (err) {
    console.error('Restore avatar error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
