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

  const fetchTemplates = async () => {
    try {
      const response = await getChallengeTemplates();
      setTemplates(response.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleSaveTemplate = async (challengeConfig) => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
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
        challengeHintsEnabled: challengeConfig.challengeHintsEnabled,
        challengeHints: challengeConfig.challengeHints,
        hintPenaltyPercent: challengeConfig.hintPenaltyPercent,
        maxHintsPerChallenge: challengeConfig.maxHintsPerChallenge,
        totalAttackBonus: challengeConfig.totalAttackBonus,
        dueDateEnabled: challengeConfig.dueDateEnabled,
        dueDate: challengeConfig.dueDate,
        difficulty: 'medium'
      };

      await saveChallengeTemplate(templateName.trim(), challengeConfig.title, settings);
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

  const handleLoadTemplate = (template, setChallengeConfig) => {
    const newConfig = {
      title: template.title,
      rewardMode: template.settings.rewardMode || 'individual',
      challengeBits: template.settings.challengeBits || [50, 75, 100, 125],
      totalRewardBits: template.settings.totalRewardBits || 350,
      multiplierMode: template.settings.multiplierMode || 'individual',
      challengeMultipliers: template.settings.challengeMultipliers || [1.0, 1.0, 1.0, 1.0],
      totalMultiplier: template.settings.totalMultiplier || 1.0,
      luckMode: template.settings.luckMode || 'individual',
      challengeLuck: template.settings.challengeLuck || [1.0, 1.0, 1.0, 1.0],
      totalLuck: template.settings.totalLuck || 1.0,
      discountMode: template.settings.discountMode || 'individual',
      challengeDiscounts: template.settings.challengeDiscounts || [0, 0, 0, 0],
      totalDiscount: template.settings.totalDiscount || 0,
      shieldMode: template.settings.shieldMode || 'individual',
      challengeShields: template.settings.challengeShields || [false, false, false, false],
      totalShield: template.settings.totalShield || false,
      attackMode: template.settings.attackMode || 'individual',
      challengeAttackBonuses: template.settings.challengeAttackBonuses || [0, 0, 0, 0],
      totalAttackBonus: template.settings.totalAttackBonus || 0,
      challengeHintsEnabled: template.settings.challengeHintsEnabled || [false, false, false, false],
      challengeHints: template.settings.challengeHints || [[], [], [], []],
      hintPenaltyPercent: template.settings.hintPenaltyPercent ?? 25,
      maxHintsPerChallenge: template.settings.maxHintsPerChallenge ?? 2,
      dueDateEnabled: template.settings.dueDateEnabled || false,
      dueDate: template.settings.dueDate || ''
    };
    
    setChallengeConfig(newConfig);
    toast.success(`Template "${template.name}" loaded!`);
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
    // expose modal state & handlers for UI
    deleteTemplateModal,
    confirmDeleteTemplate,
    cancelDeleteTemplate,
    deletingTemplate
  };
};
