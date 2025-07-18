

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function PendingApprovals({ classroomId }) {
  const [list, setList] = useState([]);

  useEffect(() => {
    axios
      .get(`/api/pending-assignments/${classroomId}`, { withCredentials: true })
      .then((r) => setList(r.data))
      .catch(() => setList([]));
  }, [classroomId]);

  const handle = async (id, action) => {
    try {
      await axios.patch(
        `/api/pending-assignments/${id}/${action}`,
        {},
        { withCredentials: true }
      );
      toast.success(`${action.charAt(0).toUpperCase() + action.slice(1)}d successfully`);
      setList((l) => l.filter((pa) => pa._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  if (list.length === 0) return <p className="text-gray-600">No pending approvals.</p>;

  return (
    <div className="space-y-4 mt-4">
      {list.map((pa) => (
        <div key={pa._id} className="border p-3 rounded flex justify-between items-center">
          <div>
            <strong>
              {pa.student.firstName || pa.student.email}
            </strong>{' '}
            requested{' '}
            <strong>{pa.amount} bits</strong>
            <div className="text-sm text-gray-500">{pa.description}</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handle(pa._id, 'approve')}
              className="btn btn-sm btn-success"
            >
              Approve
            </button>
            <button
              onClick={() => handle(pa._id, 'reject')}
              className="btn btn-sm btn-error"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
