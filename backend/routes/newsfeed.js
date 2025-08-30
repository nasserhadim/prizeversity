const express = require('express');
const router = express.Router({ mergeParams: true });
const NewsItem = require('../models/NewsItem');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const { populateNotification } = require('../utils/notifications');

// The news feed will work for the teacher posting announcement in their classroom homepage

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

        // send the new announcement to everyone in the class instantly
        req.app.get('io')
            .to(`classroom-${req.params.id}`)
            .emit('receive-announcement', item);
        // Create notifications for teacher and all students in the class   
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

// DELETE a news (announcement) item (only teachers)
router.delete('/:itemId', ensureTeacher, async (req, res) => {
    const { id, itemId } = req.params;
    const deleted = await NewsItem.findOneAndDelete({
        _id: itemId,
        classroomId: id
    });
    if (!deleted) {
        return res.status(404).json({ error: 'News (announcement) item not found' });
    }
    res.json({ message: 'News (announcement) item deleted successfully' });
});

router.put(
    '/:itemId', 
    ensureTeacher, 
    upload.array('attachments'), 
    async (req, res) => {
        const { id, itemId } = req.params;
        const { content, existingAttachments } = req.body;
        const files = req.files || [];

        try {
            const item = await NewsItem.findOne({ _id: itemId, classroomId: id });
            if (!item) {
                return res.status(404).json({ error: 'News (announcement) item not found' });
            }

            // Parse existing attachments to keep
            let attachmentsToKeep = [];
            if (existingAttachments) {
                try {
                    // It might be a stringified JSON array
                    attachmentsToKeep = Array.isArray(existingAttachments)
                        ? existingAttachments.map(a => typeof a === 'string' ? JSON.parse(a) : a)
                        : [JSON.parse(existingAttachments)];
                } catch (e) {
                    // Fallback for single stringified object
                    if (typeof existingAttachments === 'string') {
                        try {
                            attachmentsToKeep = [JSON.parse(existingAttachments)];
                        } catch (parseErr) {
                            attachmentsToKeep = []; // handle malformed JSON
                        }
                    } else {
                        attachmentsToKeep = existingAttachments || [];
                    }
                }
            }


            // Add new attachments
            const newAttachments = files.map(f => ({
                filename: f.filename,
                originalName: f.originalname,
                url: `/uploads/${f.filename}`
            }));

            const finalAttachments = [...attachmentsToKeep, ...newAttachments];

            // Deep comparison for attachments
            const attachmentsChanged = item.attachments.length !== finalAttachments.length ||
                JSON.stringify(item.attachments.map(a => a.url).sort()) !== JSON.stringify(finalAttachments.map(a => a.url).sort());

            if (item.content === content && !attachmentsChanged) {
                return res.status(400).json({ message: 'No changes were made' });
            }

            // Update content
            item.content = content;
            item.attachments = finalAttachments;

            const updated = await item.save();
            await updated.populate('authorId', 'firstName lastName');
            
            res.json(updated);
        } catch (err) {
            console.error('Update announcement error:', err);
            res.status(500).json({ error: 'Failed to update announcement' });
        }
    }
);

module.exports = router;