// src/hooks/useBazaarTemplate.js (your file name)
import { useState, useCallback } from 'react';
import { getBazaarTemplates, importBazaarTemplate } from '../API/apiBazaarTemplate';
import toast from 'react-hot-toast';

export const useBazaarTemplates = (classroomId) => {
  const [bazaarTemplates, setBazaarTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [error, setError] = useState(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [selectingTemplateId, setSelectingTemplateId] = useState(null);
  const [newBazaarName, setNewBazaarName] = useState('');
  const [importing, setImporting] = useState(false);

  const loadBazaarTemplate = useCallback(async (opts) => {
    try {
      setLoadingTemplates(true);
      setError(null);
      const response = await getBazaarTemplates(classroomId, opts);
      const list = Array.isArray(response?.bazaarTemplates) ? response.bazaarTemplates : [];
      setBazaarTemplates(list);
    } catch (err) {
      console.error(err);
      setError(err.message || 'There was an error while loading the bazaar templates.');
      setBazaarTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }, [classroomId]);

  const importFromTemplate = useCallback(async () => {
    if (!selectingTemplateId) return toast.error('Please select a bazaar template to import from.');
    try {
      setImporting(true);
      const { bazaar } = await importBazaarTemplate(classroomId, {
        bazaarTemplateId: selectingTemplateId,
        newBazaarName: newBazaarName.trim(),
      });
      toast.success('Bazaar imported successfully.');
      setShowImportModal(false);
      setSelectingTemplateId(null);
      setNewBazaarName('');
      return bazaar;
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'There was an error while importing the bazaar template.');
      return null;
    } finally {
      setImporting(false);
    }
  }, [classroomId, selectingTemplateId, newBazaarName]);

  return {
    bazaarTemplates, loadingTemplates, error,
    showImportModal, setShowImportModal,
    selectingTemplateId, setSelectingTemplateId,
    newBazaarName, setNewBazaarName,
    importing,
    loadBazaarTemplate,
    importFromTemplate,
  };
};
