
const mongoose = require('mongoose');

// The Siphon Request feature will be used to keep all request in a group if one of the members wins bits unfairly

const VoteSchema = new mongoose.Schema({
  user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vote:   { type: String, enum: ['yes','no'], required: true },
  _id:    false                               
});

const SiphonRequestSchema = new mongoose.Schema({
  group:        { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  requestedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetUser:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reasonHtml:   { type: String, required: true },
  amount:       { type: Number,  min: 1, required: true },

  status:       {                                            
    type: String,
    enum: ['pending',           
           'group_approved',    
           'teacher_approved',  
           'rejected'],
    default: 'pending'
  },

  votes: [VoteSchema],          // one  per vote
  createdAt:   { type: Date, default: Date.now }
});

module.exports =
  mongoose.models.SiphonRequest || mongoose.model('SiphonRequest', SiphonRequestSchema);
