const mongoose = require('mongoose');

// This is the item schema representing discounts
const DiscountSchema = new mongoose.Schema({
    classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    appliedAt: { type: Date, default: Date.now },
    // the default expiration date is one hour after creation
    expiresAt: { type: Date, default: Date.now + (60 * 60 * 1000)}, 
    discountPercent: { type: Number, default: 20, min: 0, max: 100}
});

module.exports = mongoose.model('Discount', DiscountSchema);