import { API_BASE } from '../config/api';

export const getBadgeTemplates = async () => {
  const res = await fetch(`${API_BASE}/api/badge-templates`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch templates');
  return res.json();
};

export const saveBadgeTemplate = async (name, classroomId) => {
  const res = await fetch(`${API_BASE}/api/badge-templates`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, classroomId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to save template');
  return data;
};

export const deleteBadgeTemplate = async (templateId) => {
  const res = await fetch(`${API_BASE}/api/badge-templates/${templateId}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to delete template');
  return data;
};

export const applyBadgeTemplate = async (templateId, classroomId) => {
  const res = await fetch(`${API_BASE}/api/badge-templates/${templateId}/apply`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classroomId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to apply template');
  return data;
};