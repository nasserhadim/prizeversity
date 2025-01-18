import mongoose from 'mongoose';

const classroomSchema = new mongoose.Schema({
  className: { type: String, required: true },
  classCode: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  users: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['admin', 'teacher', 'student'] },
    joinedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

export default mongoose.model('Classroom', classroomSchema);
