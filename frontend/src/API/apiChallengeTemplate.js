import { API_BASE } from '../config/api';

export const getChallengeTemplates = async () => {
  const response = await fetch(`${API_BASE}/api/challenge-templates`, {
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch templates');
  }
  
  return response.json();
};

export const saveChallengeTemplate = async (name, title, settings) => {
  const response = await fetch(`${API_BASE}/api/challenge-templates`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, title, settings })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to save template');
  }
  
  return response.json();
};

export const updateChallengeTemplate = async (templateId, name, title, settings) => {
  const response = await fetch(`${API_BASE}/api/challenge-templates/${templateId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, title, settings })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update template');
  }
  
  return response.json();
};

export const deleteChallengeTemplate = async (templateId) => {
  const response = await fetch(`${API_BASE}/api/challenge-templates/${templateId}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete template');
  }
  
  return response.json();
};