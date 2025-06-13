import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import socket from '../utils/socket';

const Groups = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // these const state variables will be managing groups and group sets (not yet have been put to implementation yet)
  const [groupSets, setGroupSets] = useState([]);
  const [groupSetName, setGroupSetName] = useState('');
  const [groupSetSelfSignup, setGroupSetSelfSignup] = useState(false);
  const [groupSetJoinApproval, setGroupSetJoinApproval] = useState(false);
  const [groupSetMaxMembers, setGroupSetMaxMembers] = useState('');
  const [groupSetImage, setGroupSetImage] = useState('');
  const [editingGroupSet, setEditingGroupSet] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [groupImage, setGroupImage] = useState('');
  const [groupMaxMembers, setGroupMaxMembers] = useState('');
  const [groupCount, setGroupCount] = useState(1);
  const [selectedMembers, setSelectedMembers] = useState({});
  const [editingGroup, setEditingGroup] = useState(null);
  const [memberFilters, setMemberFilters] = useState({});
  const [memberSorts, setMemberSorts] = useState({});
  const [memberSearches, setMemberSearches] = useState({});


  // Moved all the functions from the Classroom.jsx related to the group functionalities

  // Will get the group sets and join the socket room for the classroom 
  useEffect(() => {
    fetchGroupSets();
    socket.emit('join', `classroom-${id}`);
    return () => {
      socket.off('group_update');
      socket.off('groupset_update');
    };
  }, [id]);


  // Will fetch group sets for the classroom 
  const fetchGroupSets = async () => {
    try {
      const res = await axios.get(`/api/group/groupset/classroom/${id}`);
      setGroupSets(res.data);
    } catch (err) {
      console.error('Failed to fetch group sets:', err);
    }
  };

  // Teacher will be the only one that will be able to crate Group Set
  const handleCreateGroupSet = async () => {
    try {
      await axios.post('/api/group/groupset/create', {
        name: groupSetName,
        classroomId: id,
        selfSignup: groupSetSelfSignup,
        joinApproval: groupSetJoinApproval,
        maxMembers: groupSetMaxMembers,
        image: groupSetImage,
      });
      // Will refresh the list and reset the inputs from the previous creation
      fetchGroupSets();
      setGroupSetName('');
      setGroupSetSelfSignup(false);
      setGroupSetJoinApproval(false);
      setGroupSetMaxMembers('');
      setGroupSetImage('');
    } catch (err) {
      alert('Failed to create GroupSet');
    }
  };

  // The groups will be crated within the groupset that is specfici choosen
  const handleCreateGroup = async (groupSetId) => {
    if (!groupName.trim()) return alert('Group name required');
    if (groupCount < 1 ) return alert('Group count must be at least 1');
    try {
      await axios.post(`/api/group/groupset/${groupSetId}/group/create`, {
        name: groupName,
        count: groupCount,
      });
      fetchGroupSets();
      setGroupName('');
      setGroupCount(1);
      } catch (err) {
      const message = err?.response?.data?.error || 'Failed to create group';
      alert(message);
      }

  };

  // Students will have the option to join the specific group (later on will add a timeline for the Teacher where they can see students that are not in a group by the deadline (also created by the professor))
  const handleJoinGroup = async (groupSetId, groupId) => {
    try {
      await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/join`);
      fetchGroupSets();
    } catch (err) {
      alert('Failed to join group');
    }
  };


  // The option of leaving the group
  const handleLeaveGroup = async (groupSetId, groupId) => {
    try {
      await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/leave`);
      fetchGroupSets();
    } catch (err) {
      alert('Failed to leave group');
    }
  };


  // It will be able to filter, search and sort group memebrs but this is not yet implemented in the Group page
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


  // Adding all the UI for the functions above
  return (
  <div className="p-6 max-w-5xl mx-auto">
    <h1 className="text-4xl font-bold mb-8 text-center">Group Management</h1>

    {user?.role === 'teacher' && (
      <div className="mb-10">
        <div className="card bg-base-100 shadow-xl p-6">
          <h2 className="text-2xl font-semibold mb-4">Create a Group Set</h2>
          <div className="form-control mb-4">
            <input
              type="text"
              placeholder="Group Set Name"
              className="input input-bordered"
              value={groupSetName}
              onChange={(e) => setGroupSetName(e.target.value)}
            />
          </div>
          <div className="form-control mb-4 flex flex-row items-center gap-4">
            <label className="label cursor-pointer">
              <span className="label-text">Self Signup</span>
              <input
                type="checkbox"
                className="checkbox"
                checked={groupSetSelfSignup}
                onChange={() => setGroupSetSelfSignup(!groupSetSelfSignup)}
              />
            </label>
            <label className="label cursor-pointer">
              <span className="label-text">Join Approval</span>
              <input
                type="checkbox"
                className="checkbox"
                checked={groupSetJoinApproval}
                onChange={() => setGroupSetJoinApproval(!groupSetJoinApproval)}
              />
            </label>
          </div>
          <div className="form-control mb-4">
            <input
              type="number"
              placeholder="Max Members"
              className="input input-bordered"
              value={groupSetMaxMembers}
              onChange={(e) => setGroupSetMaxMembers(e.target.value)}
            />
          </div>
          <div className="form-control mb-4">
            <input
              type="text"
              placeholder="Image URL (optional)"
              className="input input-bordered"
              value={groupSetImage}
              onChange={(e) => setGroupSetImage(e.target.value)}
            />
          </div>
          <button className="btn btn-primary w-full" onClick={handleCreateGroupSet}>
            Create Group Set
          </button>
        </div>
      </div>
    )}

    <div className="space-y-6">
      {groupSets.map((gs) => (
        <div key={gs._id} className="card bg-base-200 shadow-md p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">{gs.name}</h2>
              <p className="text-sm text-gray-500">{gs.groups.length} groups</p>
            </div>
            {gs.image && (
              <img src={gs.image} alt={gs.name} className="w-16 h-16 object-cover rounded-lg" />
            )}
          </div>

          {user?.role === 'teacher' && (
            <div className="mt-4 flex flex-col md:flex-row gap-4 items-center">
              <input
                type="text"
                placeholder="Group Name"
                className="input input-bordered w-full"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
              <input
                type="number"
                min="1"
                placeholder="Group Count"
                className="input input-bordered w-full"
                value={groupCount}
                onChange={(e) => {
                const value = Math.max(1, parseInt(e.target.value) || 1);
                setGroupCount(value);
                }}
              />
              <button className="btn btn-success" onClick={() => handleCreateGroup(gs._id)}>
                Add Group
              </button>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {gs.groups.map((g) => (
              <div
                key={g._id}
                className="bg-base-100 p-4 border rounded-lg flex justify-between items-center"
              >
                <div>
                  <h3 className="text-lg font-semibold">{g.name}</h3>
                  <p className="text-sm text-gray-500">{g.members.length} members</p>
                </div>
                {user?.role === 'student' && (
                  <div className="flex gap-2">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleJoinGroup(gs._id, g._id)}
                    >
                      Join
                    </button>
                    <button
                      className="btn btn-sm btn-error"
                      onClick={() => handleLeaveGroup(gs._id, g._id)}
                    >
                      Leave
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

};

export default Groups;