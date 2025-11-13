import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../config/api";
import Footer from "../components/Footer";
import { toast } from "react-hot-toast";
import { getClassroom } from "../API/apiClassroom";
import FeedbackList from '../components/FeedbackList';
import '../styles/Feedback.css';
import { useAuth } from '../context/AuthContext';
import ModerationLog from '../components/ModerationLog';
import { subscribeToFeedbackEvents } from '../utils/socket';
import useFeedbackRealtime from '../hooks/useFeedbackRealtime';
import RatingDistribution from '../components/RatingDistribution';
import ExportButtons from '../components/ExportButtons';
import { exportFeedbacksToCSV, exportFeedbacksToJSON } from '../utils/exportFeedbacks';
import AverageRating from '../components/AverageRating';
import { Settings } from 'lucide-react'; // ADD
 
const ClassroomFeedbackPage = ({ userId }) => {
  const { classroomId } = useParams();
  const { user } = useAuth();
  const [tab, setTab] = useState('submit'); // 'submit' | 'recent'
  const [classroom, setClassroom] = useState(null);
  const [rating, setRating] = useState(null);
  const [comment, setComment] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [feedbacks, setFeedbacks] = useState([]);
  const [page, setPage] = useState(1);
  const perPage = 6;
  const [hasMore, setHasMore] = useState(false);
  const [reportingId, setReportingId] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [total, setTotal] = useState(null);

  // --- NEW: feedback reward config (teacher-only) ---
  const [feedbackRewardConfig, setFeedbackRewardConfig] = useState({
    feedbackRewardEnabled: false,
    feedbackRewardBits: 0,
    feedbackRewardApplyGroupMultipliers: true,
    feedbackRewardApplyPersonalMultipliers: true,
    feedbackRewardAllowAnonymous: false
  });
  const [loadingRewardConfig, setLoadingRewardConfig] = useState(false);
  const [savingRewardConfig, setSavingRewardConfig] = useState(false);

  // --- NEW: server-side rating data ---
  const [serverRatingCounts, setServerRatingCounts] = useState(null);
  const [serverAverage, setServerAverage] = useState(null);

  useEffect(() => {
    const fetchClass = async () => {
      try {
        const res = await getClassroom(classroomId);
        setClassroom(res.data);
      } catch (err) {
        console.error("Failed to load classroom info:", err);
      }
    };
    if (classroomId) fetchClass();
  }, [classroomId]);
  
  // --- NEW: load feedback reward config for teachers ---
  useEffect(() => {
    if (!classroomId || !user || user.role !== 'teacher') return;
    let mounted = true;
    setLoadingRewardConfig(true);
    axios.get(`/api/classroom/${classroomId}/feedback-reward`, { withCredentials: true })
      .then(res => {
        if (!mounted) return;
        setFeedbackRewardConfig({
          feedbackRewardEnabled: !!res.data.feedbackRewardEnabled,
          feedbackRewardBits: Number(res.data.feedbackRewardBits) || 0,
          feedbackRewardApplyGroupMultipliers: !!res.data.feedbackRewardApplyGroupMultipliers,
          feedbackRewardApplyPersonalMultipliers: !!res.data.feedbackRewardApplyPersonalMultipliers,
          feedbackRewardAllowAnonymous: !!res.data.feedbackRewardAllowAnonymous
        });
      })
      .catch(err => {
        console.error('Failed to load feedback reward config', err);
        toast.error('Failed to load feedback reward config');
      })
      .finally(() => {
        if (mounted) setLoadingRewardConfig(false);
      });
    return () => { mounted = false; };
  }, [classroomId, user]);
 
  const fetchClassroomFeedback = async (nextPage = 1, append = false) => {
    if (!classroomId) return;
    try {
      const includeHidden = user && (user.role === 'teacher' || user.role === 'admin') ? '&includeHidden=true' : '';
      const res = await axios.get(`${API_BASE}/api/feedback/classroom/${classroomId}?page=${nextPage}&perPage=${perPage}${includeHidden}`, { withCredentials: true });
      const data = res.data || {};
      const items = Array.isArray(data) ? data : (data.feedbacks || []);
      if (append) setFeedbacks(prev => [...prev, ...items]); else setFeedbacks(items);
      setTotal(typeof data.total === 'number' ? data.total : null);
      setServerRatingCounts(Array.isArray(data.ratingCounts) ? data.ratingCounts : null);
      setServerAverage(typeof data.average === 'number' ? data.average : null);
      const totalCount = typeof data.total === 'number' ? data.total : null;
      setHasMore(totalCount ? (nextPage * perPage < totalCount) : (items.length === perPage));
    } catch (err) {
      console.error('Failed to load classroom feedback', err);
    }
  };
 
  useEffect(() => { fetchClassroomFeedback(1, false); }, [classroomId]);
 
  useFeedbackRealtime({
    scope: 'classroom',
    classroomId,
    setFeedbacks,
    setTotal,
    fetchFeedbacks: fetchClassroomFeedback
  });
 
  const loadMore = async () => {
    const next = page + 1;
    await fetchClassroomFeedback(next, true);
    setPage(next);
  };
 
  const handleSubmit = async (e) => {
    e.preventDefault();
    // client-side validation so button can stay enabled but user gets clear feedback
    if (!rating) {
      toast.error('Please select a star rating before submitting.');
      return;
    }
    if (!comment || comment.trim() === '') {
      toast.error('Please enter a comment before submitting.');
      return;
    }
    try {
      const payload = {
        rating,
        comment,
        classroomId,
        anonymous: !!anonymous
      };

      // IMPORTANT: use the classroom-specific endpoint so backend reward flow runs
      await axios.post(`${API_BASE}/api/feedback/classroom`, payload, { withCredentials: true });

      setRating(null);
      setComment("");
      setAnonymous(false);
      setSubmitted(true);
      toast.success("Thank you for your feedback!");
      setPage(1);
      await fetchClassroomFeedback(1, false);
      // switch to recent tab so user sees their submitted feedback
      setTab('recent');

      // SAVE local fallback so anonymous submit still shows "Your rating"
      try { localStorage.setItem(`feedback_your_rating_classroom_${classroomId}`, String(rating)); } catch (e) { /* ignore */ }
    } catch (err) {
      console.error("Error submitting classroom feedback:", err);
      toast.error(err.response?.data?.error || 'Failed to submit feedback');
    }
  };
 
  const handleToggleHide = async (id, hide) => {
    try {
      // backend expects /:id/hide (no underscore)
      await axios.patch(`${API_BASE}/api/feedback/${id}/hide`, { hide }, { withCredentials: true });
      setFeedbacks(prev => prev.map(f => f._id === id ? { ...f, hidden: hide } : f));
      toast.success(hide ? 'Feedback hidden' : 'Feedback unhidden');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update feedback visibility');
    }
  };

  // --- NEW: Save handler for feedback reward settings (fixes missing function) ---
  const handleSaveFeedbackReward = async () => {
    if (!classroomId) return;
    setSavingRewardConfig(true);
    try {
      const payload = {
        feedbackRewardEnabled: !!feedbackRewardConfig.feedbackRewardEnabled,
        feedbackRewardBits: Math.max(0, Math.round(Number(feedbackRewardConfig.feedbackRewardBits) || 0)),
        feedbackRewardApplyGroupMultipliers: !!feedbackRewardConfig.feedbackRewardApplyGroupMultipliers,
        feedbackRewardApplyPersonalMultipliers: !!feedbackRewardConfig.feedbackRewardApplyPersonalMultipliers,
        feedbackRewardAllowAnonymous: !!feedbackRewardConfig.feedbackRewardAllowAnonymous
      };
      await axios.patch(`/api/classroom/${classroomId}/feedback-reward`, payload, { withCredentials: true });
      toast.success('Feedback reward settings updated');
      // update local state in case backend normalized values
      setFeedbackRewardConfig(prev => ({ ...prev, feedbackRewardBits: payload.feedbackRewardBits }));
    } catch (err) {
      console.error('Failed to save feedback reward config', err);
      toast.error(err.response?.data?.error || 'Failed to update reward settings');
    } finally {
      setSavingRewardConfig(false);
    }
  };
 
  const handleReport = (feedbackId) => {
    setReportingId(feedbackId);
    setReportReason('');
    setReporterEmail(user?.email || '');
  };
 
  const submitReport = async () => {
    try {
      await axios.post(`${API_BASE}/api/feedback/${reportingId}/report`, { reason: reportReason, reporterEmail }, { withCredentials: true });
      toast.success('Report submitted. The classroom teacher/admin will be notified for review.');
      setReportingId(null);
      setReportReason('');
      await fetchClassroomFeedback(1, false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit report');
    }
  };
 
  // compute counts from feedbacks state
  const ratingCounts = React.useMemo(() => {
    const counts = [0,0,0,0,0,0];
    (feedbacks || []).forEach(f => {
      const r = Math.max(1, Math.min(5, Number(f.rating) || 0));
      counts[r] = (counts[r] || 0) + 1;
    });
    return counts;
  }, [feedbacks]);
  const ratingTotal = (feedbacks || []).length;

  const renderDistribution = () => {
    if (!ratingTotal) return null;
    return (
      <div className="rating-distribution mb-4">
        {Array.from({ length: 5 }).map((_, idx) => {
          const star = 5 - idx;
          const count = ratingCounts[star] || 0;
          const pct = ratingTotal ? Math.round((count / ratingTotal) * 100) : 0;
          const visiblePct = pct > 0 ? Math.max(pct, 4) : 0;
          return (
            <div key={star} className="rating-row flex items-center gap-3">
              <div className="rating-label text-sm text-base-content/70 w-14">{star}★</div>
              <div className="rating-bar w-full rounded h-3 overflow-hidden" aria-hidden={count === 0}>
                <div className="rating-fill" style={{ width: `${visiblePct}%` }} title={`${pct}% (${count})`} />
              </div>
              <div className="rating-count text-sm text-base-content/60 w-12 text-right">{count}</div>
            </div>
          );
        })}
      </div>
    );
  };
 
  const sanitize = (s = '') => String(s || '')
    .replace(/[^\w\s-]/g, '')        // remove special chars
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60);                   // limit length
 
  // pull ALL classroom feedback before exporting (respects includeHidden for teacher/admin)
  const fetchAllClassroomFeedbackForExport = async () => {
    if (!classroomId) return [];
    const includeHidden = user && (user.role === 'teacher' || user.role === 'admin') ? '&includeHidden=true' : '';
    const per = 200; // batch size
    let pageNum = 1;
    let all = [];
    while (true) {
      const res = await axios.get(`${API_BASE}/api/feedback/classroom/${classroomId}?page=${pageNum}&perPage=${per}${includeHidden}`, { withCredentials: true });
      const data = res.data || {};
      const items = Array.isArray(data) ? data : (data.feedbacks || []);
      all = all.concat(items);
      const totalCount = typeof data.total === 'number' ? data.total : all.length;
      if (all.length >= totalCount || items.length < per) break;
      pageNum++;
    }
    return all;
  };

  const handleExportClassroomFeedbacks = async () => {
    const all = await fetchAllClassroomFeedbackForExport();
    // Inject classroom meta if missing
    const withMeta = all.map(f => ({
      ...f,
      classroomName: f.classroomName || f.classroom?.name || classroom?.name || '',
      classroomCode: f.classroomCode || f.classroom?.code || classroom?.code || ''
    }));
    const namePart = String(classroom?.name || 'classroom').replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_\-]/g,'');
    const codePart = classroom?.code ? `_${classroom.code}` : '';
    const baseName = `classroom_feedbacks_${namePart}${codePart}`;
    return exportFeedbacksToCSV(withMeta, baseName);
  };

  const handleExportClassroomFeedbacksJSON = async () => {
    const all = await fetchAllClassroomFeedbackForExport();
    const withMeta = all.map(f => ({
      ...f,
      classroomName: f.classroomName || f.classroom?.name || classroom?.name || '',
      classroomCode: f.classroomCode || f.classroom?.code || classroom?.code || ''
    }));
    const namePart = String(classroom?.name || 'classroom').replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_\-]/g,'');
    const codePart = classroom?.code ? `_${classroom.code}` : '';
    const baseName = `classroom_feedbacks_${namePart}${codePart}`;
    return exportFeedbacksToJSON(withMeta, baseName);
  };
 
  // NEW: collapsed state for the reward settings (persisted per classroom)
  const [showRewardSettings, setShowRewardSettings] = useState(() => {
    try { return localStorage.getItem(`cfp_reward_settings_open_${classroomId}`) === '1'; } catch { return false; }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`cfp_reward_settings_open_${classroomId}`, showRewardSettings ? '1' : '0');
    } catch {}
  }, [showRewardSettings, classroomId]);

  return (
    <div className="min-h-screen bg-base-200 flex flex-col justify-between">
      <div className="flex-grow p-4">
        <div className="card w-full max-w-3xl mx-auto shadow-xl bg-base-100 mt-8">
          <div className="card-body">
            {/* HEADER + gear toggle */}
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="card-title text-primary">
                {classroom ? `${classroom.name}${classroom.code ? ` (${classroom.code})` : ''} Feedback` : 'Classroom Feedback'}
              </h2>
              {user && user.role === 'teacher' && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm gap-2"
                  onClick={() => setShowRewardSettings(s => !s)}
                  title="Feedback reward settings"
                >
                  <Settings size={16} />
                  {showRewardSettings ? 'Hide settings' : 'Show settings'}
                </button>
              )}
            </div>

            <AverageRating
              feedbacks={feedbacks}
              user={user}
              yourRatingLocal={Number(localStorage.getItem(`feedback_your_rating_classroom_${classroomId}`)) || null}
              totalOverride={total}
              ratingCountsOverride={serverRatingCounts}
              averageOverride={serverAverage}
            />
            <RatingDistribution
              feedbacks={feedbacks}
              ratingCountsOverride={serverRatingCounts}
              totalOverride={total}
            />

            {/* STUDENT: show reward badge if enabled */}
            {classroom && classroom.feedbackRewardEnabled && (
              <div className="alert alert-info mt-4 max-w-3xl mx-auto">
                <div>
                  <strong>Feedback reward:</strong> {Number(classroom.feedbackRewardBits) || feedbackRewardConfig.feedbackRewardBits} ₿
                  { (classroom.feedbackRewardApplyGroupMultipliers || classroom.feedbackRewardApplyPersonalMultipliers) && (
                    <span className="ml-2 text-sm text-gray-600"> (multipliers apply)</span>
                  )}
                  {/* SHOW NOTE ABOUT ANONYMOUS AWARDING */}
                  { classroom.feedbackRewardAllowAnonymous ? (
                    <div className="text-xs text-gray-600 mt-1">
                      Teacher allows awarding when submitting anonymously (signed-in users only).
                    </div>
                  ) : (
                    <div className="text-xs text-red-600 mt-1">
                      Note: Anonymous submissions will NOT receive the feedback reward in this classroom. Uncheck "Submit as Anonymous" to be eligible.
                    </div>
                  ) }
                </div>
              </div>
            )}

            {/* TEACHER: Feedback reward settings (collapsible) */}
            {user && user.role === 'teacher' && showRewardSettings && (
              <div className="card bg-base-100 border border-base-200 p-4 mt-4 max-w-3xl mx-auto">
                <h4 className="font-semibold mb-2">Feedback Reward (₿its)</h4>
                {loadingRewardConfig ? (
                  <div className="text-sm text-gray-500">Loading...</div>
                ) : (
                  <div className="space-y-3">
                    <label className="flex items-center justify-between">
                      <span>Enable reward for submitting feedback</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-success"
                        checked={feedbackRewardConfig.feedbackRewardEnabled}
                        onChange={(e) => setFeedbackRewardConfig(prev => ({ ...prev, feedbackRewardEnabled: e.target.checked }))}
                      />
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                      <div>
                        <label className="label"><span className="label-text">Allow awarding anonymous submissions</span></label>
                        <input
                          type="checkbox"
                          className="toggle toggle-secondary"
                          checked={feedbackRewardConfig.feedbackRewardAllowAnonymous}
                          onChange={(e) => setFeedbackRewardConfig(prev => ({ ...prev, feedbackRewardAllowAnonymous: e.target.checked }))}
                        />
                      </div>
                      <div>
                        <label className="label"><span className="label-text">₿ (base)</span></label>
                        <input
                          type="number"
                          min={0}
                          className="input input-bordered w-full"
                          value={feedbackRewardConfig.feedbackRewardBits}
                          onChange={(e) => setFeedbackRewardConfig(prev => ({ ...prev, feedbackRewardBits: Number(e.target.value || 0) }))}
                        />
                      </div>
                      <div>
                        <label className="label"><span className="label-text">Apply group multipliers</span></label>
                        <input
                          type="checkbox"
                          className="toggle toggle-primary"
                          checked={feedbackRewardConfig.feedbackRewardApplyGroupMultipliers}
                          onChange={(e) => setFeedbackRewardConfig(prev => ({ ...prev, feedbackRewardApplyGroupMultipliers: e.target.checked }))}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="label"><span className="label-text">Apply personal multipliers</span></label>
                      <input
                        type="checkbox"
                        className="toggle toggle-primary"
                        checked={feedbackRewardConfig.feedbackRewardApplyPersonalMultipliers}
                        onChange={(e) => setFeedbackRewardConfig(prev => ({ ...prev, feedbackRewardApplyPersonalMultipliers: e.target.checked }))}
                      />
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button
                        className="btn btn-ghost"
                        onClick={() => {
                          // reload config
                          setLoadingRewardConfig(true);
                          axios.get(`/api/classroom/${classroomId}/feedback-reward`, { withCredentials: true })
                            .then(res => setFeedbackRewardConfig({
                              feedbackRewardEnabled: !!res.data.feedbackRewardEnabled,
                              feedbackRewardBits: Number(res.data.feedbackRewardBits) || 0,
                              feedbackRewardApplyGroupMultipliers: !!res.data.feedbackRewardApplyGroupMultipliers,
                              feedbackRewardApplyPersonalMultipliers: !!res.data.feedbackRewardApplyPersonalMultipliers,
                              feedbackRewardAllowAnonymous: !!res.data.feedbackRewardAllowAnonymous
                            }))
                            .catch(() => toast.error('Failed to reload'))
                            .finally(() => setLoadingRewardConfig(false));
                        }}
                      >
                        Reload
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleSaveFeedbackReward}
                        disabled={savingRewardConfig}
                      >
                        {savingRewardConfig ? 'Saving...' : 'Save'}
                      </button>
                    </div>

                    <p className="text-xs text-gray-500">
                      Note: students can only be rewarded once per classroom. Anonymous submissions are counted but the backend prevents duplicate rewards per student/IP.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center mb-4">
              <div className="ml-auto">
                <ExportButtons
                  onExportCSV={handleExportClassroomFeedbacks}
                  onExportJSON={handleExportClassroomFeedbacksJSON}
                  userName={classroom ? classroom.name : ''}
                  exportLabel="classroom_feedbacks"
                />
              </div>
            </div>

            {/* tabs follow */}
            {/* Tabs */}
            <div role="tablist" className="tabs tabs-boxed mb-4">
              <a role="tab" className={`tab ${tab === 'submit' ? 'tab-active' : ''}`} onClick={() => setTab('submit')}>Submit</a>
              <a role="tab" className={`tab ${tab === 'recent' ? 'tab-active' : ''}`} onClick={() => setTab('recent')}>Recent</a>
            </div>
 
            {/* Tab panes */}
            {tab === 'submit' && (
              <div>
                <form onSubmit={handleSubmit} key={submitted} className="space-y-4">
                  <div>
                    <label className="label"><span className="label-text">Star Rating</span></label>
                    <div className="rating">
                      {[1,2,3,4,5].map(star => (
                        <input
                          key={star}
                          type="radio"
                          name="rating"
                          className="mask mask-star-2 bg-yellow-400 feedback-star-input"
                          checked={rating === star}
                          onChange={() => setRating(star)}
                        />
                      ))}
                    </div>
                  </div>
 
                  <div>
                    <label className="label"><span className="label-text">Your Comment</span></label>
                    <textarea className="textarea textarea-bordered w-full" value={comment} onChange={(e)=>setComment(e.target.value)} placeholder="Type your feedback here..." rows={4} />
                  </div>
 
                  <div className="form-control">
                    <label className="cursor-pointer label">
                      <span className="label-text">Submit as Anonymous</span>
                      <input type="checkbox" className="toggle toggle-primary" checked={anonymous} onChange={(e)=>setAnonymous(e.target.checked)} />
                    </label>
                  </div>
 
                  <button type="submit" className="btn btn-success w-full">Submit</button>
                </form>
              </div>
            )}
 
            {tab === 'recent' && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Recent Classroom Feedback</h3>
                  {hasMore && <button className="btn btn-outline btn-sm" onClick={loadMore}>Load more</button>}
                </div>
                <FeedbackList
                  feedbacks={feedbacks}
                  total={total}
                  showModeration={user && (user.role === 'teacher' || user.role === 'admin')}
                  onToggleHide={handleToggleHide}
                  onReport={handleReport}
                />
                {user && (user.role === 'teacher' || user.role === 'admin') && (
                  <ModerationLog classroomId={classroomId} />
                )}
              </div>
            )}
 
          </div>
        </div>
      </div>
 
      <Footer />
 
      {/* Report Modal */}
      {reportingId && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Report Feedback</h3>
            <p className="py-2">Tell us why you're reporting this feedback. The classroom teacher/admin will be notified.</p>
            <textarea className="textarea textarea-bordered w-full" rows={4} value={reportReason} onChange={(e)=>setReportReason(e.target.value)} placeholder="Reason for reporting..." />
            <input className="input input-bordered w-full mt-2" placeholder="Your email (optional)" value={reporterEmail} onChange={(e)=>setReporterEmail(e.target.value)} />
            <div className="modal-action">
              <button className="btn" onClick={() => setReportingId(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitReport} disabled={!reportReason.trim()}>Submit Report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
 
export default ClassroomFeedbackPage;