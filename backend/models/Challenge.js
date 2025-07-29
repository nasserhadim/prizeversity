const mongoose = require('mongoose');
const crypto = require('crypto');

const UserChallengeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uniqueId: { type: String, unique: true },
  hashedPassword: { type: String },
  progress: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const ChallengeSchema = new mongoose.Schema({
  classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  title: { type: String, required: true, default: 'Cyber Challenge' },
  description: { type: String, default: 'Decrypt your unique ID to access the first puzzle' },
  isActive: { type: Boolean, default: false },
  userChallenges: [UserChallengeSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

function generateUniqueId() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function generateHashedPassword(uniqueId) {
  const hash = crypto.createHash('md5').update(uniqueId).digest('hex');
  return hash.substring(0, 8).toUpperCase();
}

ChallengeSchema.pre('save', async function(next) {
  if (this.isModified('userChallenges') || this.isNew) {
    for (let userChallenge of this.userChallenges) {
      if (!userChallenge.uniqueId) {
        let uniqueId;
        let exists = true;
        
        while (exists) {
          uniqueId = generateUniqueId();
          exists = await mongoose.models.Challenge.exists({
            'userChallenges.uniqueId': uniqueId
          });
        }
        
        userChallenge.uniqueId = uniqueId;
        userChallenge.hashedPassword = generateHashedPassword(uniqueId);
      }
    }
  }
  
  this.updatedAt = Date.now();
  next();
});

ChallengeSchema.index({ classroomId: 1 });
ChallengeSchema.index({ 'userChallenges.userId': 1 });
ChallengeSchema.index({ 'userChallenges.uniqueId': 1 });

module.exports = mongoose.model('Challenge', ChallengeSchema); 