const mongoose = require('mongoose');

// This is the schema for the bazaar template itself, which has multiple item templates
const BazaarTemplateSchema = new mongoose.Schema({
    name: { // the title the instructor gives the bazaar template
        type: String,
        required: true,
        trim: true,
        maxLength: 100,
    },
    description: { // the description the instructor gives the bazaar template
        type: String,
        trim: true,
        maxLength: 300,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    sourceBazaar: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bazaar',
        required: true,
    },
    sourceClassroom: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Classroom',
        required: true,
    },

    items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],

    countItem: {
        type: Number,
        default: 0,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
});

// these indexes will help when searching for bazaar templates
BazaarTemplateSchema.index({ owner: 1, createdAt: -1 }); // search by the name or tags

module.exports = mongoose.model('BazaarTemplate', BazaarTemplateSchema);
