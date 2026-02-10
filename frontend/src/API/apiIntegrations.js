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
  { value: 'wallet:adjust', label: 'Adjust Wallet Balances', description: 'Add or deduct bits from student wallets' },
  { value: 'users:match', label: 'Match Students', description: 'Match student names to Prizeversity accounts' },
  { value: 'users:read', label: 'List Students', description: 'View student names and emails in a classroom' },
  { value: 'classroom:read', label: 'Read Classroom Info', description: 'View classroom name, code, and student count' },
  { value: 'inventory:read', label: 'Read Inventory', description: 'View student inventory items' },
  { value: 'inventory:use', label: 'Redeem Items', description: 'Mark inventory items as redeemed' },
  { value: 'lms:grades', label: 'LMS Grade Sync', description: 'Sync grades with external learning management systems' },
  { value: 'webhooks:manage', label: 'Manage Webhooks', description: 'Register and manage event webhooks' },
];

export const WEBHOOK_EVENTS = [
  { value: 'wallet.updated', label: 'Wallet Updated', description: 'When a student balance changes' },
  { value: 'item.purchased', label: 'Item Purchased', description: 'When a student buys from the bazaar' },
  { value: 'item.redeemed', label: 'Item Redeemed', description: 'When an inventory item is used' },
  { value: 'challenge.completed', label: 'Challenge Completed', description: 'When a challenge finishes' },
  { value: 'level.up', label: 'Level Up', description: 'When a student levels up' },
  { value: 'badge.earned', label: 'Badge Earned', description: 'When a badge is unlocked' },
];