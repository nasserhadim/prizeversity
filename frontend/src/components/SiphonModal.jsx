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

        {/* Helper: What is siphoning? */}
        <div className="mt-2 mb-3">
          <details className="collapse collapse-arrow bg-base-200 rounded">
            <summary className="collapse-title text-sm font-medium">
              About siphoning
            </summary>
            <div className="collapse-content text-sm space-y-2">
              <p>
                Siphoning is a group accountability tool:
              </p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Group members can vote to temporarily freeze a teammate’s spending, and potentially redistribute their bits.</li>
                <li>Requires a majority vote from approved group members.</li>
                <li>Frozen members cannot spend bits during the review period.</li>
                <li>The teacher reviews the request and approves or rejects it.</li>
                <li>If approved, bits are redistributed to cooperative members.</li>
              </ul>
              <p className="mt-2">
                Limits and timing:
              </p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Only one siphon per configured cooldown window (e.g., default 72 hours) per group.</li>
                <li>If the majority and teacher action don’t occur within the timeout, the account is automatically unfrozen.</li>
              </ul>
              <p className="mt-2">
                Tip: Be clear and factual in the reason. You can attach proof (PDF/image).
              </p>
            </div>
          </details>
        </div>

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

        {/* NEW: inline guidance under reason */}
        <p className="text-xs text-base-content/70 mt-2">
          Provide a clear summary of the issue(s). Include helpful context such as dates, actions, and impact on group cooperation. You may attach proof below.
        </p>

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
            Percentage is applied to the user’s current balance privately on submission. Final transfer is recalculated at teacher review time.
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