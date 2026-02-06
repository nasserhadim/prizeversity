const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Challenge = require('../../models/Challenge');
const User = require('../../models/User');
const Classroom = require('../../models/Classroom');
const { ensureAuthenticated, ensureTeacher } = require('../../middleware/auth');
const { calculateChallengeRewards } = require('./utils');
const { awardXP } = require('../../utils/awardXP');
const { logStatChanges } = require('../../utils/statChangeLog');
const { getIO } = require('../../utils/io');
const fs = require('fs').promises;
const path = require('path');
const upload = require('../../middleware/upload');
const templateEngine = require('../../utils/challengeTemplates');
const { getScopedUserStats } = require('../../utils/classroomStats');
// ADD: Import group multiplier utility
const { getUserGroupMultiplier } = require('../../utils/groupMultiplier');

async function awardCustomChallengeXP({ userId, classroomId, rewards, challengeName }) {
  try {
    const cls = await Classroom.findById(classroomId).select('xpSettings');
    if (!cls?.xpSettings?.enabled) return;

    const io = getIO();

    // Helper: log XP delta (A -> B) to student's stats_adjusted feed + emit realtime
    const logXPDelta = async ({ xpRes, context, effectsText }) => {
      if (!xpRes || typeof xpRes.oldXP === 'undefined' || typeof xpRes.newXP === 'undefined') return;
      if (xpRes.newXP === xpRes.oldXP) return;

      try {
        const targetUser = await User.findById(userId).select('firstName lastName');
        if (!targetUser) return;

        await logStatChanges({
          io,
          classroomId,
          user: targetUser,
          actionBy: null, // system
          prevStats: { xp: xpRes.oldXP },
          currStats: { xp: xpRes.newXP },
          context,
          details: { effectsText, challengeName },
          forceLog: true
        });
      } catch (e) {
        console.warn('[custom] failed to log XP stat change:', e);
      }
    };

    // 1) Bits-earned XP (custom challenge rewards already "final")
    const bits = Number(rewards?.bits || 0);
    const rateBits = Number(cls.xpSettings.bitsEarned || 0);
    if (bits > 0 && rateBits > 0) {
      const xp = bits * rateBits;
      if (xp > 0) {
        try {
          const xpRes = await awardXP(userId, classroomId, xp, 'earning bits (custom challenge)', cls.xpSettings);
          await logXPDelta({
            xpRes,
            context: `earning bits (custom challenge${challengeName ? `: ${challengeName}` : ''})`,
            effectsText: `Bits: +${bits}`
          });
        } catch (e) {
          console.warn('[custom] awardXP (bits) failed:', e);
        }
      }
    }

    // 2) Stat-increase XP
    const statCount =
      (Number(rewards?.multiplier || 0) > 0 ? 1 : 0) +
      (Number(rewards?.luck || 1) > 1.0 ? 1 : 0) +
      (Number(rewards?.discount || 0) > 0 ? 1 : 0) +
      (rewards?.shield ? 1 : 0);

    const rateStat = Number(cls.xpSettings.statIncrease || 0);
    if (statCount > 0 && rateStat > 0) {
      const xp = statCount * rateStat;
      if (xp > 0) {
        try {
          const xpRes = await awardXP(userId, classroomId, xp, 'stat increase (custom challenge)', cls.xpSettings);

          const parts = [];
          if (Number(rewards?.multiplier || 0) > 0) parts.push(`+${Number(rewards.multiplier).toFixed(1)} Multiplier`);
          if (Number(rewards?.luck || 1) > 1.0) parts.push(`+${Number(rewards.luck - 1).toFixed(1)} Luck`);
          if (Number(rewards?.discount || 0) > 0) parts.push(`+${Number(rewards.discount)}% Discount`);
          if (rewards?.shield) parts.push('Shield +1');

          await logXPDelta({
            xpRes,
            context: `stat increase (custom challenge${challengeName ? `: ${challengeName}` : ''})`,
            effectsText: parts.join(', ') || undefined
          });
        } catch (e) {
          console.warn('[custom] awardXP (stat increase) failed:', e);
        }
      }
    }

    // 3) Completion XP
    const rateCompletion = Number(cls.xpSettings.challengeCompletion || 0);
    if (rateCompletion > 0) {
      try {
        const xpRes = await awardXP(userId, classroomId, rateCompletion, 'custom challenge completion', cls.xpSettings);
        await logXPDelta({
          xpRes,
          context: `custom challenge completion${challengeName ? `: ${challengeName}` : ''}`,
          effectsText: `Completion bonus: +${rateCompletion}`
        });
      } catch (e) {
        console.warn('[custom] awardXP (completion) failed:', e);
      }
    }
  } catch (err) {
    console.warn('[custom] awardCustomChallengeXP failed:', err);
  }
}

// Get template metadata (for teacher UI) - MUST be before parameterized routes
router.get('/templates/metadata', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const metadata = templateEngine.getTemplateMetadata();
    res.json({ success: true, templates: metadata });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch template metadata' });
  }
});

// Reorder custom challenges (MUST be before '/:classroomId/custom/:challengeId' routes)
router.put('/:classroomId/custom/reorder', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { order } = req.body;

    if (!Array.isArray(order)) {
      return res.status(400).json({ success: false, message: 'Order must be an array of challenge IDs' });
    }

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge series not found' });
    }

    if (challenge.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the challenge creator can reorder challenges' });
    }

    const challengeMap = new Map();
    challenge.customChallenges.forEach(cc => {
      challengeMap.set(cc._id.toString(), cc);
    });

    order.forEach((id, index) => {
      const cc = challengeMap.get(id);
      if (cc) cc.order = index;
    });

    challenge.customChallenges.sort((a, b) => a.order - b.order);
    await challenge.save();

    res.json({ success: true, message: 'Challenges reordered' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to reorder challenges' });
  }
});

