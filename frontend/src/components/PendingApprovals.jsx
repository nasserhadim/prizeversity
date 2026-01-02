import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function PendingApprovals({ classroomId, onCountChange }) {
  const [list, setList] = useState([]);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectingId, setRejectingId] = useState(null);

  // NEW: UI controls
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'group' | 'other'
  const [sortField, setSortField] = useState('createdAt'); // 'createdAt' | 'amount' | 'student' | 'requestor'
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'

  // NEW: bulk selection + bulk reject modal
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');

  // Fetch pending assignments whenever classroomId changes
  useEffect(() => {
    axios
      .get(`/api/pending-assignments/${classroomId}`, { withCredentials: true })
      .then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch(() => setList([]));
  }, [classroomId]);

  // Bubble count up to parent (optional)
  useEffect(() => {
    if (typeof onCountChange === 'function') onCountChange(list.length);
  }, [list.length, onCountChange]);

  const normalize = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  const isGroupAdjust = (pa) => /group\s+adjust/i.test(String(pa?.description || ''));

  const displayName = (u) => {
    const name = `${u?.firstName || ''} ${u?.lastName || ''}`.trim();
    return name || u?.email || 'Unknown';
  };

  const visible = useMemo(() => {
    const q = normalize(search);

    let items = (list || []).slice();

    // filter by type
    if (typeFilter === 'group') items = items.filter((pa) => isGroupAdjust(pa));
    if (typeFilter === 'other') items = items.filter((pa) => !isGroupAdjust(pa));

    // deep search
    if (q) {
      items = items.filter((pa) => {
        const student = pa?.student || {};
        const reqBy = pa?.requestedBy || {};
        const parts = [
          pa?._id,
          pa?.description,
          String(pa?.amount ?? ''),
          pa?.createdAt ? new Date(pa.createdAt).toLocaleString() : '',
          displayName(student),
          student?.email,
          displayName(reqBy),
          reqBy?.email,
        ]
          .filter(Boolean)
          .map(normalize)
          .join(' ');
        return parts.includes(q);
      });
    }

    // sorting
    const dir = sortDir === 'asc' ? 1 : -1;
    const cmpStr = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' });

    items.sort((a, b) => {
      switch (sortField) {
        case 'amount': {
          const av = Number(a?.amount) || 0;
          const bv = Number(b?.amount) || 0;
          return (av - bv) * dir;
        }
        case 'student': {
          const an = displayName(a?.student);
          const bn = displayName(b?.student);
          return cmpStr(an, bn) * dir;
        }
        case 'requestor': {
          const an = displayName(a?.requestedBy);
          const bn = displayName(b?.requestedBy);
          return cmpStr(an, bn) * dir;
        }
        case 'createdAt':
        default: {
          const av = new Date(a?.createdAt || 0).getTime();
          const bv = new Date(b?.createdAt || 0).getTime();
          return (av - bv) * dir;
        }
      }
    });

    return items;
  }, [list, search, typeFilter, sortField, sortDir]);

  // NEW: keep selection in sync with existing list (drop ids that no longer exist)
  useEffect(() => {
    const live = new Set((list || []).map((x) => String(x?._id)).filter(Boolean));
    setSelectedIds((prev) => {
      const next = new Set();
      for (const id of prev) if (live.has(String(id))) next.add(String(id));
      return next;
    });
  }, [list]);

  const visibleIds = useMemo(() => new Set((visible || []).map((x) => String(x?._id)).filter(Boolean)), [visible]);
  const selectedVisibleIds = useMemo(() => {
    const out = [];
    for (const id of selectedIds) if (visibleIds.has(String(id))) out.push(String(id));
    return out;
  }, [selectedIds, visibleIds]);

  const allVisibleSelected = visible.length > 0 && selectedVisibleIds.length === visible.length;

  const toggleOne = (id) => {
    const sid = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(sid) ? next.delete(sid) : next.add(sid);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        // unselect all visible
        for (const id of visibleIds) next.delete(String(id));
      } else {
        // select all visible
        for (const id of visibleIds) next.add(String(id));
      }
      return next;
    });
  };

  // Handler function for approving or rejecting a pending assignment by id
  const handle = async (id, action, reason = '') => {
    try {
      await axios.patch(
        `/api/pending-assignments/${id}/${action}`,
        { reason },
        { withCredentials: true }
      );
      toast.success(`${action.charAt(0).toUpperCase() + action.slice(1)}d successfully`);
      setList((prev) => prev.filter((x) => x._id !== id));
      setRejectionReason('');
      setRejectingId(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  // NEW: bulk helpers
  const bulkApprove = async () => {
    const ids = selectedVisibleIds;
    if (!ids.length) return;

    setBulkProcessing(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => axios.patch(`/api/pending-assignments/${id}/approve`, {}, { withCredentials: true }))
      );

      const okIds = [];
      let ok = 0;
      let fail = 0;

      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          ok += 1;
          okIds.push(ids[idx]);
        } else {
          fail += 1;
        }
      });

      if (okIds.length) {
        setList((prev) => prev.filter((x) => !okIds.includes(String(x?._id))));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          okIds.forEach((id) => next.delete(String(id)));
          return next;
        });
      }

      if (ok) toast.success(`Approved ${ok} request(s)`);
      if (fail) toast.error(`Failed to approve ${fail} request(s)`);
    } finally {
      setBulkProcessing(false);
    }
  };

  const bulkReject = async (reason) => {
    const ids = selectedVisibleIds;
    if (!ids.length) return;

    setBulkProcessing(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          axios.patch(
            `/api/pending-assignments/${id}/reject`,
            { reason },
            { withCredentials: true }
          )
        )
      );

      const okIds = [];
      let ok = 0;
      let fail = 0;

      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          ok += 1;
          okIds.push(ids[idx]);
        } else {
          fail += 1;
        }
      });

      if (okIds.length) {
        setList((prev) => prev.filter((x) => !okIds.includes(String(x?._id))));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          okIds.forEach((id) => next.delete(String(id)));
          return next;
        });
      }

      if (ok) toast.success(`Rejected ${ok} request(s)`);
      if (fail) toast.error(`Failed to reject ${fail} request(s)`);
    } finally {
      setBulkProcessing(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center gap-2">
        <input
          type="search"
          className="input input-bordered flex-1 min-w-[220px]"
          placeholder="Search by student, requestor, description, amount, date…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="select select-bordered"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          title="Filter type"
        >
          <option value="all">All types</option>
          <option value="group">Group adjusts</option>
          <option value="other">Other</option>
        </select>

        <select
          className="select select-bordered"
          value={sortField}
          onChange={(e) => setSortField(e.target.value)}
          title="Sort by"
        >
          <option value="createdAt">Date</option>
          <option value="amount">Amount</option>
          <option value="student">Student</option>
          <option value="requestor">Requestor</option>
        </select>

        <select
          className="select select-bordered"
          value={sortDir}
          onChange={(e) => setSortDir(e.target.value)}
          title="Sort direction"
        >
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setSearch('');
            setTypeFilter('all');
            setSortField('createdAt');
            setSortDir('desc');
          }}
        >
          Clear
        </button>
      </div>

      {/* Bulk actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="text-sm text-base-content/60">
          Showing {visible.length} of {list.length} pending requests
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={allVisibleSelected}
              onChange={toggleAllVisible}
              disabled={visible.length === 0}
            />
            Select visible ({selectedVisibleIds.length}/{visible.length})
          </label>

          <button
            type="button"
            className={`btn btn-sm btn-success ${bulkProcessing ? 'loading' : ''}`}
            onClick={bulkApprove}
            disabled={bulkProcessing || selectedVisibleIds.length === 0}
          >
            Approve selected
          </button>

          <button
            type="button"
            className="btn btn-sm btn-error"
            onClick={() => setBulkRejectOpen(true)}
            disabled={bulkProcessing || selectedVisibleIds.length === 0}
          >
            Reject selected
          </button>

          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setSelectedIds(new Set())}
            disabled={bulkProcessing || selectedIds.size === 0}
          >
            Clear selection
          </button>
        </div>
      </div>

      {/* Empty state */}
      {visible.length === 0 ? (
        <p className="text-base-content/70">No pending approvals.</p>
      ) : (
        visible.map((pa) => {
          const student = pa?.student || {};
          const reqBy = pa?.requestedBy || {};
          const checked = selectedIds.has(String(pa?._id));

          return (
            <div key={pa._id} className="border p-3 rounded flex justify-between items-center gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm mt-1"
                  checked={checked}
                  onChange={() => toggleOne(pa._id)}
                />

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="text-lg">{pa.amount} Ƀ</strong>
                    <span>for</span>
                    <strong className="font-semibold">{displayName(student)}</strong>
                  </div>

                  <div className="text-sm text-base-content/70 break-words">{pa.description}</div>

                  <div className="text-xs text-base-content/60 mt-1">
                    Requested by: <span className="font-medium">{displayName(reqBy)}</span>
                  </div>

                  <div className="text-xs text-base-content/50 mt-1">
                    {pa.createdAt ? new Date(pa.createdAt).toLocaleString() : ''}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <button onClick={() => handle(pa._id, 'approve')} className="btn btn-sm btn-success">
                  Approve
                </button>
                <button onClick={() => setRejectingId(pa._id)} className="btn btn-sm btn-error">
                  Reject
                </button>
              </div>
            </div>
          );
        })
      )}

      {/* Bulk Reject Modal */}
      {bulkRejectOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Reject selected requests</h3>
            <p className="py-2 text-sm text-base-content/70">
              Rejecting <strong>{selectedVisibleIds.length}</strong> visible request(s). Optional reason:
            </p>
            <textarea
              className="textarea textarea-bordered w-full"
              placeholder="e.g., Not approved for this activity."
              value={bulkRejectReason}
              onChange={(e) => setBulkRejectReason(e.target.value)}
            />
            <div className="modal-action">
              <button
                className="btn"
                onClick={() => {
                  if (bulkProcessing) return;
                  setBulkRejectOpen(false);
                  setBulkRejectReason('');
                }}
                disabled={bulkProcessing}
              >
                Cancel
              </button>
              <button
                className={`btn btn-error ${bulkProcessing ? 'loading' : ''}`}
                onClick={async () => {
                  const reason = bulkRejectReason;
                  setBulkRejectOpen(false);
                  setBulkRejectReason('');
                  await bulkReject(reason);
                }}
                disabled={bulkProcessing}
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal (single) */}
      {rejectingId && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Reject Assignment</h3>
            <p className="py-4">Provide an optional reason for rejection:</p>
            <textarea
              className="textarea textarea-bordered w-full"
              placeholder="e.g., Amount is too high for this task."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
            <div className="modal-action">
              <button className="btn" onClick={() => setRejectingId(null)}>Cancel</button>
              <button className="btn btn-error" onClick={() => handle(rejectingId, 'reject', rejectionReason)}>
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
