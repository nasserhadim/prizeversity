const express = require('express');
const router = express.Router({ mergeParams: true });
const NewsItem = require('../models/NewsItem');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const { populateNotification } = require('../utils/notifications');
const mongoose = require('mongoose'); // Add this import

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
// increase limits so large HTML content and attachments are accepted
const upload = multer({
  storage,
  limits: {
    fieldSize: 10 * 1024 * 1024, // 10 MB for text fields (content)
    fileSize: 20 * 1024 * 1024,  // 20 MB per file
    files: 20                    // max number of files
  }
});

const { ensureTeacher } = require('../middleware/auth');

router.get('/', async (req, res) => {
    try {
        // Validate ObjectId before using it
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid classroom ID' });
        }
        
        const items = await NewsItem.find({ classroomId: req.params.id })
            .populate('authorId', 'firstName lastName')
            .sort({ createdAt: -1 });
        res.json(items);
    } catch (error) {
        console.error('Error fetching news items:', error);
        res.status(500).json({ error: 'Failed to fetch news items' });
    }
});

// POST a new item (only teachers)
router.post(
    '/',
    ensureTeacher,
    upload.array('attachments'),
    async (req, res) => {
        try {
            // Validate ObjectId
            if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
                return res.status(400).json({ error: 'Invalid classroom ID' });
            }
            
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
        } catch (error) {
            console.error('Error creating news item:', error);
            res.status(500).json({ error: 'Failed to create news item' });
        }
    }
);

// DELETE a news item
router.delete('/:itemId', ensureTeacher, async (req, res) => {
    try {
        // Validate both ObjectIds
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid classroom ID' });
        }
        if (!mongoose.Types.ObjectId.isValid(req.params.itemId)) {
            return res.status(400).json({ error: 'Invalid item ID' });
        }
        
        const { id, itemId } = req.params;
        const deleted = await NewsItem.findOneAndDelete({
            _id: itemId,
            classroomId: id
        });
        if (!deleted) {
            return res.status(404).json({ error: 'News (announcement) item not found' });
        }
        res.json({ message: 'News (announcement) item deleted successfully' });
    } catch (error) {
        console.error('Error deleting news item:', error);
        res.status(500).json({ error: 'Failed to delete news item' });
    }
});

// PUT update a news item
router.put(
    '/:itemId', 
    ensureTeacher, 
    upload.array('attachments'), 
    async (req, res) => {
        try {
            // Validate both ObjectIds
            if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
                return res.status(400).json({ error: 'Invalid classroom ID' });
            }
            if (!mongoose.Types.ObjectId.isValid(req.params.itemId)) {
                return res.status(400).json({ error: 'Invalid item ID' });
            }
            
            const { id, itemId } = req.params;
            const { content, existingAttachments } = req.body;
            const files = req.files || [];

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
        } catch (error) {
            console.error('Error updating news item:', error);
            res.status(500).json({ error: 'Failed to update news item' });
        }
    }
);

// Add express error handler to return JSON for Multer errors
router.use((err, req, res, next) => {
  if (err && err.name === 'MulterError') {
    console.error('Multer error on newsfeed route:', err);
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;