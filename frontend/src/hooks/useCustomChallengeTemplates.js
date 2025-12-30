import { useState } from 'react';
import { 
  getCustomChallengeTemplates, 
  saveCustomChallengeTemplate, 
  deleteCustomChallengeTemplate 
} from '../API/apiCustomChallengeTemplate';
import toast from 'react-hot-toast';

export const useCustomChallengeTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [challengesToSave, setChallengesToSave] = useState([]);
  const [isSingleChallenge, setIsSingleChallenge] = useState(false);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await getCustomChallengeTemplates();
      setTemplates(response.templates || []);
    } catch (error) {
      console.error('Error fetching custom challenge templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const openSaveModal = (challenges, single = false) => {
    setChallengesToSave(challenges);
    setIsSingleChallenge(single);
    setTemplateName('');
    setShowSaveModal(true);
  };

  const handleSave = async (classroomId) => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    if (!challengesToSave || challengesToSave.length === 0) {
      toast.error('No challenges to save');
      return;
    }
    if (!classroomId) {
      toast.error('Missing classroom ID');
      return;
    }

    try {
      setSaving(true);
      
      const sanitized = challengesToSave.map(c => ({
        title: c.title,
        description: c.description || '',
        externalUrl: c.externalUrl || '',
        solution: c.solution || '',
        templateType: c.templateType || 'passcode',
        templateConfig: c.templateConfig || {},
        maxAttempts: c.maxAttempts || null,
        hintsEnabled: Boolean(c.hintsEnabled),
        hints: c.hints || [],
        hintPenaltyPercent: c.hintPenaltyPercent ?? null,
        bits: c.bits || 50,
        multiplier: c.multiplier || 1.0,
        luck: c.luck || 1.0,
        discount: c.discount || 0,
        shield: Boolean(c.shield),
        visible: c.visible !== false,
        dueDateEnabled: Boolean(c.dueDateEnabled)
      }));

      await saveCustomChallengeTemplate(templateName.trim(), sanitized, isSingleChallenge, classroomId);
      toast.success('Template saved!');
      setShowSaveModal(false);
      setTemplateName('');
      setChallengesToSave([]);
      fetchTemplates();
    } catch (error) {
      toast.error(error.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (templateId, templateName) => {
    setDeleteModal({ id: templateId, name: templateName });
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    try {
      setDeleting(true);
      await deleteCustomChallengeTemplate(deleteModal.id);
      toast.success('Template deleted');
      fetchTemplates();
      setDeleteModal(null);
    } catch (error) {
      toast.error(error.message || 'Failed to delete template');
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => setDeleteModal(null);

  const handleLoad = (template, onLoad) => {
    if (!template || !template.challenges || template.challenges.length === 0) {
      toast.error('Invalid template');
      return;
    }
    
    const loaded = template.challenges.map(c => ({
      title: c.title || '',
      description: c.description || '',
      externalUrl: c.externalUrl || '',
      solution: c.solution || '',
      templateType: c.templateType || 'passcode',
      templateConfig: c.templateConfig || {},
      maxAttempts: c.maxAttempts || null,
      hintsEnabled: Boolean(c.hintsEnabled),
      hints: c.hints || [],
      hintPenaltyPercent: c.hintPenaltyPercent ?? null,
      bits: c.bits || 50,
      multiplier: c.multiplier || 1.0,
      luck: c.luck || 1.0,
      discount: c.discount || 0,
      shield: Boolean(c.shield),
      visible: c.visible !== false,
      dueDateEnabled: Boolean(c.dueDateEnabled),
      dueDate: ''
    }));

    if (onLoad) {
      onLoad(loaded, template.isSingleChallenge);
    }
    
    setShowLoadModal(false);
    toast.success(`Loaded "${template.name}" (${loaded.length} challenge${loaded.length !== 1 ? 's' : ''})`);
  };

  return {
    templates,
    showSaveModal,
    setShowSaveModal,
    showLoadModal,
    setShowLoadModal,
    templateName,
    setTemplateName,
    saving,
    loading,
    fetchTemplates,
    openSaveModal,
    handleSave,
    handleLoad,
    handleDelete,
    deleteModal,
    confirmDelete,
    cancelDelete,
    deleting,
    challengesToSave,
    isSingleChallenge
  };
};

