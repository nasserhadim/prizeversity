import React, { useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';  
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config/api';

const BACKEND_URL = `${API_BASE}`;
 
 function SiphonModal({group, onClose, classroomId}) {
  console.log('[SiphonModal] group object:', group);
  const { user } = useAuth();
  const [target,setTarget] = useState('');
  const [reason,setReason]=useState('');
  const [file,setFile] = useState(null);

  // NEW: percentage-based selection (default 50%)
  const [percent, setPercent] = useState(50);

  // remove balance fetch; only track target id now
  const handleTargetChange = async (e) => {
    const id = e.target.value;
    setTarget(id);
  };

  const create = async () => {
    try {
      if (!target) return toast.error('Choose someone to siphon');
      if (!reason) return toast.error('Enter a reason');

      const fd = new FormData();
      fd.append('targetUserId', target);
      fd.append('reason', reason);
      // send a percentage; backend will compute the amount using private balance
      fd.append('percentage', String(percent));
      if (file) fd.append('proof', file);

      await axios.post(
        `${BACKEND_URL}/api/siphon/group/${group._id}/create`,
        fd,
        { withCredentials: true, headers: { 'Content-Type': 'multipart/form-data' } }
      );
      toast.success('Request submitted');
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to submit siphon request';
      toast.error(msg);
    }
  };

  return (
    <dialog open className="modal">
      <div className="modal-box">
        <h3 className="font-bold text-lg">New siphon request</h3>

        {/* Target dropdown */}
        <select
          className="select w-full"
          value={target}
          onChange={handleTargetChange}
          required
        >
          <option value="">-- target member --</option>
          {group.members
            // Exclude current user AND exclude members who are not approved (pending/rejected)
            .filter(m => {
              const memberId = m._id._id ? String(m._id._id) : String(m._id);
              const isSelf = memberId === String(user._id);
              const status = m.status || (m._id && m._id.status) || 'approved';
              return !isSelf && status === 'approved';
            })
            .map(m => {
              const id = m._id._id ? m._id._id : m._id;
              return (
                <option key={id} value={id}>
                  {`${m._id.firstName || ''} ${m._id.lastName || ''}`.trim() || m._id.email} - {m._id.email}
                </option>
              );
            })
          }
        </select>

        {/* Reason editor */}
        <ReactQuill
          className="mt-2"
          theme="snow"
          value={reason}
          onChange={setReason}
          modules={{
            toolbar: [
              [{ font: [] }, { size: [] }],
              ['bold', 'italic', 'underline', 'strike'],
              [{ color: [] }, { background: [] }],
              [{ list: 'ordered' }, { list: 'bullet' }],
              ['clean']
            ]
          }}
          placeholder="Reason…"
        />

        {/* NEW: percentage chooser (no balance shown) */}
        <div className="mt-3">
          <span className="label-text mb-1 block">Siphon amount</span>
          <div className="flex gap-2">
            {[25, 50, 75, 100].map(p => (
              <button
                key={p}
                type="button"
                className={`btn btn-sm ${percent === p ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setPercent(p)}
              >
                {p}%
              </button>
            ))}
          </div>
          <p className="text-xs text-base-content/70 mt-1">
            Percentage is applied to the user’s current balance privately on submission.
          </p>
        </div>

        {/* Proof file */}
        <label className="label mt-2">
          <span className="label-text">Attach proof (PDF or image ≤ 5 MB)</span>
        </label>
        <input
          type="file"
          accept="image/*,application/pdf"
          className="file-input file-input-bordered w-full"
          onChange={e => setFile(e.target.files[0])}
        />
        {file && (
          <p className="text-sm mt-1">
            Selected: <strong>{file.name}</strong>{' '}
            <button className="btn btn-xs ml-2" onClick={() => setFile(null)}>remove</button>
          </p>
        )}

        <div className="modal-action">
          <button
            className="btn"
            onClick={create}
            disabled={!target || !reason || !percent}
          >
            Submit
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </dialog>
  );
}

export default SiphonModal;