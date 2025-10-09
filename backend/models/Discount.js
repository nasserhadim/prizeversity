const mongoose = require('mongoose');

const DiscountSchema = new mongoose.Schema({
    classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    appliedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: Date.now },
    discountPercrnt: { type: Number, default: 10}
});

module.exports = mongoose.model('Discount', DiscountSchema);