// Create a new custom challenge
router.post('/:classroomId/custom', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { 
      title, description, externalUrl, solution, maxAttempts, 
      hintsEnabled, hints, hintPenaltyPercent, bits, multiplier, luck, discount, shield, visible,
      templateType, templateConfig, dueDateEnabled, dueDate, applyPersonalMultiplier, applyGroupMultiplier,
      isMultiStep, steps, completionBonus
    } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const isMultiStepChallenge = Boolean(isMultiStep) && Array.isArray(steps) && steps.length > 0;

    if (!isMultiStepChallenge) {
      const isTemplateType = templateType && templateType !== 'passcode';
      if (!isTemplateType && !solution) {
        return res.status(400).json({ success: false, message: 'Solution is required for passcode challenges' });
      }
    }

    if (title.length > 200) {
      return res.status(400).json({ success: false, message: 'Title must be 200 characters or less' });
    }

    if (description && description.length > 5000) {
      return res.status(400).json({ success: false, message: 'Description must be 5000 characters or less' });
    }

    const isTemplateType = templateType && templateType !== 'passcode';
    if (!isMultiStepChallenge && isTemplateType) {
      const validation = templateEngine.validateConfig(templateType, templateConfig || {});
      if (!validation.valid) {
        return res.status(400).json({ success: false, message: validation.errors.join(', ') });
      }
    }

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge series not found' });
    }

    if (challenge.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the challenge creator can add custom challenges' });
    }

    let solutionHash = null;
    let solutionPlaintext = null;
    if (!isMultiStepChallenge && !isTemplateType && solution) {
      solutionHash = await bcrypt.hash(solution.trim(), 10);
      solutionPlaintext = solution.trim();
    }

    if (!challenge.customChallenges) challenge.customChallenges = [];

    let processedSteps = [];
    if (isMultiStepChallenge) {
      const tempIdToObjectId = new Map();
      
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const newObjectId = new mongoose.Types.ObjectId();
        const tempId = step._id || `step-${i}`;
        tempIdToObjectId.set(tempId, newObjectId);
      }

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepIsTemplate = step.templateType && step.templateType !== 'passcode';
        let stepSolutionHash = null;
        let stepSolutionPlaintext = null;
        
        if (!stepIsTemplate && step.solution) {
          stepSolutionHash = await bcrypt.hash(step.solution.trim(), 10);
          stepSolutionPlaintext = step.solution.trim();
        }

        if (stepIsTemplate && step.templateConfig) {
          const validation = templateEngine.validateConfig(step.templateType, step.templateConfig);
          if (!validation.valid) {
            return res.status(400).json({ 
              success: false, 
              message: `Step "${step.title}": ${validation.errors.join(', ')}` 
            });
          }
        }

        const prereqObjectIds = [];
        if (Array.isArray(step.prerequisites)) {
          for (const prereqId of step.prerequisites) {
            const mappedId = tempIdToObjectId.get(prereqId);
            if (mappedId) {
              prereqObjectIds.push(mappedId);
            } else if (mongoose.Types.ObjectId.isValid(prereqId)) {
              prereqObjectIds.push(new mongoose.Types.ObjectId(prereqId));
            }
          }
        }

        const tempId = step._id || `step-${i}`;
        processedSteps.push({
          _id: tempIdToObjectId.get(tempId),
          title: step.title?.trim() || 'Step',
          description: step.description?.trim() || '',
          templateType: step.templateType || 'passcode',
          templateConfig: stepIsTemplate ? (step.templateConfig || {}) : {},
          solutionHash: stepSolutionHash,
          solutionPlaintext: stepSolutionPlaintext,
          bits: Number(step.bits) || 0,
          multiplier: Number(step.multiplier) || 1.0,
          luck: Number(step.luck) || 1.0,
          discount: Number(step.discount) || 0,
          shield: Boolean(step.shield),
          maxAttempts: step.maxAttempts || null,
          hintsEnabled: step.hintsEnabled || false,
          hints: Array.isArray(step.hints) ? step.hints.filter(h => h && h.trim()).map(h => h.trim()) : [],
          hintPenaltyPercent: step.hintPenaltyPercent !== undefined ? Number(step.hintPenaltyPercent) : null,
          prerequisites: prereqObjectIds,
          isRequired: step.isRequired !== false,
          applyPersonalMultiplier: Boolean(step.applyPersonalMultiplier),
          applyGroupMultiplier: Boolean(step.applyGroupMultiplier)
        });
      }
    }

    const newCustomChallenge = {
      _id: new mongoose.Types.ObjectId(),
      order: challenge.customChallenges.length,
      title: title.trim(),
      description: description?.trim() || '',
      externalUrl: externalUrl?.trim() || '',
      solutionHash,
      solutionPlaintext,
      templateType: isMultiStepChallenge ? 'passcode' : (templateType || 'passcode'),
      templateConfig: (!isMultiStepChallenge && isTemplateType) ? (templateConfig || {}) : {},
      attachments: [],
      maxAttempts: isMultiStepChallenge ? null : (maxAttempts || null),
      hintsEnabled: isMultiStepChallenge ? false : (hintsEnabled || false),
      hints: isMultiStepChallenge ? [] : (Array.isArray(hints) ? hints.filter(h => h && h.trim()).map(h => h.trim()) : []),
      hintPenaltyPercent: isMultiStepChallenge ? null : (hintPenaltyPercent !== undefined && hintPenaltyPercent !== null ? Number(hintPenaltyPercent) : null),
      bits: isMultiStepChallenge ? 0 : (Number(bits) || 50),
      multiplier: Number(multiplier) || 1.0,
      luck: Number(luck) || 1.0,
      discount: Number(discount) || 0,
      shield: Boolean(shield),
      applyPersonalMultiplier: Boolean(applyPersonalMultiplier),
      applyGroupMultiplier: Boolean(applyGroupMultiplier),
      visible: visible !== false,
      dueDateEnabled: Boolean(dueDateEnabled),
      dueDate: dueDateEnabled && dueDate ? new Date(dueDate) : null,
      isMultiStep: isMultiStepChallenge,
      steps: processedSteps,
      completionBonus: isMultiStepChallenge ? (Number(completionBonus) || 0) : 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    challenge.customChallenges.push(newCustomChallenge);

    if (challenge.seriesType === 'legacy' && (challenge.includedLegacyChallenges || []).length > 0) {
      challenge.seriesType = 'mixed';
    } else if ((challenge.includedLegacyChallenges || []).length === 0 && challenge.customChallenges.length > 0) {
      challenge.seriesType = challenge.seriesType === 'legacy' ? 'mixed' : challenge.seriesType;
    }

    await challenge.save();

    res.json({
      success: true,
      message: 'Custom challenge created',
      challenge: {
        _id: newCustomChallenge._id,
        order: newCustomChallenge.order,
        title: newCustomChallenge.title,
        description: newCustomChallenge.description,
        externalUrl: newCustomChallenge.externalUrl,
        templateType: newCustomChallenge.templateType,
        bits: newCustomChallenge.bits,
        multiplier: newCustomChallenge.multiplier,
        luck: newCustomChallenge.luck,
        discount: newCustomChallenge.discount,
        shield: newCustomChallenge.shield,
        visible: newCustomChallenge.visible,
        hintsEnabled: newCustomChallenge.hintsEnabled,
        hintsCount: newCustomChallenge.hints.length,
        maxAttempts: newCustomChallenge.maxAttempts,
        isMultiStep: newCustomChallenge.isMultiStep,
        steps: newCustomChallenge.steps,
        completionBonus: newCustomChallenge.completionBonus
      }
    });
  } catch (error) {
    console.error('[custom.js] Create error:', error);
    res.status(500).json({ success: false, message: 'Failed to create custom challenge' });
  }
});

// Update a custom challenge
router.put('/:classroomId/custom/:challengeId', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId, challengeId } = req.params;
    const { 
      title, description, externalUrl, solution, maxAttempts, 
      hintsEnabled, hints, hintPenaltyPercent, bits, multiplier, luck, discount, shield, visible,
      templateType, templateConfig, dueDateEnabled, dueDate,
      applyPersonalMultiplier, applyGroupMultiplier,
      isMultiStep, steps, completionBonus
    } = req.body;

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge series not found' });
    }

    if (challenge.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the challenge creator can edit custom challenges' });
    }

    const customChallenge = challenge.customChallenges.id(challengeId);
    if (!customChallenge) {
      return res.status(404).json({ success: false, message: 'Custom challenge not found' });
    }

    if (title !== undefined) {
      if (title.length > 200) {
        return res.status(400).json({ success: false, message: 'Title must be 200 characters or less' });
      }
      customChallenge.title = title.trim();
    }

    if (description !== undefined) {
      if (description.length > 5000) {
        return res.status(400).json({ success: false, message: 'Description must be 5000 characters or less' });
      }
      customChallenge.description = description.trim();
    }

    if (externalUrl !== undefined) customChallenge.externalUrl = externalUrl.trim();
    
    if (isMultiStep !== undefined) {
      customChallenge.isMultiStep = Boolean(isMultiStep);
    }

    if (completionBonus !== undefined) {
      customChallenge.completionBonus = Number(completionBonus) || 0;
    }

    if (steps !== undefined && Array.isArray(steps)) {
      let processedSteps = [];
      const tempIdToObjectId = new Map();
      
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const tempId = step._id || `step-${i}`;
        let objectId;
        if (step._id && mongoose.Types.ObjectId.isValid(step._id)) {
          objectId = new mongoose.Types.ObjectId(step._id);
        } else {
          objectId = new mongoose.Types.ObjectId();
        }
        tempIdToObjectId.set(tempId, objectId);
      }

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const stepIsTemplate = step.templateType && step.templateType !== 'passcode';
        let stepSolutionHash = null;
        let stepSolutionPlaintext = null;
        
        if (!stepIsTemplate && step.solution) {
          stepSolutionHash = await bcrypt.hash(step.solution.trim(), 10);
          stepSolutionPlaintext = step.solution.trim();
        }

        if (stepIsTemplate && step.templateConfig) {
          const validation = templateEngine.validateConfig(step.templateType, step.templateConfig);
          if (!validation.valid) {
            return res.status(400).json({ 
              success: false, 
              message: `Step "${step.title}": ${validation.errors.join(', ')}` 
            });
          }
        }

        const prereqObjectIds = [];
        if (Array.isArray(step.prerequisites)) {
          for (const prereqId of step.prerequisites) {
            const mappedId = tempIdToObjectId.get(prereqId);
            if (mappedId) {
              prereqObjectIds.push(mappedId);
            } else if (mongoose.Types.ObjectId.isValid(prereqId)) {
              prereqObjectIds.push(new mongoose.Types.ObjectId(prereqId));
            }
          }
        }

        const tempId = step._id || `step-${i}`;
        processedSteps.push({
          _id: tempIdToObjectId.get(tempId),
          title: step.title?.trim() || 'Step',
          description: step.description?.trim() || '',
          templateType: step.templateType || 'passcode',
          templateConfig: stepIsTemplate ? (step.templateConfig || {}) : {},
          solutionHash: stepSolutionHash,
          solutionPlaintext: stepSolutionPlaintext,
          bits: Number(step.bits) || 0,
          multiplier: Number(step.multiplier) || 1.0,
          luck: Number(step.luck) || 1.0,
          discount: Number(step.discount) || 0,
          shield: Boolean(step.shield),
          maxAttempts: step.maxAttempts || null,
          hintsEnabled: step.hintsEnabled || false,
          hints: Array.isArray(step.hints) ? step.hints.filter(h => h && h.trim()).map(h => h.trim()) : [],
          hintPenaltyPercent: step.hintPenaltyPercent !== undefined ? Number(step.hintPenaltyPercent) : null,
          prerequisites: prereqObjectIds,
          isRequired: step.isRequired !== false,
          applyPersonalMultiplier: Boolean(step.applyPersonalMultiplier),
          applyGroupMultiplier: Boolean(step.applyGroupMultiplier)
        });
      }
      customChallenge.steps = processedSteps;
    }

    if (!customChallenge.isMultiStep) {
      if (maxAttempts !== undefined) customChallenge.maxAttempts = maxAttempts;
      if (hintsEnabled !== undefined) customChallenge.hintsEnabled = hintsEnabled;
      if (hints !== undefined) customChallenge.hints = Array.isArray(hints) ? hints.filter(h => h && h.trim()).map(h => h.trim()) : [];
      if (hintPenaltyPercent !== undefined) customChallenge.hintPenaltyPercent = hintPenaltyPercent !== null ? Number(hintPenaltyPercent) : null;
      if (bits !== undefined) customChallenge.bits = Number(bits) || 0;
    }

    if (multiplier !== undefined) customChallenge.multiplier = Number(multiplier) || 1.0;
    if (luck !== undefined) customChallenge.luck = Number(luck) || 1.0;
    if (discount !== undefined) customChallenge.discount = Math.min(100, Math.max(0, Number(discount) || 0));
    if (shield !== undefined) customChallenge.shield = Boolean(shield);
    if (applyPersonalMultiplier !== undefined) customChallenge.applyPersonalMultiplier = Boolean(applyPersonalMultiplier);
    if (applyGroupMultiplier !== undefined) customChallenge.applyGroupMultiplier = Boolean(applyGroupMultiplier);
    if (visible !== undefined) customChallenge.visible = Boolean(visible);
    if (dueDateEnabled !== undefined) customChallenge.dueDateEnabled = Boolean(dueDateEnabled);
    if (dueDateEnabled !== undefined && dueDate !== undefined) {
      customChallenge.dueDate = dueDateEnabled && dueDate ? new Date(dueDate) : null;
    }

    if (!customChallenge.isMultiStep && templateType !== undefined) {
      const isTemplateType = templateType && templateType !== 'passcode';
      
      if (isTemplateType && templateConfig) {
        const validation = templateEngine.validateConfig(templateType, templateConfig);
        if (!validation.valid) {
          return res.status(400).json({ success: false, message: validation.errors.join(', ') });
        }
        customChallenge.templateType = templateType;
        customChallenge.templateConfig = templateConfig;
        customChallenge.solutionHash = null;
      } else if (!isTemplateType) {
        customChallenge.templateType = 'passcode';
        customChallenge.templateConfig = {};
      }
    }

    if (!customChallenge.isMultiStep && solution !== undefined && solution.trim() && customChallenge.templateType === 'passcode') {
      customChallenge.solutionHash = await bcrypt.hash(solution.trim(), 10);
      customChallenge.solutionPlaintext = solution.trim();
    }

    customChallenge.updatedAt = new Date();
    await challenge.save();

    res.json({
      success: true,
      message: 'Custom challenge updated',
      challenge: {
        _id: customChallenge._id,
        order: customChallenge.order,
        title: customChallenge.title,
        description: customChallenge.description,
        externalUrl: customChallenge.externalUrl,
        templateType: customChallenge.templateType,
        bits: customChallenge.bits,
        multiplier: customChallenge.multiplier,
        luck: customChallenge.luck,
        discount: customChallenge.discount,
        shield: customChallenge.shield,
        visible: customChallenge.visible,
        hintsEnabled: customChallenge.hintsEnabled,
        hintsCount: (customChallenge.hints || []).length,
        maxAttempts: customChallenge.maxAttempts,
        isMultiStep: customChallenge.isMultiStep,
        steps: customChallenge.steps,
        completionBonus: customChallenge.completionBonus
      }
    });
  } catch (error) {
    console.error('[custom.js] Update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update custom challenge' });
  }
});

