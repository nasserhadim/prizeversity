import axios from 'axios';

const apiBazaarTemplate = axios.create({
  baseURL: '/api/bazaarTemplate',
  withCredentials: true,
});

// ---- helpers ----
export function listTemplates(params = {}) {
  return apiBazaarTemplate.get('/', { params });
}

export function saveTemplateFromBazaar(bazaarId) {
  return apiBazaarTemplate.post(`/save/${bazaarId}`);
}

export function applyTemplateToClassroom(templateId, targetClassroomId) {
  return apiBazaarTemplate.post(`/apply/${templateId}`, { targetClassroomId });
}

export function deleteTemplate(templateId) {
  return apiBazaarTemplate.delete(`/${templateId}`);
}

export function showReusableBazaars(classroomId) {
  return apiBazaarTemplate.get(`/reusable-bazaars/${classroomId}`);
}

export function applyReusableBazaar(sourceBazaarId, targetClassroomId) {
  return apiBazaarTemplate.post(`/reusable-bazaars/${sourceBazaarId}/apply`, { targetClassroomId });
}

export default apiBazaarTemplate;
