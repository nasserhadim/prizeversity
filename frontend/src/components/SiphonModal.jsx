import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
 
 
 function SiphonModal({group,onClose}){
  console.log('[SiphonModal] group object:', group);
  const { user } = useAuth();
  const [target,setTarget] = useState('');
  const [reason,setReason]=useState('');
  const [amount,setAmount]=useState('');

  const create = async () => {
    try {
     if (!target) return toast.error('Choose someone to siphon');
     await axios.post(
        `http://localhost:5000/api/siphon/group/${group._id}/create`,
        { targetUserId: target, reason, amount: Number(amount) },
       { withCredentials: true }
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

  return (
    <dialog open className="modal">
      <div className="modal-box">
        <h3 className="font-bold text-lg">New siphon request</h3>
        <select className="select w-full"
                value={target} onChange={e=>setTarget(e.target.value)}
                  required>
          <option value="">-- target member --</option>
          {group.members
            .filter(m => String(m._id._id) !== String(user._id))
          .map(m => (
       <option
         key={m._id._id.toString()}        
         value={m._id._id.toString()}        
       >
         {m._id.email}
       </option>
     ))}
        </select>
        <textarea className="textarea w-full mt-2"
                  placeholder="Reason…" value={reason}
                  onChange={e=>setReason(e.target.value)}
                  required/>
        <input
            type="number"
            min="1"
            step="1"                               
            placeholder="Enter siphon amount"    
            className="input input-bordered w-full mt-2"
            value={amount}
            onChange={e => setAmount(e.target.value)}
        required  />
        <div className="modal-action">
           <button
       className="btn"
       onClick={create}
       disabled={!target || !reason || Number(amount) < 1}
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