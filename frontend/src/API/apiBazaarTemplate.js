import { API_BASE } from '../config/api';

const prefix = '/templates';

export const listTemplates = (opts ={} ) =>
  API_BASE.get(`${prefix}`, {params: { AddClassroomName: !!opts.AddClassroomName}});

export const saveTemplateFromBazaar = (bazaarId) =>
  API_BASE.post(`${prefix}/save/${bazaarId}`);

export const applyTemplateToClassroom = (templateId, targetClassroomId) =>
  API_BASE.post(`${prefix}/apply/${templateId}`, {targetClassroomId});

export const deleteTemplate = (templateId) =>
  API_BASE.delete(`/templates/${templateId}`);

export const showReusableBazaars = (classroomId) =>
  API_BASE.get(`${prefix}/reusable-bazaars/${classroomId}`);

export const applyReusableBazaar = (sourceBazaarId, targetClassroomId) =>
  API_BASE(`${prefix}/reusable-bazaars/${sourceBazaarId}/apply`, { targetClassroomId });
