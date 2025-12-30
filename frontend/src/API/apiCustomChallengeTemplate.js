import { API_BASE } from '../config/api';

export const getCustomChallengeTemplates = async () => {
  const response = await fetch(`${API_BASE}/api/custom-challenge-templates`, {
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch custom challenge templates');
  }
  
  return response.json();
};

export const saveCustomChallengeTemplate = async (name, challenges, isSingleChallenge, classroomId) => {
  const response = await fetch(`${API_BASE}/api/custom-challenge-templates`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, challenges, isSingleChallenge, classroomId })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to save template');
  }
  
  return response.json();
};

export const deleteCustomChallengeTemplate = async (templateId) => {
  const response = await fetch(`${API_BASE}/api/custom-challenge-templates/${templateId}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete template');
  }
  
  return response.json();
};

