import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

// Component for updating group multiplier within a group set
const GroupMultiplierControl = ({ group, groupSetId, classroomId, compact = false, refreshGroups }) => {
  const [multiplier, setMultiplier] = useState(group.groupMultiplier || 1);
  const [loading, setLoading] = useState(false);

  // Function to send multiplier update to server
  const handleUpdate = async () => {
    try {
      setLoading(true);
      // API call to update multiplier
      await axios.post(
        `/api/groupset/${groupSetId}/group/${group._id}/set-multiplier`,
        { multiplier }
      );
      // Notify success
      toast.success('Multiplier updated (manual override)');
      // Optionally refresh group data
      if (refreshGroups) {
        await refreshGroups();
      }
    } catch (err) {
      // Notify on error
      toast.error(err.response?.data?.error || 'Failed to update multiplier');
    } finally {
      setLoading(false);
    }
  };

  const handleResetToAuto = async () => {
    try {
      setLoading(true);
      await axios.post(`/api/groupset/${groupSetId}/group/${group._id}/reset-auto-multiplier`);
      toast.success('Reset to auto multiplier');
      if (refreshGroups) {
        await refreshGroups();
      }
    } catch (err) {
      toast.error('Failed to reset to auto multiplier');
    } finally {
      setLoading(false);
    }
  };

  return compact ? (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min="0"
        step="0.1"
        value={multiplier}
        onChange={(e) => setMultiplier(parseFloat(e.target.value))}
        className="input input-xs input-bordered w-16"
        title={group.isAutoMultiplier ? "Auto mode" : "Manual override"}
      />
      <button 
        onClick={handleUpdate}
        disabled={loading}
        className="btn btn-xs btn-warning"
        title="Set manual multiplier (overrides auto)"
      >
        {loading ? '...' : 'Set'}
      </button>
      {!group.isAutoMultiplier && (
        <button 
          onClick={handleResetToAuto}
          disabled={loading}
          className="btn btn-xs btn-success"
          title="Reset to auto multiplier"
        >
          Auto
        </button>
      )}
    </div>
  ) : (
    <div className="flex items-center gap-2 mt-2">
      <label className="label-text">
        Multiplier: 
        {group.isAutoMultiplier ? (
          <span className="text-green-600 text-xs ml-1">(Auto)</span>
        ) : (
          <span className="text-orange-600 text-xs ml-1">(Manual)</span>
        )}
      </label>
      <input
        type="number"
        min="0"
        step="0.1"
        value={multiplier}
        onChange={(e) => setMultiplier(parseFloat(e.target.value))}
        className="input input-sm input-bordered w-20"
      />
      <button 
        onClick={handleUpdate}
        disabled={loading}
        className="btn btn-sm btn-warning"
      >
        {loading ? 'Updating...' : 'Set Manual'}
      </button>
      {!group.isAutoMultiplier && (
        <button 
          onClick={handleResetToAuto}
          disabled={loading}
          className="btn btn-sm btn-success"
        >
          Reset Auto
        </button>
      )}
    </div>
  );
};

export default GroupMultiplierControl;