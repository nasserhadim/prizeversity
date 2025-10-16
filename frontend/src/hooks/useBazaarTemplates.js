import { useState } from 'react';
import { getBazaarTemplates, saveBazaarTemplate, deleteBazaarTemplate } from '../API/apiBazaarTemplate';
import toast from 'react-hot-toast';

export const useBazaarTemplates =() => {
    const [bazaarTemplates, setBazaarTemplates] = useState([]);
    const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
    const [bazaarTemplateName, setBazaarTemplateName] = useState('');
    const [savingBazaarTemplate, setSavingBazaarTemplate] = useState(false);
}

const fetchBazaarTemplates = async () => {
    try {
        const response = await getBazaarTemplates();
        setBazaarTemplates(response.templateId || []);
    } catch (error) {
        console.error('Error fetching the bazaar templates:', error);
    }
};

const handleSaveBazaarTemplate = async (sourceClassroomId, bazaarTemplateId) => {
    if (!bazaarTemplateName.trim()) {
        toast.error('Please enter a template name');
        return;
    }
  
};