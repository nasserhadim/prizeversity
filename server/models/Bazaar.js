import mongoose from 'mongoose';

const bazaarSchema = new mongoose.Schema({
  classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  name: String,
  description: String,
  image: String
}, { timestamps: true });

export default mongoose.model('Bazaar', bazaarSchema);
