import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const GroupMultiplierControl = ({ group, groupSetId, classroomId, compact = false }) => {
  const [multiplier, setMultiplier] = useState(group.groupMultiplier || 1);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    try {
      setLoading(true);
      await axios.post(
        `/api/groupset/${groupSetId}/group/${group._id}/set-multiplier`,
        { multiplier }
      );
      toast.success('Multiplier updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update multiplier');
    } finally {
      setLoading(false);
    }
  };

  return compact ? (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min="0.5"
        max="2"
        step="0.1"
        value={multiplier}
        onChange={(e) => setMultiplier(parseFloat(e.target.value))}
        className="input input-xs input-bordered w-16"
      />
      <button 
        onClick={handleUpdate}
        disabled={loading}
        className="btn btn-xs btn-primary"
      >
        {loading ? '...' : 'Set'}
      </button>
    </div>
  ) : (
    <div className="flex items-center gap-2 mt-2">
      <label className="label-text">Multiplier:</label>
      <input
        type="number"
        min="0.5"
        max="2"
        step="0.1"
        value={multiplier}
        onChange={(e) => setMultiplier(parseFloat(e.target.value))}
        className="input input-sm input-bordered w-20"
      />
      <button 
        onClick={handleUpdate}
        disabled={loading}
        className="btn btn-sm btn-primary"
      >
        {loading ? 'Updating...' : 'Update'}
      </button>
    </div>
  );
};

export default GroupMultiplierControl;