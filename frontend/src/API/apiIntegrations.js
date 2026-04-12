import axios from 'axios';

const api = axios.create({
  baseURL: '/api/integrations',
  withCredentials: true
});

// ── App CRUD ──

export const getIntegrationApps = () => api.get('/apps').then(r => r.data);

export const getIntegrationApp = (id) => api.get(`/apps/${id}`).then(r => r.data);

export const createIntegrationApp = ({ name, description, icon, scopes, classrooms }) =>
  api.post('/apps', { name, description, icon, scopes, classrooms }).then(r => r.data);

export const updateIntegrationApp = (id, updates) =>
  api.patch(`/apps/${id}`, updates).then(r => r.data);

export const deactivateIntegrationApp = (id) =>
  api.delete(`/apps/${id}`).then(r => r.data);

export const regenerateApiKey = (id) =>
  api.post(`/apps/${id}/regenerate-key`).then(r => r.data);

// ── Webhooks ──

export const createWebhook = (appId, { event, url }) =>
  api.post(`/apps/${appId}/webhooks`, { event, url }).then(r => r.data);

export const deleteWebhook = (appId, hookId) =>
  api.delete(`/apps/${appId}/webhooks/${hookId}`).then(r => r.data);

// ── Constants ──

export const AVAILABLE_SCOPES = [
  { value: 'wallet:adjust', label: 'Adjust Wallet Balances', description: 'Add or deduct bits from user wallets' },
  { value: 'users:match', label: 'Match users', description: 'Match user names to Prizeversity accounts' },
  { value: 'users:read', label: 'List users', description: 'View user names, emails, and extended data (balances, XP, badges, stats, groups)' },
  { value: 'classroom:read', label: 'Read Classroom Info', description: 'View classroom details and extended data (groups, bazaar, badges, XP settings, announcements)' },
  { value: 'inventory:read', label: 'Read Inventory', description: 'View user inventory items' },
  { value: 'inventory:use', label: 'Redeem Items', description: 'Mark inventory items as redeemed' },
  { value: 'stats:adjust', label: 'Adjust Stats', description: 'Adjust user stats (multiplier, luck, discount, shield)' },
  { value: 'reward:grant', label: 'Grant Rewards', description: 'Award bits, stats, and XP for external activity completions' },
  { value: 'webhooks:manage', label: 'Manage Webhooks', description: 'Register and manage event webhooks' },
];

export const WEBHOOK_EVENTS = [
  { value: 'wallet.updated', label: 'Wallet Updated', description: 'When a user balance changes' },
  { value: 'item.purchased', label: 'Item Purchased', description: 'When a user buys from the bazaar' },
  { value: 'item.redeemed', label: 'Item Redeemed', description: 'When an inventory item is used' },
  { value: 'challenge.completed', label: 'Challenge Completed', description: 'When a challenge finishes' },
  { value: 'level.up', label: 'Level Up', description: 'When a user levels up' },
  { value: 'badge.earned', label: 'Badge Earned', description: 'When a badge is unlocked' },
  { value: 'stats.updated', label: 'Stats Updated', description: 'When user stats are adjusted via integration' },
  { value: 'reward.granted', label: 'Reward Granted', description: 'When a reward is granted for an external activity' },
];

export const WEBHOOKS_BETA_LABEL = 'Beta';