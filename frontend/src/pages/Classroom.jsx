import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import '../styles/MemberManagement.css';
import socket from '../utils/socket';
import { Link } from 'react-router-dom';
import apiBazaar from '../API/apiBazaar';
import toast from 'react-hot-toast';
import { LoaderIcon } from 'lucide-react';

const Classroom = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true); // Add loading state
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
  const [memberFilters, setMemberFilters] = useState({});
  const [memberSorts, setMemberSorts] = useState({});
  const [memberSearches, setMemberSearches] = useState({});

  useEffect(() => {
    // Don't try to fetch data if there's no user yet
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        await fetchClassroomDetails();
      } catch (err) {
        // Check if error is due to unauthorized access
        if (err.response?.status === 401) {
          localStorage.removeItem('hadPreviousSession');
          navigate('/?session_expired=true');
          return;
        }
        console.error('Error fetching classroom details:', err);
      }
    };

    fetchData();
  }, [id, user, navigate]);

  useEffect(() => {
    // Join classroom socket room
    socket.emit('join', `classroom-${id}`);

    socket.on('classroom_update', (updatedClassroom) => {
      setClassroom(updatedClassroom);
    });

    socket.on('groupset_update', (updatedGroupSet) => {
      setGroupSets(prevGroupSets =>
        prevGroupSets.map(gs =>
          gs._id === updatedGroupSet._id ? updatedGroupSet : gs
        )
      );
    });

    socket.on('group_update', ({ groupSet: groupSetId, group: updatedGroup }) => {
      setGroupSets(prevGroupSets =>
        prevGroupSets.map(gs => {
          if (gs._id === groupSetId) {
            return {
              ...gs,
              groups: gs.groups.map(g =>
                g._id === updatedGroup._id ? updatedGroup : g
              )
            };
          }
          return gs;
        })
      );
    });

    return () => {
      socket.off('classroom_update');
      socket.off('groupset_update');
      socket.off('group_update');
    };
  }, [id]);

  useEffect(() => {
    socket.on('classroom_removal', (data) => {
      if (data.classroomId === id) {
        alert(data.message);
        navigate('/');
      }
    });

    socket.on('groupset_create', (newGroupSet) => {
      setGroupSets(prev => [...prev, newGroupSet]);
    });

    return () => {
      socket.off('classroom_removal');
      socket.off('groupset_create');
    };
  }, [id, navigate]);

  useEffect(() => {
    socket.on('classroom_update', (updatedClassroom) => {
      setClassroom(updatedClassroom);
    });

    socket.on('groupset_delete', (groupSetId) => {
      setGroupSets(prev => prev.filter(gs => gs._id !== groupSetId));
    });

    socket.on('group_delete', ({ groupSetId, groupId }) => {
      setGroupSets(prev => prev.map(gs => {
        if (gs._id === groupSetId) {
          return {
            ...gs,
            groups: gs.groups.filter(g => g._id !== groupId)
          };
        }
        return gs;
      }));
    });

    return () => {
      socket.off('classroom_update');
      socket.off('groupset_delete');
      socket.off('group_delete');
    };
  }, []);

  useEffect(() => {
    socket.on('notification', (notification) => {
      // Handle classroom rename notifications while inside classroom
      if (notification.type === 'classroom_update' &&
        notification.classroom?._id === id) {
        fetchClassroom();
      }
    });

    return () => {
      socket.off('notification');
    };
  }, [id]);

  const fetchClassroomDetails = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/classroom/${id}`);
      // Check if user still has access to this classroom
      const classroom = response.data;
      const hasAccess =
        user.role === 'admin' ||
        (user.role === 'teacher' && classroom.teacher === user._id) ||
        (user.role === 'student' && classroom.students.includes(user._id));

      if (!hasAccess) {
        alert('You no longer have access to this classroom');
        navigate('/');
        return;
      }

      setClassroom(response.data);
      await fetchBazaars();
      await fetchGroupSets();
      await fetchStudents();
    } catch (err) {
      if (err.response?.status === 403) {
        alert('You no longer have access to this classroom');
        navigate('/');
        return;
      }
      // Let the error bubble up to the parent try-catch
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const fetchClassroom = async () => {
    try {
      const response = await axios.get(`/api/classroom/${id}`);
      setClassroom(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        throw err; // Let parent handle the 401
      }
      console.error('Failed to fetch classroom', err);
    }
  };

  const fetchBazaars = async () => {
    try {
      const res = await apiBazaar.get(`/classroom/${classroomId}/bazaar`);
      setBazaars(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        throw err;
      }
      console.error('Failed to fetch bazaars', err);
    }
  };

  const fetchGroupSets = async () => {
    try {
      const response = await axios.get(`/api/group/groupset/classroom/${id}`);
      setGroupSets(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        throw err;
      }
      console.error('Failed to fetch group sets', err);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await axios.get(`/api/classroom/${id}/students`);
      setStudents(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        throw err;
      }
      console.error('Failed to fetch students', err);
    }
  };

  const handleUpdateClassroom = async () => {
    try {
      const response = await axios.put(`/api/classroom/${id}`, {
        name: updateClassroomName || classroom.name,
        image: updateClassroomImage || classroom.image
      });

      if (response.data.message === 'No changes were made') {
        // alert('No changes were made');
        toast.error('No changes were made!');
      } else {
        // alert('Classroom updated successfully!');
        toast.success('Classroom updated successfully!');
        setEditingClassroom(false);
        setUpdateClassroomName('');
        setUpdateClassroomImage('');
        fetchClassroom();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to update classroom';
      toast.error(errorMessage);
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
      toast.success('Bazaar created successfully!');
      fetchBazaars();
      setBazaarName('');
      setBazaarDescription('');
      setBazaarImage('');
    } catch (err) {
      console.error('Failed to create bazaar', err);
      toast.error('Failed to create bazaar');
    }
  };

  const handleCreateGroupSet = async () => {
    if (!groupSetName.trim()) {
      toast.error('GroupSet name is required');
      return;
    }

    if (groupSetMaxMembers < 0) {
      toast.error('Max members cannot be a negative number');
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
      toast.success('GroupSet created successfully!');
      setGroupSetName('');
      setGroupSetSelfSignup(false);
      setGroupSetJoinApproval(false);
      setGroupSetMaxMembers('');
      setGroupSetImage('');
      fetchGroupSets();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        toast.error(err.response.data.error);
      } else {
        console.error('Failed to create group set', err);
        toast.error('Failed to create group set');
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
        toast.error('No changes were made');
      } else {
        toast.success('GroupSet updated successfully!');
        setEditingGroupSet(null);
        setGroupSetName('');
        setGroupSetSelfSignup(false);
        setGroupSetJoinApproval(false);
        setGroupSetMaxMembers('');
        setGroupSetImage('');
        fetchGroupSets();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to update groupset';
      toast.error(errorMessage);
    }
  };

  const handleDeleteGroupSet = async (groupSetId) => {
    try {
      await axios.delete(`/api/group/groupset/${groupSetId}`);
      toast.success('GroupSet deleted successfully!');
      fetchGroupSets();
    } catch (err) {
      console.error('Failed to delete group set', err);
      toast.error('Failed to delete group set');
    }
  };

  const handleCreateGroup = async (groupSetId) => {
    if (!groupName.trim()) {
      toast.error('Group name is required');
      return;
    }

    if (groupCount <= 0) {
      toast.error('Number of groups must be greater than 0');
      return;
    }

    try {
      const response = await axios.post(`/api/group/groupset/${groupSetId}/group/create`, {
        name: groupName,
        count: groupCount,
      });
      console.log('Groups created:', response.data);
      toast.success('Groups created successfully!');
      setGroupName('');
      setGroupCount(1);
      fetchGroupSets();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        toast.error(err.response.data.error);
      } else {
        console.error('Failed to create groups', err);
        toast.error('Failed to create groups');
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
        toast.error('No changes were made');
      } else {
        toast.success('Group updated successfully!');
        setEditingGroup(null);
        setGroupName('');
        setGroupImage('');
        setGroupMaxMembers('');
        fetchGroupSets();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to update group';
      toast.error(errorMessage);
    }
  };

  const handleDeleteGroup = async (groupSetId, groupId) => {
    try {
      await axios.delete(`/api/group/groupset/${groupSetId}/group/${groupId}`);
      toast.success('Group deleted successfully!');
      fetchGroupSets();
    } catch (err) {
      console.error('Failed to delete group', err);
      toast.error('Failed to delete group');
    }
  };

  const handleJoinGroup = async (groupSetId, groupId) => {
    try {
      // Check if user is already in any group in this groupset
      const currentGroupSet = groupSets.find(gs => gs._id === groupSetId);
      if (currentGroupSet) {
        const isInAnyGroup = currentGroupSet.groups.some(group =>
          group.members.some(member =>
            member._id._id === user._id &&
            (member.status === 'approved' || member.status === 'pending')
          )
        );

        if (isInAnyGroup) {
          toast.error('You are already a member or have a pending request in this GroupSet');
          return;
        }
      }

      const response = await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/join`);
      alert(response.data.message);
      fetchGroupSets();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        toast.error(err.response.data.error);
      } else {
        console.error('Failed to join group', err);
        toast.error('Failed to join group');
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
        toast.error(err.response.data.message);
      } else {
        console.error('Failed to leave group', err);
        toast.error('Failed to leave group');
      }
    }
  };

  const handleRemoveStudent = async (studentId) => {
    try {
      await axios.delete(`/api/classroom/${id}/students/${studentId}`);
      toast.success('Student removed successfully!');
      // Fetch both students and group sets to update the UI
      await Promise.all([
        fetchStudents(),
        fetchGroupSets()
      ]);
    } catch (err) {
      console.error('Failed to remove student', err);
      toast.error('Failed to remove student');
    }
  };

  const handleLeaveClassroom = async () => {
    try {
      await axios.post(`/api/classroom/${id}/leave`);
      // alert('Left classroom successfully!');
      toast.success('Left classroom successfully!');
      navigate('/classrooms');
    } catch (err) {
      console.error('Failed to leave classroom', err);
      // alert('Failed to leave classroom');
      toast.error("Failed to leave classroom!");
    }
  };

  const handleDeleteClassroom = async () => {
    try {
      await axios.delete(`/api/classroom/${id}`);
      toast.success('Classroom deleted successfully!');
      navigate('/');
    } catch (err) {
      console.error('Failed to delete classroom', err);
      toast.error('Failed to delete classroom');
    }
  };

  const handleSelectMember = (groupId, memberId) => {
    setSelectedMembers(prevSelected => ({
      ...prevSelected,
      [groupId]: prevSelected[groupId]
        ? prevSelected[groupId].includes(memberId)
          ? prevSelected[groupId].filter(id => id !== memberId)
          : [...prevSelected[groupId], memberId]
        : [memberId]
    }));
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
      toast.error('No members selected for suspension.');
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
        toast.error(err.response.data.message);
      } else {
        console.error('Failed to suspend members', err);
        toast.error('Failed to suspend members');
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
        // alert('Left classroom successfully!');
        toast.success('Left classroom successfully!');
        navigate('/classrooms');
      } catch (err) {
        console.error('Failed to leave classroom', err);
        // alert('Failed to leave classroom');
        toast.error('Failed to leave classroom!');
      }
    }
  };

  const handleDeleteClassroomConfirm = async () => {
    if (window.confirm(`You're about to delete classroom "${classroom.name}". All data will be purged! Are you sure you want to proceed?`)) {
      try {
        await axios.delete(`/api/classroom/${id}`);
        // alert('Classroom deleted successfully!');
        toast.success('Classroom deleted successfully!');
        navigate('/classrooms');
      } catch (err) {
        console.error('Failed to delete classroom', err);
        // alert('Failed to delete classroom');
        toast.error('Failed to delete classroom!');
      }
    }
  };

  const handleRemoveStudentConfirm = async (studentId) => {
    if (window.confirm('Are you sure you want to proceed with the removal? Any group associations will be disconnected as well.')) {
      try {
        await axios.delete(`/api/classroom/${id}/students/${studentId}`);
        toast.success('Student removed successfully!');
        await Promise.all([
          fetchStudents(),
          fetchGroupSets()
        ]);
      } catch (err) {
        console.error('Failed to remove student', err);
        toast.error('Failed to remove student');
      }
    }
  };

  const handleDeleteGroupSetConfirm = async (groupSet) => {
    if (window.confirm(`You're about to delete this GroupSet "${groupSet.name}". All student enrollment in any groups within this GroupSet will be purged alongside the groups themselves. Are you sure you want to proceed?`)) {
      try {
        await axios.delete(`/api/group/groupset/${groupSet._id}`);
        toast.success('GroupSet deleted successfully!');
        fetchGroupSets();
      } catch (err) {
        console.error('Failed to delete group set', err);
        toast.error('Failed to delete group set');
      }
    }
  };

  const handleDeleteGroupConfirm = async (groupSetId, group) => {
    if (window.confirm(`You're about to delete this group "${group.name}". Any students enrolled in the group will be removed. Are you sure you want to proceed?`)) {
      try {
        await axios.delete(`/api/group/groupset/${groupSetId}/group/${group._id}`);
        toast.success('Group deleted successfully!');
        fetchGroupSets();
      } catch (err) {
        console.error('Failed to delete group', err);
        toast.error('Failed to delete group');
      }
    }
  };

  // Add these handler functions
  const handleApproveMembers = async (groupSetId, groupId) => {
    const groupSelectedMembers = selectedMembers[groupId] || [];
    if (groupSelectedMembers.length === 0) {
      toast.error('No selection with pending status made to perform this action.');
      return;
    }

    try {
      const response = await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/approve`, {
        memberIds: groupSelectedMembers
      });
      alert(response.data.message);
      setSelectedMembers((prevSelected) => ({ ...prevSelected, [groupId]: [] }));
      fetchGroupSets();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.message) {
        alert(err.response.data.message);
      } else {
        console.error('Failed to approve members', err);
        toast.error('Failed to approve members');
      }
    }
  };

  const handleRejectMembers = async (groupSetId, groupId) => {
    const groupSelectedMembers = selectedMembers[groupId] || [];
    if (groupSelectedMembers.length === 0) {
      toast.error('No selection with pending status made to perform this action.');
      return;
    }

    try {
      const response = await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/reject`, {
        memberIds: groupSelectedMembers
      });
      alert(response.data.message);
      setSelectedMembers((prevSelected) => ({ ...prevSelected, [groupId]: [] }));
      fetchGroupSets();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.message) {
        alert(err.response.data.message);
      } else {
        console.error('Failed to reject members', err);
        toast.error('Failed to reject members');
      }
    }
  };

  const getFilteredAndSortedMembers = (group) => {
    const filter = memberFilters[group._id] || 'all';
    const sort = memberSorts[group._id] || 'email';
    const search = memberSearches[group._id] || '';

    return group.members
      .filter(member => {
        if (filter === 'all') return true;
        return member.status === filter;
      })
      .filter(member =>
        // Add null checks
        member?._id?.email?.toLowerCase().includes(search.toLowerCase()) ?? false
      )
      .sort((a, b) => {
        switch (sort) {
          case 'email':
            // Add null checks
            return (a?._id?.email ?? '').localeCompare(b?._id?.email ?? '');
          case 'status':
            return (a.status || 'approved').localeCompare(b.status || 'approved');
          case 'date':
            return new Date(b.joinDate) - new Date(a.joinDate);
          default:
            return 0;
        }
      });
  };

  const handleFilterChange = (groupId, value) => {
    setMemberFilters(prev => ({
      ...prev,
      [groupId]: value
    }));
  };

  const handleSortChange = (groupId, value) => {
    setMemberSorts(prev => ({
      ...prev,
      [groupId]: value
    }));
  };

  const handleSearchChange = (groupId, value) => {
    setMemberSearches(prev => ({
      ...prev,
      [groupId]: value
    }));
  };

  // Add loading check at the start of render
  if (loading || !user) {
    return (
      <div className='min-h-screen bg-base-200 flex items-center justify-center'>
        <LoaderIcon className='animate-spin, size-10' />
      </div>
    );
  };

  if (!user) {
    return <div>Please log in to view this classroom.</div>;
  }

  if (loading) {
    return <div>Loading classroom details...</div>;
  }

  if (!classroom) {
    return (
      <div className='min-h-screen bg-base-200 flex items-center justify-center'>
        <LoaderIcon className='animate-spin, size-10' />
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <Link to="/classrooms" className="link text-accent">
        ← Back to Classroom Dashboard
      </Link>

      <nav className="flex space-x-4 mb-4">
        <Link to={`/classroom/${id}/news`}>News</Link>
        {user.role === 'teacher' && (
          <Link to={`/classroom/${id}/teacher-news`}>Manage News</Link>
        )}
      </nav>

      <h1 className="text-3xl font-bold">{classroom.name}</h1>
      <p className="text-sm text-gray-500">Class Code: {classroom.code}</p>

      {(user.role === 'teacher' || user.role === 'admin') && (
        <div className="space-y-4">
          {editingClassroom ? (
            <div className="card bg-base-100 shadow-md p-4">
              <h4 className="text-lg font-semibold">Update Classroom</h4>
              <input
                className="input input-bordered w-full mt-2"
                type="text"
                placeholder="New Classroom Name"
                value={updateClassroomName}
                onChange={(e) => setUpdateClassroomName(e.target.value)}
              />
              <input
                className="input input-bordered w-full mt-2"
                type="text"
                placeholder="New Image URL"
                value={updateClassroomImage}
                onChange={(e) => setUpdateClassroomImage(e.target.value)}
              />
              <div className="mt-4 flex gap-2">
                <button className="btn btn-primary" onClick={handleUpdateClassroom}>Update</button>
                <button className="btn btn-ghost" onClick={handleCancelUpdate}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="btn btn-outline btn-info" onClick={() => setEditingClassroom(true)}>Edit Classroom</button>
          )}

          <div className="flex gap-2">
            <button className="btn btn-warning" onClick={handleLeaveClassroomConfirm}>Leave Classroom</button>
            {user.role === 'teacher' && (
              <button className="btn btn-error" onClick={handleDeleteClassroomConfirm}>Delete Classroom</button>
            )}
          </div>

          <div className="card bg-base-200 p-4">
            <h3 className="text-xl font-semibold">Students</h3>
            <ul className="mt-2 space-y-2">
              {students.map((student) => (
                <li key={student._id} className="flex items-center justify-between">
                  <span>{student.email}</span>
                  <button className="btn btn-xs btn-error" onClick={() => handleRemoveStudentConfirm(student._id)}>Remove</button>
                </li>
              ))}
            </ul>
          </div>

          {/* Group Sets */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold">Group Sets</h3>
            <ul className="space-y-6">
              {groupSets.map((groupSet) => (
                <li key={groupSet._id} className="card bg-base-100 shadow p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-lg font-semibold">{groupSet.name}</h4>
                      <p>Self Signup: {groupSet.selfSignup ? 'Yes' : 'No'}</p>
                      <p>Join Approval: {groupSet.joinApproval ? 'Yes' : 'No'}</p>
                      <p>Max Members: {groupSet.maxMembers || 'No limit'}</p>
                    </div>
                    <img src={groupSet.image} alt={groupSet.name} className="w-16 h-16 object-cover rounded" />
                  </div>

                  <div className="flex gap-2">
                    <button className="btn btn-sm btn-accent" onClick={() => handleEditGroupSet(groupSet)}>Edit</button>
                    <button className="btn btn-sm btn-error" onClick={() => handleDeleteGroupSetConfirm(groupSet)}>Delete</button>
                  </div>

                  {/* Create Group */}
                  <div>
                    <h4 className="font-semibold">Create Group</h4>
                    <input
                      className="input input-bordered w-full mt-1"
                      type="text"
                      placeholder="Group Name"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                    />
                    <input
                      className="input input-bordered w-full mt-2"
                      type="number"
                      placeholder="Number of Groups"
                      value={groupCount}
                      onChange={(e) => setGroupCount(Math.max(1, e.target.value))}
                    />
                    <button className="btn btn-primary mt-2" onClick={() => handleCreateGroup(groupSet._id)}>Create</button>
                  </div>

                  {/* Groups Table */}
                  <div>
                    <h4 className="font-semibold">Groups</h4>
                    <div className="space-y-4">
                      {groupSet.groups.map((group) => (
                        <div key={group._id} className="border rounded p-4 bg-base-100">
                          <div className="flex justify-between items-center">
                            <div>
                              <h5 className="font-semibold">{group.name}</h5>
                              <p>Members: {group.members.length}/{group.maxMembers || 'No limit'}</p>
                            </div>
                            <div className="flex gap-1">
                              <button className="btn btn-xs btn-success" onClick={() => handleJoinGroup(groupSet._id, group._id)}>Join</button>
                              <button className="btn btn-xs btn-outline" onClick={() => handleLeaveGroup(groupSet._id, group._id)}>Leave</button>
                              <button className="btn btn-xs btn-info" onClick={() => handleEditGroup(group)}>Edit</button>
                              <button className="btn btn-xs btn-error" onClick={() => handleDeleteGroupConfirm(groupSet._id, group)}>Delete</button>
                            </div>
                          </div>

                          {/* Edit group (if selected) */}
                          {editingGroup && editingGroup._id === group._id && (
                            <div className="mt-3 space-y-2">
                              <h4 className="text-sm font-bold">Update Group</h4>
                              <input
                                className="input input-bordered w-full"
                                type="text"
                                placeholder="Group Name"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                              />
                              <input
                                className="input input-bordered w-full"
                                type="text"
                                placeholder="Image URL"
                                value={groupImage}
                                onChange={(e) => setGroupImage(e.target.value)}
                              />
                              <input
                                className="input input-bordered w-full"
                                type="number"
                                placeholder="Max Members"
                                value={groupMaxMembers}
                                onChange={(e) => setGroupMaxMembers(Math.max(0, e.target.value))}
                              />
                              <div className="flex gap-2 mt-2">
                                <button className="btn btn-primary" onClick={() => handleUpdateGroup(groupSet._id, group._id)}>Update</button>
                                <button className="btn btn-ghost" onClick={handleCancelUpdate}>Cancel</button>
                              </div>
                            </div>
                          )}

                          {/* Members Table */}
                          <div className="mt-4">
                            <h5 className="text-sm font-semibold mb-2">Members</h5>
                            <div className="flex gap-2 mb-2">
                              <input
                                type="text"
                                placeholder="Search..."
                                value={memberSearches[group._id] || ''}
                                onChange={(e) => handleSearchChange(group._id, e.target.value)}
                                className="input input-bordered input-sm w-full"
                              />
                              <select
                                value={memberFilters[group._id] || 'all'}
                                onChange={(e) => handleFilterChange(group._id, e.target.value)}
                                className="select select-bordered select-sm"
                              >
                                <option value="all">All</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                              </select>
                              <select
                                value={memberSorts[group._id] || 'email'}
                                onChange={(e) => handleSortChange(group._id, e.target.value)}
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
                                    <th>
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
                            <div className="mt-2 flex gap-2">
                              <button className="btn btn-xs btn-success" disabled={!selectedMembers[group._id]?.length} onClick={() => handleApproveMembers(groupSet._id, group._id)}>Approve</button>
                              <button className="btn btn-xs btn-error" disabled={!selectedMembers[group._id]?.length} onClick={() => handleRejectMembers(groupSet._id, group._id)}>Reject</button>
                              <button className="btn btn-xs btn-warning" disabled={!selectedMembers[group._id]?.length} onClick={() => handleSuspendMembers(groupSet._id, group._id)}>Suspend</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Create/Update Group Set */}
            <div className="card bg-base-200 p-4 space-y-2">
              <h4 className="font-semibold">{editingGroupSet ? 'Update GroupSet' : 'Create GroupSet'}</h4>
              <input
                className="input input-bordered w-full"
                type="text"
                placeholder="GroupSet Name"
                value={groupSetName}
                onChange={(e) => setGroupSetName(e.target.value)}
              />
              <label className="label cursor-pointer">
                <span className="label-text">Allow Self-Signup</span>
                <input type="checkbox" className="toggle" checked={groupSetSelfSignup} onChange={(e) => setGroupSetSelfSignup(e.target.checked)} />
              </label>
              <label className="label cursor-pointer">
                <span className="label-text">Require Join Approval</span>
                <input type="checkbox" className="toggle" checked={groupSetJoinApproval} onChange={(e) => setGroupSetJoinApproval(e.target.checked)} />
              </label>
              <input
                className="input input-bordered w-full"
                type="number"
                placeholder="Max Members"
                value={groupSetMaxMembers}
                onChange={(e) => setGroupSetMaxMembers(Math.max(0, e.target.value))}
              />
              <input
                className="input input-bordered w-full"
                type="text"
                placeholder="Image URL"
                value={groupSetImage}
                onChange={(e) => setGroupSetImage(e.target.value)}
              />
              <div className="flex gap-2">
                <button className="btn btn-primary" onClick={editingGroupSet ? handleUpdateGroupSet : handleCreateGroupSet}>
                  {editingGroupSet ? 'Update' : 'Create'}
                </button>
                {editingGroupSet && <button className="btn btn-ghost" onClick={handleCancelUpdate}>Cancel</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {user.role === 'student' && (
        <div className="space-y-6">
          <button className="btn btn-warning" onClick={handleLeaveClassroomConfirm}>Leave Classroom</button>

          {/* Group Sets for Students */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold">Group Sets</h3>
            <ul className="space-y-6">
              {groupSets.map((groupSet) => (
                <li key={groupSet._id} className="card bg-base-100 shadow p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-lg font-semibold">{groupSet.name}</h4>
                      <p>Self Signup: {groupSet.selfSignup ? 'Yes' : 'No'}</p>
                      <p>Join Approval: {groupSet.joinApproval ? 'Yes' : 'No'}</p>
                      <p>Max Members: {groupSet.maxMembers || 'No limit'}</p>
                    </div>
                    <img src={groupSet.image} alt={groupSet.name} className="w-16 h-16 object-cover rounded" />
                  </div>

                  {/* Groups List */}
                  <div>
                    <h4 className="font-semibold mb-2">Groups</h4>
                    <div className="space-y-4">
                      {groupSet.groups.map((group) => {
                        // Check if current user is in this group
                        const isMember = group.members.some(member =>
                          member._id._id === user._id && member.status === 'approved'
                        );
                        const isPending = group.members.some(member =>
                          member._id._id === user._id && member.status === 'pending'
                        );

                        return (
                          <div key={group._id} className="border rounded p-4 bg-base-100">
                            <div className="flex justify-between items-center">
                              <div>
                                <h5 className="font-semibold">{group.name}</h5>
                                <p>Members: {group.members.length}/{group.maxMembers || 'No limit'}</p>
                              </div>
                              <div className="flex gap-1">
                                {!isMember && !isPending && (
                                  <button
                                    className="btn btn-xs btn-success"
                                    onClick={() => handleJoinGroup(groupSet._id, group._id)}
                                  >
                                    Join
                                  </button>
                                )}
                                {isPending && (
                                  <span className="badge badge-warning">Pending Approval</span>
                                )}
                                {(isMember || isPending) && (
                                  <button
                                    className="btn btn-xs btn-error"
                                    onClick={() => handleLeaveGroup(groupSet._id, group._id)}
                                  >
                                    Leave
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Members List */}
                            <div className="mt-4">
                              <h5 className="text-sm font-semibold mb-2">Members</h5>
                              <div className="flex gap-2 mb-2">
                                <input
                                  type="text"
                                  placeholder="Search members..."
                                  value={memberSearches[group._id] || ''}
                                  onChange={(e) => handleSearchChange(group._id, e.target.value)}
                                  className="input input-bordered input-sm w-full"
                                />
                                <select
                                  value={memberFilters[group._id] || 'all'}
                                  onChange={(e) => handleFilterChange(group._id, e.target.value)}
                                  className="select select-bordered select-sm"
                                >
                                  <option value="all">All</option>
                                  <option value="approved">Approved</option>
                                </select>
                                <select
                                  value={memberSorts[group._id] || 'email'}
                                  onChange={(e) => handleSortChange(group._id, e.target.value)}
                                  className="select select-bordered select-sm"
                                >
                                  <option value="email">Email</option>
                                  <option value="date">Join Date</option>
                                </select>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="table table-zebra table-sm">
                                  <thead>
                                    <tr>
                                      <th>Email</th>
                                      <th>Status</th>
                                      <th>Join Date</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {getFilteredAndSortedMembers(group)
                                      .filter(member => member.status === 'approved') // Students only see approved members
                                      .map((member, idx) => (
                                        <tr key={`${group._id}-${member._id._id}-${idx}`}>
                                          <td>
                                            {member._id.email}
                                            {member._id._id === user._id && (
                                              <span className="badge badge-info ml-2">You</span>
                                            )}
                                          </td>
                                          <td>
                                            <span className="badge badge-success">
                                              {member.status || 'approved'}
                                            </span>
                                          </td>
                                          <td>{new Date(member.joinDate).toLocaleString()}</td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )

};

export default Classroom;