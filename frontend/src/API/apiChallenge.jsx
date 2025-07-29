import { API_BASE } from '../config/api';

export const getChallengeData = async (classroomId) => {
  try {
    const response = await fetch(`${API_BASE}/api/challenges/${classroomId}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching challenge data:', error);
    throw error;
  }
};

export const initiateChallenge = async (classroomId) => {
  try {
    const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/initiate`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error initiating challenge:', error);
    throw error;
  }
};

export const deactivateChallenge = async (classroomId) => {
  try {
    const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/deactivate`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error deactivating challenge:', error);
    throw error;
  }
};