// Delete a custom challenge
router.delete('/:classroomId/custom/:challengeId', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId, challengeId } = req.params;

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge series not found' });
    }

    if (challenge.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the challenge creator can delete custom challenges' });
    }

    const customChallenge = challenge.customChallenges.id(challengeId);
    if (!customChallenge) {
      return res.status(404).json({ success: false, message: 'Custom challenge not found' });
    }

    // Delete associated attachment files
    for (const attachment of customChallenge.attachments || []) {
      try {
        await fs.unlink(attachment.path);
      } catch {
        // File may not exist, continue
      }
    }

    challenge.customChallenges.pull(challengeId);

    // Reorder remaining challenges
    challenge.customChallenges.forEach((cc, index) => {
      cc.order = index;
    });

    // Update series type if needed
    if (challenge.customChallenges.length === 0) {
      if ((challenge.includedLegacyChallenges || []).length > 0) {
        challenge.seriesType = 'legacy';
      }
    }

    await challenge.save();

    res.json({ success: true, message: 'Custom challenge deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete custom challenge' });
  }
});

// Verify custom challenge solution (student submission)
router.post('/:classroomId/custom/:challengeId/verify', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId, challengeId } = req.params;
    const { passcode } = req.body;
    const userId = req.user._id;

    if (!passcode || !passcode.trim()) {
      return res.status(400).json({ success: false, message: 'Passcode is required' });
    }

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge series not found' });
    }

    if (!challenge.isActive) {
      return res.status(400).json({ success: false, message: 'Challenge series is not active' });
    }

    if (challenge.isExpired()) {
      return res.status(400).json({ success: false, message: 'Challenge series has expired' });
    }

    const customChallenge = challenge.customChallenges.id(challengeId);
    if (!customChallenge) {
      return res.status(404).json({ success: false, message: 'Custom challenge not found' });
    }

    if (!customChallenge.visible) {
      return res.status(400).json({ success: false, message: 'This challenge is not available' });
    }

    let userChallenge = challenge.userChallenges.find(uc => uc.userId.toString() === userId.toString());
    if (!userChallenge) {
      return res.status(400).json({ success: false, message: 'You are not enrolled in this challenge series' });
    }

    if (!userChallenge.customChallengeProgress) {
      userChallenge.customChallengeProgress = [];
    }

    let progress = userChallenge.customChallengeProgress.find(p => p.challengeId.toString() === challengeId);
    if (!progress) {
      progress = {
        challengeId: new mongoose.Types.ObjectId(challengeId),
        attempts: 0,
        completed: false,
        startedAt: new Date(),
        hintsUsed: 0,
        hintsUnlocked: [],
        bitsAwarded: 0
      };
      userChallenge.customChallengeProgress.push(progress);
    }

    if (progress.completed) {
      return res.status(400).json({ success: false, message: 'You have already completed this challenge' });
    }

    if (customChallenge.maxAttempts && progress.attempts >= customChallenge.maxAttempts) {
      return res.status(400).json({ success: false, message: 'Maximum attempts reached', attemptsLeft: 0 });
    }

    progress.attempts += 1;

    // Determine verification method based on template type
    let isMatch = false;
    const templateType = customChallenge.templateType || 'passcode';
    
    if (templateType === 'passcode') {
      // Traditional passcode verification via bcrypt
      if (customChallenge.solutionHash) {
        isMatch = await bcrypt.compare(passcode.trim(), customChallenge.solutionHash);
      }
    } else {
      // Template-based verification: compare against generated answer
      if (progress.generatedContent?.expectedAnswer) {
        isMatch = templateEngine.verifyAnswer(
          passcode.trim(), 
          progress.generatedContent.expectedAnswer, 
          templateType
        );
      } else {
        // No generated content - this shouldn't happen if student started properly
        await challenge.save();
        return res.status(400).json({ 
          success: false, 
          message: 'Please start the challenge first to generate your unique content' 
        });
      }
    }

    if (!isMatch) {
      await challenge.save();
      const attemptsLeft = customChallenge.maxAttempts ? customChallenge.maxAttempts - progress.attempts : null;
      return res.status(400).json({
        success: false,
        message: 'Incorrect passcode',
        attemptsLeft
      });
    }

    progress.completed = true;
    progress.completedAt = new Date();

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // ADD: snapshot BEFORE (classroom-scoped)
    const scopedBefore = getScopedUserStats(user, classroomId, { create: true });
    const prevStats = {
      multiplier: scopedBefore.passive?.multiplier ?? 1,
      luck: scopedBefore.passive?.luck ?? 1,
      discount: scopedBefore.passive?.discount ?? 0,
      shield: scopedBefore.shieldCount ?? 0,
    };

    // existing: classroom-scoped target
    const scoped = getScopedUserStats(user, classroomId, { create: true });
    const passiveTarget = scoped.cs ? scoped.cs.passiveAttributes : (user.passiveAttributes ||= {});

    const customRewards = {
      bits: customChallenge.bits || 0,
      multiplier: customChallenge.multiplier || 1.0,
      luck: customChallenge.luck || 1.0,
      discount: customChallenge.discount || 0,
      shield: customChallenge.shield || false,
      applyPersonalMultiplier: customChallenge.applyPersonalMultiplier || false,
      applyGroupMultiplier: customChallenge.applyGroupMultiplier || false
    };

    // Apply hint penalty
    const hintsUsed = progress.hintsUsed || 0;
    const hintPenaltyPercent = customChallenge.hintPenaltyPercent ?? challenge.settings?.hintPenaltyPercent ?? 25;
    let baseBitsAfterPenalty = customRewards.bits;

    if (customChallenge.hintsEnabled && baseBitsAfterPenalty > 0 && hintsUsed > 0) {
      const totalPenalty = (hintPenaltyPercent * hintsUsed) / 100;
      const cappedPenalty = Math.min(totalPenalty, 0.8);
      baseBitsAfterPenalty = Math.round(baseBitsAfterPenalty * (1 - cappedPenalty));
    }

    // NEW: Apply personal/group multipliers if enabled
    let bitsAwarded = baseBitsAfterPenalty;
    let personalMult = 1;
    let groupMult = 1;
    let appliedPersonalMultiplier = false;
    let appliedGroupMultiplier = false;

    if (baseBitsAfterPenalty > 0) {
      if (customRewards.applyPersonalMultiplier) {
        personalMult = scoped.passive?.multiplier || 1;
        appliedPersonalMultiplier = true;
      }

      if (customRewards.applyGroupMultiplier) {
        groupMult = await getUserGroupMultiplier(user._id, classroomId);
        appliedGroupMultiplier = true;
      }

      // ADDITIVE multiplier logic
      let finalMultiplier = 1;
      if (customRewards.applyPersonalMultiplier) {
        finalMultiplier += (personalMult - 1);
      }
      if (customRewards.applyGroupMultiplier) {
        finalMultiplier += (groupMult - 1);
      }

      bitsAwarded = Math.round(baseBitsAfterPenalty * finalMultiplier);
    }

    // Award bits
    if (bitsAwarded > 0) {
      const classroomBalance = user.classroomBalances.find(cb => cb.classroom.toString() === classroomId);
      if (classroomBalance) {
        classroomBalance.balance = (classroomBalance.balance || 0) + bitsAwarded;
      } else {
        user.classroomBalances.push({ classroom: classroomId, balance: bitsAwarded });
      }

      let transactionDescription = `Completed Custom Challenge: ${customChallenge.title}`;
      const totalMultiplier = (appliedPersonalMultiplier || appliedGroupMultiplier) 
        ? (1 + (appliedPersonalMultiplier ? personalMult - 1 : 0) + (appliedGroupMultiplier ? groupMult - 1 : 0))
        : 1;

      if (totalMultiplier > 1) {
        transactionDescription += ` (${totalMultiplier.toFixed(2)}x multiplier)`;
      }

      user.transactions = user.transactions || [];
      user.transactions.push({
        amount: bitsAwarded,
        description: transactionDescription,
        type: 'challenge_completion',
        challengeName: customChallenge.title,
        classroom: classroomId,
        assignedBy: challenge.createdBy,
        calculation: {
          baseAmount: customRewards.bits,
          hintsUsed: hintsUsed > 0 ? hintsUsed : undefined,
          penaltyPercent: hintsUsed > 0 ? hintPenaltyPercent : undefined,
          bitsAfterPenalty: baseBitsAfterPenalty !== customRewards.bits ? baseBitsAfterPenalty : undefined,
          personalMultiplier: appliedPersonalMultiplier ? personalMult : undefined,
          groupMultiplier: appliedGroupMultiplier ? groupMult : undefined,
          totalMultiplier: totalMultiplier > 1 ? totalMultiplier : undefined,
          finalAmount: bitsAwarded
        },
        createdAt: new Date()
      });

      progress.bitsAwarded = bitsAwarded;
      userChallenge.bitsAwarded = (userChallenge.bitsAwarded || 0) + bitsAwarded;
    }

    // Apply stat rewards (CHANGED: write to classroom-scoped entry)
    const rewardsEarned = { 
      bits: bitsAwarded, 
      baseBits: customRewards.bits,
      bitsAfterPenalty: baseBitsAfterPenalty,
      multiplier: 0, 
      luck: 1.0, 
      discount: 0, 
      shield: false,
      personalMultiplier: personalMult,
      groupMultiplier: groupMult,
      totalMultiplier: (appliedPersonalMultiplier || appliedGroupMultiplier) 
        ? (1 + (appliedPersonalMultiplier ? personalMult - 1 : 0) + (appliedGroupMultiplier ? groupMult - 1 : 0))
        : 1,
      appliedPersonalMultiplier,
      appliedGroupMultiplier
    };

    if (customRewards.multiplier > 1.0) {
      const multiplierIncrease = customRewards.multiplier - 1.0;
      passiveTarget.multiplier =
        Math.round(((passiveTarget.multiplier || 1.0) + multiplierIncrease) * 100) / 100;
      rewardsEarned.multiplier = multiplierIncrease;
    }

    if (customRewards.luck > 1.0) {
      const luckIncrease = customRewards.luck - 1.0;
      passiveTarget.luck =
        Math.round(((passiveTarget.luck || 1.0) + luckIncrease) * 10) / 10;
      rewardsEarned.luck = customRewards.luck;
    }

    if (customRewards.discount > 0) {
      passiveTarget.discount =
        Math.min(100, (passiveTarget.discount || 0) + customRewards.discount);
      rewardsEarned.discount = customRewards.discount;
    }

    if (customRewards.shield) {
      if (scoped.cs) {
        scoped.cs.shieldCount = (scoped.cs.shieldCount || 0) + 1;
        scoped.cs.shieldActive = true;
      } else {
        user.shieldActive = true;
        user.shieldCount = (user.shieldCount || 0) + 1;
      }
      rewardsEarned.shield = true;
    }

    await user.save();
    await challenge.save();

    // ADD: snapshot AFTER + emit legacy-style stat delta notification/log
    try {
      const scopedAfter = getScopedUserStats(user, classroomId, { create: true });
      const currStats = {
        multiplier: scopedAfter.passive?.multiplier ?? 1,
        luck: scopedAfter.passive?.luck ?? 1,
        discount: scopedAfter.passive?.discount ?? 0,
        shield: scopedAfter.shieldCount ?? 0,
      };

      const parts = [];
      const fmt1 = (n) => Number(Number(n).toFixed(1));
      if (String(prevStats.multiplier) !== String(currStats.multiplier)) {
        parts.push(`multiplier: ${fmt1(prevStats.multiplier)} → ${fmt1(currStats.multiplier)}`);
      }
      if (String(prevStats.luck) !== String(currStats.luck)) {
        parts.push(`luck: ${fmt1(prevStats.luck)} → ${fmt1(currStats.luck)}`);
      }
      if (String(prevStats.discount) !== String(currStats.discount)) {
        parts.push(`discount: ${Math.round(prevStats.discount)} → ${Math.round(currStats.discount)}`);
      }
      if (String(prevStats.shield) !== String(currStats.shield)) {
        parts.push(`shield: ${parseInt(prevStats.shield, 10) || 0} → ${parseInt(currStats.shield, 10) || 0}`);
      }

      if (parts.length) {
        const io = getIO();
        const title = customChallenge?.title || 'Custom Challenge';
        const effectsText = `Earned stat boosts from custom challenge ${title}: ${parts.join('; ')}.`;

        await logStatChanges({
          io,
          classroomId,
          user,
          actionBy: user._id,
          prevStats,
          currStats,
          context: `Custom Challenge - ${title}`,
          details: { effectsText },
          forceLog: true,
        });
      }
    } catch (e) {
      console.warn('[custom challenge] failed to log stat deltas:', e);
    }

    // Award XP
    await awardCustomChallengeXP({
      userId,
      classroomId,
      rewards: rewardsEarned,
      challengeName: customChallenge.title
    });

    // Check if all challenges completed
    const totalCustomChallenges = challenge.customChallenges.length;
    const completedCustomChallenges = userChallenge.customChallengeProgress.filter(p => p.completed).length;
    const allCompleted = completedCustomChallenges >= totalCustomChallenges;

    res.json({
      success: true,
      message: 'Challenge completed!',
      rewards: rewardsEarned,
      allCompleted,
      progress: {
        completed: completedCustomChallenges,
        total: totalCustomChallenges
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to verify challenge' });
  }
});

