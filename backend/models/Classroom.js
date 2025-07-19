const mongoose = require('mongoose');

const ClassroomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true },
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
  studentSendEnabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

ClassroomSchema.index(
  { code: 1, teacher: 1 },
  { unique: true, partialFilterExpression: { archived: false } }
);

module.exports = mongoose.model('Classroom', ClassroomSchema);