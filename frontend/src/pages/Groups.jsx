
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import socket from '../utils/socket';
import toast from 'react-hot-toast';

const Groups = () => {
  const { id } = useParams();
  const { user } = useAuth();

  const [groupSets, setGroupSets] = useState([]);
  const [groupSetName, setGroupSetName] = useState('');
  const [groupSetSelfSignup, setGroupSetSelfSignup] = useState(false);
  const [groupSetJoinApproval, setGroupSetJoinApproval] = useState(false);
  const [groupSetMaxMembers, setGroupSetMaxMembers] = useState('');
  const [groupSetImage, setGroupSetImage] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupCount, setGroupCount] = useState(1);
  const [memberSearches, setMemberSearches] = useState({});
  const [memberFilters, setMemberFilters] = useState({});
  const [memberSorts, setMemberSorts] = useState({});
  const [selectedMembers, setSelectedMembers] = useState({});

  useEffect(() => {
    fetchGroupSets();
    socket.emit('join', `classroom-${id}`);
    return () => {
      socket.off('group_update');
      socket.off('groupset_update');
    };
  }, [id]);

  const fetchGroupSets = async () => {
    try {
      const res = await axios.get(`/api/group/groupset/classroom/${id}`);
      setGroupSets(res.data);
    } catch (err) {
      toast.error('Failed to fetch group sets');
    }
  };

  const handleCreateGroup = async (groupSetId) => {
    if (!groupName.trim()) return toast.error('Group name required');
    if (groupCount < 1) return toast.error('Group count must be at least 1');
    try {
      await axios.post(`/api/group/groupset/${groupSetId}/group/create`, {
        name: groupName,
        count: groupCount,
      });
      fetchGroupSets();
      setGroupName('');
      setGroupCount(1);
    } catch (err) {
      toast.error('Failed to create group');
    }
  };

  const [editingGroupSetId, setEditingGroupSetId] = useState(null);
  
  const handleEditGroupSet = (gs) => {
  setEditingGroupSetId(gs._id);
  setGroupSetName(gs.name);
  setGroupSetSelfSignup(gs.selfSignup);
  setGroupSetJoinApproval(gs.joinApproval);
  setGroupSetMaxMembers(gs.maxMembers);
  setGroupSetImage(gs.image);
};

// GROUP: Edit Group Name
const handleEditGroup = async (groupSetId, groupId) => {
  const newName = prompt('Enter new group name:');
  if (!newName?.trim()) return toast.error('Group name cannot be empty');

  try {
    await axios.put(`/api/group/groupset/${groupSetId}/group/${groupId}`, {
      name: newName.trim()
    });
    toast.success('Group updated');
    fetchGroupSets();
  } catch (err) {
    toast.error('Failed to update group');
  }
};

// GROUP: Delete Group
const handleDeleteGroup = async (groupSetId, groupId) => {
  if (!window.confirm('Are you sure you want to delete this group?')) return;

  try {
    await axios.delete(`/api/group/groupset/${groupSetId}/group/${groupId}`);
    toast.success('Group deleted');
    fetchGroupSets();
  } catch (err) {
    toast.error('Failed to delete group');
  }
};

// GROUP: Join
const handleJoinGroup = async (groupSetId, groupId) => {
  const groupSet = groupSets.find(gs => gs._id === groupSetId);
  const alreadyJoined = groupSet?.groups.some(group =>
    group.members.some(m => m._id._id === user._id && m.status === 'approved')
  );

  if (user.role === 'student' && alreadyJoined) {
    toast.error('Students can only join one group in this GroupSet');
    return;
  }

  try {
    await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/join`);
    toast.success('Join request sent');
    fetchGroupSets();
  } catch (err) {
    toast.error('Failed to join group');
  }
};


// GROUP: Leave
const handleLeaveGroup = async (groupSetId, groupId) => {
  try {
    await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/leave`);
    toast.success('Left group');
    fetchGroupSets();
  } catch (err) {
    toast.error('Failed to leave group');
  }
};

