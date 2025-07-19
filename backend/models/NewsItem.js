const mongoose = require('mongoose');

const newsItemSchema = new mongoose.Schema({
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },

    // add an attachments array to store uploaded files
    attachments: {
        type: [
            {
                filename: { type: String, required: true },
                originalName: { type: String, required: true },
                url: { type: String, required: true }
            }
        ],
        default: []
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NewsItem', newsItemSchema);