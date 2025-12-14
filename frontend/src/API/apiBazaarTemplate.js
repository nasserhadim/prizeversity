import { API_BASE } from '../config/api';

export const getBazaarTemplates = async () => {
  const response = await fetch(`${API_BASE}/api/bazaar-templates`, {
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch templates');
  }
  
  return response.json();
};

export const saveBazaarTemplate = async (name, bazaarId) => {
  const response = await fetch(`${API_BASE}/api/bazaar-templates`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, bazaarId })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to save template');
  }
  
  return response.json();
};

export const deleteBazaarTemplate = async (templateId) => {
  const response = await fetch(`${API_BASE}/api/bazaar-templates/${templateId}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete template');
  }
  
  return response.json();
};

export const applyBazaarTemplate = async (templateId, classroomId, opts = {}) => {
  const mode = opts.mode || 'replace';
  const qs = new URLSearchParams();
  if (mode) qs.set('mode', mode);

  const response = await fetch(`${API_BASE}/api/bazaar-templates/${templateId}/apply?${qs.toString()}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classroomId, mode })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to apply template');
  }

  return response.json();
};