// Start a custom challenge (mark as in-progress and generate content for templates)
router.post('/:classroomId/custom/:challengeId/start', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId, challengeId } = req.params;
    const userId = req.user._id;

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge series not found' });
    }

    const customChallenge = challenge.customChallenges.id(challengeId);
    if (!customChallenge) {
      return res.status(404).json({ success: false, message: 'Custom challenge not found' });
    }

    let userChallenge = challenge.userChallenges.find(uc => uc.userId.toString() === userId.toString());
    if (!userChallenge) {
      return res.status(400).json({ success: false, message: 'You are not enrolled in this challenge series' });
    }

    if (!userChallenge.customChallengeProgress) {
      userChallenge.customChallengeProgress = [];
    }

    let progress = userChallenge.customChallengeProgress.find(p => p.challengeId.toString() === challengeId);
    let generatedContent = null;
    
    if (!progress) {
      progress = {
        challengeId: new mongoose.Types.ObjectId(challengeId),
        attempts: 0,
        completed: false,
        startedAt: new Date(),
        hintsUsed: 0,
        hintsUnlocked: [],
        bitsAwarded: 0
      };
      
      // Generate unique content for template-based challenges
      const templateType = customChallenge.templateType || 'passcode';
      if (templateType !== 'passcode') {
        try {
          generatedContent = await templateEngine.generateForStudent(
            templateType,
            customChallenge.templateConfig || {},
            userId.toString(),
            challengeId.toString()
          );
          progress.generatedContent = generatedContent;
        } catch (genError) {
          return res.status(500).json({ 
            success: false, 
            message: 'Failed to generate challenge content' 
          });
        }
      }
      
      userChallenge.customChallengeProgress.push(progress);
      await challenge.save();
    } else {
      // Challenge already started - check if we need to generate content
      const templateType = customChallenge.templateType || 'passcode';
      
      if (templateType !== 'passcode' && !progress.generatedContent?.expectedAnswer) {
        // Template challenge started before content generation was implemented
        // Generate content now
        try {
          generatedContent = await templateEngine.generateForStudent(
            templateType,
            customChallenge.templateConfig || {},
            userId.toString(),
            challengeId.toString()
          );
          progress.generatedContent = generatedContent;
          await challenge.save();
        } catch (genError) {
          return res.status(500).json({ 
            success: false, 
            message: 'Failed to generate challenge content' 
          });
        }
      } else {
        generatedContent = progress.generatedContent;
      }
    }

    // Prepare response based on challenge type
    const templateType = customChallenge.templateType || 'passcode';
    const responseData = {
      success: true,
      message: 'Challenge started',
      startedAt: progress.startedAt,
      templateType
    };

    // Include display data for template challenges (but NEVER the expected answer)
    if (templateType !== 'passcode' && generatedContent) {
      responseData.displayData = generatedContent.displayData;
      responseData.metadata = generatedContent.metadata;
    }

    res.json(responseData);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to start challenge' });
  }
});

