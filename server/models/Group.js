import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  dateJoined: { type: Date, default: Date.now }
});

const joinRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  requestDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
});

const groupSchema = new mongoose.Schema({
  classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' },
  name: String,
  image: String,
  multiplier: { type: Number, default: 0 }, // e.g. 0.25
  maxStudents: { type: Number, default: 5 },
  selfSignUp: { type: Boolean, default: false },
  joinApprovalRequired: { type: Boolean, default: false },
  members: [memberSchema],
  joinRequests: [joinRequestSchema]
}, { timestamps: true });

export default mongoose.model('Group', groupSchema);
