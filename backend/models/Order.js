const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
  total: { type: Number, required: true },
  classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }, // ADD if not present
  description: { type: String }, // ADD: Optional description for mystery boxes
  type: { 
    type: String, 
    enum: ['purchase', 'mystery_box'], 
    default: 'purchase' 
  }, // ADD: Order type
  metadata: { 
    type: mongoose.Schema.Types.Mixed 
  }, // ADD: Flexible metadata field
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', OrderSchema);