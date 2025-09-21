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
    // If the client requested anonymous, do not attach the authenticated user's id
    const resolvedUserId = anonymous ? undefined : req.user._id;

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
      rating,
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
    // Respect anonymous flag here as well
    const resolvedUserId = anonymous ? undefined : ((req.user) ? req.user._id : (bodyUserId || undefined));

    // Rate limit (per-classroom). Signed-in users limited by userId; unauthenticated by IP.
    const cooldownDays = Number(process.env.FEEDBACK_COOLDOWN_DAYS || 7);
    const cutoff = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000);
    const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();

    let recent;
    if (req.user) {
      recent = await Feedback.findOne({ userId: req.user._id, classroom: classroomId, createdAt: { $gte: cutoff } });
    } else {
      recent = await Feedback.findOne({ ip, classroom: classroomId, createdAt: { $gte: cutoff } });
    }
    if (recent) {
      const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
      const remainingMs = (new Date(recent.createdAt).getTime() + cooldownMs) - Date.now();
      const remainingText = formatRemainingMs(remainingMs);
      return res.status(429).json({ error: `You can submit feedback for this classroom only once every ${cooldownDays} day(s). Try again in ~${remainingText}.` });
    }

    const feedback = new Feedback({
      rating,
      comment,
      classroom: classroomId || undefined,
      userId: resolvedUserId,
      anonymous: !!anonymous,
      ip: ip || undefined
    });
    await feedback.save();
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

    const [total, feedbacks] = await Promise.all([
      Feedback.countDocuments(filter),
      Feedback.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .populate('userId', 'firstName lastName email')
    ]);

    res.json({ feedbacks, total, page, perPage });
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
    const includeHidden = req.query.includeHidden === 'true' && req.user && (req.user.role === 'teacher' || req.user.role === 'admin');

    const filter = { classroom: req.params.id };
    if (!includeHidden) filter.hidden = { $ne: true };

    const [total, feedbacks] = await Promise.all([
      Feedback.countDocuments(filter),
      Feedback.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .populate('userId', 'firstName lastName email')
    ]);

    res.json({ feedbacks, total, page, perPage });
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
      // classroom report: existing teacher notification flow (unchanged)
      const classroom = await Classroom.findById(feedback.classroom).populate('teacher', 'email firstName lastName');
      if (classroom && classroom.teacher) {
        const teacher = classroom.teacher;
        if (Notification) {
          const created = await Notification.create({
            user: teacher._id,
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
              io.to(`user-${classroom.teacher._id}`).emit('notification', populated);
              io.to(`user-${classroom.teacher._id}`).emit('feedback_report', populated);
            }
          } catch (emitErr) {
            console.error('Failed to emit teacher notification:', emitErr);
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

    // only admin or classroom teacher can respond
    if (!feedback.classroom) {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can respond to site feedback' });
    } else {
      const classroom = await Classroom.findById(feedback.classroom);
      const isTeacherOfClass = classroom && String(classroom.teacher) === String(req.user._id);
      if (!isTeacherOfClass && req.user.role !== 'admin') return res.status(403).json({ error: 'Only the classroom teacher or admin can respond' });
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
      const classroom = await Classroom.findById(classroomId).select('teacher');
      if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
      const isTeacher = String(classroom.teacher) === String(req.user._id);
      if (!isTeacher && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
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
      // classroom feedback => classroom teacher or admin
      const classroom = await Classroom.findById(feedback.classroom).select('teacher');
      const isTeacher = classroom && String(classroom.teacher) === String(req.user._id);
      if (!isTeacher && req.user.role !== 'admin') return res.status(403).json({ error: 'Only the classroom teacher or admin can change visibility' });
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
          const classroom = await Classroom.findById(feedback.classroom);
          if (classroom?.teacher) {
            io.to(`user-${classroom.teacher}`).emit('moderation_log_updated', populatedLog);
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
        } else {
          const admins = await User.find({ role: 'admin' }).select('_id');
          for (const a of admins) {
            io.to(`user-${a._1d}`).emit('feedback_visibility_changed', { feedbackId: feedback._id, hidden: feedback.hidden });
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