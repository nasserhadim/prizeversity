import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config/api';
import Footer from '../components/Footer';
import { toast } from 'react-hot-toast';
import FeedbackList from '../components/FeedbackList';
import '../styles/Feedback.css';
import ModerationLog from '../components/ModerationLog';
import RatingDistribution from '../components/RatingDistribution';
import ExportButtons from '../components/ExportButtons';
import { exportFeedbacksToCSV, exportFeedbacksToJSON } from '../utils/exportFeedbacks';
import { useAuth } from '../context/AuthContext';
import { subscribeToFeedbackEvents } from '../utils/socket';
import useFeedbackRealtime from '../hooks/useFeedbackRealtime';
import AverageRating from '../components/AverageRating';
 
const FeedbackPage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('submit');
  const [rating, setRating] = useState(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [feedbacks, setFeedbacks] = useState([]);
  const [page, setPage] = useState(1);
  const perPage = 6;
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(null);
  // report flow state
  const [reportingId, setReportingId] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [serverRatingCounts, setServerRatingCounts] = useState(null);
  const [serverAverage, setServerAverage] = useState(null);
 
  const fetchSiteFeedback = async (nextPage = 1, append = false) => {
    try {
      const includeHidden = user && (user.role === 'teacher' || user.role === 'admin') ? '&includeHidden=true' : '';
      const res = await axios.get(`${API_BASE}/api/feedback?page=${nextPage}&perPage=${perPage}${includeHidden}`, { withCredentials: true });
      const data = res.data || {};
      const items = Array.isArray(data) ? data : (data.feedbacks || []);
      if (append) {
        setFeedbacks(prev => [...prev, ...items]);
      } else {
        setFeedbacks(items);
      }
      setTotal(typeof data.total === 'number' ? data.total : null);
      setServerRatingCounts(Array.isArray(data.ratingCounts) ? data.ratingCounts : null);
      setServerAverage(typeof data.average === 'number' ? data.average : null);
      const totalCount = typeof data.total === 'number' ? data.total : null;
      setHasMore(totalCount ? (nextPage * perPage < totalCount) : (items.length === perPage));
    } catch (err) {
      console.error('Failed to load site feedback', err);
    }
  };
 
  useEffect(() => {
    fetchSiteFeedback(1, false);
  }, [user]);
 
  // keep realtime subscription (hook) as before
  useFeedbackRealtime({
    scope: 'site',
    setFeedbacks,
    setTotal,
    fetchFeedbacks: fetchSiteFeedback
  });
 
  const loadMore = async () => {
    const next = page + 1;
    await fetchSiteFeedback(next, true);
    setPage(next);
  };
 
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) {
      toast.error("Please select a star rating before submitting.");
      return;
    }
    try {
      await axios.post(`${API_BASE}/api/feedback`, {
        rating,
        comment,
        anonymous: !!anonymous,
        userId: anonymous ? null : user?._id
      }, { withCredentials: true });
      setRating(null);
      setComment('');
      setSubmitted(true);
      setAnonymous(false);
      toast.success("Thank you for your feedback!");
      setPage(1);
      await fetchSiteFeedback(1, false);
      // show the recent tab after successful submit
      setTab('recent');

      // SAVE local fallback so anonymous submit still shows "Your rating"
      try { localStorage.setItem('feedback_your_rating_site', String(rating)); } catch (e) { /* ignore */ }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit feedback');
    }
  };
 
  const handleToggleHide = async (id, hide) => {
    try {
      // call the correct hide endpoint
      await axios.patch(`${API_BASE}/api/feedback/${id}/hide`, { hide }, { withCredentials: true });
     // optimistic update
     setFeedbacks(prev => prev.map(f => f._id === id ? { ...f, hidden: hide } : f));
     toast.success(hide ? 'Feedback hidden' : 'Feedback unhidden');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update feedback visibility');
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
      toast.success('Report submitted. Site admin(s) will review.');
      setReportingId(null);
      setReportReason('');
      setReporterEmail('');
      // refresh list
      setPage(1);
      await fetchSiteFeedback(1, false);
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

  // pull ALL site feedback before exporting (respects includeHidden for admin/teacher)
  const fetchAllSiteFeedbackForExport = async () => {
    const includeHidden = user && (user.role === 'teacher' || user.role === 'admin') ? '&includeHidden=true' : '';
    const per = 200; // batch size
    let pageNum = 1;
    let all = [];
    while (true) {
      const res = await axios.get(`${API_BASE}/api/feedback?page=${pageNum}&perPage=${per}${includeHidden}`, { withCredentials: true });
      const data = res.data || {};
      const items = Array.isArray(data) ? data : (data.feedbacks || []);
      all = all.concat(items);
      const totalCount = typeof data.total === 'number' ? data.total : all.length;
      if (all.length >= totalCount || items.length < per) break;
      pageNum++;
    }
    return all;
  };

  const handleExportFeedbacks = async () => {
    const all = await fetchAllSiteFeedbackForExport();
    const base = user ? `${(user.firstName || '')}_${(user.lastName || '')}_feedbacks`.replace(/\s+/g, '_') : 'site_feedbacks';
    return exportFeedbacksToCSV(all, base);
  };

  const handleExportFeedbacksJSON = async () => {
    const all = await fetchAllSiteFeedbackForExport();
    const base = user ? `${(user.firstName || '')}_${(user.lastName || '')}_feedbacks`.replace(/\s+/g, '_') : 'site_feedbacks';
    return exportFeedbacksToJSON(all, base);
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <main className="flex-grow p-4 pt-24">
        <div className="card w-full max-w-3xl mx-auto shadow-xl bg-base-100">
          <div className="card-body">
            <h2 className="card-title text-primary mb-4">Site Feedback</h2>

            <AverageRating
              feedbacks={feedbacks}
              user={user}
              yourRatingLocal={Number(localStorage.getItem('feedback_your_rating_site')) || null}
              totalOverride={total}
              ratingCountsOverride={serverRatingCounts}
              averageOverride={serverAverage}
            />
            <RatingDistribution
              feedbacks={feedbacks}
              ratingCountsOverride={serverRatingCounts}
              totalOverride={total}
            />

            {/* Export buttons (CSV) */}
            <div className="flex items-center mb-4">
              <div className="ml-auto">
                <ExportButtons
                  onExportCSV={handleExportFeedbacks}
                  onExportJSON={handleExportFeedbacksJSON}
                  userName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
                  exportLabel="feedbacks"
                />
              </div>
            </div>

            {/* Tabs */}
            <div role="tablist" className="tabs tabs-boxed mb-4">
              <a role="tab" className={`tab ${tab === 'submit' ? 'tab-active' : ''}`} onClick={() => setTab('submit')}>Submit</a>
              <a role="tab" className={`tab ${tab === 'recent' ? 'tab-active' : ''}`} onClick={() => setTab('recent')}>Recent</a>
            </div>

            {/* Tab panes */}
            {tab === 'submit' && (
              <div>
                {!user ? (
                  <div className="p-4 border rounded bg-base-100">
                    <p className="mb-3">To reduce spam we require you to sign in before submitting site-wide feedback.</p>
                    <div className="flex gap-2">
                      <a href="/api/auth/google" className="btn btn-primary">Sign in with Google</a>
                      <a href="/api/auth/microsoft" className="btn btn-outline">Sign in with Microsoft</a>
                    </div>
                    <p className="text-xs text-base-content/60 mt-3">Once signed in you'll be able to submit feedback. Classroom feedback remains available in-classroom.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} key={submitted} className="space-y-4">
                    <div>
                      <label className="label">
                        <span className="label-text">Star Rating</span>
                      </label>
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
                      <label className="label">
                        <span className="label-text">Your Comment</span>
                      </label>
                      <textarea
                        className="textarea textarea-bordered w-full"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Type your feedback here..."
                        rows={4}
                      />
                    </div>

                    {user && (
                      <div className="form-control">
                        <label className="cursor-pointer label">
                          <span className="label-text">Submit as Anonymous</span>
                          <input
                            type="checkbox"
                            className="toggle toggle-primary"
                            checked={anonymous}
                            onChange={(e) => setAnonymous(e.target.checked)}
                          />
                        </label>
                      </div>
                    )}

                    <button type="submit" className="btn btn-success w-full">Submit</button>
                  </form>
                )}
              </div>
            )}

            {tab === 'recent' && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Recent Feedback</h3>
                  {hasMore && <button className="btn btn-outline btn-sm" onClick={loadMore}>Load more</button>}
                </div>
                <FeedbackList
                  feedbacks={feedbacks}
                  total={total}
                  showModeration={user && (user.role === 'teacher' || user.role === 'admin')}
                  onToggleHide={handleToggleHide}
                  onReport={handleReport}
                />
              </div>
            )}
          </div>
        </div>
      </main>
 
      <Footer />
      {/* Report Modal */}
      {reportingId && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Report Feedback</h3>
            <p className="py-2">Tell us why you're reporting this feedback. Site admins will review and take action if needed.</p>
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
 
export default FeedbackPage;