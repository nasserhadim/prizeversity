const mongoose = require('mongoose');

const ClassroomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { 
    type: String, 
    required: true, 
    minlength: 5,
    maxlength: 6, // <-- Add this line
    unique: true // <-- ENFORCE GLOBAL UNIQUENESS
  },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  bazaars: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bazaar' }],
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  color: { type: String, default: '#ffffff' },
  // filename/path for an optional background image
  backgroundImage: { type: String, default: '' },
  archived: { type: Boolean, default: false },
  taBitPolicy: {
    type: String,
    enum: ['full', 'approval', 'none'],
    default: 'full',
  },
  siphonTimeoutHours: {
    type: Number,
    default: 72,
    min: 1,
    max: 168 // Max 1 week
  },
  studentSendEnabled: { type: Boolean, default: false },
  studentsCanViewStats: { type: Boolean, default: true }, // Add this line
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Classroom', ClassroomSchema);