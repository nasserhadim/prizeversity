// src/API/apiBazaarTemplate.js
import { API_BASE } from '../config/api';

// in src/API/apiBazaarTemplate.js
export const getBazaarTemplates = async (classroomId, { scope='all', searchText='' } = {}) => {
  const params = new URLSearchParams();
  if (scope) params.set('scope', scope);
  if (searchText) params.set('searchText', searchText);

  const res = await fetch(`${API_BASE}/api/classrooms/${classroomId}/bazaar-templates?${params}`, {
    credentials: 'include'
  });

  let data = null;
  try { data = await res.json(); } catch {}

  if (!res.ok) {
    // include status for easier debugging in UI/toast
    const msg = data?.message || `Failed to fetch bazaar templates (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return data;
};


export const importBazaarTemplate = async (classroomId, { bazaarTemplateId, newBazaarName }) => {
  const response = await fetch(
    `${API_BASE}/api/classrooms/${classroomId}/bazaar-templates`,  // <-- FIXED
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bazaarTemplateId, newBazaarName }),
    }
  );

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || 'Failed to import bazaar template');
  }
  return data; // { bazaar: {...} }
};
