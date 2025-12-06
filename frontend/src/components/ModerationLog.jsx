import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../config/api';
import { useAuth } from '../context/AuthContext';
import ExportButtons from './ExportButtons';
import toast from 'react-hot-toast';
import { subscribeToFeedbackEvents } from '../utils/socket';

export default function ModerationLog({ classroomId = null }) {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [total, setTotal] = useState(0);
  const [classroomMeta, setClassroomMeta] = useState(null);

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

  // subscribe to realtime moderation events and refresh
  useEffect(() => {
    const unsub = subscribeToFeedbackEvents((e) => {
      if (['moderation_log_updated','feedback_report','feedback_created','feedback_updated','feedback_deleted'].includes(e.event)) {
        // refresh logs when something relevant happens
        fetchLogs(1);
      }
    });
    return () => unsub();
  }, [classroomId, user]);

  // fetch classroom metadata (name, code) for classroomId
  useEffect(() => {
    if (!classroomId) { setClassroomMeta(null); return; }
    axios.get(`/api/classroom/${classroomId}`, { withCredentials: true })
      .then(r => setClassroomMeta(r.data))
      .catch(()=>setClassroomMeta(null));
  }, [classroomId]);

  // Export helpers for moderation logs (CSV + JSON)
  const exportLogsToCSV = async (logsArr = [], filenameBase = 'moderation_logs') => {
    function esc(v) { if (v === null || v === undefined) return ''; return `"${String(v).replace(/"/g, '""')}"`; }
    const header = ['id','action','reason','reporterEmail','moderatorId','moderatorName','feedbackId','feedbackRating','classroomId'];
    if (classroomId) header.push('classroomName','classroomCode');
    header.push('createdAt');
    const rows = (logsArr || []).map(l => {
      const moderatorName = l.moderator ? `${l.moderator.firstName || ''} ${l.moderator.lastName || ''}`.trim() : '';
      const row = [
        esc(l._id),
        esc(l.action),
        esc(l.reason),
        esc(l.reporterEmail),
        esc(l.moderator ? (l.moderator._id || l.moderator) : ''),
        esc(moderatorName),
        esc(l.feedback ? (l.feedback._id || l.feedback) : ''),
        esc(l.feedback && l.feedback.rating ? l.feedback.rating : ''),
        esc(l.classroom || ''),
      ];
      if (classroomId) {
        row.push(
          esc(classroomMeta?.name || ''),
          esc(classroomMeta?.code || '')
        );
      }
      row.push(esc(new Date(l.createdAt || '').toISOString()));
      return row.join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${filenameBase}_${ts}.csv`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return filename;
  };

  const exportLogsToJSON = async (logsArr = [], filenameBase = 'moderation_logs') => {
    const data = (logsArr || []).map(l => {
      const moderatorName = l.moderator ? `${l.moderator.firstName || ''} ${l.moderator.lastName || ''}`.trim() : '';
      const baseObj = {
        id: l._id,
        action: l.action,
        reason: l.reason,
        reporterEmail: l.reporterEmail,
        moderatorId: l.moderator ? (l.moderator._id || l.moderator) : null,
        moderatorName,
        feedbackId: l.feedback ? (l.feedback._id || l.feedback) : null,
        feedbackRating: l.feedback && l.feedback.rating ? l.feedback.rating : null,
        classroomId: l.classroom || null,
        createdAt: l.createdAt
      };
      if (classroomId) {
        baseObj.classroomName = classroomMeta?.name || null;
        baseObj.classroomCode = classroomMeta?.code || null;
      }
      return baseObj;
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${filenameBase}_${ts}.json`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return filename;
  };

  const middleTruncateId = (id) => {
    if (!id) return '';
    const s = String(id);
    return s.length <= 16 ? s : `${s.slice(0,6)}…${s.slice(-6)}`;
  };

  if (!user || !(user.role === 'teacher' || user.role === 'admin' || classroomId === null)) {
    // teachers can view classroom logs for their classroom; admins can view site logs
  }

  return (
    <div className="card bg-base-100 p-4 shadow-lg border border-base-300">
      <div className="flex items-start justify-between mb-3">
        <h4 className="text-lg font-semibold text-base-content">Moderation Log</h4>
        <div>
          {/*
            Use descriptive filename:
              - classroom-specific: classroom_<ID>_moderation_logs
              - site-wide: site_moderation_logs
          */}
          {(() => {
            const safe = (s='') => s.replace(/[^a-zA-Z0-9_-]/g,'_');
            const base = classroomId
              ? `classroom_${safe(classroomMeta?.name || 'class')}${classroomMeta?.code ? `_${safe(classroomMeta.code)}` : ''}_moderation_logs`
              : 'site_moderation_logs';
            return (
              <ExportButtons
                onExportCSV={() => exportLogsToCSV(logs || [], base)}
                onExportJSON={() => exportLogsToJSON(logs || [], base)}
                userName={user ? `${user.firstName || ''}_${user.lastName || ''}`.trim() : 'moderator'}
                exportLabel="moderation_logs"
              />
            );
          })()}
        </div>
      </div>
      {logs.length === 0 ? (
        <div className="text-sm text-gray-500">No moderation entries.</div>
      ) : (
        <div className="space-y-3">
          {logs.map(l => (
            <div key={l._id} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
              <div className="min-w-0">
                <div className="text-xs text-base-content/60">{new Date(l.createdAt).toLocaleString()}</div>
                <div className="text-sm text-base-content/80 mt-1">
                  <span className="font-semibold mr-2">{l.action?.toUpperCase()}</span>
                  {l.feedback && (
                    <>
                      <span>rating {l.feedback.rating}</span>
                      <span className="ml-2 font-mono">
                        {middleTruncateId(l.feedback._id)}
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs ml-1"
                          onClick={() => navigator.clipboard.writeText(String(l.feedback._id))}
                          title="Copy feedback id"
                        >Copy</button>
                      </span>
                      {l.feedback.comment && (
                        <span className="ml-2 italic text-base-content/50">
                          “{String(l.feedback.comment).slice(0,60)}{l.feedback.comment.length > 60 ? '…' : ''}”
                        </span>
                      )}
                    </>
                  )}
                </div>
                {/* reporter email */}
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