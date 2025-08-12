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

export const configureChallenge = async (classroomId, title, settings) => {
  try {
    const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/configure`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, settings }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error configuring challenge:', error);
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
      }
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


export const submitChallengeAnswer = async (classroomId, challengeId, answer) => {
  try {
    const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/submit`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ challengeId, answer }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error submitting challenge answer:', error);
    throw error;
  }
};

export const unlockHint = async (classroomId, challengeId) => {
  try {
    const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/hints/unlock`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ challengeId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error unlocking hint:', error);
    throw error;
  }
};

export const completeChallenge = async (level, uniqueId, solution) => {
  try {
    const response = await fetch(`${API_BASE}/api/challenges/complete-challenge/${level}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uniqueId, solution }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error completing challenge:', error);
    throw error;
  }
};

export const getChallengeStats = async (classroomId) => {
  try {
    const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/stats`, {
      method: 'GET',
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
    console.error('Error fetching challenge stats:', error);
    throw error;
  }
};

export const verifyPassword = async (uniqueId, password) => {
  try {
    const response = await fetch(`${API_BASE}/api/challenges/verify-password`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uniqueId, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error verifying password:', error);
    throw error;
  }
};

export const verifyChallenge2External = async (uniqueId, password) => {
  try {
    const response = await fetch(`${API_BASE}/api/challenges/verify-challenge2-external`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uniqueId, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error verifying challenge 2:', error);
    throw error;
  }
};
