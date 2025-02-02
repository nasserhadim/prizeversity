import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Classroom = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classroom, setClassroom] = useState(null);
  const [students, setStudents] = useState([]);
  const [bazaars, setBazaars] = useState([]);
  const [groupSets, setGroupSets] = useState([]);
  const [updateClassroomName, setUpdateClassroomName] = useState('');
  const [updateClassroomImage, setUpdateClassroomImage] = useState('');
  const [bazaarName, setBazaarName] = useState('');
  const [bazaarDescription, setBazaarDescription] = useState('');
  const [bazaarImage, setBazaarImage] = useState('');
  const [groupSetName, setGroupSetName] = useState('');
  const [groupSetSelfSignup, setGroupSetSelfSignup] = useState(false);
  const [groupSetJoinApproval, setGroupSetJoinApproval] = useState(false);
  const [groupSetMaxMembers, setGroupSetMaxMembers] = useState('');
  const [groupSetImage, setGroupSetImage] = useState('');
  const [editingGroupSet, setEditingGroupSet] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [groupImage, setGroupImage] = useState('');
  const [groupMaxMembers, setGroupMaxMembers] = useState('');
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupCount, setGroupCount] = useState(1);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [editingClassroom, setEditingClassroom] = useState(false);

  useEffect(() => {
    fetchClassroomDetails();
  }, [id]);

  const fetchClassroom = async () => {
    try {
      const response = await axios.get(`/api/classroom/${id}`);
      setClassroom(response.data);
    } catch (err) {
      console.error('Failed to fetch classroom', err);
    }
  };

  const fetchClassroomDetails = async () => {
    await fetchClassroom();
    await fetchBazaars();
    await fetchGroupSets();
    await fetchStudents();
  };

  const fetchBazaars = async () => {
    try {
      const response = await axios.get(`/api/bazaar/classroom/${id}`);
      setBazaars(response.data);
    } catch (err) {
      console.error('Failed to fetch bazaars', err);
    }
  };

  const fetchGroupSets = async () => {
    try {
      const response = await axios.get(`/api/group/groupset/classroom/${id}`);
      setGroupSets(response.data);
    } catch (err) {
      console.error('Failed to fetch group sets', err);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await axios.get(`/api/classroom/${id}/students`);
      setStudents(response.data);
    } catch (err) {
      console.error('Failed to fetch students', err);
    }
  };

  const handleUpdateClassroom = async () => {
    try {
      const response = await axios.put(`/api/classroom/${id}`, {
        name: updateClassroomName,
        image: updateClassroomImage,
      });
      if (response.data.message === 'No changes were made') {
        alert('No changes were made');
      } else {
        console.log('Classroom updated:', response.data);
        alert('Classroom updated successfully!');
      }
      setEditingClassroom(false);
      setUpdateClassroomName('');
      setUpdateClassroomImage('');
      fetchClassroom();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.message) {
        alert(err.response.data.message);
      } else {
        console.error('Failed to update classroom', err);
        alert('Failed to update classroom');
      }
    }
  };

  const handleCreateBazaar = async () => {
    try {
      await axios.post('/api/bazaar/create', {
        name: bazaarName,
        description: bazaarDescription,
        image: bazaarImage,
        classroomId: id,
      });
      alert('Bazaar created successfully!');
      fetchBazaars();
      setBazaarName('');
      setBazaarDescription('');
      setBazaarImage('');
    } catch (err) {
      console.error('Failed to create bazaar', err);
      alert('Failed to create bazaar');
    }
  };

  const handleCreateGroupSet = async () => {
    if (!groupSetName.trim()) {
      alert('GroupSet name is required');
      return;
    }
  
    if (groupSetMaxMembers < 0) {
      alert('Max members cannot be a negative number');
      return;
    }
  
    try {
      const response = await axios.post('/api/group/groupset/create', {
        name: groupSetName,
        classroomId: id,
        selfSignup: groupSetSelfSignup,
        joinApproval: groupSetJoinApproval,
        maxMembers: groupSetMaxMembers,
        image: groupSetImage,
      });
      console.log('GroupSet created:', response.data);
      alert('GroupSet created successfully!');
      setGroupSetName('');
      setGroupSetSelfSignup(false);
      setGroupSetJoinApproval(false);
      setGroupSetMaxMembers('');
      setGroupSetImage('');
      fetchGroupSets();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        alert(err.response.data.error);
      } else {
        console.error('Failed to create group set', err);
        alert('Failed to create group set');
      }
    }
  };
  

  const handleEditGroupSet = (groupSet) => {
    setEditingGroupSet(groupSet);
    setGroupSetName(groupSet.name);
    setGroupSetSelfSignup(groupSet.selfSignup);
    setGroupSetJoinApproval(groupSet.joinApproval);
    setGroupSetMaxMembers(groupSet.maxMembers || '');
    setGroupSetImage(groupSet.image);
  };

  const handleUpdateGroupSet = async () => {
    try {
      const response = await axios.put(`/api/group/groupset/${editingGroupSet._id}`, {
        name: groupSetName,
        selfSignup: groupSetSelfSignup,
        joinApproval: groupSetJoinApproval,
        maxMembers: groupSetMaxMembers,
        image: groupSetImage,
      });
      if (response.data.message === 'No changes were made') {
        alert('No changes were made');
      } else {
        console.log('GroupSet updated:', response.data);
        alert('GroupSet updated successfully!');
      }
      setEditingGroupSet(null);
      setGroupSetName('');
      setGroupSetSelfSignup(false);
      setGroupSetJoinApproval(false);
      setGroupSetMaxMembers('');
      setGroupSetImage('');
      fetchGroupSets();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.message) {
        alert(err.response.data.message);
      } else {
        console.error('Failed to update group set', err);
        alert('Failed to update group set');
      }
    }
  };

  const handleDeleteGroupSet = async (groupSetId) => {
    try {
      await axios.delete(`/api/group/groupset/${groupSetId}`);
      alert('GroupSet deleted successfully!');
      fetchGroupSets();
    } catch (err) {
      console.error('Failed to delete group set', err);
      alert('Failed to delete group set');
    }
  };

  const handleCreateGroup = async (groupSetId) => {
    if (!groupName.trim()) {
      alert('Group name is required');
      return;
    }
  
    if (groupCount <= 0) {
      alert('Number of groups must be greater than 0');
      return;
    }
  
    try {
      const response = await axios.post(`/api/group/groupset/${groupSetId}/group/create`, {
        name: groupName,
        count: groupCount,
      });
      console.log('Groups created:', response.data);
      alert('Groups created successfully!');
      setGroupName('');
      setGroupCount(1);
      fetchGroupSets();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        alert(err.response.data.error);
      } else {
        console.error('Failed to create groups', err);
        alert('Failed to create groups');
      }
    }
  };
  

  const handleEditGroup = (group) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupImage(group.image);
    setGroupMaxMembers(group.maxMembers || '');
  };

  const handleUpdateGroup = async (groupSetId, groupId) => {
    try {
      const response = await axios.put(`/api/group/groupset/${groupSetId}/group/${groupId}`, {
        name: groupName,
        image: groupImage,
        maxMembers: groupMaxMembers,
      });
      if (response.data.message === 'No changes were made') {
        alert('No changes were made');
      } else {
        console.log('Group updated:', response.data);
        alert('Group updated successfully!');
      }
      setEditingGroup(null);
      setGroupName('');
      setGroupImage('');
      setGroupMaxMembers('');
      fetchGroupSets();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.message) {
        alert(err.response.data.message);
      } else {
        console.error('Failed to update group', err);
        alert('Failed to update group');
      }
    }
  };

  const handleDeleteGroup = async (groupSetId, groupId) => {
    try {
      await axios.delete(`/api/group/groupset/${groupSetId}/group/${groupId}`);
      alert('Group deleted successfully!');
      fetchGroupSets();
    } catch (err) {
      console.error('Failed to delete group', err);
      alert('Failed to delete group');
    }
  };

  const handleJoinGroup = async (groupSetId, groupId) => {
    try {
      const response = await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/join`);
      console.log('Joined group:', response.data);
      alert('Joined group successfully!');
      fetchGroupSets();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        alert(`Failed to join group: ${err.response.data.error}`);
      } else {
        console.error('Failed to join group', err);
        alert('Failed to join group');
      }
    }
  };

  const handleLeaveGroup = async (groupSetId, groupId) => {
    try {
      const response = await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/leave`);
      console.log('Leave group response:', response.data);
      alert(response.data.message); // Will show either success message or "You're not a member" message
      fetchGroupSets();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.message) {
        alert(err.response.data.message);
      } else {
        console.error('Failed to leave group', err);
        alert('Failed to leave group');
      }
    }
  };

  const handleRemoveStudent = async (studentId) => {
    try {
      await axios.delete(`/api/classroom/${id}/students/${studentId}`);
      alert('Student removed successfully!');
      // Fetch both students and group sets to update the UI
      await Promise.all([
        fetchStudents(),
        fetchGroupSets()
      ]);
    } catch (err) {
      console.error('Failed to remove student', err);
      alert('Failed to remove student');
    }
  };

  const handleLeaveClassroom = async () => {
    try {
      await axios.post(`/api/classroom/${id}/leave`);
      alert('Left classroom successfully!');
      navigate('/');
    } catch (err) {
      console.error('Failed to leave classroom', err);
      alert('Failed to leave classroom');
    }
  };

  const handleDeleteClassroom = async () => {
    try {
      await axios.delete(`/api/classroom/${id}`);
      alert('Classroom deleted successfully!');
      navigate('/');
    } catch (err) {
      console.error('Failed to delete classroom', err);
      alert('Failed to delete classroom');
    }
  };

  const handleSelectMember = (groupId, memberId) => {
    setSelectedMembers((prevSelected) => {
      const groupSelectedMembers = prevSelected[groupId] || [];
      const newGroupSelectedMembers = groupSelectedMembers.includes(memberId)
        ? groupSelectedMembers.filter((id) => id !== memberId)
        : [...groupSelectedMembers, memberId];
      return { ...prevSelected, [groupId]: newGroupSelectedMembers };
    });
  };

  const handleSelectAllMembers = (groupId, group) => {
    setSelectedMembers(prevSelected => {
      const allMemberIds = group.members.map(member => member._id._id);
      const currentGroupSelected = prevSelected[groupId] || [];
      const newGroupSelectedMembers = currentGroupSelected.length === allMemberIds.length 
        ? []  // If all are selected, unselect all
        : allMemberIds;  // Otherwise, select all
      return { ...prevSelected, [groupId]: newGroupSelectedMembers };
    });
  };

  const handleSuspendMembers = async (groupSetId, groupId) => {
    const groupSelectedMembers = selectedMembers[groupId] || [];
    if (groupSelectedMembers.length === 0) {
      alert('No members selected for suspension.');
      return;
    }
  
    try {
      const response = await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/suspend`, {
        memberIds: groupSelectedMembers
      });
      alert(response.data.message);
      setSelectedMembers((prevSelected) => ({ ...prevSelected, [groupId]: [] }));
      fetchGroupSets();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.message) {
        alert(err.response.data.message);
      } else {
        console.error('Failed to suspend members', err);
        alert('Failed to suspend members');
      }
    }
  };

  const handleCancelUpdate = () => {
    setEditingClassroom(false);
    setEditingGroupSet(null);
    setEditingGroup(null);
    setGroupSetName('');
    setGroupSetSelfSignup(false);
    setGroupSetJoinApproval(false);
    setGroupSetMaxMembers('');
    setGroupSetImage('');
    setGroupName('');
    setGroupImage('');
    setGroupMaxMembers('');
  };

  // Add these confirmation handlers
  const handleLeaveClassroomConfirm = async () => {
    if (window.confirm(`You are about to leave the classroom "${classroom.name}". If you're a member of any group(s) in this classroom, you will be automatically removed. Are you sure you want to proceed?`)) {
      try {
        await axios.post(`/api/classroom/${id}/leave`);
        alert('Left classroom successfully!');
        navigate('/');
      } catch (err) {
        console.error('Failed to leave classroom', err);
        alert('Failed to leave classroom');
      }
    }
  };

  const handleDeleteClassroomConfirm = async () => {
    if (window.confirm(`You're about to delete classroom "${classroom.name}". All data will be purged! Are you sure you want to proceed?`)) {
      try {
        await axios.delete(`/api/classroom/${id}`);
        alert('Classroom deleted successfully!');
        navigate('/');
      } catch (err) {
        console.error('Failed to delete classroom', err);
        alert('Failed to delete classroom');
      }
    }
  };

  const handleRemoveStudentConfirm = async (studentId) => {
    if (window.confirm('Are you sure you want to proceed with the removal? Any group associations will be disconnected as well.')) {
      try {
        await axios.delete(`/api/classroom/${id}/students/${studentId}`);
        alert('Student removed successfully!');
        await Promise.all([
          fetchStudents(),
          fetchGroupSets()
        ]);
      } catch (err) {
        console.error('Failed to remove student', err);
        alert('Failed to remove student');
      }
    }
  };

  const handleDeleteGroupSetConfirm = async (groupSet) => {
    if (window.confirm(`You're about to delete this GroupSet "${groupSet.name}". All student enrollment in any groups within this GroupSet will be purged alongside the groups themselves. Are you sure you want to proceed?`)) {
      try {
        await axios.delete(`/api/group/groupset/${groupSet._id}`);
        alert('GroupSet deleted successfully!');
        fetchGroupSets();
      } catch (err) {
        console.error('Failed to delete group set', err);
        alert('Failed to delete group set');
      }
    }
  };

  const handleDeleteGroupConfirm = async (groupSetId, group) => {
    if (window.confirm(`You're about to delete this group "${group.name}". Any students enrolled in the group will be removed. Are you sure you want to proceed?`)) {
      try {
        await axios.delete(`/api/group/groupset/${groupSetId}/group/${group._id}`);
        alert('Group deleted successfully!');
        fetchGroupSets();
      } catch (err) {
        console.error('Failed to delete group', err);
        alert('Failed to delete group');
      }
    }
  };

  if (!classroom) return <div>Loading...</div>;

  return (
    <div>
      <h1>{classroom.name}</h1>
      <p>Class Code: {classroom.code}</p>
      {user.role === 'teacher' && (
        <div>
          {editingClassroom ? (
            <div>
              <h4>Update Classroom</h4>
              <input
                type="text"
                placeholder="New Classroom Name"
                value={updateClassroomName}
                onChange={(e) => setUpdateClassroomName(e.target.value)}
              />
              <input
                type="text"
                placeholder="New Image URL"
                value={updateClassroomImage}
                onChange={(e) => setUpdateClassroomImage(e.target.value)}
              />
              <button onClick={handleUpdateClassroom}>Update Classroom</button>
              <button onClick={handleCancelUpdate}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setEditingClassroom(true)}>Edit Classroom</button>
          )}
          <button onClick={handleLeaveClassroomConfirm}>Leave Classroom</button>
          <button onClick={handleDeleteClassroomConfirm}>Delete Classroom</button>
          <div>
            <h4>Create Bazaar</h4>
            <input
              type="text"
              placeholder="Bazaar Name"
              value={bazaarName}
              onChange={(e) => setBazaarName(e.target.value)}
            />
            <input
              type="text"
              placeholder="Description"
              value={bazaarDescription}
              onChange={(e) => setBazaarDescription(e.target.value)}
            />
            <input
              type="text"
              placeholder="Image URL"
              value={bazaarImage}
              onChange={(e) => setBazaarImage(e.target.value)}
            />
            <button onClick={handleCreateBazaar}>Create Bazaar</button>
          </div>
          <div>
            <h3>Bazaars</h3>
            <ul>
              {bazaars.map((bazaar) => (
                <li key={bazaar._id}>
                  <h4>{bazaar.name}</h4>
                  <p>{bazaar.description}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Students</h3>
            <ul>
              {students.map((student) => (
                <li key={student._id}>
                  {student.email}
                  <button onClick={() => handleRemoveStudentConfirm(student._id)}>Remove Student</button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Group Sets</h3>
            <ul>
              {groupSets.map((groupSet) => (
                <li key={groupSet._id}>
                  <h4>{groupSet.name}</h4>
                  <p>Self Signup: {groupSet.selfSignup ? 'Yes' : 'No'}</p>
                  <p>Join Approval: {groupSet.joinApproval ? 'Yes' : 'No'}</p>
                  <p>Max Members: {groupSet.maxMembers || 'No limit'}</p>
                  <p>Image: <img src={groupSet.image} alt={groupSet.name} width="50" /></p>
                  <button onClick={() => handleEditGroupSet(groupSet)}>Edit</button>
                  <button onClick={() => handleDeleteGroupSetConfirm(groupSet)}>Delete</button>
                  <div>
                    <h4>Create Group</h4>
                    <input
                      type="text"
                      placeholder="Group Name"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Number of Groups"
                      value={groupCount}
                      onChange={(e) => setGroupCount(Math.max(1, e.target.value))}
                    />
                    <button onClick={() => handleCreateGroup(groupSet._id)}>Create Groups</button>
                  </div>
                  <div>
                    <h4>Groups</h4>
                    <ul>
                      {groupSet.groups.map((group) => (
                        <li key={group._id}>
                          <h5>{group.name}</h5>
                          <p>Members: {group.members.length}/{group.maxMembers || 'No limit'}</p>
                          <button onClick={() => handleJoinGroup(groupSet._id, group._id)}>Join Group</button>
                          <button onClick={() => handleLeaveGroup(groupSet._id, group._id)}>Leave Group</button>
                          <button onClick={() => handleEditGroup(group)}>Edit</button>
                          <button onClick={() => handleDeleteGroupConfirm(groupSet._id, group)}>Delete</button>
                          {editingGroup && editingGroup._id === group._id && (
                            <div>
                              <h4>Update Group</h4>
                              <input
                                type="text"
                                placeholder="Group Name"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                              />
                              <input
                                type="text"
                                placeholder="Image URL"
                                value={groupImage}
                                onChange={(e) => setGroupImage(e.target.value)}
                              />
                              <input
                                type="number"
                                placeholder="Max Members"
                                value={groupMaxMembers}
                                onChange={(e) => setGroupMaxMembers(Math.max(0, e.target.value))}
                              />
                              <button onClick={() => handleUpdateGroup(groupSet._id, group._id)}>Update Group</button>
                              <button onClick={handleCancelUpdate}>Cancel</button>
                            </div>
                          )}
                          <div>
                            <h5>Members</h5>
                            <table>
                              <thead>
                                <tr>
                                  <th>
                                    <input
                                      type="checkbox"
                                      checked={(selectedMembers[group._id]?.length || 0) === group.members.length}
                                      onChange={() => handleSelectAllMembers(group._id, group)}
                                    />
                                  </th>
                                  <th>Name/Email</th>
                                  <th>Join Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.members.map((member) => (
                                  <tr key={`${group._id}-${member._id._id}`}>
                                    <td>
                                      <input
                                        type="checkbox"
                                        checked={selectedMembers[group._id]?.includes(member._id._id) || false}
                                        onChange={() => handleSelectMember(group._id, member._id._id)}
                                      />
                                    </td>
                                    <td>{member._id.email}</td>
                                    <td>{new Date(member.joinDate).toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <button onClick={() => handleSuspendMembers(groupSet._id, group._id)}>Suspend</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>{editingGroupSet ? 'Update GroupSet' : 'Create GroupSet'}</h4>
            <input
              type="text"
              placeholder="GroupSet Name"
              value={groupSetName}
              onChange={(e) => setGroupSetName(e.target.value)}
            />
            <label>
              <input
                type="checkbox"
                checked={groupSetSelfSignup}
                onChange={(e) => setGroupSetSelfSignup(e.target.checked)}
              />
              Allow Self-Signup
            </label>
            <label>
              <input
                type="checkbox"
                checked={groupSetJoinApproval}
                onChange={(e) => setGroupSetJoinApproval(e.target.checked)}
              />
              Require Join Approval
            </label>
            <input
              type="number"
              placeholder="Max Members"
              value={groupSetMaxMembers}
              onChange={(e) => setGroupSetMaxMembers(Math.max(0, e.target.value))}
            />
            <input
              type="text"
              placeholder="Image URL"
              value={groupSetImage}
              onChange={(e) => setGroupSetImage(e.target.value)}
            />
            <button onClick={editingGroupSet ? handleUpdateGroupSet : handleCreateGroupSet}>
              {editingGroupSet ? 'Update GroupSet' : 'Create GroupSet'}
            </button>
            {editingGroupSet && <button onClick={handleCancelUpdate}>Cancel</button>}
          </div>
        </div>
      )}
      {user.role === 'student' && (
        <div>
          <button onClick={handleLeaveClassroomConfirm}>Leave Classroom</button>
          <h3>Bazaars</h3>
          <ul>
            {bazaars.map((bazaar) => (
              <li key={bazaar._id}>
                <h4>{bazaar.name}</h4>
                <p>{bazaar.description}</p>
              </li>
            ))}
          </ul>
          <div>
            <h3>Group Sets</h3>
            <ul>
              {groupSets.map((groupSet) => (
                <li key={groupSet._id}>
                  <h4>{groupSet.name}</h4>
                  <p>Self Signup: {groupSet.selfSignup ? 'Yes' : 'No'}</p>
                  <p>Join Approval: {groupSet.joinApproval ? 'Yes' : 'No'}</p>
                  <p>Max Members: {groupSet.maxMembers || 'No limit'}</p>
                  <p>Image: <img src={groupSet.image} alt={groupSet.name} width="50" /></p>
                  <div>
                    <h4>Groups</h4>
                    <ul>
                      {groupSet.groups.map((group) => (
                        <li key={group._id}>
                          <h5>{group.name}</h5>
                          <p>Members: {group.members.length}/{group.maxMembers || 'No limit'}</p>
                          <button onClick={() => handleJoinGroup(groupSet._id, group._id)}>Join Group</button>
                          <button onClick={() => handleLeaveGroup(groupSet._id, group._id)}>Leave Group</button>
                          <div>
                            <h5>Members</h5>
                            <table>
                              <thead>
                                <tr>
                                  <th>Name/Email</th>
                                  <th>Join Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.members.map((member) => (
                                  <tr key={`${group._id}-${member._id._id}`}>
                                    <td>{member._id.email}</td>
                                    <td>{new Date(member.joinDate).toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default Classroom;