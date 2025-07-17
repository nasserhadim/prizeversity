// prizeversity/backend/routes/newsfeed.js

const express = require('express');
const router = express.Router({ mergeParams: true });
const NewsItem = require('../models/NewsItem');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const { populateNotification } = require('../utils/notifications');
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
        const classroom = await Classroom.findById(req.params.id).populate('teacher').populate('students');
        const item = new NewsItem({
            classroomId: req.params.id,
            authorId: req.user._id,
            content,
            attachments
        });
        await item.save();
        await item.populate('authorId', 'firstName lastName');

         const recipients = [classroom.teacher, ...classroom.students];
           for (const recipientId of recipients) {
             const notification = await Notification.create({
               user: recipientId,
               type: 'announcement',
               message: `New announcement in ${classroom.name}`,
               classroom: classroom._id,
               actionBy: req.user._id
             });
             const populated = await populateNotification(notification._id);
             req.app.get('io').to(`user-${recipientId}`).emit('notification', populated);
           }
       
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