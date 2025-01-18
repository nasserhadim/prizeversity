import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['credit', 'debit', 'transfer'] },
  amount: Number,
  description: String,
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

const walletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' },
  balance: { type: Number, default: 0 },
  transactions: [transactionSchema]
}, { timestamps: true });

// Index for faster concurrency lookups
walletSchema.index({ userId: 1, classroomId: 1 }, { unique: true });

export default mongoose.model('Wallet', walletSchema);