// Start a specific step in a multi-step challenge
router.post('/:classroomId/custom/:challengeId/step/:stepId/start', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId, challengeId, stepId } = req.params;
    const userId = req.user._id;

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge series not found' });
    }

    const customChallenge = challenge.customChallenges.id(challengeId);
    if (!customChallenge) {
      return res.status(404).json({ success: false, message: 'Custom challenge not found' });
    }

    if (!customChallenge.isMultiStep) {
      return res.status(400).json({ success: false, message: 'This challenge does not have multiple steps' });
    }

    const step = customChallenge.steps.id(stepId);
    if (!step) {
      return res.status(404).json({ success: false, message: 'Step not found' });
    }

    let userChallenge = challenge.userChallenges.find(uc => uc.userId.toString() === userId.toString());
    if (!userChallenge) {
      return res.status(400).json({ success: false, message: 'You are not enrolled in this challenge series' });
    }

    if (!userChallenge.customChallengeProgress) {
      userChallenge.customChallengeProgress = [];
    }

    let progress = userChallenge.customChallengeProgress.find(p => p.challengeId.toString() === challengeId);
    if (!progress) {
      progress = {
        challengeId: new mongoose.Types.ObjectId(challengeId),
        attempts: 0,
        completed: false,
        startedAt: new Date(),
        hintsUsed: 0,
        hintsUnlocked: [],
        bitsAwarded: 0,
        stepProgress: [],
        currentStepId: null,
        completionBonusAwarded: false
      };
      userChallenge.customChallengeProgress.push(progress);
    }

    if (!progress.stepProgress) {
      progress.stepProgress = [];
    }

    const completedStepIds = progress.stepProgress
      .filter(sp => sp.completed)
      .map(sp => sp.stepId.toString());

    const prereqsMet = (step.prerequisites || []).every(prereqId => 
      completedStepIds.includes(prereqId.toString())
    );

    if (!prereqsMet) {
      return res.status(400).json({ 
        success: false, 
        message: 'Prerequisites not met. Complete the required steps first.' 
      });
    }

    let stepProgress = progress.stepProgress.find(sp => sp.stepId.toString() === stepId);
    let generatedContent = null;

    if (!stepProgress) {
      stepProgress = {
        stepId: new mongoose.Types.ObjectId(stepId),
        completed: false,
        startedAt: new Date(),
        attempts: 0,
        hintsUsed: 0,
        hintsUnlocked: [],
        bitsAwarded: 0
      };

      const templateType = step.templateType || 'passcode';
      if (templateType !== 'passcode') {
        try {
          generatedContent = await templateEngine.generateForStudent(
            templateType,
            step.templateConfig || {},
            userId.toString(),
            `${challengeId}-${stepId}`
          );
          stepProgress.generatedContent = generatedContent;
        } catch (genError) {
          return res.status(500).json({ 
            success: false, 
            message: 'Failed to generate step content' 
          });
        }
      }

      progress.stepProgress.push(stepProgress);
      progress.currentStepId = new mongoose.Types.ObjectId(stepId);
      // Ensure Mongoose tracks nested userChallenges changes
      challenge.markModified('userChallenges');
      await challenge.save();
    } else {
      const templateType = step.templateType || 'passcode';
      if (templateType !== 'passcode' && !stepProgress.generatedContent?.expectedAnswer) {
        try {
          generatedContent = await templateEngine.generateForStudent(
            templateType,
            step.templateConfig || {},
            userId.toString(),
            `${challengeId}-${stepId}`
          );
          stepProgress.generatedContent = generatedContent;
          challenge.markModified('userChallenges');
          await challenge.save();
        } catch (genError) {
          return res.status(500).json({ 
            success: false, 
            message: 'Failed to generate step content' 
          });
        }
      } else {
        generatedContent = stepProgress.generatedContent;
      }
    }

    const templateType = step.templateType || 'passcode';

    // Ensure we persist any mutations to nested userChallenges/stepProgress before responding
    challenge.markModified('userChallenges');
    await challenge.save();

    const responseData = {
      success: true,
      message: 'Step started',
      startedAt: stepProgress.startedAt,
      templateType,
      step: {
        _id: step._id,
        title: step.title,
        description: step.description,
        bits: step.bits,
        multiplier: step.multiplier || 1.0,
        luck: step.luck || 1.0,
        discount: step.discount || 0,
        shield: step.shield || false,
        hintsEnabled: step.hintsEnabled,
        hintsCount: (step.hints || []).length,
        maxAttempts: step.maxAttempts
      }
    };

    if (templateType !== 'passcode' && generatedContent) {
      responseData.displayData = generatedContent.displayData;
      responseData.metadata = generatedContent.metadata;
    }

    res.json(responseData);
  } catch (error) {
    console.error('[custom.js] Start step error:', error);
    res.status(500).json({ success: false, message: 'Failed to start step' });
  }
});

