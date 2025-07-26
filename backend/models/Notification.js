const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String },
  message: { type: String, required: true },
  type: { 
    type: String, 
    enum: [
      'group_approval', 
      'group_rejection', 
      'classroom_removal', 
      'group_removal', 
      'classroom_deletion',
      'group_deletion',
      'group_suspension',
      'groupset_deletion',  // Add this new type
      'classroom_update',
      'groupset_update',
      'group_update',
      'siphon_review', 
      'siphon_request',     
     'siphon_rejected',
      'siphon_approved',
      'wallet_transaction',
      'wallet_topup',
     'ta_promotion', 
      'ta_demotion', 
      'announcement', // New type for announcements
      'attack', // New type for attack notification
      'defend', // New type for defense notification
    ],
    required: true 
  },
  classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' },
  groupSet: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupSet' },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  actionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', NotificationSchema);