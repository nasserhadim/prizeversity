import { useEffect } from 'react';
import { subscribeToFeedbackEvents } from '../utils/socket';

/**
 * useFeedbackRealtime(options)
 * - scope: 'site' | 'classroom' | 'admin'
 * - classroomId: only for 'classroom' scope
 * - setFeedbacks: setter for feedback list (optional)
 * - setTotal: setter for total count (optional)
 * - fetchFeedbacks: function to refresh list from server (optional)
 * - fetchLogs: function to refresh moderation logs (optional)
 * - hydrateFeedbacks: optional admin helper to refresh feedbacks
 */
export default function useFeedbackRealtime({
  scope = 'site',
  classroomId = null,
  setFeedbacks,
  setTotal,
  fetchFeedbacks,
  fetchLogs,
  hydrateFeedbacks
}) {
  useEffect(() => {
    const unsub = subscribeToFeedbackEvents((e) => {
      const p = e.payload;

      // Helper to check classroom match
      const isForClassroom = (item) => {
        if (!classroomId) return false;
        // p.classroom can be object or id
        const pc = item.classroom || p.classroom;
        return String(pc) === String(classroomId);
      };

      // SITE scope: only handle feedbacks without classroom
      if (scope === 'site') {
        if (e.event === 'feedback_created' && !p.classroom && setFeedbacks) {
          setFeedbacks(prev => [p, ...(prev || [])]);
          if (setTotal) setTotal(t => (typeof t === 'number' ? t + 1 : t));
        }
        if (e.event === 'feedback_updated' && !p.classroom && setFeedbacks) {
          setFeedbacks(prev => (prev || []).map(f => f._id === p._id ? { ...f, ...p } : f));
        }
        if (e.event === 'feedback_deleted' && setFeedbacks) {
          setFeedbacks(prev => (prev || []).filter(f => f._id !== p.feedbackId));
          if (setTotal) setTotal(t => (typeof t === 'number' ? Math.max(0, t - 1) : t));
        }
        if (['feedback_report','moderation_log_updated'].includes(e.event) && typeof fetchFeedbacks === 'function') {
          fetchFeedbacks(1, false);
        }
        if (e.event === 'feedback_visibility_changed' && setFeedbacks) {
          setFeedbacks(prev => (prev || []).map(f => f._id === p.feedbackId ? { ...f, hidden: p.hidden } : f));
        }
      }

      // CLASSROOM scope: only handle events targeted at classroomId
      if (scope === 'classroom') {
        if (!classroomId) return;
        if (e.event === 'feedback_created' && isForClassroom(p) && setFeedbacks) {
          setFeedbacks(prev => [p, ...(prev || [])]);
          if (setTotal) setTotal(t => (typeof t === 'number' ? t + 1 : t));
        }
        if (e.event === 'feedback_updated' && isForClassroom(p) && setFeedbacks) {
          setFeedbacks(prev => (prev || []).map(f => f._id === p._id ? { ...f, ...p } : f));
        }
        if (e.event === 'feedback_deleted' && isForClassroom(p) && setFeedbacks) {
          setFeedbacks(prev => (prev || []).filter(f => f._id !== p.feedbackId));
          if (setTotal) setTotal(t => (typeof t === 'number' ? Math.max(0, t - 1) : t));
        }
        if (e.event === 'feedback_visibility_changed' && isForClassroom(p) && setFeedbacks) {
          setFeedbacks(prev => (prev || []).map(f => f._id === p.feedbackId ? { ...f, hidden: p.hidden } : f));
        }
        if (['feedback_report','moderation_log_updated'].includes(e.event) && typeof fetchFeedbacks === 'function') {
          fetchFeedbacks(1, false);
        }
      }

      // ADMIN scope: refresh logs / hydration
      if (scope === 'admin') {
        if (['feedback_created','feedback_updated','feedback_deleted','feedback_visibility_changed','moderation_log_updated','feedback_report'].includes(e.event)) {
          if (typeof fetchLogs === 'function') fetchLogs(1);
          if (typeof hydrateFeedbacks === 'function') hydrateFeedbacks();
        }
      }
    });

    return () => unsub();
  }, [scope, classroomId, setFeedbacks, setTotal, fetchFeedbacks, fetchLogs, hydrateFeedbacks]);
}