const handleApproveMembers = async (groupSetId, groupId) => {
  try {
    await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/approve`, {
      memberIds: selectedMembers[groupId]
    });
    toast.success('Members approved');
    fetchGroupSets();
  } catch (err) {
    toast.error('Failed to approve members');
  }
};

const handleRejectMembers = async (groupSetId, groupId) => {
  try {
    await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/reject`, {
      memberIds: selectedMembers[groupId]
    });
    toast.success('Members rejected');
    fetchGroupSets();
  } catch (err) {
    toast.error('Failed to reject members');
  }
};

const handleSuspendMembers = async (groupSetId, groupId) => {
  try {
    await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/suspend`, {
      memberIds: selectedMembers[groupId]
    });
    toast.success('Members suspended');
    fetchGroupSets();
  } catch (err) {
    toast.error('Failed to suspend members');
  }
};

const handleUpdateGroupSet = async () => {
  if (!groupSetName.trim()) return toast.error('GroupSet name is required');
  if (groupSetMaxMembers < 0) return toast.error('Max members cannot be negative');

  try {
    await axios.put(`/api/group/groupset/${editingGroupSetId}`, {
      name: groupSetName,
      selfSignup: groupSetSelfSignup,
      joinApproval: groupSetJoinApproval,
      maxMembers: groupSetMaxMembers,
      image: groupSetImage,
    });

    toast.success('GroupSet updated successfully');
    resetGroupSetForm();
    fetchGroupSets();
  } catch (err) {
    toast.error('Failed to update group set');
  }
};

const handleDeleteGroupSetConfirm = async (gs) => {
  if (!window.confirm(`Delete group set "${gs.name}"?`)) return;

  try {
    await axios.delete(`/api/group/groupset/${gs._id}`);
    toast.success('GroupSet deleted');
    fetchGroupSets();
  } catch (err) {
    toast.error('Failed to delete group set');
  }
};

const resetGroupSetForm = () => {
  setEditingGroupSetId(null);
  setGroupSetName('');
  setGroupSetSelfSignup(false);
  setGroupSetJoinApproval(false);
  setGroupSetMaxMembers('');
  setGroupSetImage('');
};

  const getFilteredAndSortedMembers = (group) => {
    const filter = memberFilters[group._id] || 'all';
    const sort = memberSorts[group._id] || 'email';
    const search = memberSearches[group._id] || '';
    return group.members
      .filter(m => filter === 'all' || m.status === filter)
      .filter(m => m?._id?.email?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (sort === 'email') return a._id.email.localeCompare(b._id.email);
        if (sort === 'status') return (a.status || '').localeCompare(b.status || '');
        if (sort === 'date') return new Date(b.joinDate) - new Date(a.joinDate);
        return 0;
      });
  };

  const handleSelectAllMembers = (groupId, group) => {
    const allSelected = (selectedMembers[groupId] || []).length === group.members.length;
    const newSelected = allSelected ? [] : group.members.map(m => m._id._id);
    setSelectedMembers(prev => ({ ...prev, [groupId]: newSelected }));
  };

  const handleSelectMember = (groupId, memberId) => {
    setSelectedMembers(prev => {
      const selected = new Set(prev[groupId] || []);
      selected.has(memberId) ? selected.delete(memberId) : selected.add(memberId);
      return { ...prev, [groupId]: Array.from(selected) };
    });
  };

  const handleCreateGroupSet = async () => {
    if (!groupSetName.trim()) {
      toast.error('GroupSet name is required');
      return;
    }
    if (groupSetMaxMembers < 0) {
      toast.error('Max members cannot be negative');
      return;
    }
    try {
      await axios.post('/api/group/groupset/create', {
        name: groupSetName,
        classroomId: id,
        selfSignup: groupSetSelfSignup,
        joinApproval: groupSetJoinApproval,
        maxMembers: groupSetMaxMembers,
        image: groupSetImage,
      });
      toast.success('GroupSet created successfully');
      setGroupSetName('');
      setGroupSetSelfSignup(false);
      setGroupSetJoinApproval(false);
      setGroupSetMaxMembers('');
      setGroupSetImage('');
      fetchGroupSets();
    } catch (err) {
      toast.error('Failed to create group set');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Group Sets</h1>

      {/* GroupSet Creation Form */}

<div className="card bg-base-200 p-4 space-y-2">
  <input
    className="input input-bordered w-full hover:ring hover:ring-primary"
    type="text"
    placeholder="GroupSet Name"
    value={groupSetName}
    onChange={(e) => setGroupSetName(e.target.value)}
  />

  {/* Allow Self-Signup Toggle with Red/Green indicator and hover effect */}
  <label className="label cursor-pointer">
    <span className="label-text">Allow Self-Signup</span>
    <input
      type="checkbox"
      className={`toggle transition-colors duration-300 ${groupSetSelfSignup ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
      checked={groupSetSelfSignup}
      onChange={(e) => setGroupSetSelfSignup(e.target.checked)}
    />
  </label>

  {/* Require Join Approval Toggle with Red/Green indicator and hover effect */}
  <label className="label cursor-pointer">
    <span className="label-text">Require Join Approval</span>
    <input
      type="checkbox"
      className={`toggle transition-colors duration-300 ${groupSetJoinApproval ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
      checked={groupSetJoinApproval}
      onChange={(e) => setGroupSetJoinApproval(e.target.checked)}
    />
  </label>

  <input
    className="input input-bordered w-full hover:ring hover:ring-primary"
    type="number"
    placeholder="Max Members"
    value={groupSetMaxMembers}
    onChange={(e) => setGroupSetMaxMembers(Math.max(0, e.target.value))}
  />

  <input
    className="input input-bordered w-full hover:ring hover:ring-primary"
    type="text"
    placeholder="Image URL"
    value={groupSetImage}
    onChange={(e) => setGroupSetImage(e.target.value)}
  />

  {editingGroupSetId ? (
  <button
    className="btn btn-warning hover:scale-105 transition-transform duration-200"
    onClick={handleUpdateGroupSet}
  >
    Update GroupSet
  </button>
) : (
  <button
    className="btn btn-primary hover:scale-105 transition-transform duration-200"
    onClick={handleCreateGroupSet}
  >
    Create GroupSet
  </button>
)}
</div>


{/* GroupSet Display */}
{groupSets.map((gs) => (
  <div key={gs._id} className="card bg-base-100 shadow-md p-4 space-y-4">
    <div className="flex justify-between items-center">
      <div>
        <h2 className="text-xl font-semibold">{gs.name}</h2>
        <p>Self Signup: {gs.selfSignup ? 'Yes' : 'No'}</p>
        <p>Join Approval: {gs.joinApproval ? 'Yes' : 'No'}</p>
        <p>Max Members: {gs.maxMembers || 'No limit'}</p>
      </div>
      <img src={gs.image} alt={gs.name} className="w-16 h-16 object-cover rounded" />
    </div>
    {/* Group Set action buttons (Edit & Delete) */}
<div className="flex gap-2 mt-2">
  <button
    className="btn btn-sm btn-accent"
    onClick={() => handleEditGroupSet(gs)}  //Assumes this function is defined
  >
    Edit
  </button>
  <button
    className="btn btn-sm btn-error"
    onClick={() => handleDeleteGroupSetConfirm(gs)}  // Assumes this function is defined
  >
    Delete
  </button>
</div>


          {/* Create Group under GroupSet */}
          {user.role === 'teacher' && (
            <div className="mt-4">
              <h4 className="text-md font-semibold">Create Group</h4>
              <input type="text" className="input input-bordered w-full mt-1" placeholder="Group Name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
              <input
  type="number"
  min="1"
  step="1"
  placeholder="Group Count"
  className="input input-bordered w-full"
  value={groupCount}
  onChange={(e) => {
    const value = e.target.value;

    // Allow empty input for user typing but block negatives
    if (value === '' || parseInt(value) >= 1) {
      setGroupCount(value);
    }
  }}
  onBlur={(e) => {
    const value = parseInt(e.target.value);
    // On blur (focus out), fix invalid values
    if (isNaN(value) || value < 1) {
      setGroupCount(1);
    }
  }}
/>

              <button className="btn btn-primary mt-2" onClick={() => handleCreateGroup(gs._id)}>Create</button>
            </div>
          )}

          {/* Display Groups */}
          {gs.groups.map(group => (
            <div className="border rounded p-4 bg-base-100">
  <div className="flex justify-between items-center">
    <div>
      <h5 className="font-semibold">{group.name}</h5>
      <p>Members: {group.members.length}/{group.maxMembers || 'No limit'}</p>
    </div>

    {/* Group-level action buttons */}
    <div className="flex gap-2">
      <button className="btn btn-xs btn-success" onClick={() => handleJoinGroup(gs._id, group._id)}>Join</button>
      <button className="btn btn-xs btn-warning" onClick={() => handleLeaveGroup(gs._id, group._id)}>Leave</button>
      <button className="btn btn-xs btn-info" onClick={() => handleEditGroup(gs._id, group._id)}>Edit</button>
      <button className="btn btn-xs btn-error" onClick={() => handleDeleteGroup(gs._id, group._id)}>Delete</button>

    </div>
  </div>

  {/* Member management UI */}
  <div className="mt-4">
    <h5 className="text-sm font-semibold mb-2">Members</h5>

    {/* Search and filters */}
    <div className="flex gap-2 mb-2">
      <input
        type="text"
        placeholder="Search..."
        value={memberSearches[group._id] || ''}
        onChange={(e) => setMemberSearches(prev => ({ ...prev, [group._id]: e.target.value }))}
        className="input input-bordered input-sm w-full"
      />
      <select
        value={memberFilters[group._id] || 'all'}
        onChange={(e) => setMemberFilters(prev => ({ ...prev, [group._id]: e.target.value }))}
        className="select select-bordered select-sm"
      >
        <option value="all">All</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
      </select>
      <select
        value={memberSorts[group._id] || 'email'}
        onChange={(e) => setMemberSorts(prev => ({ ...prev, [group._id]: e.target.value }))}
        className="select select-bordered select-sm"
      >
        <option value="email">Email</option>
        <option value="status">Status</option>
        <option value="date">Join Date</option>
      </select>
    </div>

    {/* Table of members */}
    <div className="overflow-x-auto">
      <table className="table table-zebra table-sm">
        <thead>
          <tr>
            <th>
              {/* Select All */}
              <input
                type="checkbox"
                checked={(selectedMembers[group._id]?.length || 0) === group.members.length}
                onChange={() => handleSelectAllMembers(group._id, group)}
              />
            </th>
            <th>Email</th>
            <th>Status</th>
            <th>Join Date</th>
          </tr>
        </thead>
        <tbody>
          {getFilteredAndSortedMembers(group).map((member, idx) => (
            <tr key={`${group._id}-${member._id._id}-${idx}`}>
              <td>
                {/* Select Individual */}
                <input
                  type="checkbox"
                  checked={selectedMembers[group._id]?.includes(member._id._id) || false}
                  onChange={() => handleSelectMember(group._id, member._id._id)}
                />
              </td>
              <td>{member._id.email}</td>
              <td>
                <span className={`badge ${member.status === 'pending' ? 'badge-warning' : 'badge-success'}`}>
                  {member.status || 'approved'}
                </span>
              </td>
              <td>{member.status === 'approved' ? new Date(member.joinDate).toLocaleString() : 'Pending'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Batch action buttons */}
    <div className="mt-2 flex gap-2">
      <button
        className="btn btn-xs btn-success"
        disabled={!selectedMembers[group._id]?.length}
        onClick={() => handleApproveMembers(groupSet._id, group._id)}
      >
        Approve
      </button>
      <button
        className="btn btn-xs btn-error"
        disabled={!selectedMembers[group._id]?.length}
        onClick={() => handleRejectMembers(groupSet._id, group._id)}
      >
        Reject
      </button>
      <button
        className="btn btn-xs btn-warning"
        disabled={!selectedMembers[group._id]?.length}
        onClick={() => handleSuspendMembers(groupSet._id, group._id)}
      >
        Suspend
      </button>
    </div>
  </div>
</div>

          ))}
        </div>
      ))}
    </div>
  );
};

export default Groups;