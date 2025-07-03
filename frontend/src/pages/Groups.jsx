
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import socket from '../utils/socket';
import toast from 'react-hot-toast';
import SiphonModal from '../components/SiphonModal';
import { Lock } from 'lucide-react';



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
  const [openSiphonModal, setOpenSiphonModal] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [adjustModal, setAdjustModal] = useState(null); 
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDesc, setAdjustDesc] = useState('');

const openAdjustModal = (groupSetId, groupId) => {
  setAdjustModal({ groupSetId, groupId });
  setAdjustAmount('');
  setAdjustDesc('');
};

const submitAdjust = async () => {
  try {
    const { groupSetId, groupId } = adjustModal;
    const amt = Number(adjustAmount);
    await axios.post(
      `/api/groupset/${groupSetId}/group/${groupId}/adjust-balance`,
      { amount: amt, description: adjustDesc }
    );
    toast.success(`All students ${amt >= 0 ? 'credited' : 'debited'} ${Math.abs(amt)} bits`);
    fetchGroupSets();
  } catch (err) {
    toast.error(err.response?.data?.error || 'Adjust failed');
  } finally {
    setAdjustModal(null);
  }
};

useEffect(() => {
  fetchGroupSets();
  socket.emit('join', `classroom-${id}`);


  socket.on('group_update', fetchGroupSets);
  socket.on('groupset_update', fetchGroupSets);
  socket.on('siphon_create', fetchGroupSets);
  socket.on('siphon_vote',   fetchGroupSets);
  socket.on('siphon_update', fetchGroupSets);

  return () => {
    socket.off('group_update', fetchGroupSets);
    socket.off('groupset_update', fetchGroupSets);
    socket.off('siphon_create', fetchGroupSets);
    socket.off('siphon_vote', fetchGroupSets);
    socket.off('siphon_update', fetchGroupSets);
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
  const voteOnSiphon = async (siphonId, vote) => {
  console.log('👉 voteOnSiphon called with', siphonId, vote);
  try {
    const res = await axios.post(`/api/siphon/${siphonId}/vote`, { vote });
    console.log('vote response', res.data);
    fetchGroupSets();
  } catch (err) {
    console.error(' vote error', err);
    toast.error(err.response?.data?.error || 'Vote failed');
  }
};


  const teacherApprove = async (siphonId) => {
    await axios.post(`/api/siphon/${siphonId}/teacher-approve`);
    fetchGroupSets();
  };
  
const teacherReject = async (siphonId) => {
   
   if (processing) return;
   setProcessing(true);
   try {
     
     await axios.post(`/api/siphon/${siphonId}/teacher-reject`);
  
     fetchGroupSets();
   } catch (err) {
     toast.error(err.response?.data?.error || 'Failed to reject');
   } finally {
     setProcessing(false);
   }
 };

const handleCreateGroup = async (groupSetId) => {
  if (!groupName.trim()) return toast.error('Group name required');
  if (groupCount < 1) return toast.error('Group count must be at least 1');

  const groupSet = groupSets.find(gs => gs._id === groupSetId);
  if (!groupSet) return toast.error('GroupSet not found');

  const existingNames = groupSet.groups.map(g => g.name.trim());

  // Extract base name (e.g., "abb" from "abb 1")
  const baseMatch = groupName.trim().match(/^(.*?)(?:\s\d+)?$/);
  const baseName = baseMatch ? baseMatch[1].trim() : groupName.trim();

  // Get highest used number
  const usedNumbers = existingNames
    .map(name => {
      const match = name.match(new RegExp(`^${baseName} (\\d+)$`));
      return match ? parseInt(match[1], 10) : null;
    })
    .filter(n => n !== null);

  let start = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;

  try {
    for (let i = 0; i < groupCount; i++) {
      const newName = `${baseName} ${start + i}`;
      await axios.post(`/api/group/groupset/${groupSetId}/group/create`, {
        name: newName,        // required for naming
        count: 1              // safely include this if backend expects it
      });
    }

    toast.success(`${groupCount} team(s) created`);
    fetchGroupSets();
    setGroupName('');
    setGroupCount(1);
  } catch (err) {
    console.error(err?.response?.data || err);
    toast.error('Failed to create team(s)');
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
      <h1 className="text-3xl font-bold">Groups</h1>

      {/* Group Creation Form */}
      {(user.role === 'teacher' || user.role === 'admin') && (
        <div className="card bg-base-200 p-4 space-y-2">
          <input
            className="input input-bordered w-full hover:ring hover:ring-primary"
            type="text"
            placeholder="Group Name"
            value={groupSetName}
            onChange={(e) => setGroupSetName(e.target.value)}
          />

          <label className="label cursor-pointer">
            <span className="label-text">Allow Self-Signup</span>
            <input
              type="checkbox"
              className={`toggle transition-colors duration-300 ${groupSetSelfSignup ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
              checked={groupSetSelfSignup}
              onChange={(e) => setGroupSetSelfSignup(e.target.checked)}
            />
          </label>

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
              Update Group
            </button>
          ) : (
            <button
              className="btn btn-primary hover:scale-105 transition-transform duration-200"
              onClick={handleCreateGroupSet}
            >
              Create Group
            </button>
          )}
        </div>
      )}

      {/* Group Display */}
      {groupSets.length === 0 && user.role === 'student' && (
        <p className="text-lg font-medium text-gray-600">No teams available</p>
      )}


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
    onClick={() => handleEditGroupSet(gs)}  
  >
    Edit
  </button>
  <button
    className="btn btn-sm btn-error"
    onClick={() => handleDeleteGroupSetConfirm(gs)}  
  >
    Delete
  </button>
</div>

          {(user.role === 'teacher' || user.role === 'admin') && (
            <div className="flex gap-2 mt-2">
              <button className="btn btn-sm btn-accent" onClick={() => handleEditGroupSet(gs)}>Edit</button>
              <button className="btn btn-sm btn-error" onClick={() => handleDeleteGroupSetConfirm(gs)}>Delete</button>
            </div>
          )}

          {/* Create Team */}
          {(user.role === 'teacher' || user.role === 'admin') && (
            <div className="mt-4">
              <h4 className="text-md font-semibold">Create Team</h4>
              <input type="text" className="input input-bordered w-full mt-1" placeholder="Team Name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
              <input
                type="number"
                min="1"
                step="1"
                placeholder="Team Count"
                className="input input-bordered w-full"
                value={groupCount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || parseInt(value) >= 1) {
                    setGroupCount(value);
                  }
                }}
                onBlur={(e) => {
                  const value = parseInt(e.target.value);
                  if (isNaN(value) || value < 1) {
                    setGroupCount(1);
                  }
                }}
              />
              <button className="btn btn-primary mt-2" onClick={() => handleCreateGroup(gs._id)}>Create</button>
            </div>
          )}

          {/* Display Teams */}
          {gs.groups.map(group => (
            <div key={group._id} className="border rounded p-4 bg-base-100">
  <div className="flex justify-between items-center">
    <div>
      <h5 className="font-semibold">{group.name}</h5>
      <p>Members: {group.members.length}/{group.maxMembers || 'No limit'}</p>
    </div>

    {/* Group-level action buttons */}
    <div className="flex gap-2">
      <button className="btn btn-xs btn-success" onClick={() => handleJoinGroup(gs._id, group._id)}>Join</button>
      <button className="btn btn-xs btn-error" onClick={() => handleLeaveGroup(gs._id, group._id)}>Leave</button>
      <button className="btn btn-xs btn-info">Edit</button>
      <button className="btn btn-xs btn-error">Delete</button>
      {/*  open siphon modal */}
<button
  className="btn btn-xs btn-warning"
  onClick={() => setOpenSiphonModal(group)}
        >
          Siphon
        </button>
        {/*  */}
        {(user.role === 'teacher' || user.role === 'admin') && (
          <button
            className="btn btn-xs btn-primary"
            onClick={() => openAdjustModal(gs._id, group._id)}
          >
            Transfer
          </button>
        )}
        </div>
            </div>
          


      {/* Active siphon requests */}
    {group.siphonRequests?.length > 0 && (
      <div className="mt-4">
        <h5 className="font-semibold text-sm">Active Siphon Requests</h5>
        {group.siphonRequests
          .filter(r => r.status !== 'teacher_approved')
          .map(r => (
            <div key={r._id} className="border p-2 mt-2 rounded bg-base-200">
              <p>
                <strong>{r.amount} bits</strong> from {r.targetUser.email}
              </p>
              <div
                className="italic text-xs mb-1"
                dangerouslySetInnerHTML={{ __html: r.reasonHtml }}
              />


              {/* show vote buttons until the current user has voted */}
              {r.status === 'pending' 
                && user.role !== 'teacher'
                 && !r.votes.some(v => v.user.toString() === user._id) && (
                  <div className="flex gap-1">
                    <button
                      className="btn btn-xs btn-success"
                      onClick={() => voteOnSiphon(r._id, 'yes')}
                    >
                      Yes
                    </button>
                    <button
                      className="btn btn-xs btn-error"
                      onClick={() => voteOnSiphon(r._id, 'no')}
                    >
                      No
                    </button>
                  </div>
              )}

              {/* teacher sees final-approve when group has already approved */}
              {r.status === 'group_approved' && user.role === 'teacher' && (
          <div className="flex gap-1 mt-1">
            <button
              className="btn btn-xs btn-success"
              onClick={() => teacherApprove(r._id)}
            >
              Yes
            </button>
            <button
              className="btn btn-xs btn-error"
              onClick={() => teacherReject(r._id)}
            >
              No
            </button>
          </div>
        )}

                    </div>
                  ))}
              </div>
            )}


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
              <td>
              {member._id.email}
              {member._id.isFrozen && (
                <Lock className="inline w-4 h-4 ml-1 text-red-500" title="Balance frozen" />
              )}
            </td>
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
        onClick={() => handleApproveMembers(gs._id, group._id)}
      >
        Approve
      </button>
      <button
        className="btn btn-xs btn-error"
        disabled={!selectedMembers[group._id]?.length}
        onClick={() => handleRejectMembers(gs._id, group._id)}
      >
        Reject
      </button>
      <button
        className="btn btn-xs btn-warning"
        disabled={!selectedMembers[group._id]?.length}
        onClick={() => handleSuspendMembers(gs._id, group._id)}
      >
        Suspend
      </button>
    </div>
  </div>
</div>

          ))}
        </div>
      ))}
      {/*  modal instance */}
{openSiphonModal && (
  <SiphonModal
    group={openSiphonModal}
    onClose={() => setOpenSiphonModal(null)}
  />
)}
   {/* Adjust-Balance Modal */}
      {adjustModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded shadow-lg w-80">
            <h3 className="text-lg mb-4">Adjust balances for all students</h3>
            <input
              type="number"
              placeholder="Amount (e.g. 50 or -20)"
              className="input input-bordered w-full mb-2"
              value={adjustAmount}
              onChange={e => setAdjustAmount(e.target.value)}
            />
            <input
              type="text"
              placeholder="Description (optional)"
              className="input input-bordered w-full mb-4"
              value={adjustDesc}
              onChange={e => setAdjustDesc(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                className="btn btn-sm"
                onClick={() => setAdjustModal(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-sm btn-primary"
                onClick={submitAdjust}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    
    </div>
  );
};

export default Groups;