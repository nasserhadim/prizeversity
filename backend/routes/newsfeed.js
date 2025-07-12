// prizeversity/backend/routes/newsfeed.js

const express = require('express');
const router = express.Router({ mergeParams: true });
const NewsItem = require('../models/NewsItem');
// Multer + file storage setup
const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
    destination: (req, file, cb) =>
        cb(null, path.join(__dirname, '../uploads')),
    filename: (req, file, cb) =>
        cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

const { ensureTeacher } = require('../middleware/auth');

router.get('/', async (req, res) => {
    const items = await NewsItem.find({ classroomId: req.params.id })
        .populate('authorId', 'firstName lastName')
        .sort({ createdAt: -1 });
    res.json(items);
});

// POST a new item (only teachers)
router.post(
    '/',
    ensureTeacher,
    upload.array('attachments'),
    async (req, res) => {
        const { content } = req.body;
        const files = req.files || [];
        const attachments = files.map(f => ({
            filename: f.filename,
            originalName: f.originalname,
            url: `/uploads/${f.filename}`
        }));

        const item = new NewsItem({
            classroomId: req.params.id,
            authorId: req.user._id,
            content,
            attachments
        });
        await item.save();
        await item.populate('authorId', 'firstName lastName');
        res.status(201).json(item);
    }
);

// DELETE a news item (only teachers)
router.delete('/:itemId', ensureTeacher, async (req, res) => {
    const { id, itemId } = req.params;
    const deleted = await NewsItem.findOneAndDelete({
        _id: itemId,
        classroomId: id
    });
    if (!deleted) {
        return res.status(404).json({ error: 'News item not found' });
    }
    res.json({ message: 'News item deleted successfully' });
});

router.put('/:itemId', ensureTeacher, async (req, res) => {
    const { id, itemId } = req.params;
    const { content } = req.body;
    const updated = await NewsItem.findOneAndUpdate(
        { _id: itemId, classroomId: id },
        { content },
        { new: true }
    )
        .populate('authorId', 'firstName lastName');
    if (!updated) {
        return res.status(404).json({ error: 'News item not found' });
    }
    res.json(updated);
});

module.exports = router;