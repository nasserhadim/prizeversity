import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import FeedbackList from '../components/FeedbackList';
import useFeedbackRealtime from '../hooks/useFeedbackRealtime';
import ExportButtons from '../components/ExportButtons';
import { exportFeedbacksToCSV, exportFeedbacksToJSON } from '../utils/exportFeedbacks';

export default function AdminModeration() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);

  // server-side filter/sort state
  const [actionFilter, setActionFilter] = useState('all');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [reporterEmailFilter, setReporterEmailFilter] = useState('');

  const fetchLogs = async (p = 1) => {
    try {
      setLoading(true);
      const q = new URLSearchParams();
      q.set('page', p);
      q.set('perPage', perPage);
      if (actionFilter !== 'all') q.set('action', actionFilter);
      if (reporterEmailFilter) q.set('reporterEmail', reporterEmailFilter);
      q.set('sortField', sortField);
      q.set('sortDir', sortDir);
      const res = await axios.get(`${API_BASE}/api/feedback/moderation-log?${q.toString()}`, { withCredentials: true });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || null);
      setPage(res.data.page || 1);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load moderation logs');
    } finally {
      setLoading(false);
    }
  };

  // helpful: fetch corresponding feedbacks for display
  const hydrateFeedbacks = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/feedback?page=1&perPage=100&includeHidden=true`, { withCredentials: true });
      const items = res.data && res.data.feedbacks ? res.data.feedbacks : (Array.isArray(res.data) ? res.data : []);
      setFeedbacks(items);
    } catch (err) {
      console.error('Failed to fetch feedbacks', err);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    fetchLogs(1);
    hydrateFeedbacks();
  }, [user, actionFilter, sortField, sortDir, reporterEmailFilter]);
 
  // subscribe admin events (separate hook avoids duplicating handlers)
  useFeedbackRealtime({
    scope: 'admin',
    fetchLogs,
    hydrateFeedbacks
  });

  // Export handlers for admin page
  const handleExportAdminFeedbacksCSV = async () => {
    const base = `admin_feedbacks`;
    return exportFeedbacksToCSV(feedbacks || [], base);
  };

  const handleExportAdminFeedbacksJSON = async () => {
    const base = `admin_feedbacks`;
    return exportFeedbacksToJSON(feedbacks || [], base);
  };

  const handleHide = async (feedbackId, hide) => {
    try {
      await axios.patch(`${API_BASE}/api/feedback/${feedbackId}/hide`, { hide }, { withCredentials: true });
      toast.success(hide ? 'Hidden' : 'Unhidden');
      fetchLogs(page);
      hydrateFeedbacks();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleDelete = async (feedbackId) => {
    if (!confirm('Delete this feedback permanently?')) return;
    try {
      await axios.delete(`${API_BASE}/api/feedback/${feedbackId}`, { withCredentials: true });
      toast.success('Deleted');
      fetchLogs(page);
      hydrateFeedbacks();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleRespond = async (feedbackId) => {
    const response = prompt('Enter your response (will be stored in moderation log):');
    if (!response) return;
    try {
      await axios.post(`${API_BASE}/api/feedback/${feedbackId}/respond`, { response }, { withCredentials: true });
      toast.success('Response saved');
      fetchLogs(page);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to respond');
    }
  };

  if (!user || user.role !== 'admin') {
    return <div className="p-6">Access denied — admin only.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Moderation</h1>

      {/* Export controls for admins (exports currently-visible feedback list) */}
      <div className="mb-4 flex justify-end">
        <ExportButtons
          onExportCSV={handleExportAdminFeedbacksCSV}
          onExportJSON={handleExportAdminFeedbacksJSON}
          userName="admin"
          exportLabel="admin_feedbacks"
        />
      </div>

      <div className="mb-4 flex gap-3 items-center">
        <label className="text-sm">Action</label>
        <select className="select select-sm" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="report">Report</option>
          <option value="hide">Hide</option>
          <option value="unhide">Unhide</option>
          <option value="delete">Delete</option>
          <option value="response">Response</option>
        </select>
        <label className="text-sm">Sort</label>
        <select className="select select-sm" value={sortField} onChange={(e) => setSortField(e.target.value)}>
          <option value="createdAt">Date</option>
          <option value="action">Action</option>
        </select>
        <select className="select select-sm" value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
        <input className="input input-sm ml-2" placeholder="Reporter email" value={reporterEmailFilter} onChange={(e)=>setReporterEmailFilter(e.target.value)} />
        <button className="btn btn-sm ml-2" onClick={() => fetchLogs(1)}>Apply</button>
      </div>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">Moderation Log</h2>
        {loading ? <div>Loading...</div> : (
          <ul className="space-y-3">
            {logs.map(l => (
              <li key={l._id} className="p-3 border rounded bg-base-100">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs text-gray-500">{new Date(l.createdAt).toLocaleString()}</div>
                    <div className="font-medium">{l.action.toUpperCase()} {l.feedback ? `— rating ${l.feedback.rating}` : ''}</div>
                    {l.reason && <div className="mt-1">{l.reason}</div>}
                    {l.reporterEmail && <div className="text-xs text-gray-500">Reporter: {l.reporterEmail}</div>}
                  </div>
                  <div className="flex flex-col gap-2">
                    {l.feedback && l.feedback._id && (
                      <>
                        <button className="btn btn-xs" onClick={() => handleHide(l.feedback._id, !(l.feedback.hidden))}>
                          {l.feedback.hidden ? 'Unhide' : 'Hide'}
                        </button>
                        <button className="btn btn-xs btn-error" onClick={() => handleDelete(l.feedback._id)}>Delete</button>
                        <button className="btn btn-xs btn-ghost" onClick={() => handleRespond(l.feedback._id)}>Respond</button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {total > perPage && (
          <div className="mt-3 flex justify-between items-center">
            <div className="text-sm text-gray-500">Showing {logs.length} of {total}</div>
            <div className="space-x-2">
              <button className="btn btn-sm" onClick={() => fetchLogs(Math.max(1, page - 1))}>Prev</button>
              <button className="btn btn-sm" onClick={() => fetchLogs(page + 1)}>Next</button>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Recent Site Feedback (admin view)</h2>
        <FeedbackList feedbacks={feedbacks} showModeration={true} onToggleHide={(id, hide)=>handleHide(id, hide)} />
      </section>
    </div>
  );
}