// Verify a step solution in a multi-step challenge
router.post('/:classroomId/custom/:challengeId/step/:stepId/verify', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId, challengeId, stepId } = req.params;
    const { passcode } = req.body;
    const userId = req.user._id;

    if (!passcode || !passcode.trim()) {
      return res.status(400).json({ success: false, message: 'Passcode is required' });
    }

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge series not found' });
    }

    if (!challenge.isActive) {
      return res.status(400).json({ success: false, message: 'Challenge series is not active' });
    }

    const customChallenge = challenge.customChallenges.id(challengeId);
    if (!customChallenge) {
      return res.status(404).json({ success: false, message: 'Custom challenge not found' });
    }

    if (!customChallenge.isMultiStep) {
      return res.status(400).json({ success: false, message: 'This challenge does not have multiple steps' });
    }

    const step = customChallenge.steps.id(stepId);
    if (!step) {
      return res.status(404).json({ success: false, message: 'Step not found' });
    }

    let userChallenge = challenge.userChallenges.find(uc => uc.userId.toString() === userId.toString());
    if (!userChallenge) {
      return res.status(400).json({ success: false, message: 'You are not enrolled in this challenge series' });
    }

    let progress = userChallenge.customChallengeProgress?.find(p => p.challengeId.toString() === challengeId);
    if (!progress) {
      return res.status(400).json({ success: false, message: 'Please start the challenge first' });
    }

    let stepProgress = progress.stepProgress?.find(sp => sp.stepId.toString() === stepId);
    if (!stepProgress) {
      return res.status(400).json({ success: false, message: 'Please start this step first' });
    }

    if (stepProgress.completed) {
      return res.status(400).json({ success: false, message: 'You have already completed this step' });
    }

    if (step.maxAttempts && stepProgress.attempts >= step.maxAttempts) {
      return res.status(400).json({ success: false, message: 'Maximum attempts reached', attemptsLeft: 0 });
    }

    stepProgress.attempts += 1;

    let isMatch = false;
    const templateType = step.templateType || 'passcode';

    if (templateType === 'passcode') {
      if (step.solutionHash) {
        isMatch = await bcrypt.compare(passcode.trim(), step.solutionHash);
      }
    } else {
      if (stepProgress.generatedContent?.expectedAnswer) {
        isMatch = templateEngine.verifyAnswer(
          passcode.trim(),
          stepProgress.generatedContent.expectedAnswer,
          templateType
        );
      } else {
        await challenge.save();
        return res.status(400).json({ 
          success: false, 
          message: 'Please start this step first to generate your unique content' 
        });
      }
    }

    if (!isMatch) {
      await challenge.save();
      const attemptsLeft = step.maxAttempts ? step.maxAttempts - stepProgress.attempts : null;
      return res.status(400).json({
        success: false,
        message: 'Incorrect passcode',
        attemptsLeft
      });
    }

    stepProgress.completed = true;
    stepProgress.completedAt = new Date();

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const hintsUsed = stepProgress.hintsUsed || 0;
    const hintPenaltyPercent = step.hintPenaltyPercent ?? challenge.settings?.hintPenaltyPercent ?? 25;
    let baseBitsAfterPenalty = step.bits || 0;

    if (step.hintsEnabled && baseBitsAfterPenalty > 0 && hintsUsed > 0) {
      const totalPenalty = (hintPenaltyPercent * hintsUsed) / 100;
      const cappedPenalty = Math.min(totalPenalty, 0.8);
      baseBitsAfterPenalty = Math.round(baseBitsAfterPenalty * (1 - cappedPenalty));
    }

    let bitsAwarded = baseBitsAfterPenalty;
    let personalMult = 1;
    let groupMult = 1;
    let appliedPersonalMultiplier = false;
    let appliedGroupMultiplier = false;

    const scoped = getScopedUserStats(user, classroomId, { create: true });

    if (baseBitsAfterPenalty > 0) {
      if (step.applyPersonalMultiplier) {
        personalMult = scoped.passive?.multiplier || 1;
        appliedPersonalMultiplier = true;
      }

      if (step.applyGroupMultiplier) {
        groupMult = await getUserGroupMultiplier(user._id, classroomId);
        appliedGroupMultiplier = true;
      }

      let finalMultiplier = 1;
      if (step.applyPersonalMultiplier) {
        finalMultiplier += (personalMult - 1);
      }
      if (step.applyGroupMultiplier) {
        finalMultiplier += (groupMult - 1);
      }

      bitsAwarded = Math.round(baseBitsAfterPenalty * finalMultiplier);
    }

    if (bitsAwarded > 0) {
      const classroomBalance = user.classroomBalances.find(cb => cb.classroom.toString() === classroomId);
      if (classroomBalance) {
        classroomBalance.balance = (classroomBalance.balance || 0) + bitsAwarded;
      } else {
        user.classroomBalances.push({ classroom: classroomId, balance: bitsAwarded });
      }

      const totalMultiplier = (appliedPersonalMultiplier || appliedGroupMultiplier) 
        ? (1 + (appliedPersonalMultiplier ? personalMult - 1 : 0) + (appliedGroupMultiplier ? groupMult - 1 : 0))
        : 1;

      let transactionDescription = `Completed Step: ${step.title} in ${customChallenge.title}`;
      if (totalMultiplier > 1) {
        transactionDescription += ` (${totalMultiplier.toFixed(2)}x multiplier)`;
      }

      user.transactions = user.transactions || [];
      user.transactions.push({
        amount: bitsAwarded,
        description: transactionDescription,
        type: 'challenge_completion',
        challengeName: `${customChallenge.title} - ${step.title}`,
        classroom: classroomId,
        assignedBy: challenge.createdBy,
        calculation: {
          baseAmount: step.bits || 0,
          hintsUsed: hintsUsed > 0 ? hintsUsed : undefined,
          penaltyPercent: hintsUsed > 0 ? hintPenaltyPercent : undefined,
          bitsAfterPenalty: baseBitsAfterPenalty !== (step.bits || 0) ? baseBitsAfterPenalty : undefined,
          personalMultiplier: appliedPersonalMultiplier ? personalMult : undefined,
          groupMultiplier: appliedGroupMultiplier ? groupMult : undefined,
          totalMultiplier: totalMultiplier > 1 ? totalMultiplier : undefined,
          finalAmount: bitsAwarded
        },
        createdAt: new Date()
      });

      stepProgress.bitsAwarded = bitsAwarded;
      progress.bitsAwarded = (progress.bitsAwarded || 0) + bitsAwarded;
    }

    const passiveTarget = scoped.cs ? scoped.cs.passiveAttributes : (user.passiveAttributes ||= {});

    if (stepProgress.multiplierAwarded === undefined) stepProgress.multiplierAwarded = 0;
    if (stepProgress.luckAwarded === undefined) stepProgress.luckAwarded = 0;
    if (stepProgress.discountAwarded === undefined) stepProgress.discountAwarded = 0;
    if (stepProgress.shieldAwarded === undefined) stepProgress.shieldAwarded = false;

    if (step.multiplier > 1.0) {
      const multiplierIncrease = step.multiplier - 1.0;
      passiveTarget.multiplier = Math.round(((passiveTarget.multiplier || 1.0) + multiplierIncrease) * 100) / 100;
      stepProgress.multiplierAwarded = multiplierIncrease;
    }

    if (step.luck > 1.0) {
      const luckIncrease = step.luck - 1.0;
      passiveTarget.luck = Math.round(((passiveTarget.luck || 1.0) + luckIncrease) * 10) / 10;
      stepProgress.luckAwarded = luckIncrease;
    }

    if (step.discount > 0) {
      passiveTarget.discount = Math.min(100, (passiveTarget.discount || 0) + step.discount);
      stepProgress.discountAwarded = step.discount;
    }

    if (step.shield && !passiveTarget.shield) {
      passiveTarget.shield = true;
      stepProgress.shieldAwarded = true;
    }

    const requiredSteps = customChallenge.steps.filter(s => s.isRequired);
    const completedRequiredSteps = requiredSteps.filter(s => 
      progress.stepProgress.some(sp => sp.stepId.toString() === s._id.toString() && sp.completed)
    );

    const allRequiredComplete = completedRequiredSteps.length === requiredSteps.length;
    let completionBonusAwarded = 0;

    if (allRequiredComplete && !progress.completionBonusAwarded && customChallenge.completionBonus > 0) {
      completionBonusAwarded = customChallenge.completionBonus;
      
      const classroomBalance = user.classroomBalances.find(cb => cb.classroom.toString() === classroomId);
      if (classroomBalance) {
        classroomBalance.balance = (classroomBalance.balance || 0) + completionBonusAwarded;
      } else {
        user.classroomBalances.push({ classroom: classroomId, balance: completionBonusAwarded });
      }

      user.transactions.push({
        amount: completionBonusAwarded,
        description: `Completion Bonus: ${customChallenge.title}`,
        type: 'challenge_completion',
        challengeName: customChallenge.title,
        classroom: classroomId,
        assignedBy: challenge.createdBy,
        createdAt: new Date()
      });

      progress.completionBonusAwarded = true;
      progress.completed = true;
      progress.completedAt = new Date();
      progress.bitsAwarded = (progress.bitsAwarded || 0) + completionBonusAwarded;
    }

    await user.save();
    await challenge.save();

    const totalSteps = customChallenge.steps.length;
    const completedSteps = progress.stepProgress.filter(sp => sp.completed).length;

    const rewardsEarned = {
      bits: bitsAwarded + (allRequiredComplete ? completionBonusAwarded : 0),
      baseBits: step.bits || 0,
      bitsAfterPenalty: baseBitsAfterPenalty,
      multiplier: stepProgress.multiplierAwarded || 0,
      luck: stepProgress.luckAwarded || 0,
      discount: stepProgress.discountAwarded || 0,
      shield: stepProgress.shieldAwarded || false,
      personalMultiplier: appliedPersonalMultiplier ? personalMult : undefined,
      groupMultiplier: appliedGroupMultiplier ? groupMult : undefined,
      totalMultiplier: (appliedPersonalMultiplier || appliedGroupMultiplier) 
        ? (1 + (appliedPersonalMultiplier ? personalMult - 1 : 0) + (appliedGroupMultiplier ? groupMult - 1 : 0))
        : 1,
      appliedPersonalMultiplier,
      appliedGroupMultiplier
    };

    res.json({
      success: true,
      message: allRequiredComplete ? 'Challenge completed!' : 'Step completed!',
      bitsAwarded,
      completionBonusAwarded,
      allRequiredComplete,
      rewards: rewardsEarned,
      progress: {
        completedSteps,
        totalSteps,
        requiredComplete: completedRequiredSteps.length,
        requiredTotal: requiredSteps.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to verify step' });
  }
});

// Unlock a hint for a step in multi-step challenge
router.post('/:classroomId/custom/:challengeId/step/:stepId/hint', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId, challengeId, stepId } = req.params;
    const userId = req.user._id;

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge series not found' });
    }

    const customChallenge = challenge.customChallenges.id(challengeId);
    if (!customChallenge) {
      return res.status(404).json({ success: false, message: 'Custom challenge not found' });
    }

    if (!customChallenge.isMultiStep) {
      return res.status(400).json({ success: false, message: 'This challenge does not have multiple steps' });
    }

    const step = customChallenge.steps.id(stepId);
    if (!step) {
      return res.status(404).json({ success: false, message: 'Step not found' });
    }

    if (!step.hintsEnabled) {
      return res.status(400).json({ success: false, message: 'Hints are not enabled for this step' });
    }

    let userChallenge = challenge.userChallenges.find(uc => uc.userId.toString() === userId.toString());
    if (!userChallenge) {
      return res.status(400).json({ success: false, message: 'You are not enrolled in this challenge series' });
    }

    let progress = userChallenge.customChallengeProgress?.find(p => p.challengeId.toString() === challengeId);
    if (!progress) {
      return res.status(400).json({ success: false, message: 'Please start the challenge first' });
    }

    let stepProgress = progress.stepProgress?.find(sp => sp.stepId.toString() === stepId);
    if (!stepProgress) {
      return res.status(400).json({ success: false, message: 'Please start this step first' });
    }

    if (stepProgress.completed) {
      return res.status(400).json({ success: false, message: 'Step already completed' });
    }

    const availableHints = step.hints || [];
    const nextHintIndex = stepProgress.hintsUsed || 0;

    if (nextHintIndex >= availableHints.length) {
      return res.status(400).json({ success: false, message: 'No more hints available' });
    }

    const hint = availableHints[nextHintIndex];
    stepProgress.hintsUsed = nextHintIndex + 1;
    if (!stepProgress.hintsUnlocked) stepProgress.hintsUnlocked = [];
    stepProgress.hintsUnlocked.push(hint);

    await challenge.save();

    res.json({
      success: true,
      hint,
      hintsUsed: stepProgress.hintsUsed,
      hintsRemaining: availableHints.length - stepProgress.hintsUsed
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to unlock hint' });
  }
});

