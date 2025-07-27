import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import socket from '../utils/socket';
import toast from 'react-hot-toast';
import SiphonModal from '../components/SiphonModal';
import GroupMultiplierControl from '../components/GroupMultiplierControl';
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
  const [editingGroupSetId, setEditingGroupSetId] = useState(null);
  const [openSiphonModal, setOpenSiphonModal] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [adjustModal, setAdjustModal] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDesc, setAdjustDesc] = useState('');
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(null);
  const [confirmDeleteGroupSet, setConfirmDeleteGroupSet] = useState(null);
  const [confirmLeaveGroup, setConfirmLeaveGroup] = useState(null);
  const [editGroupModal, setEditGroupModal] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');


  // Fetch group sets
  const fetchGroupSets = async () => {
    try {
      const res = await axios.get(`/api/group/groupset/classroom/${id}`);
      setGroupSets(res.data);
    } catch {
      toast.error('Failed to fetch group sets');
    }
  };

  // Will fetch all the updates from the groups, their siphone votes, groupsets, and siphon updates
  useEffect(() => {
    fetchGroupSets();
    socket.emit('join', `classroom-${id}`);

    socket.on('group_update', fetchGroupSets);
    socket.on('groupset_update', fetchGroupSets);
    socket.on('siphon_create', fetchGroupSets);
    socket.on('siphon_vote', fetchGroupSets);
    socket.on('siphon_update', fetchGroupSets);

    return () => {
      socket.off('group_update', fetchGroupSets);
      socket.off('groupset_update', fetchGroupSets);
      socket.off('siphon_create', fetchGroupSets);
      socket.off('siphon_vote', fetchGroupSets);
      socket.off('siphon_update', fetchGroupSets);
    };
  }, [id]);

  // GroupSet creation/update/reset
  const handleCreateGroupSet = async () => {
    if (!groupSetName.trim()) return toast.error('GroupSet name is required');
    if (groupSetMaxMembers < 0) return toast.error('Max members cannot be negative');

    try {
      // POST to create the groupset
      await axios.post('/api/group/groupset/create', {
        name: groupSetName,
        classroomId: id,
        selfSignup: groupSetSelfSignup,
        joinApproval: groupSetJoinApproval,
        maxMembers: groupSetMaxMembers,
        image: groupSetImage,
      });
      toast.success('GroupSet created successfully');
      resetGroupSetForm();
      fetchGroupSets();
    } catch {
      toast.error('Failed to create group set');
    }
  };

  // It will reset the GroupSet Form
  const resetGroupSetForm = () => {
    setEditingGroupSetId(null);
    setGroupSetName('');
    setGroupSetSelfSignup(false);
    setGroupSetJoinApproval(false);
    setGroupSetMaxMembers('');
    setGroupSetImage('');
  };

  // iT will edit the Group set
  const handleEditGroupSet = (gs) => {
    setEditingGroupSetId(gs._id);
    setGroupSetName(gs.name);
    setGroupSetSelfSignup(gs.selfSignup);
    setGroupSetJoinApproval(gs.joinApproval);
    setGroupSetMaxMembers(gs.maxMembers);
    setGroupSetImage(gs.image);
  };

  // After editing will update the group set
  const handleUpdateGroupSet = async () => {
    if (!groupSetName.trim()) return toast.error('GroupSet name is required');
    if (groupSetMaxMembers < 0) return toast.error('Max members cannot be negative');

    try {
      // PUT API call to update the new edits for the groupset
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
    } catch {
      toast.error('Failed to update group set');
    }
  };

  // const handleDeleteGroupSetConfirm = async (gs) => {
  //   if (!window.confirm(`Delete group set "${gs.name}"?`)) return;

  //   try {
  //     await axios.delete(`/api/group/groupset/${gs._id}`);
  //     toast.success('GroupSet deleted');
  //     fetchGroupSets();
  //   } catch {
  //     toast.error('Failed to delete group set');
  //   }
  // };
  // will delete the group set using DELETE API call
  const handleDeleteGroupSet = async () => {
    if (!confirmDeleteGroupSet) return;

    try {
      await axios.delete(`/api/group/groupset/${confirmDeleteGroupSet._id}`);
      toast.success('GroupSet deleted');
      setConfirmDeleteGroupSet(null);
      fetchGroupSets();
    } catch(error) {
      toast.error('Failed to delete group set');
    }
  };

  // Create Group(s)
  const handleCreateGroup = async (groupSetId) => {
    if (!groupName.trim()) return toast.error('Group name required');
    if (groupCount < 1) return toast.error('Group count must be at least 1');

    const groupSet = groupSets.find(gs => gs._id === groupSetId);
    if (!groupSet) return toast.error('GroupSet not found');

    const existingNames = groupSet.groups.map(g => g.name.trim());
    const baseMatch = groupName.trim().match(/^(.*?)(?:\s\d+)?$/);
    const baseName = baseMatch ? baseMatch[1].trim() : groupName.trim();

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
          name: newName,
          count: 1
        });
      }

      toast.success(`${groupCount} group(s) created`);
      fetchGroupSets();
      setGroupName('');
      setGroupCount(1);
    } catch (err) {
      toast.error('Failed to create group(s)');
    }
  };

  // Group-level actions
  // const handleEditGroup = async (groupSetId, groupId) => {
  //   const newName = prompt('Enter new group name:');
  //   if (!newName?.trim()) return toast.error('Group name cannot be empty');

  //   try {
  //     await axios.put(`/api/group/groupset/${groupSetId}/group/${groupId}`, {
  //       name: newName.trim()
  //     });
  //     toast.success('Group updated');
  //     fetchGroupSets();
  //   } catch {
  //     toast.error('Failed to update group');
  //   }
  // };

  // const handleDeleteGroup = async (groupSetId, groupId) => {
  //   if (!window.confirm('Are you sure you want to delete this group?')) return;
  //   try {
  //     await axios.delete(`/api/group/groupset/${groupSetId}/group/${groupId}`);
  //     toast.success('Group deleted');
  //     fetchGroupSets();
  //   } catch {
  //     toast.error('Failed to delete group');
  //   }
  // };

  // Editing the group name 
  const openEditGroupModal = (groupSetId, groupId, currentName) => {
    setEditGroupModal({ groupSetId, groupId });
    setNewGroupName(currentName);
  };

  // Making sure that the group name cannot be epty and makes a PUT api call to update the new changes for the group
  const handleEditGroup = async () => {
    if (!editGroupModal || !newGroupName.trim()) {
      return toast.error('Group name cannot be empty');
    }

    try {
      const { groupSetId, groupId } = editGroupModal;
      await axios.put(`/api/group/groupset/${groupSetId}/group/${groupId}`, {
        name: newGroupName.trim()
      });
      toast.success('Group updated');
      setEditGroupModal(null);
      fetchGroupSets();
    } catch {
      toast.error('Failed to update group');
    }
  };


  // Will delete hte group using the DELETE API call
  const handleDeleteGroup = async () => {
    if (!confirmDeleteGroup) return;

    try {
      const {groupSetId, groupId} = confirmDeleteGroup;
      await axios.delete(`/api/group/groupset/${groupSetId}/group/${groupId}`);
      toast.success('Group deleted');
      setConfirmDeleteGroup(null);
      fetchGroupSets();
    } catch (error) {
      toast.error('Failed to delete group');
    }
  }

  // Handles a student joining a group
  const handleJoinGroup = async (groupSetId, groupId) => {
  const groupSet = groupSets.find(gs => gs._id === groupSetId);
  if (!groupSet) return toast.error('GroupSet not found');

  const alreadyJoined = groupSet.groups.some(group =>
    group.members.some(m => m._id._id === user._id && m.status === 'approved')
  );

  if (user.role === 'student' && alreadyJoined) {
    toast.error('Students can only join one group in this GroupSet');
    return;
  }

  try {
    // Check if joinApproval is required
    if (!groupSet.joinApproval) {
      // Join instantly (no approval flow)
      await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/join`, {
        autoApprove: true  // optional: flag to auto-approve in backend
      });
      toast.success('Joined group');
    } else {
      // Normal flow: request join
      await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/join`);
      toast.success('Join request sent');
    }

    fetchGroupSets();
  } catch {
    toast.error('Failed to join group');
  }
};

  // const handleLeaveGroup = async (groupSetId, groupId) => {
  //   try {
  //     await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/leave`);
  //     toast.success('Left group');
  //     fetchGroupSets();
  //   } catch {
  //     toast.error('Failed to leave group');
  //   }
  // };
  // Handles a student leaving a group
  const handleLeaveGroup = async () => {
    if (!confirmLeaveGroup) return;

    try {
      const { groupSetId, groupId } = confirmLeaveGroup;
      await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/leave`);
      toast.success('Left group');
      setConfirmLeaveGroup(null);
      fetchGroupSets();
    } catch {
      toast.error('Failed to leave group');
    }
  };


  // Member moderation
  const handleApproveMembers = async (groupSetId, groupId) => {
    try {
      await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/approve`, {
        memberIds: selectedMembers[groupId]
      });
      toast.success('Members approved');
      fetchGroupSets();
    } catch {
      toast.error('Failed to approve members');
    }
  };

  // Handles a teacher rejecting a student trying to join a group using POST api call
  const handleRejectMembers = async (groupSetId, groupId) => {
    try {
      await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/reject`, {
        memberIds: selectedMembers[groupId]
      });
      toast.success('Members rejected');
      fetchGroupSets();
    } catch {
      toast.error('Failed to reject members');
    }
  };

  // Handles suspension teachers can make to studnets in particular groups using POST api call
  const handleSuspendMembers = async (groupSetId, groupId) => {
    try {
      await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/suspend`, {
        memberIds: selectedMembers[groupId]
      });
      toast.success('Members suspended');
      fetchGroupSets();
    } catch {
      toast.error('Failed to suspend members');
    }
  };

  // Siphon actions
  const voteOnSiphon = async (siphonId, vote) => {
    try {
      await axios.post(`/api/siphon/${siphonId}/vote`, { vote });
      fetchGroupSets();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Vote failed');
    }
  };

  // Teacher approving the siphon using POST api call
  const teacherApprove = async (siphonId) => {
    await axios.post(`/api/siphon/${siphonId}/teacher-approve`);
    fetchGroupSets();
  };

  // Teacher rejecting a siphon using POST api call
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

  // Open the adjustment modal for a specific groupSet and group
  const openAdjustModal = (groupSetId, groupId) => {
    setAdjustModal({ groupSetId, groupId });
    setAdjustAmount('');
    setAdjustDesc('');
  };

  // Submit the balance adjustment to backend API
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

  // Helpers for member filtering/sorting
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

  // Toggle select all members in a group
  const handleSelectAllMembers = (groupId, group) => {
    const allSelected = (selectedMembers[groupId] || []).length === group.members.length;
    const newSelected = allSelected ? [] : group.members.map(m => m._id._id);
    setSelectedMembers(prev => ({ ...prev, [groupId]: newSelected }));
  };

  // Toggle selection of a single member by ID within a group
  const handleSelectMember = (groupId, memberId) => {
    setSelectedMembers(prev => {
      const selected = new Set(prev[groupId] || []);
      selected.has(memberId) ? selected.delete(memberId) : selected.add(memberId);
      return { ...prev, [groupId]: Array.from(selected) };
    });
  };
 
  // Create GroupSet
  return (
  <div className="p-6 space-y-6">
    <h1 className="text-3xl font-bold">Groupset</h1>
    {(user.role === 'teacher' || user.role === 'admin') && (
        <div className="card bg-base-200 p-4 space-y-2">
          <input
            className="input input-bordered w-full hover:ring hover:ring-primary"
            type="text"
            placeholder="Groupset Name"
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
              Update Groupset
            </button>
          ) : (
            <button
              className="btn btn-success hover:scale-105 transition-transform duration-200"
              onClick={handleCreateGroupSet}
            >
              Create Groupset
            </button>
          )}
        </div>
      )}
      {groupSets.length === 0 && user.role === 'student' && (
        <p className="text-lg font-medium text-gray-600">No groups available</p>
      )}

    {/* Group Sets */}
    {groupSets.map((gs) => (
      <div key={gs._id} className="card bg-base-100 shadow-md p-4 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">{gs.name}</h2>
            <p>Self Signup: {gs.selfSignup ? 'Yes' : 'No'}</p>
            <p>Join Approval: {gs.joinApproval ? 'Yes' : 'No'}</p>
            <p>Max Members: {gs.maxMembers || 'No limit'}</p>
          </div>
          {gs.image && (
            <img
              src={gs.image}
              alt={gs.name}
              className="w-16 h-16 object-cover rounded"
            />
          )}
        </div>

        {(user.role === 'teacher' || user.role === 'admin') && (
          <div className="flex gap-2">
            <button className="btn btn-sm btn-info" onClick={() => handleEditGroupSet(gs)}>Edit</button>
            <button className="btn btn-sm btn-error" onClick={() => setConfirmDeleteGroupSet(gs)}>Delete</button>
          </div>
        )}

        {/* Create Group */}
        {(user.role === 'teacher' || user.role === 'admin') && (
          <div>
            <h4 className="text-md font-semibold">Create group</h4>
            <input
              type="text"
              className="input input-bordered w-full mt-1 mb-3"
              placeholder="Group Name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <input
              type="number"
              min="1"
              className="input input-bordered w-full"
              placeholder="Group Count"
              value={groupCount}
              onChange={(e) => setGroupCount(e.target.value)}
            />
            <button className="btn btn-success mt-2" onClick={() => handleCreateGroup(gs._id)}>
              Create
            </button>
          </div>
        )}

        {/* Display Groups */}
        {gs.groups.map((group) => (
          <div key={group._id} className="border rounded p-4 bg-base-100">
            <div className="flex justify-between items-start">
              <div>
                <h5 className="font-semibold">{group.name}</h5>
                <p className="text-sm">
                  Members: {group.members.length}/{group.maxMembers || 'No limit'} • 
                  Multiplier: {group.groupMultiplier || 1}x
                </p>
              </div>
              
              {(user.role === 'teacher' || user.role === 'admin') && (
                <GroupMultiplierControl 
                  group={group} 
                  groupSetId={gs._id}
                  classroomId={id}
                  compact={true}
                  refreshGroups={fetchGroupSets}
                />
              )}
            </div>

            <div className="flex gap-2 flex-wrap mt-2">
              {user.role === 'student' && (() => {
                const studentMembership = group.members.find(m => m._id._id === user._id);
                const isApproved = studentMembership?.status === 'approved';
                const isPending = studentMembership?.status === 'pending';

                const alreadyJoinedApproved = gs.groups.some(g =>
                  g.members.some(m => m._id._id === user._id && m.status === 'approved' || m.status === 'pending')
                );

                return (
                  <>
                    {!studentMembership && !alreadyJoinedApproved && (
                      <button
                        className="btn btn-xs btn-success"
                        onClick={() => handleJoinGroup(gs._id, group._id)}
                      >
                        Join
                      </button>
                    )}

                    {isPending && (
                      <button
                        className="btn btn-xs btn-error"
                        onClick={() => handleLeaveGroup(gs._id, group._id)}
                      >
                        Cancel Request
                      </button>
                    )}

                    {isApproved && (
                      <>
                        <button
                          className="btn btn-xs btn-error"
                          onClick={() => setConfirmLeaveGroup({
                            groupSetId: gs._id,
                            groupId: group._id,
                            groupName: group.name
                          })}
                        >
                          Leave
                        </button>
                        <button
                          className="btn btn-xs btn-warning"
                          onClick={() => setOpenSiphonModal(group)}
                        >
                          Siphon
                        </button>
                      </>
                    )}
                  </>
                );
              })()}

              {(user.role === 'teacher' || user.role === 'admin') && (
                <>
                  <button className="btn btn-xs btn-info" onClick={() => openEditGroupModal(gs._id, group._id, group.name)}>Edit</button>
                  <button className="btn btn-xs btn-error" onClick={() =>
                    setConfirmDeleteGroup({
                      groupId: group._id,
                      groupSetId: gs._id,
                      groupName: group.name,
                    })
                  }>Delete</button>
                  <button className="btn btn-xs btn-warning" onClick={() => setOpenSiphonModal(group)}>Siphon</button>
                  <button className="btn btn-xs btn-success" onClick={() => openAdjustModal(gs._id, group._id)}>Transfer</button>
                </>
              )}
            </div>

            {/* Siphon requests */}
            {group.siphonRequests?.length > 0 && (
              <div className="mt-4">
                <h5 className="text-sm font-semibold">Active Siphon Requests</h5>
                {group.siphonRequests
                  .filter(r => r.status !== 'teacher_approved')
                  .map(r => (
                    <div key={r._id} className="border p-2 mt-2 rounded bg-base-200">
                      <p>
                        <strong>{r.amount} bits</strong> from {r.targetUser.email}
                      </p>
                      <div className="italic text-xs mb-1" dangerouslySetInnerHTML={{ __html: r.reasonHtml }} />

                      {r.status === 'pending' && user.role !== 'teacher' &&
                        !r.votes.some(v => v.user.toString() === user._id) && (
                          <div className="flex gap-1">
                            <button className="btn btn-xs btn-success" onClick={() => voteOnSiphon(r._id, 'yes')}>Yes</button>
                            <button className="btn btn-xs btn-error" onClick={() => voteOnSiphon(r._id, 'no')}>No</button>
                          </div>
                        )}

                      {r.status === 'group_approved' && user.role === 'teacher' && (
                        <div className="flex gap-1 mt-1">
                          <button className="btn btn-xs btn-success" onClick={() => teacherApprove(r._id)}>Approve</button>
                          <button className="btn btn-xs btn-error" onClick={() => teacherReject(r._id)}>Reject</button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}

            {/* Member Table */}
            <div className="mt-4">
              <h5 className="text-sm font-semibold mb-2">Members</h5>
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

              <div className="overflow-x-auto">
                <table className="table table-zebra table-sm">
                  <thead>
                    <tr>
                      <th><input type="checkbox"
                        checked={(selectedMembers[group._id]?.length || 0) === group.members.length}
                        onChange={() => handleSelectAllMembers(group._id, group)}
                      /></th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Join Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredAndSortedMembers(group).map((member, idx) => (
                      <tr key={`${group._id}-${member._id._id}-${idx}`}>
                        <td>
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

              {(user.role === 'teacher' || user.role === 'admin') && (
                <div className="mt-2 flex gap-2">
                  <button className="btn btn-xs btn-success" disabled={!selectedMembers[group._id]?.length} onClick={() => handleApproveMembers(gs._id, group._id)}>Approve</button>
                  <button className="btn btn-xs btn-error" disabled={!selectedMembers[group._id]?.length} onClick={() => handleRejectMembers(gs._id, group._id)}>Reject</button>
                  <button className="btn btn-xs btn-warning" disabled={!selectedMembers[group._id]?.length} onClick={() => handleSuspendMembers(gs._id, group._id)}>Suspend</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    ))}

    {/* Modals */}
    {openSiphonModal && (
      <SiphonModal
        group={openSiphonModal}
        onClose={() => setOpenSiphonModal(null)}
      />
    )}

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
            <button className="btn btn-sm" onClick={() => setAdjustModal(null)}>Cancel</button>
            <button className="btn btn-sm btn-primary" onClick={submitAdjust}>Apply</button>
          </div>
        </div>
      </div>
    )}

    {confirmDeleteGroup && (
      <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-base-100 p-6 rounded-xl shadow-lg w-[90%] max-w-sm">
          <h2 className="text-lg font-semibold mb-4 text-center">Confirm Deletion</h2>
          <p className="text-sm text-center">
            Are you sure you want to delete <strong>{confirmDeleteGroup.groupName}</strong>?
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <button
              onClick={() => setConfirmDeleteGroup(null)}
              className="btn btn-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteGroup}
              className="btn btn-sm btn-error"
            >
              Yes, Delete
            </button>
          </div>
        </div>
      </div>
    )}

    {confirmDeleteGroupSet && (
      <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-base-100 p-6 rounded-xl shadow-lg w-[90%] max-w-sm">
          <h2 className="text-lg font-semibold mb-4 text-center">Delete GroupSet</h2>
          <p className="text-sm text-center">
            Are you sure you want to delete the GroupSet <strong>{confirmDeleteGroupSet.name}</strong>?
            <br />
            This will also delete all its groups.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <button
              onClick={() => setConfirmDeleteGroupSet(null)}
              className="btn btn-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteGroupSet}
              className="btn btn-sm btn-error"
            >
              Yes, Delete
            </button>
          </div>
        </div>
      </div>
    )}

    {confirmLeaveGroup && (
      <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-base-100 p-6 rounded-xl shadow-lg w-[90%] max-w-sm">
          <h2 className="text-lg font-semibold mb-4 text-center">Leave Group</h2>
          <p className="text-sm text-center">
            Are you sure you want to leave <strong>{confirmLeaveGroup.groupName}</strong>?
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <button
              onClick={() => setConfirmLeaveGroup(null)}
              className="btn btn-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleLeaveGroup}
              className="btn btn-sm btn-error"
            >
              Yes, Leave
            </button>
          </div>
        </div>
      </div>
    )}

    {editGroupModal && (
      <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-base-100 p-6 rounded-xl shadow-lg w-[90%] max-w-sm">
          <h2 className="text-lg font-semibold mb-4 text-center">Edit Group Name</h2>
          <input
            type="text"
            className="input input-bordered w-full mb-4"
            placeholder="New group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <div className="flex justify-center gap-4">
            <button
              className="btn btn-sm"
              onClick={() => setEditGroupModal(null)}
            >
              Cancel
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={handleEditGroup}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    )}

  </div>
);
};

export default Groups;
 