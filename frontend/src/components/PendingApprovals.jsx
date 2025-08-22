import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function PendingApprovals({ classroomId }) {
  const [list, setList] = useState([]);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectingId, setRejectingId] = useState(null);

  // Fetch pending assignments whenever classroomId changes
  useEffect(() => {
    axios
      .get(`/api/pending-assignments/${classroomId}`, { withCredentials: true })
      .then((r) => setList(r.data))
      .catch(() => setList([]));
  }, [classroomId]);

  // Handler function for approving or rejecting a pending assignment by id
  const handle = async (id, action, reason = '') => {
    try {
      // Send PATCH request to backend with the action (approve/reject)
      await axios.patch(
        `/api/pending-assignments/${id}/${action}`,
        { reason },
        { withCredentials: true }
      );
      toast.success(`${action.charAt(0).toUpperCase() + action.slice(1)}d successfully`);
      // Remove the handled item from the list
      setList((l) => l.filter((pa) => pa._id !== id));
      setRejectingId(null);
      setRejectionReason('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  // Show message if there are no pending approvals
  if (list.length === 0) return <p className="text-gray-600">No pending approvals.</p>;

  // Render the list of pending approvals with approve and reject buttons
  return (
    <div className="space-y-4 mt-4">
      {list.map((pa) => (
        <div key={pa._id} className="border p-3 rounded flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <strong className="text-lg">
                {pa.amount} Ƀ
              </strong>
              <span>for</span>
              <strong className="font-semibold">
                {`${pa.student.firstName || ''} ${pa.student.lastName || ''}`.trim() || pa.student.email}
              </strong>
            </div>
            <div className="text-sm text-gray-500">{pa.description}</div>
            <div className="text-xs text-gray-400 mt-1">
              {new Date(pa.createdAt).toLocaleString()}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handle(pa._id, 'approve')}
              className="btn btn-sm btn-success"
            >
              Approve
            </button>
            <button
              onClick={() => setRejectingId(pa._id)}
              className="btn btn-sm btn-error"
            >
              Reject
            </button>
          </div>
        </div>
      ))}

      {/* Rejection Modal */}
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
              <button className="btn btn-error" onClick={() => handle(rejectingId, 'reject', rejectionReason)}>Confirm Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
