import mongoose from 'mongoose';

const bazaarItemSchema = new mongoose.Schema({
  bazaarId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bazaar', required: true },
  name: String,
  description: String,
  price: Number,
  image: String
}, { timestamps: true });

export default mongoose.model('BazaarItem', bazaarItemSchema);
