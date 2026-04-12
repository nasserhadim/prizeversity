const mongoose = require('mongoose');
const crypto = require('crypto');

const VALID_SCOPES = [
  'wallet:adjust',
  'users:match',
  'users:read',
  'classroom:read',
  'inventory:read',
  'inventory:use',
  'stats:adjust',
  'reward:grant',
  'webhooks:manage',
];

const WebhookSchema = new mongoose.Schema({
  event: {
    type: String,
    enum: [
      'wallet.updated',
      'item.purchased',
      'item.redeemed',
      'challenge.completed',
      'level.up',
      'badge.earned',
      'stats.updated',
      'reward.granted',
    ],
    required: true
  },
  url: { type: String, required: true },
  secret: { type: String, required: true },
  active: { type: Boolean, default: true },
  failCount: { type: Number, default: 0 },
  lastTriggeredAt: { type: Date },
  lastFailedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

const IntegrationAppSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  icon: { type: String, default: '🔌' },

  clientId: { type: String, required: true, unique: true, index: true },
  apiKey: { type: String, required: true, unique: true, index: true },

  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  classrooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }],

  scopes: [{
    type: String,
    enum: VALID_SCOPES
  }],

  webhooks: [WebhookSchema],

  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  deactivatedAt: { type: Date, default: null },
  pausedAt: { type: Date, default: null },
  resumedAt: { type: Date, default: null },
  keyRegeneratedAt: { type: Date, default: null },

  requestCount: { type: Number, default: 0 },

  rateLimit: {
    maxPerMinute: { type: Number, default: 60 },
    maxPerHour: { type: Number, default: 1000 }
  },

  updatedAt: { type: Date, default: Date.now }
});

IntegrationAppSchema.statics.generateCredentials = function () {
  return {
    clientId: `pv_${crypto.randomBytes(12).toString('hex')}`,
    apiKey: `pvk_${crypto.randomBytes(32).toString('hex')}`
  };
};

IntegrationAppSchema.statics.VALID_SCOPES = VALID_SCOPES;

module.exports = mongoose.model('IntegrationApp', IntegrationAppSchema);