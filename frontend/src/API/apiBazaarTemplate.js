import { API_BASE } from '../config/api';

export const getBazaarTemplates = async () => {
    const response = await fetch(`${API_BASE}/api/bazaarTemplates/import`, {
        credentials: 'include'
    });
    if (!response.ok) {
        throw new Error('Failed to fetch the requested templates');
    }
    return response.json();
};

export const saveBazaarTemplate = async (sourceClassroomId, bazaarTemplateId, newBazaarName) =>{
    const response = await fetch(`${API_BASE}/api/bazaarTemplates/import`, {
        method: 'POST', 
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sourceClassroomId, bazaarTemplateId, newBazaarName })
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save the template');
    }
    return response.json();
};

export const deleteBazaarTemplate = async (templateId) => {
    const response = await fetch(`${API_BASE}/api/bazaarTemplates/${templateId}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete the template');
    }
    return response.json();
};