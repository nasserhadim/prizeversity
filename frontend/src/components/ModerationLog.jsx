import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../config/api';
import { useAuth } from '../context/AuthContext';

export default function ModerationLog({ classroomId = null }) {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [total, setTotal] = useState(0);

  const fetchLogs = async (p = 1) => {
    try {
      const q = classroomId ? `?classroomId=${classroomId}&page=${p}&perPage=${perPage}` : `?page=${p}&perPage=${perPage}`;
      const res = await axios.get(`${API_BASE}/api/feedback/moderation-log${q}`, { withCredentials: true });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
      setPage(res.data.page || 1);
    } catch (err) {
      console.error('Failed to load moderation logs', err);
      setLogs([]);
    }
  };

  useEffect(() => { fetchLogs(1); }, [classroomId, user]);

  if (!user || !(user.role === 'teacher' || user.role === 'admin' || classroomId === null)) {
    // teachers can view classroom logs for their classroom; admins can view site logs
  }

  return (
    <div className="card bg-base-100 p-4 shadow-lg border border-base-300">
      <h4 className="text-lg font-semibold mb-3 text-base-content">Moderation Log</h4>
      {logs.length === 0 ? (
        <div className="text-sm text-gray-500">No moderation entries.</div>
      ) : (
        <div className="space-y-3">
          {logs.map(l => (
            <div key={l._id} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
              <div className="min-w-0">
                <div className="text-sm text-base-content/60">{new Date(l.createdAt).toLocaleString()}</div>
                <div className="text-sm text-base-content/80 mt-1">
                  <span className="font-semibold text-base-content/90 mr-2">{l.action?.toUpperCase()}</span>
                  <span className="text-base-content/70">— rating {l.feedback?.rating ?? '—'}</span>
                </div>
                {/* show reporter email only to teachers/admins */}
                {l.reporterEmail && user && (user.role === 'admin' || user.role === 'teacher') && (
                  <div className="text-xs text-base-content/60 mt-1">Reporter: {l.reporterEmail}</div>
                )}
              </div>
              <div className="mt-2 sm:mt-0 text-sm text-base-content/80">
                {l.moderator ? `${l.moderator.firstName || ''} ${l.moderator.lastName || ''}`.trim() : 'System'}
              </div>
            </div>
          ))}
        </div>
      )}

      {total > perPage && (
        <div className="mt-3 flex justify-between items-center">
          <div className="text-xs text-gray-500">Showing {Math.min(total, page * perPage)} of {total}</div>
          <div className="space-x-2">
            <button className="btn btn-xs" onClick={() => { if (page>1) { fetchLogs(page-1); }}}>Prev</button>
            <button className="btn btn-xs" onClick={() => { if (page * perPage < total) { fetchLogs(page+1); }}}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}