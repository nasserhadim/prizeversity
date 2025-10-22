import { useState, useCallback } from 'react';
import { listTemplates, saveTemplateFromBazaar, applyTemplateToClassroom, deleteTemplate, showReusableBazaars, applyReusableBazaar } from '../API/apiBazaarTemplate';
import toast from 'react-hot-toast';

export const applyBazaarTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [reusable, setReusable] = useState([]);
  const [loadTemplate, setLoadTemplate] = useState([]);
  const [showViewer, setShowViewer] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoadTemplate(true);
    try {
      const res = await listTemplates({ AddClassroomName: true });
      setTemplates(res.data.templates || []);
    } catch (err) {
      console.error(err);
      toast.entry('Could not load templates')
    } finally {
      setLoadTemplate(false);
    }
  }, []);

  const fetchReusableBazaarTemplates = useCallback(async (classroomId) => {
    setLoadTemplate(true);
    try {
      const res = await showReusableBazaars(classroomId);
      setReusable(res.data.bazaars || []);
    } catch (err) {
      console.error(err);
      toast.error('Unable to load the reusable templates');
    } finally {
      setLoadTemplate(false);
    }
  }, []);

  const saveBazaarTemplate = useCallBack(async (bazaarId) => {
    try {
      await saveTemplateFromBazaar(bazaarId);
      toast.success('Saved bazaar as template');
      fetchTemplates();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save the bazaar as template')
    }
  }, [fetchTemplates]);

  const addBazaarTemplate = useCallBack(async (templateId, targetClassroomId) => {
    try {
      const res = await applyTemplateToClassroom(templateId, targetClassroomId);
      toast.success('Template has been applied');
      return res.data.bazaar;
    } catch (err) {
      console.error(err);
      toast.error('Failed tp apply bazaar template');
      return null;
    }
  }, []);

  const deleteBazaarTemplate = useCallBack(async (templateId) => {
    try {
      await deleteTemplate(templateId);
      toast.success('Template has been deleted');
      fetchTemplates();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete the bazaar template');
    }
  })

  const applyReadyTemplate = useCallback(async (sourceBazaarId, targetClassroomId) => {
    try {
      const res = await applyReusableBazaar(sourceBazaarId, targetClassroomId);
      toast.success('Imported bazzar from another classroom');
      return res.data.bazaar;
    } catch (err) {
      console.error(err);
      toast.error('Failed to apply the bazaar template');
      return null;
    }
  }, []);

  return {
    loadTemplate,
    templates,
    reusable,
    showViewer,
    setShowViewer,
    fetchTemplates,
    fetchReusableBazaarTemplates,
    saveBazaarTemplate,
    addBazaarTemplate,
    deleteBazaarTemplate,
    applyReadyTemplate
  };

};
