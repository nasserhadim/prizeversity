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

async function awardCustomChallengeXP({ userId, classroomId, rewards, challengeName }) {
  try {
    const cls = await Classroom.findById(classroomId).select('xpSettings');
    if (!cls?.xpSettings?.enabled) return;

    const bits = Number(rewards?.bits || 0);
    if (bits > 0 && (cls.xpSettings.bitsEarned || 0) > 0) {
      const xp = bits * (cls.xpSettings.bitsEarned || 0);
      await awardXP(userId, classroomId, xp, 'earning bits (custom challenge)', cls.xpSettings);
    }

    const statCount =
      (rewards?.multiplier > 0 ? 1 : 0) +
      ((rewards?.luck || 1) > 1.0 ? 1 : 0) +
      ((rewards?.discount || 0) > 0 ? 1 : 0) +
      (rewards?.shield ? 1 : 0);

    if (statCount > 0 && (cls.xpSettings.statIncrease || 0) > 0) {
      const xp = statCount * cls.xpSettings.statIncrease;
      await awardXP(userId, classroomId, xp, 'stat increase (custom challenge)', cls.xpSettings);
    }

    if ((cls.xpSettings.challengeCompletion || 0) > 0) {
      const xp = cls.xpSettings.challengeCompletion || 0;
      await awardXP(userId, classroomId, xp, 'custom challenge completion', cls.xpSettings);
    }
  } catch (err) {
    // Silently handle XP errors - non-critical
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
      hintsEnabled, hints, bits, multiplier, luck, discount, shield, visible,
      templateType, templateConfig 
    } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    // Passcode type requires solution, template types don't
    const isTemplateType = templateType && templateType !== 'passcode';
    if (!isTemplateType && !solution) {
      return res.status(400).json({ success: false, message: 'Solution is required for passcode challenges' });
    }

    if (title.length > 200) {
      return res.status(400).json({ success: false, message: 'Title must be 200 characters or less' });
    }

    if (description && description.length > 5000) {
      return res.status(400).json({ success: false, message: 'Description must be 5000 characters or less' });
    }

    // Validate template config if using a template
    if (isTemplateType) {
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

    // Only hash solution for passcode-type challenges
    let solutionHash = null;
    if (!isTemplateType && solution) {
      solutionHash = await bcrypt.hash(solution.trim(), 10);
    }

    if (!challenge.customChallenges) challenge.customChallenges = [];

    const newCustomChallenge = {
      _id: new mongoose.Types.ObjectId(),
      order: challenge.customChallenges.length,
      title: title.trim(),
      description: description?.trim() || '',
      externalUrl: externalUrl?.trim() || '',
      solutionHash,
      templateType: templateType || 'passcode',
      templateConfig: isTemplateType ? (templateConfig || {}) : {},
      attachments: [],
      maxAttempts: maxAttempts || null,
      hintsEnabled: hintsEnabled || false,
      hints: Array.isArray(hints) ? hints.filter(h => h && h.trim()).map(h => h.trim()) : [],
      bits: Number(bits) || 50,
      multiplier: Number(multiplier) || 1.0,
      luck: Number(luck) || 1.0,
      discount: Number(discount) || 0,
      shield: Boolean(shield),
      visible: visible !== false,
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
        maxAttempts: newCustomChallenge.maxAttempts
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create custom challenge' });
  }
});

