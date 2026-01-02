const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const Classroom = require('../models/Classroom');
const ModerationLog = require('../models/ModerationLog');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { populateNotification } = require('../utils/notifications');
const { ensureAuthenticated } = require('../config/auth');
const sendEmail = require('../../send-email'); // root-level send-email.js
const { awardXP } = require('../utils/awardXP');
const { logStatChanges } = require('../utils/statChangeLog');
const { getScopedUserStats } = require('../utils/classroomStats'); // ADD if present
const { isClassroomAdmin } = require('../utils/classroomStats'); // ADD

// ADD: classroom-scoped personal multiplier helper (no global fallback when classroomId exists)
function getPersonalMultiplierForClassroom(userDoc, classroomId) {
  if (classroomId) {
    const scoped = getScopedUserStats(userDoc, classroomId, { create: false });
    if (!scoped || !scoped.cs) return 1;
    const m = Number(scoped.passive?.multiplier ?? 1);
    return Number.isFinite(m) && m > 0 ? m : 1;
  }
  const m = Number(userDoc?.personalMultiplier ?? userDoc?.passiveAttributes?.multiplier ?? 1);
  return Number.isFinite(m) && m > 0 ? m : 1;
}

// helper to format remaining milliseconds into "Xd Yh Zm"
function formatRemainingMs(ms) {
  if (!ms || ms <= 0) return '0 minutes';
  const totalMinutes = Math.ceil(ms / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (minutes) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  return parts.join(' ');
}

// Submit feedback (site OR classroom) — accepts optional classroomId in body.
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const { rating, comment, classroomId, anonymous } = req.body;
    const numericRating = Number(rating);
    if (!(numericRating >= 1 && numericRating <= 5)) return res.status(400).json({ error: 'Invalid rating' });

    // If the client requested anonymous, do not attach the authenticated user's id
    const resolvedUserId = anonymous ? undefined : req.user._id;

    // NEW: enforce minimum 50 non-space characters on the server
    const nonSpaceLength = (comment || '').replace(/\s/g, '').length;
    if (nonSpaceLength < 50) {
      return res.status(400).json({
        error: 'Feedback comment must be at least 50 non-space characters long.'
      });
    }

    // Rate limit: per-user, scoped separately for site vs each classroom.
    // Submitting feedback in one classroom should not block submitting in other classrooms or site feedback.
    const cooldownDays = Number(process.env.FEEDBACK_COOLDOWN_DAYS || 7);
    const cutoff = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);

    // Recent lookup is explicitly scoped:
    // - if classroomId provided: only consider feedbacks for that classroom
    // - otherwise: only consider site-wide feedback (documents without a classroom field)
    const recentFilter = {
      userId: resolvedUserId,
      createdAt: { $gte: cutoff }
    };
    if (classroomId) {
      recentFilter.classroom = classroomId;
    } else {
      recentFilter.classroom = { $exists: false };
    }

    const recent = await Feedback.findOne(recentFilter);
    if (recent) {
      const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
      const remainingMs = (new Date(recent.createdAt).getTime() + cooldownMs) - Date.now();
      const remainingText = formatRemainingMs(remainingMs);
      return res.status(429).json({ error: `You can submit feedback only once every ${cooldownDays} day(s). Try again ~${remainingText}.` });
    }

    const feedback = new Feedback({
      rating: numericRating,
      comment,
      classroom: classroomId || undefined,
      userId: resolvedUserId, // will be undefined for anonymous submissions
      anonymous: !!anonymous
    });
    await feedback.save();

    // populate then emit real-time events so clients update immediately
    try {
      const populated = await Feedback.findById(feedback._id).populate('userId', 'firstName lastName email');
      const io = req.app.get('io');
      if (io) {
        if (classroomId) {
          io.to(`classroom-${classroomId}`).emit('feedback_created', populated);
          const cls = await Classroom.findById(classroomId).select('teacher');
          if (cls?.teacher) io.to(`user-${cls.teacher}`).emit('feedback_created', populated);
        } else {
          const admins = await User.find({ role: 'admin' }).select('_id');
          for (const a of admins) io.to(`user-${a._id}`).emit('feedback_created', populated);
        }
      }
    } catch (emitErr) {
      console.error('emit feedback_created failed', emitErr);
    }

    res.status(201).json({ message: 'Feedback submitted successfully', feedback });
  } catch (err) {
    console.error('Error submitting feedback:', err);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// If you want classroom feedback to require signed-in users, enable the auth middleware:
router.post('/classroom', ensureAuthenticated, async (req, res) => {
  try {
    const { rating, comment, classroomId, userId: bodyUserId, anonymous } = req.body;
    const numericRating = Number(rating);
    if (!(numericRating >= 1 && numericRating <= 5)) return res.status(400).json({ error: 'Invalid rating' });
    const resolvedUserId = anonymous ? undefined : ((req.user) ? req.user._id : (bodyUserId || undefined));

    // DEFINE ip early (was referenced before definition)
    const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();

    // NEW: enforce minimum 50 non-space characters for classroom feedback
    const nonSpaceLength = (comment || '').replace(/\s/g, '').length;
    if (nonSpaceLength < 50) {
      return res.status(400).json({
        error: 'Feedback comment must be at least 50 non-space characters long.'
      });
    }

    // DEBUG: log incoming classroom feedback requests so we can confirm this handler runs
    console.log('[feedback] POST /classroom received', {
      classroomId,
      user: req.user ? { _id: String(req.user._id), role: req.user.role } : null,
      anonymous: !!anonymous,
      ip
    });

    // Rate limit (per-classroom). Allow multiple signed-in users on same IP.
    const cooldownDays = Number(process.env.FEEDBACK_COOLDOWN_DAYS || 7);
    const cutoff = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);

    let recent;
    if (resolvedUserId) {
      // Signed-in user: only check their own prior submission
      recent = await Feedback.findOne({
        classroom: classroomId,
        userId: resolvedUserId,
        createdAt: { $gte: cutoff }
      });
    } else if (!resolvedUserId && ip) {
      // Truly anonymous (no user id): IP-based cooldown
      recent = await Feedback.findOne({
        classroom: classroomId,
        userId: { $exists: false },
        ip,
        createdAt: { $gte: cutoff }
      });
    }
    if (recent) {
      console.log('[feedback] classroom cooldown hit', {
        classroomId,
        forUser: resolvedUserId || null,
        ip,
        recentId: recent._id
      });
      const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
      const remainingMs = (new Date(recent.createdAt).getTime() + cooldownMs) - Date.now();
      const remainingText = formatRemainingMs(remainingMs);
      return res.status(429).json({ error: `You can submit feedback for this classroom only once every ${cooldownDays} day(s). Try again in ~${remainingText}.` });
    }

    const feedback = new Feedback({
      rating: numericRating,
      comment,
      classroom: classroomId || undefined,
      userId: resolvedUserId,
      anonymous: !!anonymous,
      ip: ip || undefined
    });
    await feedback.save();

    // --- reward flow (remove duplicate const ip) ---
    try {
      const cls = await Classroom.findById(classroomId)
        .select('feedbackRewardEnabled feedbackRewardBits feedbackRewardApplyGroupMultipliers feedbackRewardApplyPersonalMultipliers feedbackRewardAllowAnonymous teacher xpSettings');
      console.log('[feedback] reward check:', { classroomId, clsEnabled: !!cls?.feedbackRewardEnabled, bits: cls?.feedbackRewardBits, allowAnonymous: !!cls?.feedbackRewardAllowAnonymous });

      if (cls && cls.feedbackRewardEnabled && Number(cls.feedbackRewardBits) > 0) {
        const excludeCurrent = { _id: { $ne: feedback._id } };
        const allowAnon = !!cls.feedbackRewardAllowAnonymous;

        let already = null;

        if (req.user) {
          // Signed-in submitter: block by userId only
          already = await Feedback.findOne({
            classroom: classroomId,
            userId: req.user._id,
            ...(allowAnon ? {} : { anonymous: { $ne: true } }),
            ...excludeCurrent
          });
          if (already) console.log('[feedback] prior submission found (user) blocking award', { priorId: already._id, anonymous: !!already.anonymous });
        } else if (ip) {
          // No user (true anonymous): fall back to IP-based check
          already = await Feedback.findOne({
            classroom: classroomId,
            ip,
            ...(allowAnon ? {} : { anonymous: { $ne: true } }),
            ...excludeCurrent
          });
          if (already) console.log('[feedback] prior submission found (ip) blocking award', { priorId: already._id, anonymous: !!already.anonymous });
        }

        // NEW: guard against re-award when first submission was anonymous
        if (!already) {
          // who would be credited for this award?
          const targetId = (feedback && feedback.userId) ? feedback.userId : (req.user ? req.user._id : null);
          if (targetId) {
            const priorAward = await User.exists({
              _id: targetId,
              transactions: { $elemMatch: { type: 'feedback_reward', classroom: classroomId } }
            });
            if (priorAward) {
              already = true;
              console.log('[feedback] prior feedback_reward transaction found for user; skipping award');
            }
          }
        }

        console.log('[feedback] duplicate-check result', { matchedExisting: !!already, allowAnonymous: allowAnon });

        if (!already) {
          // If feedback was anonymous and classroom disallows anonymous awarding, skip
          if (feedback.anonymous && !cls.feedbackRewardAllowAnonymous) {
            console.log('[feedback] anonymous submission - awarding disabled by classroom');
          } else {
            // compute multipliers
            let groupMultiplier = 1;
            if (cls.feedbackRewardApplyGroupMultipliers && req.user) {
              const GroupSet = require('../models/GroupSet');
              const Group = require('../models/Group');
              const groupSets = await GroupSet.find({ classroom: classroomId }).select('groups').lean();
              const groupIds = groupSets.flatMap(gs => gs.groups);
              if (groupIds.length > 0) {
                const groups = await Group.find({
                  _id: { $in: groupIds },
                  members: { $elemMatch: { _id: req.user._id, status: 'approved' } }
                }).select('groupMultiplier');
                if (groups && groups.length > 0) {
                  groupMultiplier = groups.reduce((s, g) => s + (g.groupMultiplier || 1), 0);
                }
              }
            }

            let personalMultiplier = 1;
            if (cls.feedbackRewardApplyPersonalMultipliers && req.user) {
              const uTemp = await User.findById(req.user._id).select('personalMultiplier passiveAttributes classroomStats'); // ADD classroomStats
              personalMultiplier = getPersonalMultiplierForClassroom(uTemp, classroomId); // CHANGED
            }

            const base = Number(cls.feedbackRewardBits) || 0;
            // Use additive multiplier logic (consistent with wallet/group adjustments):
            // total = 1 + (group - 1) + (personal - 1)
            let totalMultiplier = 1;
            if (cls.feedbackRewardApplyGroupMultipliers) totalMultiplier += (groupMultiplier - 1);
            if (cls.feedbackRewardApplyPersonalMultipliers) totalMultiplier += (personalMultiplier - 1);
            const award = Math.max(0, Math.round(base * totalMultiplier));
            console.log('[feedback] computed award:', { base, groupMultiplier, personalMultiplier, totalMultiplier, award });

            if (award > 0) {
              // Determine who to credit:
              // - If feedback saved with userId (non-anonymous submission previously saved with userId) use that.
              // - Else prefer req.user (signed-in submitter) even if they chose anonymous AND classroom allows anonymous awarding.
              const targetId = (feedback && feedback.userId) ? feedback.userId : (req.user ? req.user._id : null);

              if (!targetId) {
                console.warn('[feedback] no user id to credit (anonymous + no session) — skipping award');
              } else {
                const target = await User.findById(targetId);
                if (!target) {
                  console.warn('[feedback] target user not found:', targetId);
                } else {
                  if (!Array.isArray(target.classroomBalances)) target.classroomBalances = [];
                  if (!Array.isArray(target.transactions)) target.transactions = [];

                  const idx = target.classroomBalances.findIndex(cb => String(cb.classroom) === String(classroomId));
                  if (idx >= 0) {
                    target.classroomBalances[idx].balance = (target.classroomBalances[idx].balance || 0) + award;
                  } else {
                    target.classroomBalances.push({ classroom: classroomId, balance: award });
                  }

                  // add a transaction entry including calculation details
                  target.transactions.push({
                    amount: award,
                    description: `Feedback reward: ${award} bits`,
                    type: 'feedback_reward',
                    assignedBy: cls.teacher || undefined,
                    classroom: classroomId || null,
                    calculation: {
                      baseAmount: base,
                      groupMultiplier: cls.feedbackRewardApplyGroupMultipliers ? groupMultiplier : 1,
                      personalMultiplier: cls.feedbackRewardApplyPersonalMultipliers ? personalMultiplier : 1,
                      totalMultiplier,
                      finalAmount: award
                    },
                    createdAt: new Date()
                  });

                  await target.save();

                  // Ensure classroom XP entry exists so /api/xp can read it
                  try {
                    if (!Array.isArray(target.classroomXP)) target.classroomXP = [];
                    const hasEntry = target.classroomXP.some(cx => String(cx.classroom) === String(classroomId));
                    if (!hasEntry) {
                      target.classroomXP.push({ classroom: classroomId, xp: 0, level: 1, earnedBadges: [] });
                    }
                    await target.save();
                  } catch (e) {
                    console.warn('[feedback] classroomXP upsert failed:', e);
                  }

                  console.log(`[feedback] awarded ${award} bits -> user ${target._id} (classroom ${classroomId})`);

                  // Award XP for bits earned via feedback reward (unchanged)
                  try {
                    if (cls?.xpSettings?.enabled) {
                      const xpRate = cls.xpSettings.bitsEarned || 0;
                      const xpBits = (cls.xpSettings.bitsXPBasis === 'base') ? Math.abs(base) : Math.abs(award);
                      const xpToAward = xpBits * xpRate;
                      if (xpToAward > 0) {
                        // award XP for the bits earned and capture result so we can log the stat change
                        const xpRes = await awardXP(target._id, classroomId, xpToAward, 'earning bits (feedback reward)', cls.xpSettings);
                        // create a stats_adjusted log/notification for the XP delta so the student sees "xp: A → B (+Δ)"
                        if (xpRes && typeof xpRes.oldXP !== 'undefined' && typeof xpRes.newXP !== 'undefined' && xpRes.newXP !== xpRes.oldXP) {
                          try {
                            await logStatChanges({
                              io: req.app && req.app.get ? req.app.get('io') : null,
                              classroomId,
                              user: target,
                              actionBy: req.user ? req.user._id : undefined,
                              prevStats: { xp: xpRes.oldXP },
                              currStats: { xp: xpRes.newXP },
                              context: 'feedback submission',
                              // show the bits effect explicitly for the bits-earned flow
                              details: { effectsText: award ? `Feedback reward: ${award} bits` : undefined },
                              forceLog: true
                            });
                          } catch (logErr) {
                            console.warn('[feedback] failed to log stat change for bits-earned XP:', logErr);
                          }
                        }
                      }
                    }
                  } catch (xpErr) {
                    console.warn('[feedback] failed to award XP for feedback reward:', xpErr);
                  }

                  // Emit socket events so frontend updates (emit to classroom and user rooms)
                  try {
                    const io = req.app && req.app.get ? req.app.get('io') : null;
                    const perClassBalance = (Array.isArray(target.classroomBalances) && target.classroomBalances.find(cb => String(cb.classroom) === String(classroomId)))?.balance || 0;
                    if (io) {
                      const populatedNotification = await Notification.create({
                        user: target._id,
                        type: 'bit_assignment_approved',
                        message: `You received ${award} ₿ for submitting feedback.`,
                        classroom: classroomId,
                        actionBy: cls.teacher || undefined,
                        createdAt: new Date()
                      });
                      const pop = await populateNotification(populatedNotification._id);
                      io.to(`user-${target._id}`).emit('notification', pop);
                      io.to(`user-${target._id}`).emit('balance_update', { userId: target._id, classroomId, newBalance: perClassBalance });
                      io.to(`user-${target._id}`).emit('wallet_update', { userId: target._id, classroomId, newBalance: perClassBalance });
                      io.to(`classroom-${classroomId}`).emit('balance_update', { studentId: target._id, classroomId, newBalance: perClassBalance });
                    } else {
                      console.warn('[feedback] io not available on req.app');
                    }
                  } catch (emitErr) {
                    console.warn('[feedback] failed to emit socket events:', emitErr);
                  }
                }
              }
            }
          } // end awarding branch
        } // end if not already
      } // end if cls && enabled
    } catch (rewardErr) {
      console.error('Feedback reward flow failed:', rewardErr);
    }
    // --- END NEW flow ---

    // --- AFTER the reward flow (outside / after the try/catch that handles bit award) ---
    { 
      // NEW: award XP for the feedback submission itself (independent of bit award)
      try {
        // reload classroom xp settings to be safe (or reuse "cls" if in scope)
        const cls2 = await Classroom.findById(classroomId).select('xpSettings feedbackRewardBits teacher');
        if (cls2?.xpSettings?.enabled && Number(cls2.xpSettings.feedbackSubmission || 0) > 0) {
          // determine who to credit (consistent with earlier logic)
          const targetId2 = (feedback && feedback.userId) ? feedback.userId : (req.user ? req.user._id : null);
          if (targetId2) {
            const targetUser = await User.findById(targetId2);
            if (targetUser) {
              // Ensure classroomXP entry exists so awardXP can operate and /api/xp reads correct data
              if (!Array.isArray(targetUser.classroomXP)) targetUser.classroomXP = [];
              const hasEntry = targetUser.classroomXP.some(cx => String(cx.classroom) === String(classroomId));
              if (!hasEntry) {
                targetUser.classroomXP.push({ classroom: classroomId, xp: 0, level: 1, earnedBadges: [] });
                await targetUser.save();
              }

              const xpAmount = Number(cls2.xpSettings.feedbackSubmission || 0);
              const xpRes = await awardXP(targetId2, classroomId, xpAmount, 'feedback submission', cls2.xpSettings);

              // Log stat change so notification shows "xp: A → B (+Δ)"
              if (xpRes && typeof xpRes.oldXP !== 'undefined' && typeof xpRes.newXP !== 'undefined' && xpRes.newXP !== xpRes.oldXP) {
                try {
                  // only advertise a "Feedback reward: N bits" effect when the classroom actually has the bit reward enabled
                  const effectsText = (cls2.feedbackRewardEnabled && Number(cls2.feedbackRewardBits) > 0)
                    ? `Feedback reward: ${cls2.feedbackRewardBits} bits`
                    : undefined;

                  await logStatChanges({
                    io: req.app.get('io'),
                    classroomId,
                    user: targetUser,
                    actionBy: req.user ? req.user._id : undefined,
                    prevStats: { xp: xpRes.oldXP },
                    currStats: { xp: xpRes.newXP },
                    context: 'feedback submission',
                    details: { effectsText },
                    forceLog: true
                  });
                } catch (logErr) {
                  console.warn('[feedback] failed to log stat change for feedback XP (post-flow):', logErr);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('[feedback] feedbackSubmission XP award failed (post-flow):', err);
      }
    }

    res.status(201).json({ message: 'Classroom feedback submitted successfully' });
  } catch (err) {
    console.error('Error submitting classroom feedback:', err);
    res.status(500).json({ error: 'Failed to submit classroom feedback' });
  }
});

// GET site-wide feedback (recent)
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = Math.max(1, parseInt(req.query.perPage) || 10);
    const includeHidden = req.query.includeHidden === 'true' && req.user && (req.user.role === 'teacher' || req.user.role === 'admin');

    const filter = { classroom: { $exists: false } };
    if (!includeHidden) filter.hidden = { $ne: true };

    const [total, feedbacksRaw, countsRaw] = await Promise.all([
      Feedback.countDocuments(filter),
      Feedback.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .populate('userId', 'firstName lastName email')
        .populate('classroom', 'name code') // <-- ADD
      ,
      Feedback.aggregate([
        { $match: filter },
        { $project: { ratingValue: { $ifNull: ['$rating', '$feedbackRating'] } } },
        { $match: { ratingValue: { $gte: 1, $lte: 5 } } },
        { $group: { _id: '$ratingValue', count: { $sum: 1 } } }
      ])
    ]);

    // Normalize rating field on returned docs (legacy support)
    const feedbacks = feedbacksRaw.map(f => {
      if (f.rating == null && f.feedbackRating != null) {
        f.rating = f.feedbackRating;
      }
      return f;
    });

    const ratingCounts = [0,0,0,0,0,0];
    countsRaw.forEach(c => {
      const r = Number(c._id);
      if (r >= 1 && r <= 5) ratingCounts[r] = c.count;
    });
    const sum = ratingCounts.reduce((acc, cnt, r) => r >= 1 ? acc + cnt * r : acc, 0);
    const average = total ? sum / total : 0;

    res.json({ feedbacks, total, page, perPage, ratingCounts, average });
  } catch (err) {
    console.error('Error fetching site feedback:', err);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// GET classroom feedback (with total)
router.get('/classroom/:id', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = Math.max(1, parseInt(req.query.perPage) || 10);
    
    // FIXED: rename local variable to avoid collision with imported function
    let includeHidden = false;
    if (req.user) {
      const isGlobalAdmin = req.user.role === 'admin';
      const isTeacher = req.user.role === 'teacher';
      
      // Check if user is classroom admin AND teacher allows feedback moderation
      let userCanModerate = false;
      if (await isClassroomAdmin(req.user, req.params.id)) {
        const classroom = await Classroom.findById(req.params.id).select('taFeedbackPolicy');
        userCanModerate = classroom && classroom.taFeedbackPolicy === 'full';
      }
      
      includeHidden = isGlobalAdmin || isTeacher || userCanModerate;
    }

    const filter = { classroom: req.params.id };
    if (!includeHidden) filter.hidden = { $ne: true };

    const [total, feedbacks, countsRaw] = await Promise.all([
      Feedback.countDocuments(filter),
      Feedback.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .populate('userId', 'firstName lastName email'),
      Feedback.aggregate([
        { $match: filter },
        { $group: { _id: '$rating', count: { $sum: 1 } } }
      ])
    ]);

    const ratingCounts = [0,0,0,0,0,0];
    countsRaw.forEach(c => {
      const r = Number(c._id);
      if (r >= 1 && r <= 5) ratingCounts[r] = c.count;
    });
    const sum = ratingCounts.reduce((acc, cnt, r) => r >= 1 ? acc + cnt * r : acc, 0);
    const average = total ? sum / total : 0;
    res.json({ feedbacks, total, page, perPage, ratingCounts, average });
  } catch (err) {
    console.error('Error fetching classroom feedback:', err);
    res.status(500).json({ error: 'Failed to fetch classroom feedback' });
  }
});

// NEW: report a feedback (authenticated users only)
router.post('/:id/report', ensureAuthenticated, async (req, res) => {
  try {
    const { reason, reporterEmail: bodyEmail } = req.body;
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) return res.status(404).json({ error: 'Feedback not found' });

    const log = await ModerationLog.create({
      feedback: feedback._id,
      action: 'report',
      moderator: req.user._id,
      // prefer explicit body email, otherwise use authenticated user's email
      reporterEmail: bodyEmail || req.user.email || undefined,
      reason: reason || '',
      classroom: feedback.classroom || undefined
    });

    // If site-wide (no classroom), notify admins and emit socket notification + email
    if (!feedback.classroom) {
      const admins = await User.find({ role: 'admin' }).select('email firstName lastName');
      for (const admin of admins) {
        // create in-app notification (if Notification model)
        if (Notification) {
          const created = await Notification.create({
            user: admin._id,
            type: 'feedback_report',
            message: `A site feedback was reported: "${(feedback.comment || '').slice(0,120)}"`,
            feedback: feedback._id,
            createdAt: new Date(),
            actionBy: req.user ? req.user._id : undefined
          });
          try {
            const populated = await populateNotification(created._id);
            const io = req.app.get('io');
            if (io) {
              // emit regular notification payload
              io.to(`user-${admin._id}`).emit('notification', populated);
              // also emit a dedicated feedback_report event so admin pages can react specifically
              io.to(`user-${admin._id}`).emit('feedback_report', populated);
            }
          } catch (emitErr) {
            console.error('Failed to emit admin notification:', emitErr);
          }
        }

        // send email (simple template)
        try {
          if (admin.email && typeof sendEmail === 'function') {
            const subject = `[Prizeversity] Site feedback reported`;
            const html = `
              <p>Hi ${admin.firstName || 'Admin'},</p>
              <p>A site-wide feedback was reported.</p>
              <p><strong>Reason:</strong> ${reason || '(no reason provided)'}</p>
              <p><strong>Feedback excerpt:</strong> ${(feedback.comment || '(no comment)').substring(0, 400)}</p>
              <p><a href="${process.env.REDIRECT_BASE || ''}/admin/moderation">Open moderation dashboard</a></p>
              <hr/>
              <p>This is an automated notification from Prizeversity.</p>
            `;
            await sendEmail({ to: admin.email, subject, html });
          }
        } catch (emailErr) {
          console.error('Failed sending admin email for feedback report:', emailErr);
        }
      }
    } else {
      // classroom report: notify teacher AND classroom-scoped Admin/TAs
      const classroom = await Classroom.findById(feedback.classroom)
        .populate('teacher', 'email firstName lastName')
        .populate('admins', 'email firstName lastName'); // ADD: populate admins
      
      if (classroom) {
        const recipients = [classroom.teacher];
        // ADD: include classroom admins
        if (Array.isArray(classroom.admins)) {
          recipients.push(...classroom.admins);
        }

        for (const recipient of recipients) {
          if (!recipient || !recipient._id) continue;
          
          if (Notification) {
            const created = await Notification.create({
              user: recipient._id,
              type: 'feedback_report',
              message: `A feedback in "${classroom.name}" was reported.`,
              feedback: feedback._id,
              classroom: classroom._id,
              createdAt: new Date(),
              actionBy: req.user ? req.user._id : undefined
            });
            try {
              const populated = await populateNotification(created._id);
              const io = req.app.get('io');
              if (io) {
                io.to(`user-${recipient._id}`).emit('notification', populated);
                io.to(`user-${recipient._id}`).emit('feedback_report', populated);
              }
            } catch (emitErr) {
              console.error('Failed to emit notification:', emitErr);
            }
          }

          // Send email notification
          if (recipient.email && typeof sendEmail === 'function') {
            try {
              const subject = `[Prizeversity] Classroom feedback reported`;
              const html = `
                <p>Hi ${recipient.firstName || 'there'},</p>
                <p>A feedback in classroom "${classroom.name}" was reported.</p>
                <p><strong>Reason:</strong> ${reason || '(no reason provided)'}</p>
                <p><strong>Reporter:</strong> ${bodyEmail || req.user?.email || 'Anonymous'}</p>
                <p><a href="${process.env.REDIRECT_BASE || ''}/classroom/${classroom._id}/feedback">View classroom feedback</a></p>
                <hr/>
                <p>This is an automated notification from Prizeversity.</p>
              `;
              await sendEmail({ to: recipient.email, subject, html });
            } catch (emailErr) {
              console.error('Failed sending email:', emailErr);
            }
          }
        }
      }
    }

    res.json({ success: true, log });
  } catch (err) {
    console.error('Error reporting feedback:', err);
    res.status(500).json({ error: 'Failed to report feedback' });
  }
});

// NEW: admin/classroom moderator endpoint - delete feedback
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) return res.status(404).json({ error: 'Feedback not found' });

    // permission check: site feedback => admin only; classroom feedback => classroom teacher or admin
    if (!feedback.classroom) {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can delete site feedback' });
    } else {
      const classroom = await Classroom.findById(feedback.classroom);
      const isTeacherOfClass = classroom && String(classroom.teacher) === String(req.user._id);
      if (!isTeacherOfClass && req.user.role !== 'admin') return res.status(403).json({ error: 'Only the classroom teacher or admin can delete this feedback' });
    }

    await Feedback.findByIdAndDelete(req.params.id);
    await ModerationLog.create({ feedback: req.params.id, action: 'delete', moderator: req.user._id, classroom: feedback.classroom || undefined });

    // emit moderation log update for admins/teacher
    try {
      const log = await ModerationLog.findOne({ feedback: req.params.id, action: 'delete', moderator: req.user._id }).populate('moderator', 'firstName lastName email').populate('feedback', 'rating comment classroom');
      const io = req.app.get('io');
      if (io) {
        if (feedback.classroom) {
          io.to(`classroom-${feedback.classroom}`).emit('moderation_log_updated', log);
        } else {
          const admins = await User.find({ role: 'admin' }).select('_id');
          for (const a of admins) io.to(`user-${a._id}`).emit('moderation_log_updated', log);
        }
      }
    } catch (emitErr) {
      console.error('emit moderation_log_updated (delete) failed', emitErr);
    }

    // broadcast deletion event to admins/teacher (optional)
    const io = req.app.get('io');
    if (io) {
      if (!feedback.classroom) {
        const admins = await User.find({ role: 'admin' }).select('_id');
        for (const a of admins) io.to(`user-${a._id}`).emit('feedback_deleted', { feedbackId: req.params.id });
      } else {
        const classroom = await Classroom.findById(feedback.classroom).select('teacher');
        if (classroom && classroom.teacher) io.to(`user-${classroom.teacher}`).emit('feedback_deleted', { feedbackId: req.params.id });
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting feedback:', err);
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

// NEW: admin response to a report (create moderation log "response")
router.post('/:id/respond', ensureAuthenticated, async (req, res) => {
  try {
    const { response } = req.body;
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) return res.status(404).json({ error: 'Feedback not found' });

    // Only site admins may respond to site feedback; for classroom feedback, allow teacher or classroom-scoped admin/TA
    if (!feedback.classroom) {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can respond to site feedback' });
    } else {
      const classroomId = feedback.classroom;
      const classroom = await Classroom.findById(classroomId).select('teacher taFeedbackPolicy');
      const isTeacherOfClass = classroom && String(classroom.teacher) === String(req.user._id);
      
      // Check if user is classroom admin AND teacher allows feedback moderation
      let userCanModerate = false;
      if (await isClassroomAdmin(req.user, classroomId)) {
        userCanModerate = classroom && classroom.taFeedbackPolicy === 'full';
      }
      
      if (!isTeacherOfClass && !userCanModerate) return res.status(403).json({ error: 'Only the classroom teacher or classroom-scoped Admin/TA can respond' });
    }

    const log = await ModerationLog.create({
      feedback: feedback._id,
      action: 'response',
      moderator: req.user._id,
      reason: response || '',
      classroom: feedback.classroom || undefined
    });

    // optionally notify reporter if email known
    if (log && log.reporterEmail) {
      try {
        if (typeof sendEmail === 'function') {
          sendEmail({
            to: log.reporterEmail,
            subject: 'Response to feedback report',
            text: response
          }).catch(e => console.error('Email send failed', e));
        }
      } catch (e) {
        console.error('Failed to notify reporter', e);
      }
    }

    // emit update
    const io = req.app.get('io');
    if (io) {
      if (!feedback.classroom) {
        const admins = await User.find({ role: 'admin' }).select('_id');
        for (const a of admins) io.to(`user-${a._id}`).emit('moderation_log_updated', log);
      } else {
        const classroom = await Classroom.findById(feedback.classroom).select('teacher');
        if (classroom && classroom.teacher) io.to(`user-${classroom.teacher}`).emit('moderation_log_updated', log);
      }
    }

    res.json({ success: true, log });
  } catch (err) {
    console.error('Error responding to feedback:', err);
    res.status(500).json({ error: 'Failed to respond' });
  }
});

// NEW/MODIFIED: moderation-log listing (teacher/admin) with server-side filtering & sorting
router.get('/moderation-log', ensureAuthenticated, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = Math.max(1, parseInt(req.query.perPage) || 20);
    const classroomId = req.query.classroomId || null;
    const actionFilter = req.query.action || null; // e.g. 'report','hide','unhide','delete','response'
    const reporter = req.query.reporterEmail || null;
    const moderator = req.query.moderator || null; // moderator userId
    const sortField = req.query.sortField || 'createdAt';
    const sortDir = req.query.sortDir === 'asc' ? 1 : -1;

    // permission checks
    if (classroomId) {
      const classroom = await Classroom.findById(classroomId).select('teacher admins taFeedbackPolicy');
      if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
      const isTeacher = String(classroom.teacher) === String(req.user._id);
      
      // Check if user is classroom admin AND teacher allows feedback moderation
      let userCanModerate = false;
      if (await isClassroomAdmin(req.user, classroomId)) {
        userCanModerate = classroom.taFeedbackPolicy === 'full';
      }
      
      if (!isTeacher && !userCanModerate && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } else {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    }

    const filter = {};
    if (classroomId) filter.classroom = classroomId;
    if (actionFilter) filter.action = actionFilter;
    if (reporter) filter.reporterEmail = reporter;
    if (moderator) filter.moderator = moderator;

    const [total, logs] = await Promise.all([
      ModerationLog.countDocuments(filter),
      ModerationLog.find(filter)
        .sort({ [sortField]: sortDir })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .populate('feedback', 'comment rating classroom hidden')
        .populate('moderator', 'firstName lastName email')
        .populate('classroom', 'name code') // NEW
    ]);

    res.json({ logs, total, page, perPage });
  } catch (err) {
    console.error('Failed to fetch moderation log:', err);
    res.status(500).json({ error: 'Failed to fetch moderation log' });
  }
});

// ADD: toggle hide/unhide for a feedback item
router.patch('/:id/hide', ensureAuthenticated, async (req, res) => {
  try {
    const { hide } = req.body;
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) return res.status(404).json({ error: 'Feedback not found' });

    // Permission: site-wide feedback => admin only
    if (!feedback.classroom) {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can change visibility of site feedback' });
    } else {
      // classroom feedback => classroom teacher or classroom-scoped admin/TA
      const classroomId = feedback.classroom;
      const classroom = await Classroom.findById(classroomId).select('teacher taFeedbackPolicy');
      const isTeacher = classroom && String(classroom.teacher) === String(req.user._id);
      
      // Check if user is classroom admin AND teacher allows feedback moderation
      let userCanModerate = false;
      if (await isClassroomAdmin(req.user, classroomId)) {
        userCanModerate = classroom && classroom.taFeedbackPolicy === 'full';
      }
      
      if (!isTeacher && !userCanModerate) return res.status(403).json({ error: 'Only the classroom teacher or classroom-scoped Admin/TA can change visibility' });
    }

    feedback.hidden = !!hide;
    feedback.hiddenBy = hide ? req.user._id : undefined;
    await feedback.save();

    // create moderation log
    await ModerationLog.create({
      feedback: feedback._id,
      action: hide ? 'hide' : 'unhide',
      moderator: req.user._id,
      classroom: feedback.classroom || undefined
    });

    // Emit moderation log update so UI refreshes
    try {
      const populatedLog = await ModerationLog.findOne({ feedback: feedback._id, moderator: req.user._id }).populate('moderator', 'firstName lastName email').populate('feedback', 'rating comment classroom');
      const io = req.app.get('io');
      if (io) {
        if (feedback.classroom) {
          io.to(`classroom-${feedback.classroom}`).emit('moderation_log_updated', populatedLog);
          const classroom = await Classroom.findById(feedback.classroom).select('teacher admins');
          if (classroom) {
            if (classroom.teacher) {
              io.to(`user-${classroom.teacher}`).emit('moderation_log_updated', populatedLog);
            }
            // ADD: notify classroom admins
            if (Array.isArray(classroom.admins)) {
              for (const adminId of classroom.admins) {
                io.to(`user-${adminId}`).emit('moderation_log_updated', populatedLog);
              }
            }
          }
        } else {
          const admins = await User.find({ role: 'admin' }).select('_id');
          for (const a of admins) {
            io.to(`user-${a._id}`).emit('moderation_log_updated', populatedLog);
          }
        }
      }
    } catch (emitErr) {
      console.error('emit moderation_log_updated failed', emitErr);
    }

    // emit socket updates to relevant parties
    const io = req.app.get('io');
    if (io) {
      if (!feedback.classroom) {
        const admins = await User.find({ role: 'admin' }).select('_id');
        for (const a of admins) io.to(`user-${a._id}`).emit('feedback_visibility_changed', { feedbackId: feedback._id, hidden: feedback.hidden });
      } else {
        const classroom = await Classroom.findById(feedback.classroom).select('teacher');
        if (classroom && classroom.teacher) io.to(`user-${classroom.teacher}`).emit('feedback_visibility_changed', { feedbackId: feedback._id, hidden: feedback.hidden });
      }
    }

    try {
      const io = req.app.get('io');
      if (io) {
        // emit visibility change and full updated object
        if (feedback.classroom) {
          io.to(`classroom-${feedback.classroom}`).emit('feedback_visibility_changed', { feedbackId: feedback._id, hidden: feedback.hidden });
          io.to(`classroom-${feedback.classroom}`).emit('feedback_updated', feedback);
          
          // ALSO notify teacher and classroom admins directly
          const classroom = await Classroom.findById(feedback.classroom).select('teacher admins');
          if (classroom) {
            if (classroom.teacher) {
              io.to(`user-${classroom.teacher}`).emit('feedback_visibility_changed', { feedbackId: feedback._id, hidden: feedback.hidden });
              io.to(`user-${classroom.teacher}`).emit('feedback_updated', feedback);
            }
            if (Array.isArray(classroom.admins)) {
              for (const adminId of classroom.admins) {
                io.to(`user-${adminId}`).emit('feedback_visibility_changed', { feedbackId: feedback._id, hidden: feedback.hidden });
                io.to(`user-${adminId}`).emit('feedback_updated', feedback);
              }
            }
          }
        } else {
          const admins = await User.find({ role: 'admin' }).select('_id');
          for (const a of admins) {
            io.to(`user-${a._id}`).emit('feedback_visibility_changed', { feedbackId: feedback._id, hidden: feedback.hidden });
            io.to(`user-${a._id}`).emit('feedback_updated', feedback);
          }
        }
      }
    } catch (emitErr) {
      console.error('emit feedback_visibility_changed failed', emitErr);
    }

    res.json({ success: true, feedback });
  } catch (err) {
    console.error('Error toggling feedback visibility:', err);
    res.status(500).json({ error: 'Failed to update feedback visibility' });
  }
});

module.exports = router;