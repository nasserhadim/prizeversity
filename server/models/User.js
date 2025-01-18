import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  provider: String,    // "google", "microsoft", etc.
  providerId: String,
  globalRole: {
    type: String,
    default: 'student' // optional global fallback
  }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
