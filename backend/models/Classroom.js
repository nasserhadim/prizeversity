const mongoose = require('mongoose');

const ClassroomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  bazaars: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bazaar' }],
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  color: { type: String, default: '#ffffff' },
  // filename/path for an optional background image
  backgroundImage: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Classroom', ClassroomSchema);