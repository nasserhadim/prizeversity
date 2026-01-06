import { useState } from 'react';
import { getChallengeTemplates, saveChallengeTemplate, deleteChallengeTemplate } from '../API/apiChallengeTemplate';
import toast from 'react-hot-toast';

export const useTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // New: modal state for delete confirmation
  const [deleteTemplateModal, setDeleteTemplateModal] = useState(null);
  const [deletingTemplate, setDeletingTemplate] = useState(false);

  // NEW: bulk delete state
  const [bulkDeletingTemplates, setBulkDeletingTemplates] = useState(false);

  const fetchTemplates = async () => {
    try {
      const response = await getChallengeTemplates();
      setTemplates(response.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  // UPDATED: Accept optional customChallenges parameter
  const handleSaveTemplate = async (challengeConfig, classroomId, customChallenges = []) => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    if (!classroomId) {
      toast.error('Missing classroom id');
      return;
    }

    try {
      setSavingTemplate(true);

      const settings = {
        rewardMode: challengeConfig.rewardMode,
        multiplierMode: challengeConfig.multiplierMode,
        luckMode: challengeConfig.luckMode,
        discountMode: challengeConfig.discountMode,
        shieldMode: challengeConfig.shieldMode,
        attackMode: challengeConfig.attackMode,
        // Multiplier application settings
        applyPersonalMultiplier: challengeConfig.applyPersonalMultiplier || false,
        applyGroupMultiplier: challengeConfig.applyGroupMultiplier || false,
        challengeBits: challengeConfig.challengeBits,
        totalRewardBits: challengeConfig.totalRewardBits,
        challengeMultipliers: challengeConfig.challengeMultipliers,
        totalMultiplier: challengeConfig.totalMultiplier,
        challengeLuck: challengeConfig.challengeLuck,
        totalLuck: challengeConfig.totalLuck,
        challengeDiscounts: challengeConfig.challengeDiscounts,
        totalDiscount: challengeConfig.totalDiscount,
        challengeShields: challengeConfig.challengeShields,
        totalShield: challengeConfig.totalShield,
        challengeAttackBonuses: challengeConfig.challengeAttackBonuses,
        totalAttackBonus: challengeConfig.totalAttackBonus,
        challengeHintsEnabled: challengeConfig.challengeHintsEnabled,
        challengeHints: challengeConfig.challengeHints,
        hintPenaltyPercent: challengeConfig.hintPenaltyPercent,
        maxHintsPerChallenge: challengeConfig.maxHintsPerChallenge,
        challengeVisibility: Array.isArray(challengeConfig.challengeVisibility)
          ? challengeConfig.challengeVisibility.map(v => !!v)
          : [true, true, true, true, true, true, true],
        dueDateEnabled: challengeConfig.dueDateEnabled,
        dueDate: challengeConfig.dueDate,
        difficulty: 'medium',
        // NEW: Include custom challenges in template
        customChallenges: customChallenges.map(cc => ({
          title: cc.title,
          description: cc.description,
          externalUrl: cc.externalUrl,
          templateType: cc.templateType || 'passcode',
          templateConfig: cc.templateConfig || {},
          maxAttempts: cc.maxAttempts,
          hintsEnabled: cc.hintsEnabled,
          hints: cc.hints || [],
          hintPenaltyPercent: cc.hintPenaltyPercent,
          bits: cc.bits || 50,
          multiplier: cc.multiplier || 1.0,
          luck: cc.luck || 1.0,
          discount: cc.discount || 0,
          shield: cc.shield || false,
          applyPersonalMultiplier: cc.applyPersonalMultiplier || false,
          applyGroupMultiplier: cc.applyGroupMultiplier || false,
          visible: cc.visible !== false,
          dueDateEnabled: cc.dueDateEnabled || false,
          // Note: Don't include solution/solutionHash for security
          // Note: Don't include attachments as they're file-based
        }))
      };

      await saveChallengeTemplate(templateName.trim(), challengeConfig.title, settings, classroomId);
      toast.success('Template saved successfully!');
      setShowSaveTemplateModal(false);
      setTemplateName('');
      fetchTemplates();
    } catch (error) {
      toast.error(error.message || 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  // Open delete confirmation modal
  const handleDeleteTemplate = (templateId, templateName) => {
    setDeleteTemplateModal({ id: templateId, name: templateName });
  };

  // Confirm deletion
  const confirmDeleteTemplate = async () => {
    if (!deleteTemplateModal) return;
    try {
      setDeletingTemplate(true);
      await deleteChallengeTemplate(deleteTemplateModal.id);
      toast.success('Template deleted successfully!');
      fetchTemplates();
      setDeleteTemplateModal(null);
    } catch (error) {
      toast.error(error.message || 'Failed to delete template');
    } finally {
      setDeletingTemplate(false);
    }
  };

  const cancelDeleteTemplate = () => setDeleteTemplateModal(null);

  // UPDATED: handleLoadTemplate to include custom challenges
  const handleLoadTemplate = (template, setConfigFn) => {
    if (!template?.settings) {
      toast.error('Invalid template data');
      return;
    }

    setConfigFn(prev => ({
      ...prev,
      title: template.title || prev.title,
      rewardMode: template.settings.rewardMode || 'individual',
      challengeBits: template.settings.challengeBits || [50, 75, 100, 125, 150, 175, 200],
      totalRewardBits: template.settings.totalRewardBits || 350,
      // Multiplier application settings
      applyPersonalMultiplier: template.settings.applyPersonalMultiplier || false,
      applyGroupMultiplier: template.settings.applyGroupMultiplier || false,
      multiplierMode: template.settings.multiplierMode || 'individual',
      challengeMultipliers: template.settings.challengeMultipliers || [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
      totalMultiplier: template.settings.totalMultiplier || 1.0,
      luckMode: template.settings.luckMode || 'individual',
      challengeLuck: template.settings.challengeLuck || [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
      totalLuck: template.settings.totalLuck || 1.0,
      discountMode: template.settings.discountMode || 'individual',
      challengeDiscounts: template.settings.challengeDiscounts || [0, 0, 0, 0, 0, 0, 0],
      totalDiscount: template.settings.totalDiscount || 0,
      shieldMode: template.settings.shieldMode || 'individual',
      challengeShields: template.settings.challengeShields || [false, false, false, false, false, false, false],
      totalShield: template.settings.totalShield || false,
      challengeHintsEnabled: template.settings.challengeHintsEnabled || [false, false, false, false, false, false, false],
      challengeHints: template.settings.challengeHints || [[], [], [], [], [], [], []],
      hintPenaltyPercent: template.settings.hintPenaltyPercent ?? 25,
      maxHintsPerChallenge: template.settings.maxHintsPerChallenge ?? 2,
      challengeVisibility: template.settings.challengeVisibility || [true, true, true, true, true, true, true],
      dueDateEnabled: template.settings.dueDateEnabled || false,
      dueDate: template.settings.dueDate || '',
      // NEW: Include custom challenges from template
      customChallengesFromTemplate: template.settings.customChallenges || []
    }));
    
    toast.success(`Loaded template: ${template.name}${template.settings.customChallenges?.length ? ` (includes ${template.settings.customChallenges.length} custom challenge(s))` : ''}`);
    
    // Return custom challenges for caller to handle
    return template.settings.customChallenges || [];
  };

  // NEW: bulk delete helper (Delete All / Delete Filtered)
  const bulkDeleteTemplates = async (templateIds = []) => {
    const ids = (templateIds || []).filter(Boolean);
    if (!ids.length) {
      toast.error('No templates to delete');
      return;
    }

    try {
      setBulkDeletingTemplates(true);

      const results = await Promise.allSettled(ids.map(id => deleteChallengeTemplate(id)));
      const deleted = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.length - deleted;

      if (deleted) toast.success(`Deleted ${deleted} template(s)`);
      if (failed) toast.error(`Failed to delete ${failed} template(s)`);

      fetchTemplates();
    } catch (error) {
      toast.error(error.message || 'Bulk delete failed');
    } finally {
      setBulkDeletingTemplates(false);
    }
  };

  return {
    templates,
    setTemplates,
    showSaveTemplateModal,
    setShowSaveTemplateModal,
    templateName,
    setTemplateName,
    savingTemplate,
    fetchTemplates,
    handleSaveTemplate,
    handleLoadTemplate,
    handleDeleteTemplate,
    deleteTemplateModal,
    confirmDeleteTemplate,
    cancelDeleteTemplate,
    deletingTemplate,
    bulkDeleteTemplates,
    bulkDeletingTemplates
  };
};
