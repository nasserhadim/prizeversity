// prizeversity/backend/routes/newsfeed.js

const express = require('express');
const router = express.Router({ mergeParams: true });
const NewsItem = require('../models/NewsItem');
const { ensureTeacher } = require('../middleware/auth');

// GET all news for one classroom
router.get('/', async (req, res) => {
    const items = await NewsItem.find({ classroomId: req.params.id })
        .sort({ createdAt: -1 });
    res.json(items);
});

// POST a new item (only teachers)
router.post('/', ensureTeacher, async (req, res) => {
    const { content } = req.body;
    const item = new NewsItem({
        classroomId: req.params.id,
        authorId: req.user._id,
        content
    });
    await item.save();
    res.status(201).json(item);
});

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
    // find the news item by its id and classroom, update its content, return the new document
    const updated = await NewsItem.findOneAndUpdate(
        { _id: itemId, classroomId: id },
        { content },
        { new: true }
    );
    if (!updated) {
        return res.status(404).json({ error: 'News item not found' });
    }
    res.json(updated);
});

module.exports = router;