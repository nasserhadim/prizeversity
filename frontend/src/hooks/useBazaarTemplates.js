import { useState, useCallback } from 'react';
import {
  listTemplates,
  saveTemplateFromBazaar,
  applyTemplateToClassroom,
  deleteTemplate as apiDeleteTemplate,
  showReusableBazaars,
  applyReusableBazaar
} from '../API/apiBazaarTemplate';
import toast from 'react-hot-toast';

export function useBazaarTemplates() {
  const [templates, setTemplates] = useState([]);
  const [reusable, setReusable] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showViewer, setShowViewer] = useState(false);

  const fetchTemplates = useCallback(async () => {
  setLoading(true);
  try {
    const res = await listTemplates({ includeClassroomNames: 'true' });
    console.log('[listTemplates]', res.status, res.data);      
    setTemplates(res.data.templates || []);
  } catch (err) {
    console.error('[listTemplates] failed', err);              
    toast.error('Could not load templates');
  } finally {
    setLoading(false);
  }
}, []);


  const fetchReusableBazaarTemplates = useCallback(async (classroomId) => {
    setLoading(true);
    try {
      const res = await showReusableBazaars(classroomId);
      setReusable(res.data.bazaars || []);
    } catch (err) {
      console.error(err);
      toast.error('Unable to load reusable bazaars');
    } finally {
      setLoading(false);
    }
  }, []);


const saveBazaarTemplate = useCallback(async (bazaarId) => {
  try {
    const { data } = await saveTemplateFromBazaar(bazaarId);  
    toast.success(`Saved as template`);
    await fetchTemplates();                                    
    return data?.template || null;                              
  } catch (err) {
    console.error(err);
    toast.error('Failed to save template');
    return null;
  }
}, [fetchTemplates]);

  const applyTemplate = useCallback(async (templateId, targetClassroomId) => {
    try {
      const res = await applyTemplateToClassroom(templateId, targetClassroomId);
      toast.success('Template applied');
      return res.data.bazaar; // new bazaar object
    } catch (err) {
      console.error(err);
      toast.error('Failed to apply template');
      return null;
    }
  }, []);

  const deleteTemplate = useCallback(async (templateId) => {
    try {
      await apiDeleteTemplate(templateId);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete template');
    }
  }, [fetchTemplates]);

  const applyReusable = useCallback(async (sourceBazaarId, targetClassroomId) => {
    try {
      const res = await applyReusableBazaar(sourceBazaarId, targetClassroomId);
      toast.success('Imported bazaar');
      return res.data.bazaar;
    } catch (err) {
      console.error(err);
      toast.error('Failed to import bazaar');
      return null;
    }
  }, []);

  return {
    loading,
    templates,
    reusable,
    showViewer,
    setShowViewer,
    fetchTemplates,
    fetchReusableBazaarTemplates,
    saveBazaarTemplate,
    applyTemplate,
    deleteTemplate,
    applyReusable,
  };
}
