import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const Home = () => {
  const { user, logout, setUser } = useAuth();
  const [role, setRole] = useState(user?.role || '');
  const [students, setStudents] = useState([]);
  const [classroomName, setClassroomName] = useState('');
  const [classroomCode, setClassroomCode] = useState('');
  const [classrooms, setClassrooms] = useState([]);
  const [joinClassroomCode, setJoinClassroomCode] = useState('');
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
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [bazaars, setBazaars] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupSets, setGroupSets] = useState([]);

  // Fetch the user's role and classrooms on component mount
  useEffect(() => {
    if (user) {
      console.log('Fetched User:', user); // Log the fetched user
      if (user.role) {
        console.log('User Role:', user.role); // Log the user role
        setRole(user.role);
        fetchClassrooms(); // Fetch classrooms when the user role is set
      } else {
        console.log('No role assigned to user'); // Log if no role is assigned
      }
    }
  }, [user]);

  // Fetch classrooms from the backend
  const fetchClassrooms = async () => {
    try {
      const endpoint = role === 'teacher' ? '/api/classroom' : '/api/classroom/student';
      const response = await axios.get(endpoint);
      setClassrooms(response.data);
    } catch (err) {
      console.error('Failed to fetch classrooms', err);
    }
  };

  const handleRoleSelection = async (selectedRole) => {
    try {
      const response = await axios.post('/api/auth/update-role', { role: selectedRole });
      setRole(selectedRole); // Update the role in the state
      setUser(response.data.user); // Update the user in the AuthContext
    } catch (err) {
      console.error('Failed to update role', err);
    }
  };

  const handleCreateClassroom = async () => {
    try {
      const response = await axios.post('/api/classroom/create', {
        name: classroomName,
        code: classroomCode,
      });
      console.log('Classroom created:', response.data);
      alert('Classroom created successfully!');
      setClassroomName('');
      setClassroomCode('');
      fetchClassrooms(); // Refresh the classroom list
    } catch (err) {
      console.error('Failed to create classroom', err);
      alert('Failed to create classroom');
    }
  };

  const handleJoinClassroom = async () => {
    try {
      const response = await axios.post('/api/classroom/join', { code: joinClassroomCode });
      console.log('Joined Classroom:', response.data); // Log the joined classroom
      alert('Joined classroom successfully!');
      setJoinClassroomCode('');
      fetchClassrooms(); // Refresh the classroom list
    } catch (err) {
      console.error('Failed to join classroom', err);
      alert('Failed to join classroom');
    }
  };

  const handleDeleteClassroom = async (classroomId) => {
    try {
      await axios.delete(`/api/classroom/${classroomId}`);
      alert('Classroom deleted successfully!');
      fetchClassrooms(); // Refresh the classroom list
    } catch (err) {
      console.error('Failed to delete classroom', err);
      alert('Failed to delete classroom');
    }
  };

  const handleUpdateClassroom = async (classroomId) => {
    try {
      const response = await axios.put(`/api/classroom/${classroomId}`, {
        name: updateClassroomName,
        image: updateClassroomImage,
      });
      console.log('Classroom updated:', response.data);
      alert('Classroom updated successfully!');
      setUpdateClassroomName('');
      setUpdateClassroomImage('');
      fetchClassrooms(); // Refresh the classroom list
    } catch (err) {
      console.error('Failed to update classroom', err);
      alert('Failed to update classroom');
    }
  };

  const handleLeaveClassroom = async (classroomId) => {
    try {
      await axios.post(`/api/classroom/${classroomId}/leave`);
      alert('Left classroom successfully!');
      fetchClassrooms(); // Refresh the classroom list
    } catch (err) {
      console.error('Failed to leave classroom', err);
      alert('Failed to leave classroom');
    }
  };

  const handleCreateBazaar = async (classroomId) => {
    try {
      await axios.post('/api/bazaar/create', {
        name: bazaarName,
        description: bazaarDescription,
        image: bazaarImage,
        classroomId,
      });
      alert('Bazaar created successfully!');
      fetchBazaars(classroomId); // Refresh the bazaar list
      setBazaarName('');
      setBazaarDescription('');
      setBazaarImage('');
    } catch (err) {
      console.error('Failed to create bazaar', err);
      alert('Failed to create bazaar');
    }
  };

  const handleCreateGroupSet = async (classroomId) => {
    try {
      const response = await axios.post('/api/group/groupset/create', {
        name: groupSetName,
        classroomId,
        selfSignup: groupSetSelfSignup,
        joinApproval: groupSetJoinApproval,
      });
      console.log('GroupSet created:', response.data);
      alert('GroupSet created successfully!');
      setGroupSetName('');
      setGroupSetSelfSignup(false);
      setGroupSetJoinApproval(false);
      fetchGroupSets(classroomId); // Refresh the group set list
    } catch (err) {
      console.error('Failed to create group set', err);
      alert('Failed to create group set');
    }
  };

  const handleCreateGroup = async (classroomId) => {
    try {
      const response = await axios.post('/api/group/create', {
        name: groupName,
        image: groupImage,
        maxMembers: groupMaxMembers,
        classroomId,
      });
      console.log('Group created:', response.data);
      alert('Group created successfully!');
      setGroupName('');
      setGroupImage('');
      setGroupMaxMembers(0);
      fetchGroups(classroomId); // Refresh the group list
    } catch (err) {
      console.error('Failed to create group', err);
      alert('Failed to create group');
    }
  };

  const fetchBazaars = async (classroomId) => {
    try {
      const response = await axios.get(`/api/bazaar/classroom/${classroomId}`);
      setBazaars(response.data);
    } catch (err) {
      console.error('Failed to fetch bazaars', err);
    }
  };

  const fetchGroups = async (classroomId) => {
    try {
      const response = await axios.get(`/api/group/classroom/${classroomId}`);
      setGroups(response.data);
    } catch (err) {
      console.error('Failed to fetch groups', err);
    }
  };

  const fetchGroupSets = async (classroomId) => {
    try {
      const response = await axios.get(`/api/group/groupset/classroom/${classroomId}`);
      setGroupSets(response.data);
    } catch (err) {
      console.error('Failed to fetch group sets', err);
    }
  };

  const fetchStudents = async (classroomId) => {
    try {
      const response = await axios.get(`/api/classroom/${classroomId}/students`);
      setStudents(response.data);
    } catch (err) {
      console.error('Failed to fetch students', err);
    }
  };

  const handleRemoveStudent = async (classroomId, studentId) => {
    try {
      await axios.delete(`/api/classroom/${classroomId}/students/${studentId}`);
      alert('Student removed successfully!');
      fetchStudents(classroomId); // Refresh the student list
    } catch (err) {
      console.error('Failed to remove student', err);
      alert('Failed to remove student');
    }
  };

  const handleSelectClassroom = (classroom) => {
    setSelectedClassroom(classroom);
    fetchBazaars(classroom._id);
    fetchGroups(classroom._id);
    fetchGroupSets(classroom._id);
    fetchStudents(classroom._id); // Fetch students when a classroom is selected
  };

  return (
    <div>
      <h1>Welcome to Gamification App</h1>
      {user ? (
        <div>
          <p>Welcome, {user.email}</p>
          {!role && (
            <div>
              <p>Please select your role:</p>
              <button onClick={() => handleRoleSelection('teacher')}>Teacher</button>
              <button onClick={() => handleRoleSelection('student')}>Student</button>
            </div>
          )}
          {role === 'teacher' && (
            <div>
              <h2>Create Classroom</h2>
              <input
                type="text"
                placeholder="Classroom Name"
                value={classroomName}
                onChange={(e) => setClassroomName(e.target.value)}
              />
              <input
                type="text"
                placeholder="Classroom Code"
                value={classroomCode}
                onChange={(e) => setClassroomCode(e.target.value)}
              />
              <button onClick={handleCreateClassroom}>Create Classroom</button>
            </div>
          )}
          {role === 'student' && (
            <div>
              <h2>Join Classroom</h2>
              <input
                type="text"
                placeholder="Classroom Code"
                value={joinClassroomCode}
                onChange={(e) => setJoinClassroomCode(e.target.value)}
              />
              <button onClick={handleJoinClassroom}>Join Classroom</button>
            </div>
          )}
          <h2>Classrooms</h2>
          <ul>
            {classrooms.map((classroom) => (
              <li key={classroom._id} onClick={() => handleSelectClassroom(classroom)}>
                <h3>{classroom.name}</h3>
                <p>Code: {classroom.code}</p>
                {role === 'teacher' && (
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
                      <button onClick={() => handleUpdateClassroom(classroom._id)}>Update Classroom</button>
                    </div>
                    <button onClick={() => handleLeaveClassroom(classroom._id)}>Leave Classroom</button>
                    <button onClick={() => handleDeleteClassroom(classroom._id)}>Delete Classroom</button>
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
                      <button onClick={() => handleCreateBazaar(classroom._id)}>Create Bazaar</button>
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
                      <button onClick={() => handleCreateGroupSet(classroom._id)}>Create GroupSet</button>
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
                      <button onClick={() => handleCreateGroup(classroom._id)}>Create Group</button>
                    </div>
                    <div>
                      <h3>Students</h3>
                      <ul>
                        {students.map((student) => (
                          <li key={student._id}>
                            {student.email}
                            <button onClick={() => handleRemoveStudent(classroom._id, student._id)}>
                              Remove Student
                            </button>
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
                  </div>
                )}
                {role === 'student' && (
                  <div>
                    <button onClick={() => handleLeaveClassroom(classroom._id)}>Leave Classroom</button>
                    {selectedClassroom && selectedClassroom._id === classroom._id && (
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
                )}
              </li>
            ))}
          </ul>
          <button onClick={logout}>Logout</button>
        </div>
      ) : (
        <div>
          <button onClick={() => window.location.href = '/api/auth/google'}>Login with Google</button>
          <button onClick={() => window.location.href = '/api/auth/microsoft'}>Login with Microsoft</button>
        </div>
      )}
    </div>
  );
};

export default Home;