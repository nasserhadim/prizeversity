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

export const initiateChallenge = async (classroomId, password) => {
  try {
    const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/initiate`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
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

export const updateDueDate = async (classroomId, dueDateEnabled, dueDate) => {
  try {
    const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/update-due-date`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dueDateEnabled, dueDate })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating due date:', error);
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

export const updateChallenge = async (classroomId, updates) => {
  try {
    const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/update`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating challenge:', error);
    throw error;
  }
};

export const toggleChallengeVisibility = async (classroomId) => {
  try {
    const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/toggle-visibility`, {
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
    console.error('Error toggling challenge visibility:', error);
    throw error;
  }
};

export const startChallenge = async (classroomId, challengeIndex) => {
  try {
    const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/start`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ challengeIndex }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error starting challenge:', error);
    throw error;
  }
};

export const resetStudentChallenge = async (classroomId, studentId) => {
  try {
    const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/reset-student`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ studentId }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error resetting student challenge:', error);
    throw error;
  }
};

export const resetSpecificChallenge = async (classroomId, studentId, challengeIndex) => {
  try {
    const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/reset-student-challenge`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ studentId, challengeIndex }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error resetting specific challenge:', error);
    throw error;
  }
};

export const removeStudentFromChallenge = async (challengeId, studentId) => {
  try {
    const response = await fetch(`${API_BASE}/api/challenges/${challengeId}/remove-student`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw error;
  }
};

export const getCustomChallenges = async (classroomId) => {
  const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/custom`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to fetch custom challenges');
  }
  return await response.json();
};

export const createCustomChallenge = async (classroomId, challengeData) => {
  const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/custom`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(challengeData)
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to create custom challenge');
  }
  return await response.json();
};

export const updateCustomChallenge = async (classroomId, challengeId, challengeData) => {
  const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/custom/${challengeId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(challengeData)
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to update custom challenge');
  }
  return await response.json();
};

export const deleteCustomChallenge = async (classroomId, challengeId) => {
  const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/custom/${challengeId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to delete custom challenge');
  }
  return await response.json();
};

export const reorderCustomChallenges = async (classroomId, order) => {
  const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/custom/reorder`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order })
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to reorder challenges');
  }
  return await response.json();
};

export const verifyCustomChallenge = async (classroomId, challengeId, passcode) => {
  const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/custom/${challengeId}/verify`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode })
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Incorrect passcode');
  }
  return await response.json();
};

export const startCustomChallenge = async (classroomId, challengeId) => {
  const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/custom/${challengeId}/start`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to start challenge');
  }
  return await response.json();
};

export const unlockCustomChallengeHint = async (classroomId, challengeId) => {
  const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/custom/${challengeId}/hint`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to unlock hint');
  }
  return await response.json();
};

export const uploadCustomChallengeAttachment = async (classroomId, challengeId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/custom/${challengeId}/attachment`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to upload attachment');
  }
  return await response.json();
};

export const deleteCustomChallengeAttachment = async (classroomId, challengeId, attachmentId) => {
  const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/custom/${challengeId}/attachment/${attachmentId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to delete attachment');
  }
  return await response.json();
};

export const getCustomChallengeAttachmentUrl = (classroomId, challengeId, attachmentId) => {
  return `${API_BASE}/api/challenges/${classroomId}/custom/${challengeId}/attachment/${attachmentId}`;
};

export const updateLegacyChallenges = async (classroomId, includedLegacyChallenges) => {
  const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/legacy-challenges`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ includedLegacyChallenges })
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to update legacy challenges');
  }
  return await response.json();
};

export const getTemplateMetadata = async () => {
  const response = await fetch(`${API_BASE}/api/challenges/templates/metadata`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to fetch template metadata');
  }
  return await response.json();
};

export const getPersonalizedChallengeFileUrl = (classroomId, challengeId) => {
  return `${API_BASE}/api/challenges/${classroomId}/custom/${challengeId}/download-personalized`;
};

export const resetCustomChallenge = async (classroomId, studentId, challengeId) => {
  const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/custom/reset-custom-challenge`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId, challengeId })
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to reset custom challenge');
  }
  return await response.json();
};

export const resetAllCustomChallenges = async (classroomId, studentId) => {
  const response = await fetch(`${API_BASE}/api/challenges/${classroomId}/custom/reset-all-custom-challenges`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId })
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to reset all custom challenges');
  }
  return await response.json();
};
