import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config/api';
const BACKEND_URL = `${API_BASE}`;

const StatsAdjustModal = ({ isOpen, onClose, student, classroomId, onUpdated }) => {
  const [loading, setLoading] = useState(false);
  // keep input values as strings for stable formatting (avoid 7.300000000000001)
  const [multiplier, setMultiplier] = useState('1.0');
  const [luck, setLuck] = useState('1.0');
  const [discount, setDiscount] = useState('0');

  // load current stats when modal opens / student changes
  useEffect(() => {
    if (!isOpen || !student) return;
    let mounted = true;
    (async () => {
      try {
        const res = await axios.get(`/api/stats/student/${student._id}?classroomId=${classroomId}`, { withCredentials: true });
        if (!mounted) return;
        const s = res.data || {};
        // Format multiplier and luck to 1 decimal place for display
        setMultiplier(((Number(s.multiplier ?? 1)).toFixed(1)).toString());
        setLuck(((Number(s.luck ?? 1)).toFixed(1)).toString());
        setDiscount(String(Number(s.discount ?? s.discountShop ?? 0)));
      } catch (err) {
        console.debug('[StatsAdjustModal] failed to load stats', err?.message || err);
      }
    })();
    return () => { mounted = false; };
  }, [isOpen, student, classroomId]);

  if (!isOpen || !student) return null;

  const fullName = `${(student.firstName || '').trim()} ${(student.lastName || '').trim()}`.trim() || student.email;

  const handleSave = async () => {
    setLoading(true);
    try {
      await axios.patch(
        `/api/classroom/${classroomId}/users/${student._id}/stats`,
        // parse input strings into numeric values
        { multiplier: Number(multiplier) || 1, luck: Number(luck) || 1, discount: Number(discount) || 0 },
        { withCredentials: true }
      );
      toast.success('Stats updated');
      if (onUpdated) onUpdated();
      onClose && onClose();
    } catch (err) {
      console.error('[StatsAdjustModal] save error', err);
      toast.error(err.response?.data?.error || 'Failed to update stats');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-sm">
        <h3 className="font-bold text-lg">Adjust stats — {fullName}</h3>

        <div className="mt-4 space-y-3">
          <label className="flex flex-col">
            <span className="text-sm">Multiplier (e.g. 1.0)</span>
            <input
              type="number"
              step="0.1"
              min="0.1"
              className="input input-bordered mt-2"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
            />
          </label>

          <label className="flex flex-col">
            <span className="text-sm">Luck (e.g. 1.0)</span>
            <input
              type="number"
              step="0.1"
              min="1.0"
              className="input input-bordered mt-2"
              value={luck}
              onChange={(e) => setLuck(e.target.value)}
            />
          </label>

          <label className="flex flex-col">
            <span className="text-sm">Discount % (0 to clear)</span>
            <input
              type="number"
              step="1"
              min="0"
              max="100"
              className="input input-bordered mt-2"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </label>
        </div>

        <div className="modal-action">
          <button className="btn" onClick={() => { onClose && onClose(); }}>
            Cancel
          </button>
          <button className={`btn btn-primary ${loading ? 'loading' : ''}`} onClick={handleSave} disabled={loading}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatsAdjustModal;