import React, { useEffect, useState } from 'react';
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
  const [groups, setGroups] = useState([]);
  const [groupSets, setGroupSets] = useState([]);
  const [updateClassroomName, setUpdateClassroomName] = useState('');
  const [updateClassroomImage, setUpdateClassroomImage] = useState('');
  const [bazaarName, setBazaarName] = useState('');
  const [bazaarDescription, setBazaarDescription] = useState('');
  const [bazaarImage, setBazaarImage] = useState('');
  const [groupSetName, setGroupSetName] = useState('');
  const [groupSetSelfSignup, setGroupSetSelfSignup] = useState(false);
  const [groupSetJoinApproval, setGroupSetJoinApproval] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupImage, setGroupImage] = useState('');
  const [groupMaxMembers, setGroupMaxMembers] = useState(0);

  useEffect(() => {
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
      await fetchGroups();
      await fetchGroupSets();
      await fetchStudents();
    };

    fetchClassroomDetails();
  }, [id]);

  const fetchBazaars = async () => {
    try {
      const response = await axios.get(`/api/bazaar/classroom/${id}`);
      setBazaars(response.data);
    } catch (err) {
      console.error('Failed to fetch bazaars', err);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await axios.get(`/api/group/classroom/${id}`);
      setGroups(response.data);
    } catch (err) {
      console.error('Failed to fetch groups', err);
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
      console.log('Classroom updated:', response.data);
      alert('Classroom updated successfully!');
      setUpdateClassroomName('');
      setUpdateClassroomImage('');
      fetchClassroom();
    } catch (err) {
      console.error('Failed to update classroom', err);
      alert('Failed to update classroom');
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
    try {
      const response = await axios.post('/api/group/groupset/create', {
        name: groupSetName,
        classroomId: id,
        selfSignup: groupSetSelfSignup,
        joinApproval: groupSetJoinApproval,
      });
      console.log('GroupSet created:', response.data);
      alert('GroupSet created successfully!');
      setGroupSetName('');
      setGroupSetSelfSignup(false);
      setGroupSetJoinApproval(false);
      fetchGroupSets();
    } catch (err) {
      console.error('Failed to create group set', err);
      alert('Failed to create group set');
    }
  };

  const handleCreateGroup = async () => {
    try {
      const response = await axios.post('/api/group/create', {
        name: groupName,
        image: groupImage,
        maxMembers: groupMaxMembers,
        classroomId: id,
      });
      console.log('Group created:', response.data);
      alert('Group created successfully!');
      setGroupName('');
      setGroupImage('');
      setGroupMaxMembers(0);
      fetchGroups();
    } catch (err) {
      console.error('Failed to create group', err);
      alert('Failed to create group');
    }
  };

  const handleRemoveStudent = async (studentId) => {
    try {
      await axios.delete(`/api/classroom/${id}/students/${studentId}`);
      alert('Student removed successfully!');
      fetchStudents();
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

  if (!classroom) return <div>Loading...</div>;

  return (
    <div>
      <h1>{classroom.name}</h1>
      <p>Class Code: {classroom.code}</p>
      {user.role === 'teacher' && (
        <div>
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
          </div>
          <button onClick={handleLeaveClassroom}>Leave Classroom</button>
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
                  <button onClick={() => handleRemoveStudent(student._id)}>Remove Student</button>
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
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Create GroupSet</h4>
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
            <button onClick={handleCreateGroupSet}>Create GroupSet</button>
          </div>
          <div>
            <h4>Create Group</h4>
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
              onChange={(e) => setGroupMaxMembers(e.target.value)}
            />
            <button onClick={handleCreateGroup}>Create Group</button>
          </div>
        </div>
      )}
      {user.role === 'student' && (
        <div>
          <button onClick={handleLeaveClassroom}>Leave Classroom</button>
          <h3>Bazaars</h3>
          <ul>
            {bazaars.map((bazaar) => (
              <li key={bazaar._id}>
                <h4>{bazaar.name}</h4>
                <p>{bazaar.description}</p>
              </li>
            ))}
          </ul>
          <h3>Groups</h3>
          <ul>
            {groups.map((group) => (
              <li key={group._id}>
                <h4>{group.name}</h4>
                <button onClick={() => handleJoinGroup(group._id)}>Join Group</button>
              </li>
            ))}
          </ul>
          <div>
            <h3>Group Sets</h3>
            <ul>
              {groupSets.map((groupSet) => (
                <li key={groupSet._id}>
                  <h4>{groupSet.name}</h4>
                  {groupSet.selfSignup && <button>Join Group Set</button>}
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