// Unlock a hint for custom challenge
router.post('/:classroomId/custom/:challengeId/hint', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId, challengeId } = req.params;
    const userId = req.user._id;

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge series not found' });
    }

    const customChallenge = challenge.customChallenges.id(challengeId);
    if (!customChallenge) {
      return res.status(404).json({ success: false, message: 'Custom challenge not found' });
    }

    if (!customChallenge.hintsEnabled) {
      return res.status(400).json({ success: false, message: 'Hints are not enabled for this challenge' });
    }

    let userChallenge = challenge.userChallenges.find(uc => uc.userId.toString() === userId.toString());
    if (!userChallenge) {
      return res.status(400).json({ success: false, message: 'You are not enrolled in this challenge series' });
    }

    if (!userChallenge.customChallengeProgress) {
      userChallenge.customChallengeProgress = [];
    }

    let progress = userChallenge.customChallengeProgress.find(p => p.challengeId.toString() === challengeId);
    if (!progress) {
      progress = {
        challengeId: new mongoose.Types.ObjectId(challengeId),
        attempts: 0,
        completed: false,
        startedAt: new Date(),
        hintsUsed: 0,
        hintsUnlocked: [],
        bitsAwarded: 0
      };
      userChallenge.customChallengeProgress.push(progress);
    }

    if (progress.completed) {
      return res.status(400).json({ success: false, message: 'Challenge already completed' });
    }

    const availableHints = customChallenge.hints || [];
    const nextHintIndex = progress.hintsUsed || 0;

    if (nextHintIndex >= availableHints.length) {
      return res.status(400).json({ success: false, message: 'No more hints available' });
    }

    const hint = availableHints[nextHintIndex];
    progress.hintsUsed = nextHintIndex + 1;
    progress.hintsUnlocked.push(hint);

    await challenge.save();

    res.json({
      success: true,
      hint,
      hintsUsed: progress.hintsUsed,
      hintsRemaining: availableHints.length - progress.hintsUsed
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to unlock hint' });
  }
});

// Get custom challenges for a classroom (public data for students)
router.get('/:classroomId/custom', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const userId = req.user._id;
    const isTeacher = req.user.role === 'teacher';

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge series not found' });
    }

    const userChallenge = challenge.userChallenges.find(uc => uc.userId.toString() === userId.toString());

    const customChallenges = (challenge.customChallenges || [])
      .filter(cc => isTeacher || cc.visible)
      .sort((a, b) => a.order - b.order)
      .map(cc => {
        const progress = userChallenge?.customChallengeProgress?.find(p => p.challengeId.toString() === cc._id.toString());
        const templateType = cc.templateType || 'passcode';

        const data = {
          _id: cc._id,
          order: cc.order,
          title: cc.title,
          description: cc.description,
          externalUrl: cc.externalUrl,
          templateType,
          bits: cc.bits,
          multiplier: cc.multiplier,
          luck: cc.luck,
          discount: cc.discount,
          shield: cc.shield,
          // ADD: Include multiplier application settings
          applyPersonalMultiplier: cc.applyPersonalMultiplier || false,
          applyGroupMultiplier: cc.applyGroupMultiplier || false,
          visible: cc.visible,
          hintsEnabled: cc.hintsEnabled,
          hintsCount: (cc.hints || []).length,
          hints: isTeacher ? (cc.hints || []) : undefined,
          solution: isTeacher ? (cc.solutionPlaintext || '') : undefined,
          hintPenaltyPercent: cc.hintPenaltyPercent ?? challenge.settings?.hintPenaltyPercent ?? 25,
          maxAttempts: cc.maxAttempts,
          dueDateEnabled: cc.dueDateEnabled,
          dueDate: cc.dueDate,
          attachments: (cc.attachments || []).map(a => ({
            _id: a._id,
            originalName: a.originalName,
            size: a.size
          })),
          isMultiStep: cc.isMultiStep || false,
          completionBonus: cc.completionBonus || 0,
          progress: progress ? {
            attempts: progress.attempts,
            completed: progress.completed,
            completedAt: progress.completedAt,
            startedAt: progress.startedAt,
            hintsUsed: progress.hintsUsed,
            hintsUnlocked: progress.hintsUnlocked,
            completionBonusAwarded: progress.completionBonusAwarded,
            currentStepId: progress.currentStepId
          } : null
        };

        if (cc.isMultiStep && cc.steps && cc.steps.length > 0) {
          const completedStepIds = progress?.stepProgress?.filter(sp => sp.completed).map(sp => sp.stepId.toString()) || [];

          data.steps = cc.steps.map(step => {
            const stepProgress = progress?.stepProgress?.find(sp => sp.stepId.toString() === step._id.toString());
            
            const prereqsMet = (step.prerequisites || []).every(prereqId => 
              completedStepIds.includes(prereqId.toString())
            );

            const stepData = {
              _id: step._id,
              title: step.title,
              description: step.description,
              templateType: step.templateType || 'passcode',
              bits: step.bits,
              multiplier: step.multiplier || 1.0,
              luck: step.luck || 1.0,
              discount: step.discount || 0,
              shield: step.shield || false,
              hintsEnabled: step.hintsEnabled,
              hintsCount: (step.hints || []).length,
              maxAttempts: step.maxAttempts,
              prerequisites: step.prerequisites,
              isRequired: step.isRequired,
              applyPersonalMultiplier: step.applyPersonalMultiplier || false,
              applyGroupMultiplier: step.applyGroupMultiplier || false,
              isUnlocked: prereqsMet,
              progress: stepProgress ? {
                attempts: stepProgress.attempts,
                completed: stepProgress.completed,
                completedAt: stepProgress.completedAt,
                startedAt: stepProgress.startedAt,
                hintsUsed: stepProgress.hintsUsed,
                hintsUnlocked: stepProgress.hintsUnlocked
              } : null
            };

            if (!isTeacher && step.templateType !== 'passcode' && stepProgress?.generatedContent) {
              stepData.generatedDisplayData = stepProgress.generatedContent.displayData;
              stepData.generatedMetadata = stepProgress.generatedContent.metadata;
            }

            if (isTeacher) {
              stepData.hints = step.hints || [];
              stepData.solution = step.solutionPlaintext || '';
              stepData.templateConfig = step.templateConfig;
              stepData.hintPenaltyPercent = step.hintPenaltyPercent;
            }

            return stepData;
          });

          data.totalBits = cc.steps.reduce((sum, s) => sum + (s.bits || 0), 0) + (cc.completionBonus || 0);
          data.requiredStepsCount = cc.steps.filter(s => s.isRequired).length;
          
          if (progress?.stepProgress) {
            data.completedStepsCount = progress.stepProgress.filter(sp => sp.completed).length;
          }
        }

        if (!isTeacher && !cc.isMultiStep && templateType !== 'passcode' && progress?.generatedContent) {
          data.generatedDisplayData = progress.generatedContent.displayData;
          data.generatedMetadata = progress.generatedContent.metadata;
        }

        if (isTeacher) {
          data.hasSolution = templateType === 'passcode';
          data.templateConfig = cc.templateConfig;
          
          const templateMeta = templateEngine.getTemplateMetadata(templateType);
          if (templateMeta) {
            data.templateName = templateMeta.name;
            data.templateIsSecure = templateMeta.isSecure;
          }
        }

        return data;
      });

    res.json({
      success: true,
      customChallenges,
      seriesType: challenge.seriesType
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch custom challenges' });
  }
});

// Get solution for a custom challenge (teacher only)
router.get('/:classroomId/custom/:challengeId/solution', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId, challengeId } = req.params;

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge series not found' });
    }

    if (challenge.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const customChallenge = challenge.customChallenges.id(challengeId);
    if (!customChallenge) {
      return res.status(404).json({ success: false, message: 'Custom challenge not found' });
    }

    // Note: We cannot reverse a bcrypt hash, so we just confirm it exists
    res.json({
      success: true,
      message: 'Solution is stored as a secure hash. To change it, update the challenge with a new solution.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch solution' });
  }
});

// Upload attachment to a custom challenge
router.post('/:classroomId/custom/:challengeId/attachment', ensureAuthenticated, ensureTeacher, upload.challengeAttachment.single('file'), async (req, res) => {
  try {
    const { classroomId, challengeId } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ success: false, message: 'Challenge series not found' });
    }

    if (challenge.createdBy.toString() !== req.user._id.toString()) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(403).json({ success: false, message: 'Only the challenge creator can add attachments' });
    }

    const customChallenge = challenge.customChallenges.id(challengeId);
    if (!customChallenge) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(404).json({ success: false, message: 'Custom challenge not found' });
    }

    if (!customChallenge.attachments) customChallenge.attachments = [];

    if (customChallenge.attachments.length >= 5) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ success: false, message: 'Maximum 5 attachments allowed per challenge' });
    }

    const attachment = {
      _id: new mongoose.Types.ObjectId(),
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      path: req.file.path,
      size: req.file.size
    };

    customChallenge.attachments.push(attachment);
    customChallenge.updatedAt = new Date();
    await challenge.save();

    res.json({
      success: true,
      message: 'Attachment uploaded',
      attachment: {
        _id: attachment._id,
        originalName: attachment.originalName,
        size: attachment.size
      }
    });
  } catch (error) {
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ success: false, message: 'Failed to upload attachment' });
  }
});

// Delete attachment from a custom challenge
router.delete('/:classroomId/custom/:challengeId/attachment/:attachmentId', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId, challengeId, attachmentId } = req.params;

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge series not found' });
    }

    if (challenge.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the challenge creator can delete attachments' });
    }

    const customChallenge = challenge.customChallenges.id(challengeId);
    if (!customChallenge) {
      return res.status(404).json({ success: false, message: 'Custom challenge not found' });
    }

    const attachment = customChallenge.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }

    try {
      await fs.unlink(attachment.path);
    } catch {
      // File may not exist, continue
    }

    customChallenge.attachments.pull(attachmentId);
    customChallenge.updatedAt = new Date();
    await challenge.save();

    res.json({ success: true, message: 'Attachment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete attachment' });
  }
});