// Update a custom challenge
router.put('/:classroomId/custom/:challengeId', ensureAuthenticated, ensureTeacher, async (req, res) => {
  try {
    const { classroomId, challengeId } = req.params;
    const { 
      title, description, externalUrl, solution, maxAttempts, 
      hintsEnabled, hints, bits, multiplier, luck, discount, shield, visible,
      templateType, templateConfig 
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
    if (maxAttempts !== undefined) customChallenge.maxAttempts = maxAttempts;
    if (hintsEnabled !== undefined) customChallenge.hintsEnabled = hintsEnabled;
    if (hints !== undefined) customChallenge.hints = Array.isArray(hints) ? hints.filter(h => h && h.trim()).map(h => h.trim()) : [];
    if (bits !== undefined) customChallenge.bits = Number(bits) || 0;
    if (multiplier !== undefined) customChallenge.multiplier = Number(multiplier) || 1.0;
    if (luck !== undefined) customChallenge.luck = Number(luck) || 1.0;
    if (discount !== undefined) customChallenge.discount = Math.min(100, Math.max(0, Number(discount) || 0));
    if (shield !== undefined) customChallenge.shield = Boolean(shield);
    if (visible !== undefined) customChallenge.visible = Boolean(visible);

    // Handle template type changes
    if (templateType !== undefined) {
      const isTemplateType = templateType && templateType !== 'passcode';
      
      if (isTemplateType && templateConfig) {
        const validation = templateEngine.validateConfig(templateType, templateConfig);
        if (!validation.valid) {
          return res.status(400).json({ success: false, message: validation.errors.join(', ') });
        }
        customChallenge.templateType = templateType;
        customChallenge.templateConfig = templateConfig;
        customChallenge.solutionHash = null; // Clear static solution for template challenges
      } else if (!isTemplateType) {
        customChallenge.templateType = 'passcode';
        customChallenge.templateConfig = {};
      }
    }

    // Only update solution for passcode-type challenges
    if (solution !== undefined && solution.trim() && customChallenge.templateType === 'passcode') {
      customChallenge.solutionHash = await bcrypt.hash(solution.trim(), 10);
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
        hintsCount: customChallenge.hints.length,
        maxAttempts: customChallenge.maxAttempts
      }
    });
  } catch (error) {
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

    const customRewards = {
      bits: customChallenge.bits || 0,
      multiplier: customChallenge.multiplier || 1.0,
      luck: customChallenge.luck || 1.0,
      discount: customChallenge.discount || 0,
      shield: customChallenge.shield || false
    };

    // Apply hint penalty
    const hintsUsed = progress.hintsUsed || 0;
    const hintPenaltyPercent = challenge.settings?.hintPenaltyPercent || 25;
    let bitsAwarded = customRewards.bits;

    if (customChallenge.hintsEnabled && bitsAwarded > 0 && hintsUsed > 0) {
      const totalPenalty = (hintPenaltyPercent * hintsUsed) / 100;
      const cappedPenalty = Math.min(totalPenalty, 0.8);
      bitsAwarded = Math.round(bitsAwarded * (1 - cappedPenalty));
    }

    // Award bits
    if (bitsAwarded > 0) {
      const classroomBalance = user.classroomBalances.find(cb => cb.classroom.toString() === classroomId);
      if (classroomBalance) {
        classroomBalance.balance = (classroomBalance.balance || 0) + bitsAwarded;
      } else {
        user.classroomBalances.push({ classroom: classroomId, balance: bitsAwarded });
      }

      user.transactions = user.transactions || [];
      user.transactions.push({
        amount: bitsAwarded,
        description: `Completed Custom Challenge: ${customChallenge.title}`,
        type: 'challenge_completion',
        challengeName: customChallenge.title,
        classroom: classroomId,
        assignedBy: challenge.createdBy,
        createdAt: new Date()
      });

      progress.bitsAwarded = bitsAwarded;
      userChallenge.bitsAwarded = (userChallenge.bitsAwarded || 0) + bitsAwarded;
    }

    // Apply stat rewards
    const rewardsEarned = { bits: bitsAwarded, multiplier: 0, luck: 1.0, discount: 0, shield: false };

    if (customRewards.multiplier > 1.0) {
      if (!user.passiveAttributes) user.passiveAttributes = {};
      const multiplierIncrease = customRewards.multiplier - 1.0;
      user.passiveAttributes.multiplier = Math.round(((user.passiveAttributes.multiplier || 1.0) + multiplierIncrease) * 100) / 100;
      rewardsEarned.multiplier = multiplierIncrease;
    }

    if (customRewards.luck > 1.0) {
      if (!user.passiveAttributes) user.passiveAttributes = {};
      user.passiveAttributes.luck = Math.round((user.passiveAttributes.luck || 1.0) * customRewards.luck * 10) / 10;
      rewardsEarned.luck = customRewards.luck;
    }

    if (customRewards.discount > 0) {
      if (!user.passiveAttributes) user.passiveAttributes = {};
      user.passiveAttributes.discount = Math.min(100, (user.passiveAttributes.discount || 0) + customRewards.discount);
      rewardsEarned.discount = customRewards.discount;
    }

    if (customRewards.shield) {
      user.shieldActive = true;
      user.shieldCount = (user.shieldCount || 0) + 1;
      rewardsEarned.shield = true;
    }

    await user.save();
    await challenge.save();

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
          visible: cc.visible,
          hintsEnabled: cc.hintsEnabled,
          hintsCount: (cc.hints || []).length,
          maxAttempts: cc.maxAttempts,
          attachments: (cc.attachments || []).map(a => ({
            _id: a._id,
            originalName: a.originalName,
            size: a.size
          })),
          progress: progress ? {
            attempts: progress.attempts,
            completed: progress.completed,
            completedAt: progress.completedAt,
            startedAt: progress.startedAt,
            hintsUsed: progress.hintsUsed,
            hintsUnlocked: progress.hintsUnlocked
          } : null
        };

        // Include template display data for students who have started
        if (!isTeacher && templateType !== 'passcode' && progress?.generatedContent) {
          data.generatedDisplayData = progress.generatedContent.displayData;
          data.generatedMetadata = progress.generatedContent.metadata;
        }

        // Include template config for teachers
        if (isTeacher) {
          data.hasSolution = templateType === 'passcode';
          data.templateConfig = cc.templateConfig;
          
          // Get template metadata for display
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

