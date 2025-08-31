import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config/api';
import Footer from '../components/Footer';
import { toast } from 'react-hot-toast';
import FeedbackList from '../components/FeedbackList';
import '../styles/Feedback.css';
import ModerationLog from '../components/ModerationLog';
import { useAuth } from '../context/AuthContext';
 
const FeedbackPage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('submit'); // 'submit' | 'recent'
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
      // prefer total if provided
      const totalCount = typeof data.total === 'number' ? data.total : null;
      setHasMore(totalCount ? (nextPage * perPage < totalCount) : (items.length === perPage));
    } catch (err) {
      console.error('Failed to load site feedback', err);
    }
  };
 
  useEffect(() => {
    fetchSiteFeedback(1, false);
  }, [user]);
 
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
 
  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <main className="flex-grow p-4 pt-24">
        <div className="card w-full max-w-3xl mx-auto shadow-xl bg-base-100">
          <div className="card-body">
            <h2 className="card-title text-primary mb-4">Site Feedback</h2>

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