// Download attachment from a custom challenge
router.get('/:classroomId/custom/:challengeId/attachment/:attachmentId', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId, challengeId, attachmentId } = req.params;

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge series not found' });
    }

    const customChallenge = challenge.customChallenges.id(challengeId);
    if (!customChallenge) {
      return res.status(404).json({ success: false, message: 'Custom challenge not found' });
    }

    const attachment = customChallenge.attachments.id(attachmentId);
    if (!attachment) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }

    const filePath = path.resolve(attachment.path);
    res.download(filePath, attachment.originalName);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to download attachment' });
  }
});

// Download personalized challenge file (for hidden-message template)
router.get('/:classroomId/custom/:challengeId/download-personalized', ensureAuthenticated, async (req, res) => {
  try {
    const { classroomId, challengeId } = req.params;
    const userId = req.user._id;

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge series not found' });
    }

    const customChallenge = challenge.customChallenges.id(challengeId);
    if (!customChallenge) {
      return res.status(404).json({ success: false, message: 'Custom challenge not found' });
    }

    // Only for hidden-message template type
    if (customChallenge.templateType !== 'hidden-message') {
      return res.status(400).json({ success: false, message: 'This challenge does not support personalized file downloads' });
    }

    // Get the student's progress
    const userChallenge = challenge.userChallenges.find(uc => uc.userId.toString() === userId.toString());
    if (!userChallenge) {
      return res.status(404).json({ success: false, message: 'You have not started this challenge series' });
    }

    const progress = userChallenge.customChallengeProgress.find(p => p.challengeId.toString() === challengeId);
    if (!progress || !progress.generatedContent) {
      return res.status(404).json({ success: false, message: 'Challenge content not generated yet. Start the challenge first.' });
    }

    // Generate personalized file
    const hiddenMessageGenerator = require('../../utils/challengeTemplates/hiddenMessageGenerator');
    
    // Check if teacher uploaded a base image
    let baseFilePath = null;
    if (customChallenge.attachments && customChallenge.attachments.length > 0) {
      const imageAttachment = customChallenge.attachments.find(a => 
        a.mimeType && a.mimeType.startsWith('image/')
      );
      if (imageAttachment) {
        baseFilePath = path.resolve(imageAttachment.path);
      }
    }

    const file = await hiddenMessageGenerator.generatePersonalizedFile(
      customChallenge.templateConfig || {},
      progress,
      baseFilePath
    );

    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.content);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to generate personalized file' });
  }
});

// Reset a specific custom challenge for a student
router.post('/:classroomId/custom/reset-custom-challenge', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { studentId, challengeId } = req.body;
    const userId = req.user._id;

    if (!studentId || !challengeId) {
      return res.status(400).json({ success: false, message: 'Student ID and Challenge ID are required' });
    }

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    if (classroom.teacher.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge series not found' });
    }

    const userChallengeIndex = challenge.userChallenges.findIndex(
      uc => uc.userId.toString() === studentId.toString()
    );

    if (userChallengeIndex === -1) {
      return res.status(404).json({ success: false, message: 'Student not found in challenge' });
    }

    const userChallenge = challenge.userChallenges[userChallengeIndex];

    // Remove progress for this specific custom challenge
    if (userChallenge.customChallengeProgress) {
      userChallenge.customChallengeProgress = userChallenge.customChallengeProgress.filter(
        p => p.challengeId.toString() !== challengeId.toString()
      );
    }

    await challenge.save();

    // NEW: notifications (student + teacher) + realtime emit
    try {
      const Notification = require('../../models/Notification');
      const { populateNotification } = require('../../utils/notifications');

      const studentDoc = await User.findById(studentId).select('firstName lastName shortId email').lean();
      const studentLabel = studentDoc
        ? `${(studentDoc.firstName || '').trim()} ${(studentDoc.lastName || '').trim()}`.trim() || studentDoc.shortId || studentDoc.email || String(studentId)
        : String(studentId);

      const cc = (challenge.customChallenges || []).find(c => String(c._id) === String(challengeId));
      const ccTitle = cc?.title || 'Custom Challenge';

      const now = new Date();

      const studentNotify = await Notification.create({
        user: studentId,
        actionBy: userId,
        type: 'challenge_reset',
        message: `Your progress for challenge "${ccTitle}" in "${challenge.title}" was reset.`,
        classroom: challenge.classroomId,
        read: false,
        createdAt: now
      });
      const popStud = await populateNotification(studentNotify._id);
      try { req.app.get('io').to(`user-${studentId}`).emit('notification', popStud); } catch (e) {}

      const teacherRecipientId = classroom.teacher;
      const teacherNotify = await Notification.create({
        user: teacherRecipientId,
        actionBy: userId,
        type: 'challenge_reset',
        message: `Challenge "${ccTitle}" was reset for ${studentLabel} in "${challenge.title}".`,
        classroom: challenge.classroomId,
        read: false,
        createdAt: now
      });
      const popTeach = await populateNotification(teacherNotify._id);
      try { req.app.get('io').to(`user-${teacherRecipientId}`).emit('notification', popTeach); } catch (e) {}
    } catch (e) {
      console.error('[custom reset] failed to create/emit notifications:', e);
    }

    return res.json({ success: true, message: 'Custom challenge reset successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to reset custom challenge' });
  }
});

// Reset all custom challenges for a student
router.post('/:classroomId/custom/reset-all-custom-challenges', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { studentId } = req.body;
    const userId = req.user._id;

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Student ID is required' });
    }

    const classroom = await Classroom.findById(classroomId);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    if (classroom.teacher.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge series not found' });
    }

    const userChallengeIndex = challenge.userChallenges.findIndex(
      uc => uc.userId.toString() === studentId.toString()
    );

    if (userChallengeIndex === -1) {
      return res.status(404).json({ success: false, message: 'Student not found in challenge' });
    }

    const userChallenge = challenge.userChallenges[userChallengeIndex];

    // Clear all custom challenge progress
    userChallenge.customChallengeProgress = [];

    await challenge.save();

    // NEW: notifications (student + teacher) + realtime emit
    try {
      const Notification = require('../../models/Notification');
      const { populateNotification } = require('../../utils/notifications');

      const studentDoc = await User.findById(studentId).select('firstName lastName shortId email').lean();
      const studentLabel = studentDoc
        ? `${(studentDoc.firstName || '').trim()} ${(studentDoc.lastName || '').trim()}`.trim() || studentDoc.shortId || studentDoc.email || String(studentId)
        : String(studentId);

      const now = new Date();

      const studentNotify = await Notification.create({
        user: studentId,
        actionBy: userId,
        type: 'challenge_reset',
        message: `Your custom challenge progress in "${challenge.title}" was reset.`,
        classroom: challenge.classroomId,
        read: false,
        createdAt: now
      });
      const popStud = await populateNotification(studentNotify._id);
      try { req.app.get('io').to(`user-${studentId}`).emit('notification', popStud); } catch (e) {}

      const teacherRecipientId = classroom.teacher;
      const teacherNotify = await Notification.create({
        user: teacherRecipientId,
        actionBy: userId,
        type: 'challenge_reset',
        message: `Reset ALL custom challenges for ${studentLabel} in "${challenge.title}".`,
        classroom: challenge.classroomId,
        read: false,
        createdAt: now
      });
      const popTeach = await populateNotification(teacherNotify._id);
      try { req.app.get('io').to(`user-${teacherRecipientId}`).emit('notification', popTeach); } catch (e) {}
    } catch (e) {
      console.error('[custom reset all] failed to create/emit notifications:', e);
    }

    return res.json({ success: true, message: 'All custom challenges reset successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to reset custom challenges' });
  }
});

// Toggle legacy challenge inclusion
router.put('/:classroomId/legacy-challenges', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { includedLegacyChallenges } = req.body;

    if (!Array.isArray(includedLegacyChallenges)) {
      return res.status(400).json({ success: false, message: 'includedLegacyChallenges must be an array' });
    }

    const validIndices = includedLegacyChallenges.filter(i => Number.isInteger(i) && i >= 0 && i <= 6);

    const challenge = await Challenge.findOne({ classroomId });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge series not found' });
    }

    if (challenge.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the challenge creator can modify legacy challenges' });
    }

    challenge.includedLegacyChallenges = validIndices;

    // Update series type
    const hasLegacy = validIndices.length > 0;
    const hasCustom = (challenge.customChallenges || []).length > 0;

    if (hasLegacy && hasCustom) {
      challenge.seriesType = 'mixed';
    } else if (hasLegacy) {
      challenge.seriesType = 'legacy';
    } else if (hasCustom) {
      challenge.seriesType = 'custom';
    } else {
      challenge.seriesType = 'legacy';
    }

    await challenge.save();

    res.json({
      success: true,
      message: 'Legacy challenges updated',
      includedLegacyChallenges: challenge.includedLegacyChallenges,
      seriesType: challenge.seriesType
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update legacy challenges' });
  }
});

module.exports = router;

