import React, { useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';  
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config/api';

const BACKEND_URL = `${API_BASE}`;
 
 function SiphonModal({group,onClose}){
  console.log('[SiphonModal] group object:', group);
  const { user } = useAuth();
  const [target,setTarget] = useState('');
  const [reason,setReason]=useState('');
  const [amount,setAmount]=useState('');
  const [file,setFile] = useState(null);
  const [targetBalance, setTargetBalance] = useState(null);
  const [loadingBal,  setLoadingBal]  = useState(false);

  /* ───────────────── balance lookup ───────────────── */
  const handleTargetChange = async (e) => {
    const id = e.target.value;
    setTarget(id);
    setTargetBalance(null);
    setAmount('');
    if (!id) return;

 
    try {
      setLoadingBal(true);
      const { data } = await axios.get(
        `${BACKEND_URL}/api/wallet/${id}/balance`,
        { withCredentials: true }
      );
      setTargetBalance(data.balance);
    } catch (err) {
      toast.error('Failed to load balance');
    } finally {
      setLoadingBal(false);
    }
  };

  const create = async () => {
    try {
     if (!target) return toast.error('Choose someone to siphon');
     if (Number(amount) < 1) return toast.error('Amount must be ≥ 1');
     /* ---------- build multipart/form‑data ---------- */
     const fd = new FormData();
     fd.append('targetUserId', target);
     fd.append('reason', reason);
     fd.append('amount', Number(amount));
     if (file) fd.append('proof', file);

     await axios.post(
        `${BACKEND_URL}/api/siphon/group/${group._id}/create`,
        fd,
        { withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' } }
     );
      toast.success('Request submitted');
      onClose();
    } catch (err) {
      
      const msg =
        err.response?.data?.error ||
        'Failed to submit siphon request';
      toast.error(msg);
    }
  };

  const quillModules = {
    toolbar: [
      [{ font: [] }, { size: [] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ color: [] }, { background: [] }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['clean'],
    ],
  };

  return (
    <dialog open className="modal">
      <div className="modal-box">
        <h3 className="font-bold text-lg">New siphon request</h3>
        {/* 1️⃣ the dropdown itself */}
        <select
          className="select w-full"
          value={target}
          onChange={handleTargetChange}
          required
        >
          <option value="">-- target member --</option>
          {group.members
            .filter(m => String(m._id._id) !== String(user._id))
            .map(m => (
              <option key={m._id._id} value={m._id._id}>
                {m._id.email}
              </option>
            ))
          }
        </select>

        {/* balance*/}
        {loadingBal && (
          <p className="text-sm mt-1">Loading balance…</p>
        )}
        {targetBalance != null && !loadingBal && (
          <p className="text-sm mt-1">
            Current balance:&nbsp;
            <strong>{targetBalance}</strong>&nbsp;bits
          </p>
        )}

                {/* text */}
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
        <input
            type="number"
            min="1"
            step="1"                               
            placeholder="Enter siphon amount"    
            className="input input-bordered w-full mt-2"
            max={targetBalance ?? undefined}
            value={amount}
            onChange={e => {
              const val = e.target.value;
              if (targetBalance != null && Number(val) > targetBalance) {
                toast.error('Amount exceeds selected balance');
                return;
              }
              setAmount(val);
            }}
        required  />

         {/* proof file */}
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
            <button
              className="btn btn-xs ml-2"
              onClick={() => setFile(null)}
            >
              remove
            </button>
          </p>
        )}
        
        <div className="modal-action">
           <button
       className="btn"
       onClick={create}
       disabled={
         !target ||
         !reason ||
         Number(amount) < 1 ||
         (targetBalance != null && Number(amount) > targetBalance)
       }
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