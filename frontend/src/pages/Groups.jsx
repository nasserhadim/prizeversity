import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import socket from '../utils/socket';
import toast from 'react-hot-toast';
import SiphonModal from '../components/SiphonModal';
import GroupMultiplierControl from '../components/GroupMultiplierControl';
import { Lock } from 'lucide-react';
import Footer from '../components/Footer';
import { API_BASE } from '../config/api'; // add
import { resolveImageSrc, resolveGroupSetSrc, isPlaceholderGroupSetImage } from '../utils/image'; // OR import the helper

function getMemberId(member) {
  if (!member) return null;
  // member may be { _id: ObjectId | populatedDoc } or may already be the id value
  const idField = member._id ?? member;
  if (!idField) return null;
  if (typeof idField === 'string') return idField;
  if (typeof idField === 'object') {
    if (idField._id) return String(idField._id);
    // Some Mongoose objects stringify sensibly
    if (typeof idField.toString === 'function') return String(idField.toString());
  }
  return null;
}

const Groups = () => {
  const { id } = useParams(); // This is the classroomId
  const navigate = useNavigate();
  const { user } = useAuth();
  const [groupSets, setGroupSets] = useState([]);
  const [classroom, setClassroom] = useState(null);
  const [allStudents, setAllStudents] = useState([]); // Add state for all students
  const [addMemberModal, setAddMemberModal] = useState(null); // { groupId, groupSetId }
  const [selectedStudent, setSelectedStudent] = useState(''); // student id for the add dropdown
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'create'
  const [loading, setLoading] = useState(true);
  const [groupSetName, setGroupSetName] = useState('');
  const [groupSetSelfSignup, setGroupSetSelfSignup] = useState(false);
  const [groupSetJoinApproval, setGroupSetJoinApproval] = useState(false);
  const [groupSetMaxMembers, setGroupSetMaxMembers] = useState('');
  const [groupSetImage, setGroupSetImage] = useState('');
  const [groupSetImageFile, setGroupSetImageFile] = useState(null); // ADD (already present)
  const [groupSetImageSource, setGroupSetImageSource] = useState('url'); // ADD (already present)
  const [groupSetImageUrl, setGroupSetImageUrl] = useState(''); // ADD (already present)
  const [groupSetImageRemoved, setGroupSetImageRemoved] = useState(false); // ADD
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
  const [adjustApplyGroupMultipliers, setAdjustApplyGroupMultipliers] = useState(true); // Separate group multipliers
  const [adjustApplyPersonalMultipliers, setAdjustApplyPersonalMultipliers] = useState(true); // Separate personal multipliers
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(null);
  const [confirmDeleteGroupSet, setConfirmDeleteGroupSet] = useState(null);
  const [confirmLeaveGroup, setConfirmLeaveGroup] = useState(null);
  const [editGroupModal, setEditGroupModal] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMaxMembers, setNewGroupMaxMembers] = useState('');
  const [selectedGroups, setSelectedGroups] = useState({});
  const [confirmBulkDeleteGroups, setConfirmBulkDeleteGroups] = useState(null);
  const [showEditGroupSetModal, setShowEditGroupSetModal] = useState(false); // NEW
  const [confirmDeleteAllGroupSets, setConfirmDeleteAllGroupSets] = useState(null); // modal payload
  const groupSetFileInputRef = useRef(null); // ADD: clear native file input after submit
  const [selectedGroupSets, setSelectedGroupSets] = useState([]); // track selected GroupSet ids
  const [groupSetMultiplierIncrement, setGroupSetMultiplierIncrement] = useState(0); // Default to 0
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000); // update every second for countdown
    return () => clearInterval(t);
  }, []);

  // Helper: format milliseconds into compact countdown (e.g. "1d 2h 3m 4s")
  function formatMs(ms) {
    if (ms == null) return '';
    if (ms <= 0) return '0s';
    const sec = Math.floor(ms / 1000) % 60;
    const min = Math.floor(ms / (1000 * 60)) % 60;
    const hrs = Math.floor(ms / (1000 * 60 * 60)) % 24;
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hrs) parts.push(`${hrs}h`);
    if (min) parts.push(`${min}m`);
    parts.push(`${sec}s`);
    return parts.join(' ');
  }

  // helper to toggle selection for a single GroupSet id
  const toggleGroupSetSelection = (groupSetId) => {
    setSelectedGroupSets(prev =>
      prev.includes(groupSetId) ? prev.filter(id => id !== groupSetId) : [...prev, groupSetId]
    );
  };

  // optional helper to select/deselect all (call where needed)
  // Toggle select/deselect all GroupSets (uses current groupSets)
  const handleSelectAllGroupSets = () => {
    if (!groupSets || groupSets.length === 0) {
      setSelectedGroupSets([]);
      return;
    }
    if (selectedGroupSets.length === groupSets.length) {
      setSelectedGroupSets([]);
    } else {
      setSelectedGroupSets(groupSets.map(gs => gs._id));
    }
  };

  // Open confirm modal for currently selected GroupSets
  const openConfirmDeleteSelectedGroupSets = () => {
    if (!selectedGroupSets || selectedGroupSets.length === 0) {
      return toast.error('No GroupSets selected');
    }
    const names = (groupSets || [])
      .filter(gs => selectedGroupSets.includes(gs._id))
      .map(gs => gs.name);
    setConfirmDeleteAllGroupSets({ ids: [...selectedGroupSets], names });
  };

  // Execute bulk delete of GroupSets (called from confirm modal)
  const handleDeleteAllGroupSets = async () => {
    if (!confirmDeleteAllGroupSets) return;
    try {
      await axios.delete(`/api/group/classroom/${id}/groupsets/bulk`, {
        data: { groupSetIds: confirmDeleteAllGroupSets.ids.map(String) }
      });
      toast.success(`${confirmDeleteAllGroupSets.ids.length} GroupSet(s) deleted`);
      setConfirmDeleteAllGroupSets(null);
      setSelectedGroupSets([]);
      fetchGroupSets();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete GroupSets');
    }
  };

  // Fetch classroom details
  const fetchClassroom = async () => {
    try {
      const res = await axios.get(`/api/classroom/${id}`);
      setClassroom(res.data);
    } catch {
      toast.error('Failed to fetch classroom details');
    }
  };

  const fetchAllStudents = async () => {
    try {
      const res = await axios.get(`/api/classroom/${id}/students`);
      setAllStudents(res.data);
    } catch {
      toast.error('Failed to fetch students for classroom');
    }
  };

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
    fetchClassroom();
    fetchAllStudents(); // Fetch students on load
    fetchGroupSets();
    socket.emit('join', `classroom-${id}`);

    // Add classroom removal handler
    const handleClassroomRemoval = (data) => {
      if (String(data.classroomId) === String(id)) {
        toast.error(data.message || 'You have been removed from this classroom');
        setTimeout(() => {
          navigate('/classrooms');
        }, 2000);
      }
    };

    socket.on('classroom_removal', handleClassroomRemoval);
    socket.on('group_update', fetchGroupSets);
    socket.on('groupset_update', fetchGroupSets);
    socket.on('siphon_create', fetchGroupSets);
    socket.on('siphon_vote', fetchGroupSets);
    socket.on('siphon_update', fetchGroupSets);
    
    socket.on('user_deleted', (data) => {
      if (data.classroomId === id) {
        console.log('User deleted, refreshing groups...');
        fetchGroupSets();
      }
    });

    return () => {
      socket.off('group_update', fetchGroupSets);
      socket.off('groupset_update', fetchGroupSets);
      socket.off('siphon_create', fetchGroupSets);
      socket.off('siphon_vote', fetchGroupSets);
      socket.off('siphon_update', fetchGroupSets);
      socket.off('user_deleted');
      socket.off('classroom_removal', handleClassroomRemoval); // Add cleanup
    };
  }, [id, navigate]); // Add navigate to dependencies

  // GroupSet creation/update/reset
  const handleCreateGroupSet = async () => {
    if (!groupSetName.trim()) return toast.error('GroupSet name is required');
    if (groupSetMaxMembers < 0) return toast.error('Max members cannot be negative');
    try {
      if (groupSetImageSource === 'file' && groupSetImageFile) {
        const fd = new FormData();
        fd.append('name', groupSetName);
        fd.append('classroomId', id);
        fd.append('selfSignup', groupSetSelfSignup);
        fd.append('joinApproval', groupSetJoinApproval);
        fd.append('maxMembers', Math.max(0, groupSetMaxMembers || 0));
        fd.append('groupMultiplierIncrement', groupSetMultiplierIncrement); // Add this line
        fd.append('image', groupSetImageFile);
        await axios.post('/api/group/groupset/create', fd, { headers: { 'Content-Type': 'multipart/form-data' }});
      } else {
        await axios.post('/api/group/groupset/create', {
          name: groupSetName,
          classroomId: id,
          selfSignup: groupSetSelfSignup,
          joinApproval: groupSetJoinApproval,
          maxMembers: Math.max(0, groupSetMaxMembers || 0),
          groupMultiplierIncrement: groupSetMultiplierIncrement, // Add this line
          image: groupSetImageSource === 'url' ? groupSetImageUrl : undefined,
        });
      }
      toast.success('GroupSet created successfully');
      resetGroupSetForm();
      fetchGroupSets();
    } catch (err) {
      const msg = err.response?.data?.error;
      if (msg === 'A GroupSet with this name already exists in this classroom') {
        toast.error('GroupSet name already exists, choose a new one');
      } else {
        toast.error('Failed to create group set');
      }
    }
  };

  // It will reset the GroupSet Form
  const resetGroupSetForm = () => {
    setEditingGroupSetId(null);
    setGroupSetName('');
    setGroupSetSelfSignup(false);
    setGroupSetJoinApproval(false);
    setGroupSetMaxMembers('');
    setGroupSetMultiplierIncrement(0); // Reset to 0, not 0.1
    setGroupSetImage('');
    setGroupSetImageFile(null); // ADD
    setGroupSetImageSource('url'); // ADD
    setGroupSetImageUrl(''); // ADD
    if (groupSetFileInputRef.current) groupSetFileInputRef.current.value = ''; // clear native file input on reset
  };

  // iT will edit the Group set
  const handleEditGroupSet = (gs) => {
    setEditingGroupSetId(gs._id);
    setGroupSetName(gs.name);
    setGroupSetSelfSignup(gs.selfSignup);
    setGroupSetJoinApproval(gs.joinApproval);
    setGroupSetMaxMembers(gs.maxMembers);
    setGroupSetMultiplierIncrement(gs.groupMultiplierIncrement || 0); // Default to 0 if undefined
    setGroupSetImage(gs.image);
    setGroupSetImageFile(null);
    setGroupSetImageSource('url');
    setGroupSetImageUrl('');
    // Open the centered edit modal so user doesn't need to scroll up
    setShowEditGroupSetModal(true);
  };

  // Update GroupSet (modified to handle file uploads + remove flag)
  const handleUpdateGroupSet = async () => {
    if (!groupSetName.trim()) return toast.error('GroupSet name is required');
    if (groupSetMaxMembers < 0) return toast.error('Max members cannot be negative');

    try {
      // If a new file was chosen, send multipart/form-data with the file
      if (groupSetImageSource === 'file' && groupSetImageFile) {
        const fd = new FormData();
        fd.append('name', groupSetName);
        fd.append('selfSignup', groupSetSelfSignup);
        fd.append('joinApproval', groupSetJoinApproval);
        fd.append('maxMembers', Math.max(0, groupSetMaxMembers || 0));
        fd.append('groupMultiplierIncrement', groupSetMultiplierIncrement); // Add this line
        fd.append('image', groupSetImageFile);
        await axios.put(`/api/group/groupset/${editingGroupSetId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' }});
      } else {
        await axios.put(`/api/group/groupset/${editingGroupSetId}`, {
          name: groupSetName,
          selfSignup: groupSetSelfSignup,
          joinApproval: groupSetJoinApproval,
          maxMembers: Math.max(0, groupSetMaxMembers || 0),
          groupMultiplierIncrement: groupSetMultiplierIncrement, // Add this line
          image: groupSetImageRemoved ? 'placeholder.jpg' : (groupSetImageSource === 'url' ? groupSetImageUrl : undefined),
        });
      }

      toast.success('GroupSet updated successfully');
      // reset remove flag after successful update
      setGroupSetImageRemoved(false);
      resetGroupSetForm();
      fetchGroupSets();
    } catch (err) {
      if (err.response?.data?.message === 'No changes were made') {
        toast.error('No changes were made');
      } else {
        toast.error('Failed to update group set');
      }
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
  const openEditGroupModal = (groupSetId, groupId, currentName, currentMaxMembers) => {
    setEditGroupModal({ groupSetId, groupId });
    setNewGroupName(currentName);
    setNewGroupMaxMembers(currentMaxMembers || '');
  };

  // Making sure that the group name cannot be empty and makes a PUT api call to update the new changes for the group
  const handleEditGroup = async () => {
    if (!editGroupModal || !newGroupName.trim()) {
      return toast.error('Group name cannot be empty');
    }

    // Find the current group to compare values
    const currentGroup = groupSets
      .find(gs => gs._id === editGroupModal.groupSetId)
      ?.groups.find(g => g._id === editGroupModal.groupId);
    
    if (!currentGroup) {
      return toast.error('Group not found');
    }

    // Check if any changes were actually made
    const nameChanged = currentGroup.name !== newGroupName.trim();
    const maxMembersChanged = (currentGroup.maxMembers || '') !== (newGroupMaxMembers || '');
    
    if (!nameChanged && !maxMembersChanged) {
      toast.error('No changes were made');
      setEditGroupModal(null);
      return;
    }

    try {
      const { groupSetId, groupId } = editGroupModal;
      
      await axios.put(`/api/group/groupset/${groupSetId}/group/${groupId}`, {
        name: newGroupName.trim(),
        maxMembers: newGroupMaxMembers
      });
      
      toast.success('Group updated');
      setEditGroupModal(null);
      fetchGroupSets();
    } catch (err) {
      // Check if it's the "no changes" message from backend
      if (err.response?.status === 400 && err.response?.data?.message === 'No changes were made') {
        toast.error('No changes were made');
      } else {
        toast.error('Failed to update group');
      }
      setEditGroupModal(null);
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
    if (!groupSet) return;

    // Check if student already has an APPROVED membership in this GroupSet
    const alreadyApprovedInGroupSet = groupSet.groups.some(group =>
      group.members.some(m => m._id && m._id._id === user._id && m.status === 'approved')
    );

    if (user.role === 'student' && alreadyApprovedInGroupSet) {
      toast.error('You are already approved in a group within this GroupSet');
      return;
    }

    // Check if student already has a PENDING request in this GroupSet
    const hasPendingInGroupSet = groupSet.groups.some(group =>
      group.members.some(m => m._id && m._id._id === user._id && m.status === 'pending')
    );

    if (user.role === 'student' && hasPendingInGroupSet) {
      const pendingGroup = groupSet.groups.find(group =>
        group.members.some(m => m._id && m._id._id === user._id && m.status === 'pending')
      );
      toast.error(`You already have a pending request in "${pendingGroup.name}". Cancel that request first.`);
      return;
    }

    try {
      await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/join`);
      
      const groupSet = groupSets.find(gs => gs._id === groupSetId);
      if (groupSet?.joinApproval) {
        toast.success('Join request sent');
      } else {
        toast.success('Joined group');
      }

      fetchGroupSets();
    } catch (err) {
      // Display the specific error message from the backend
      const errorMessage = err.response?.data?.error || 'Failed to join group';
      toast.error(errorMessage);
    }
  };

  // Handles adding a student to a group by a teacher/admin
  const handleAddMember = async () => {
    if (!addMemberModal || !selectedStudent) {
      return toast.error('Please select a student to add.');
    }
    const { groupSetId, groupId } = addMemberModal;
    try {
      await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/add-members`, {
        memberIds: [selectedStudent]
      });
      toast.success('Student added successfully.');
      fetchGroupSets();
      setAddMemberModal(null);
      setSelectedStudent('');
      setAddMemberSearch('');
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to add student.';
      toast.error(errorMessage);
    }
  };

  // Handles a student leaving a group
  const handleLeaveGroup = async (groupSetIdParam, groupIdParam) => {
    // Accept optional parameters (from direct button click) or fall back to confirm modal state
    const groupSetId = groupSetIdParam || confirmLeaveGroup?.groupSetId;
    const groupId = groupIdParam || confirmLeaveGroup?.groupId;
    if (!groupSetId || !groupId) {
      return; // nothing to do
    }

    try {
      await axios.post(`/api/group/groupset/${groupSetId}/group/${groupId}/leave`);
      toast.success('Left group');
      setConfirmLeaveGroup(null);
      fetchGroupSets();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to leave group');
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
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to approve members';
      toast.error(errorMessage);
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
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to reject members';
      toast.error(errorMessage);
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
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to suspend members';
      toast.error(errorMessage);
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
    const group = groupSets.find(gs => gs._id === groupSetId)?.groups.find(g => g._id === groupId);
    if (!group) return;

    const selectedIds = selectedMembers[groupId] || [];
    const approvedMemberIds = selectedIds.filter(id => {
      const member = group.members.find(m => getMemberId(m) === String(id));
      return member && member.status === 'approved';
    });

    if (approvedMemberIds.length === 0) {
      toast.error('Please select at least one approved member to adjust balances.');
      return;
    }
    setAdjustModal({ groupSetId, groupId, memberIds: approvedMemberIds });
    setAdjustAmount('');
    setAdjustDesc('');
  };

  // Submit the balance adjustment to backend API
  const submitAdjust = async () => {
    try {
      const { groupSetId, groupId, memberIds } = adjustModal;
      const amt = Number(adjustAmount);
      const res = await axios.post(
        `/api/groupset/${groupSetId}/group/${groupId}/adjust-balance`, // Remove 'group-balance' prefix
        { 
          amount: amt, 
          description: adjustDesc,
          applyGroupMultipliers: adjustApplyGroupMultipliers,
          applyPersonalMultipliers: adjustApplyPersonalMultipliers,
          memberIds,
        }
      );

      if (res.status === 202) {
        toast.success('Request sent for teacher approval.');
      } else {
        toast.success(`Selected members (excluding pending/banned members (if any)) ${amt >= 0 ? 'credited' : 'debited'} ${Math.abs(amt)} ₿`);
      }
      fetchGroupSets();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Adjust failed');
    } finally {
      setAdjustModal(null);
    }
  };

  const handleBulkAdjust = async () => {
    if (!adjustModal) return;
    const { groupSetId, groupId, amount: amt } = adjustModal;
    
    // Get selected member IDs for this group (only approved members)
    const selectedMemberIds = selectedMembers[groupId] || [];
    const approvedSelectedIds = selectedMemberIds.filter(memberId => {
      const group = groupSets
        .find(gs => gs._id === groupSetId)
        ?.groups.find(g => g._id === groupId);
      const member = group?.members.find(m => m._id._id === memberId);
      return member?.status === 'approved';
    });
    
    if (approvedSelectedIds.length === 0) {
      toast.error('Please select approved members to transfer bits to');
      return;
    }

    try {
      await axios.post(
        `/api/group-balance/groupset/${groupSetId}/group/${groupId}/adjust`,
        {
          amount: amt,
          description: adjustDescription,
          selectedMemberIds: approvedSelectedIds, // Add this
          applyGroupMultipliers: adjustApplyGroupMultipliers,
          applyPersonalMultipliers: adjustApplyPersonalMultipliers
        }
      );
      toast.success(`Selected students ${amt >= 0 ? 'credited' : 'debited'} ${Math.abs(amt)} ₿`);
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
      .filter(m => {
        // Skip members with null or undefined user data (deleted accounts)
        if (!m._id) return false;
        
        return filter === 'all' || m.status === filter;
      })
      .filter(m => {
        // Skip null members in search as well
        if (!m._id) return false;
        
        const email = m._id.email?.toLowerCase() || '';
        const firstName = m._id.firstName || '';
        const lastName = m._id.lastName || '';
        const fullName = `${firstName} ${lastName}`.toLowerCase();
        
        return email.includes(search.toLowerCase()) || fullName.includes(search.toLowerCase());
      })
      .sort((a, b) => {
        // Handle null members in sorting
        if (!a._id || !b._id) return 0;
        
        if (sort === 'email') {
          const nameA = `${a._id.firstName || ''} ${a._id.lastName || ''}`.trim() || a._id.email || '';
          const nameB = `${b._id.firstName || ''} ${b._id.lastName || ''}`.trim() || b._id.email || '';
          return nameA.localeCompare(nameB);
        }
        if (sort === 'status') return (a.status || '').localeCompare(b.status || '');
        if (sort === 'date') return new Date(b.joinDate) - new Date(a.joinDate);
        return 0;
      });
  };

  // Toggle select all members in a group
  const handleSelectAllMembers = (groupId, group) => {
    const allSelected = (selectedMembers[groupId] || []).length === group.members.length;
    const newSelected = allSelected ? [] : group.members.map(m => getMemberId(m)).filter(Boolean);
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
 
  // Select/Deselect all groups in a GroupSet
  const handleSelectAllGroups = (groupSetId, groups) => {
    setSelectedGroups(prev => {
      const currentSelected = prev[groupSetId] || [];
      const allSelected = currentSelected.length === groups.length;
      
      if (allSelected) {
        // Deselect all groups
        return { ...prev, [groupSetId]: [] };
      } else {
        // Select all groups
        return { ...prev, [groupSetId]: groups.map(g => g._id) };
      }
    });
  };

  // Select/Deselect a single group in a GroupSet
  const handleSelectGroup = (groupSetId, groupId) => {
    setSelectedGroups(prev => {
      const currentSelected = prev[groupSetId] || [];
      const isSelected = currentSelected.includes(groupId);
      
      if (isSelected) {
        // Remove from selection
        return { 
          ...prev, 
          [groupSetId]: currentSelected.filter(id => id !== groupId) 
        };
      } else {
        // Add to selection
        return { 
          ...prev, 
          [groupSetId]: [...currentSelected, groupId] 
        };
      }
    });
  };

  const handleBulkDeleteGroups = async () => {
    if (!confirmBulkDeleteGroups) return;

    try {
      const { groupSetId, groupIds } = confirmBulkDeleteGroups;
      
      await axios.delete(`/api/group/groupset/${groupSetId}/groups/bulk`, {
        data: { groupIds }
      });
      
      toast.success(`${groupIds.length} group(s) deleted successfully`);
      setConfirmBulkDeleteGroups(null);
      setSelectedGroups(prev => ({ ...prev, [groupSetId]: [] }));
      fetchGroupSets();
    } catch (err) {
      toast.error('Failed to delete groups');
    }
  };

  // Helper: is user banned in this classroom
  const isBannedInClassroom = (userId) => {
    if (!classroom) return false;
    const bannedStudents = Array.isArray(classroom?.bannedStudents) ? classroom.bannedStudents : [];
    const bannedIds = bannedStudents.map(b => (b && b._id) ? String(b._id) : String(b));
    if (bannedIds.includes(String(userId))) return true;

    const banLog = Array.isArray(classroom?.banLog) ? classroom.banLog : (Array.isArray(classroom?.bannedRecords) ? classroom.bannedRecords : []);
    return (banLog || []).some(br => String(br.user?._id || br.user) === String(userId));
  };

  // Create GroupSet
  return (
    <div className="min-h-screen flex flex-col bg-base-200 p-6">
      <div className="flex-grow">
        <h1 className="text-3xl font-bold mb-6">
          {classroom
            ? `${classroom.name}${classroom.code ? ` (${classroom.code})` : ''} Groups`
            : 'Classroom Groups'}
        </h1>

        {/* Teacher controls */}
        {(user.role === 'teacher' || user.role === 'admin') && (
          <div role="tablist" className="tabs tabs-boxed mb-6">
            <a
              role="tab"
              className={`tab ${activeTab === 'list' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('list')}
            >
              Group Sets
            </a>
            <a
              role="tab"
              className={`tab ${activeTab === 'create' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('create')}
            >
              Create
            </a>
          </div>
        )}

        {/* Create Group Set Form */}
        {(user.role === 'teacher' || user.role === 'admin') && activeTab === 'create' && !showEditGroupSetModal && (
          <div className="card bg-base-100 shadow-md p-4 space-y-4 mb-6">
            <h2 className="text-xl font-semibold">Create Group Set</h2>
            <input
              type="text"
              placeholder="Group Set Name"
              className="input input-bordered w-full"
              value={groupSetName}
              onChange={(e) => setGroupSetName(e.target.value)}
            />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={groupSetSelfSignup}
                  onChange={(e) => {
                    setGroupSetSelfSignup(e.target.checked);
                    // Auto-disable join approval if self-signup is disabled
                    if (!e.target.checked) {
                      setGroupSetJoinApproval(false);
                    }
                  }}
                />
                Self Signup
              </label>
              <label className={`flex items-center gap-2 ${!groupSetSelfSignup ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={groupSetJoinApproval && groupSetSelfSignup} // Auto-uncheck if self-signup disabled
                  disabled={!groupSetSelfSignup} // Disable when self-signup is off
                  onChange={(e) => setGroupSetJoinApproval(e.target.checked)}
                />
                Join Approval Required
              </label>
            </div>
            <input
              type="number"
              placeholder="Max Members (optional)"
              className="input input-bordered w-full"
              min="0"
              value={groupSetMaxMembers}
              onChange={(e) => setGroupSetMaxMembers(Math.max(0, e.target.value))}
            />
            <div className="mb-4">
              <label className="label">
                <span className="label-text">Group Multiplier Increment</span>
                <span className="label-text-alt">Per member</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                placeholder="0"
                className="input input-bordered w-full"
                value={groupSetMultiplierIncrement}
                onChange={(e) => setGroupSetMultiplierIncrement(Math.max(0, e.target.value))}
              />
              <div className="label">
                <span className="label-text-alt">
                  {groupSetMultiplierIncrement > 0 
                    ? `Group multiplier will be 1x + (members × ${groupSetMultiplierIncrement})`
                    : `No automatic multiplier (groups stay at 1x)`
                  }
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
                <div className="inline-flex rounded-full bg-gray-200 p-1">
                <button
                  type="button"
                  onClick={() => setGroupSetImageSource('file')}
                  className={`px-3 py-1 rounded-full text-sm transition ${groupSetImageSource === 'file' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => setGroupSetImageSource('url')}
                  className={`ml-1 px-3 py-1 rounded-full text-sm transition ${groupSetImageSource === 'url' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  Use image URL
                </button>
                </div>
              </div>
  
            {groupSetImageSource === 'file' ? (
              <>
                <input
                  ref={groupSetFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={e => setGroupSetImageFile(e.target.files[0])}
                  className="file-input file-input-bordered w-full max-w-xs"
                />
                <p className="text-xs text-gray-500">Allowed: jpg, png, webp, gif. Max: 5 MB.</p>
              </>
            ) : (
              <input
                type="url"
                placeholder="https://..."
                className="input input-bordered w-full max-w-xs"
                value={groupSetImageUrl}
                onChange={e => setGroupSetImageUrl(e.target.value)}
              />
            )}

            {editingGroupSetId && (
              <>
                {/* Only show remove button when current image is NOT a placeholder */}
                {!isPlaceholderGroupSetImage(groupSetImage) && (
                  <button
                    className="btn btn-ghost btn-sm mt-2"
                    onClick={() => {
                      // mark removal locally — actual deletion will be performed when user clicks Update
                      setGroupSetImage('placeholder.jpg');
                      setGroupSetImageFile(null);
                      setGroupSetImageSource('url');
                      setGroupSetImageUrl('');
                      if (groupSetFileInputRef.current) groupSetFileInputRef.current.value = '';
                      setGroupSetImageRemoved(true);
                      toast('Image marked for removal; click Update to save');
                    }}
                  >
                    Remove image
                  </button>
                )}
              </>
            )}

            <button className="btn btn-success" onClick={editingGroupSetId ? handleUpdateGroupSet : handleCreateGroupSet}>
              {editingGroupSetId ? 'Update Group Set' : 'Create Group Set'}
            </button>
            {editingGroupSetId && (
              <button className="btn btn-ghost ml-2" onClick={resetGroupSetForm}>
                Cancel
              </button>
            )}
          </div>
        )}

        {/* Group Sets List */}
        {activeTab === 'list' && (
          <>
            {(user.role === 'teacher' || user.role === 'admin') && groupSets.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <label className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={selectedGroupSets.length === groupSets.length && groupSets.length > 0}
                    onChange={handleSelectAllGroupSets}
                  />
                  <span className="text-sm">Select all GroupSets ({groupSets.length})</span>
                </label>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    className={`btn btn-sm btn-error w-full sm:w-auto ${selectedGroupSets.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}
                    onClick={openConfirmDeleteSelectedGroupSets}
                  >
                    Delete Selected ({selectedGroupSets.length})
                  </button>
                </div>

                <div className="w-full sm:w-auto sm:ml-auto">
                  <button
                    className="btn btn-sm btn-outline w-full sm:w-auto"
                    onClick={() => {
                      setConfirmDeleteAllGroupSets({
                        ids: groupSets.map(gs => String(gs._id || gs.id)), // ensure plain strings
                        names: groupSets.map(gs => gs.name)
                      });
                    }}
                  >
                    Delete All GroupSets ({groupSets.length})
                  </button>
                </div>
              </div>
            )}

            {groupSets.length === 0 && (
              <p className="text-lg font-medium text-gray-600">No groups available</p>
            )}

            {/* Group Sets */}
            {groupSets.map((gs) => (
              <div key={gs._id} className="card bg-base-100 shadow-md p-4 space-y-4 mb-8">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    {/* groupset image + checkbox overlay */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={resolveGroupSetSrc(gs.image)}
                        alt={gs.name}
                        className="w-16 h-16 object-cover rounded border"
                      />
                      {(user.role === 'teacher' || user.role === 'admin') && (
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm absolute -top-2 -left-2 bg-white"
                          checked={selectedGroupSets.includes(gs._id)}
                          onChange={() => toggleGroupSetSelection(gs._id)}
                        />
                      )}
                    </div>
 
                    <div>
                      <h4 className="text-md font-semibold">{gs.name}</h4>
                      <p>Self Signup: {gs.selfSignup ? 'Yes' : 'No'}</p>
                      <p>Join Approval: {gs.joinApproval ? 'Yes' : 'No'}</p>
                      <p>Max Members: {gs.maxMembers || 'No limit'}</p>
                      <p>
                        Multiplier Increment: 
                        {gs.groupMultiplierIncrement === 0 
                          ? "None (groups stay at 1x)" 
                          : `+${gs.groupMultiplierIncrement}x per member`
                        }
                      </p>
                    </div>
                  </div>
                  
                  {(user.role === 'teacher' || user.role === 'admin') && (
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-info" onClick={() => handleEditGroupSet(gs)}>Edit</button>
                      <button className="btn btn-sm btn-error" onClick={() => setConfirmDeleteGroupSet(gs)}>Delete</button>
                    </div>
                  )}
                </div>

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

                {/* Bulk Actions for Groups */}
                {(user.role === 'teacher' || user.role === 'admin') && selectedGroups[gs._id]?.length > 0 && (
                  <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {selectedGroups[gs._id].length} group(s) selected
                      </span>
                      <button
                        className="btn btn-sm btn-error"
                        onClick={() => setConfirmBulkDeleteGroups({
                          groupSetId: gs._id,
                          groupIds: selectedGroups[gs._id],
                          groupNames: gs.groups
                            .filter(g => selectedGroups[gs._id].includes(g._id))
                            .map(g => g.name)
                        })}
                      >
                        Delete Selected ({selectedGroups[gs._id].length})
                      </button>
                    </div>
                  </div>
                )}

                {/* Select All Groups Checkbox */}
                {(user.role === 'teacher' || user.role === 'admin') && gs.groups.length > 0 && (
                  <div className="mb-3">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={gs.groups.length > 0 && (selectedGroups[gs._id]?.length || 0) === gs.groups.length}
                        onChange={() => handleSelectAllGroups(gs._id, gs.groups)}
                      />
                      Select All Groups ({gs.groups.length})
                    </label>
                  </div>
                )}

                {/* Display Groups */}
                {gs.groups.map((group) => (
                  <div key={group._id} className="border rounded p-4 bg-base-100">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        {/* Group Selection Checkbox */}
                        {(user.role === 'teacher' || user.role === 'admin') && (
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm mt-1"
                            checked={selectedGroups[gs._id]?.includes(group._id) || false}
                            onChange={() => handleSelectGroup(gs._id, group._id)}
                          />
                        )}
                        
                        <div>
                          <h5 className="font-semibold">{group.name}</h5>
                          <p className="text-sm">
                            Members: {group.members.filter(m => m._id).length}/{group.maxMembers || 'No limit'} • 
                            Multiplier: {group.groupMultiplier || 1}x
                            {group.isAutoMultiplier ? (
                              <span className="text-green-600 text-xs ml-1">(Auto)</span>
                            ) : (
                              <span className="text-orange-600 text-xs ml-1">(Manual)</span>
                            )}
                          </p>
                        </div>
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
                        const studentMembership = group.members.find(m => getMemberId(m) === String(user._id));
                        const isApproved = studentMembership?.status === 'approved';
                        const isPending = studentMembership?.status === 'pending';

                        // Check if student is already approved in ANY group in this GroupSet
                        const alreadyApprovedInGroupSet = gs.groups.some(g =>
                          g.members.some(m => getMemberId(m) === String(user._id) && m.status === 'approved')
                        );

                        // Check if student has a pending request in ANY group in this GroupSet
                        const hasPendingInGroupSet = gs.groups.some(g =>
                          g.members.some(m => getMemberId(m) === String(user._id) && m.status === 'pending')
                        );

                        // Find which group has the pending request (if any)
                        const pendingGroup = gs.groups.find(g =>
                          g.members.some(m => getMemberId(m) === String(user._id) && m.status === 'pending')
                        );

                        return (
                          <>
                            {/* Only show join button if self-signup is enabled */}
                            {!studentMembership && !alreadyApprovedInGroupSet && !hasPendingInGroupSet && gs.selfSignup && (
                              <button
                                className="btn btn-xs btn-success"
                                onClick={() => handleJoinGroup(gs._id, group._id)}
                              >
                                Join
                              </button>
                            )}

                            {/* Show message when self-signup is disabled */}
                            {!studentMembership && !alreadyApprovedInGroupSet && !hasPendingInGroupSet && !gs.selfSignup && (
                              <span className="text-xs text-gray-500">
                                Manual enrollment only
                              </span>
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
                                {/* Only show siphon button to group members */}
                                <button
                                  className="btn btn-xs btn-warning"
                                  onClick={() => setOpenSiphonModal(group)}
                                >
                                  Siphon
                                </button>
                              </>
                            )}

                            {alreadyApprovedInGroupSet && !isApproved && (
                              <span className="text-xs text-gray-500">
                                Already in another group
                              </span>
                            )}

                            {hasPendingInGroupSet && !isPending && pendingGroup && (
                              <span className="text-xs text-gray-500">
                                Pending request in "{pendingGroup.name}"
                              </span>
                            )}
                          </>
                        );
                      })()}

                      {(user.role === 'teacher' || user.role === 'admin') && (
                        <>
                          <button className="btn btn-xs btn-primary" onClick={() => { setAddMemberModal({ groupId: group._id, groupSetId: gs._id }); setSelectedStudent(''); }}>Add Member</button>
                          <button className="btn btn-xs btn-info" onClick={() => openEditGroupModal(gs._id, group._id, group.name, group.maxMembers)}>Edit</button>
                          <button className="btn btn-xs btn-error" onClick={() =>
                            setConfirmDeleteGroup({
                              groupId: group._id,
                              groupSetId: gs._id,
                              groupName: group.name,
                            })
                          }>Delete</button>
                          <button className="btn btn-xs btn-warning" onClick={() => setOpenSiphonModal(group)}>Siphon</button>
                          <button className="btn btn-xs btn-success" onClick={() => openAdjustModal(gs._id, group._id)}>Adjust</button>
                        </>
                      )}
                    </div>

                    {/* Siphon requests - Only show to group members, teachers, and admins */}
                    {group.siphonRequests?.length > 0 && (
                      user.role === 'teacher' || 
                      user.role === 'admin' || 
                      group.members.some(m => m._id && m._id._id === user._id && m.status === 'approved')
                    ) && (
                      <div className="mt-4">
                        <h5 className="text-sm font-semibold">Active Siphon Requests</h5>
                        {group.siphonRequests
                          .filter(r => !['teacher_approved', 'expired'].includes(r.status))
                          .map(r => {
                            const targetUserId = r.targetUser?._id ?? r.targetUser;
                            const eligibleVoters = group.members.filter(m => {
                              const mid = getMemberId(m);
                              return m.status === 'approved' && mid && String(mid) !== String(targetUserId);
                            }).length;
                            const yesVotes = r.votes?.filter(v => v.vote === 'yes').length || 0;
                            const noVotes = r.votes?.filter(v => v.vote === 'no').length || 0;
                            const totalVotes = yesVotes + noVotes;
                            const majorityThreshold = Math.ceil(eligibleVoters / 2);
                            const createdAt = r.createdAt ? new Date(r.createdAt) : null;
                            const expiresAt = r.expiresAt ? new Date(r.expiresAt) : null;
                            const msRemaining = expiresAt ? Math.max(0, expiresAt - now) : null;
                            const timeRemainingStr = msRemaining == null ? null : formatMs(msRemaining);
                            
                            return (
                              <div key={r._id} className="border p-2 mt-2 rounded bg-base-200">
                                <p>
                                  <strong>{r.amount} ₿</strong> from {
                                    r.targetUser?.firstName && r.targetUser?.lastName 
                                      ? `${r.targetUser.firstName} ${r.targetUser.lastName}` 
                                      : r.targetUser?.email || 'Unknown User'
                                  }
                                  {timeRemainingStr !== null && (
                                    <span className="text-xs text-warning ml-2">
                                      (Expires in {timeRemainingStr})
                                    </span>
                                  )}
                                </p>
                                <div className="italic text-xs mb-1" dangerouslySetInnerHTML={{ __html: r.reasonHtml }} />
                                
                                {/* Show proof file if available - KEEP ONLY THIS ONE */}
                                {r.proof && r.proof.originalName && (
                                  <div className="text-xs mb-2">
                                    <span className="font-semibold">Proof attached: </span>
                                    <a 
                                      href={`/api/siphon/${r._id}/proof`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="link link-primary"
                                    >
                                      {r.proof.originalName}
                                    </a>
                                  </div>
                                )}
                                
                                {r.status === 'pending' && (
                                  <div className="text-xs text-info mb-2">
                                    Voting: {yesVotes} Yes, {noVotes} No ({totalVotes}/{eligibleVoters} voted, need {majorityThreshold} for majority)
                                  </div>
                                )}

                                {r.status === 'group_approved' && (
                                  <div className="text-xs text-success mb-2">
                                    ✅ Majority vote decided: {r.votes?.filter(v => v.vote === 'yes').length || 0} voted YES, {r.votes?.filter(v => v.vote === 'no').length || 0} voted NO, {eligibleVoters - (r.votes?.length || 0)} didn't vote. Pending teacher approval decision.
                                  </div>
                                )}

                                {r.status === 'pending' && user.role !== 'teacher' &&
                                  !r.votes.some(v => v.user.toString() === user._id) && 
                                  r.targetUser._id !== user._id && (
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

                                {createdAt && (
                                  <div className="text-xs text-muted mb-1">
                                    Initiated: {createdAt.toLocaleString()}
                                  </div>
                                )}
                              </div>
                            );
                          })}
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
                          {/* Removed 'rejected' option since rejected members are removed */}
                        </select>
                        <select
                          value={memberSorts[group._id] || 'email'}
                          onChange={(e) => setMemberSorts(prev => ({ ...prev, [group._id]: e.target.value }))}
                          className="select select-bordered select-sm"
                        >
                          <option value="email">Name</option>
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
                              <th>Name</th>
                              <th>Status</th>
                              <th>Join Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getFilteredAndSortedMembers(group)
                              .filter(member => getMemberId(member)) // ensure a valid id
                              .map((member, index) => {
                                const mid = getMemberId(member) || String(index);
                                return (
                                  <tr key={mid}>
                                    <td>
                                      <input
                                        type="checkbox"
                                        checked={selectedMembers[group._id]?.includes(mid) || false}
                                        onChange={() => handleSelectMember(group._id, mid)}
                                      />
                                    </td>
                                    <td>
                                      {`${member._id?.firstName || ''} ${member._id?.lastName || ''}`.trim() || member._id?.email || 'Unknown User'}
                                      
                                      {/* Show banned badge if user is banned in this classroom */}
                                      {isBannedInClassroom(mid) && (
                                        <span className="badge badge-error ml-2">BANNED</span>
                                      )}
                                      
                                      {/* Only show SIPHONED to teachers/admins or students who are in the same group */}
                                      {(() => {
                                        const isSiphoned = (group?.siphonRequests || []).some(r => {
                                          const targetId = r.targetUser?._id ?? r.targetUser;
                                          return String(targetId) === String(mid) && ['pending','group_approved'].includes(r.status);
                                        });

                                        const viewerIsGroupMember = !!group?.members?.some(m => getMemberId(m) === String(user._id) && m.status === 'approved');

                                        const canSeeSiphoned = isSiphoned && (
                                          user.role === 'teacher' ||
                                          user.role === 'admin' ||
                                          viewerIsGroupMember
                                        );

                                        return canSeeSiphoned ? <span className="badge badge-warning ml-2">SIPHONED</span> : null;
                                      })()}
                                      
                                      <button 
                                        className="btn btn-xs btn-ghost ml-2"
                                        onClick={() => navigate(
                                          `/profile/${mid}`,
                                          { state: { from: 'groups', classroomId: id } }
                                        )}
                                      >
                                        View Profile
                                      </button>
                                      
                                      {(
                                        // check classroom-scoped freeze for this classroom (id from useParams)
                                        member._id?.classroomFrozen?.some(cf => String(cf.classroom) === String(id))
                                      ) && (
                                        // Only show frozen icon to group members, teachers, and admins
                                        (user.role === 'teacher' || 
                                         user.role === 'admin' || 
                                         group.members.some(m => m._id && m._id._id === user._id && m.status === 'approved')
                                        ) && (
                                          <div className="tooltip" data-tip="Account frozen due to siphon request">
                                            <Lock className="inline w-4 h-4 ml-1 text-red-500 cursor-help" />
                                          </div>
                                        )
                                      )}
                                    </td>
                                    <td>
                                      <span className={`badge ${member.status === 'pending' ? 'badge-warning' : 'badge-success'}`}>
                                        {member.status || 'approved'}
                                      </span>
                                    </td>
                                    <td>{member.status === 'approved' ? new Date(member.joinDate).toLocaleString() : 'Pending'}</td>
                                  </tr>
                                );
                              }).filter(Boolean)} {/* Filter out null elements */}
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
          </>
        )}
      </div>

      {/* All existing modals */}
      {showEditGroupSetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-base-100 p-6 rounded-xl shadow-lg w-[90%] max-w-lg">
            <h2 className="text-lg font-semibold mb-4 text-center">Edit Group Set</h2>

            <input
              type="text"
              placeholder="Group Set Name"
              className="input input-bordered w-full mb-3"
              value={groupSetName}
              onChange={(e) => setGroupSetName(e.target.value)}
            />

            <div className="flex items-center gap-4 mb-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={groupSetSelfSignup}
                  onChange={(e) => {
                    setGroupSetSelfSignup(e.target.checked);
                    // Auto-disable join approval if self-signup is disabled
                    if (!e.target.checked) {
                      setGroupSetJoinApproval(false);
                    }
                  }}
                />
                Self Signup
              </label>
              <label className={`flex items-center gap-2 ${!groupSetSelfSignup ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={groupSetJoinApproval && groupSetSelfSignup} // Auto-uncheck if self-signup disabled
                  disabled={!groupSetSelfSignup} // Disable when self-signup is off
                  onChange={(e) => setGroupSetJoinApproval(e.target.checked)}
                />
                Join Approval Required
              </label>
            </div>

            {/* Image controls moved into modal so edit UI mirrors create form */}
            <div className="mb-4">
              <label className="label">
                <span className="label-text">Image</span>
                <span className="label-text-alt">Optional</span>
              </label>

              <div className="inline-flex rounded-full bg-gray-200 p-1">
                <button
                  type="button"
                  onClick={() => setGroupSetImageSource('file')}
                  className={`px-3 py-1 rounded-full text-sm transition ${groupSetImageSource === 'file' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => setGroupSetImageSource('url')}
                  className={`ml-1 px-3 py-1 rounded-full text-sm transition ${groupSetImageSource === 'url' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  Use image URL
                </button>
              </div>

              {groupSetImageSource === 'file' ? (
                <>
                  <input
                    ref={groupSetFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={e => setGroupSetImageFile(e.target.files[0])}
                    className="file-input file-input-bordered w-full max-w-xs mt-3"
                  />
                  <p className="text-xs text-gray-500">Allowed: jpg, png, webp, gif. Max: 5 MB.</p>
                </>
              ) : (
                <input
                  type="url"
                  placeholder="https://..."
                  className="input input-bordered w-full mt-3 max-w-xs"
                  value={groupSetImageUrl}
                  onChange={(e) => setGroupSetImageUrl(e.target.value)}
                />
              )}

              {/* Preview */}
              <div className="mt-3">
                {groupSetImageFile ? (
                  <img src={URL.createObjectURL(groupSetImageFile)} alt="Preview" className="w-28 h-28 object-cover rounded border" />
                ) : groupSetImage ? (
                  <img src={resolveGroupSetSrc(groupSetImage)} alt="Preview" className="w-28 h-28 object-cover rounded border" />
                ) : (
                  <img src="/images/groupset-placeholder.svg" alt="Preview" className="w-28 h-28 object-cover rounded border" />
                )}
              </div>

              {/* Remove button only when current image is not placeholder */}
              {editingGroupSetId && !isPlaceholderGroupSetImage(groupSetImage) && (
                <div>
                  <button
                    className="btn btn-ghost btn-sm mt-2"
                    onClick={() => {
                      setGroupSetImage('placeholder.jpg');
                      setGroupSetImageFile(null);
                      setGroupSetImageSource('url');
                      setGroupSetImageUrl('');
                      if (groupSetFileInputRef.current) groupSetFileInputRef.current.value = '';
                      setGroupSetImageRemoved(true);
                      toast('Image marked for removal; click Update to save');
                    }}
                  >
                    Remove image
                  </button>
                </div>
              )}
            </div>

            <input
              type="number"
              placeholder="Max Members (optional)"
              className="input input-bordered w-full mb-4"
              min="0"
              value={groupSetMaxMembers}
              onChange={(e) => setGroupSetMaxMembers(Math.max(0, e.target.value))}
            />
            <div className="mb-4">
              <label className="label">
                <span className="label-text">Group Multiplier Increment</span>
                <span className="label-text-alt">Per member</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                placeholder="0"
                className="input input-bordered w-full"
                value={groupSetMultiplierIncrement}
                onChange={(e) => setGroupSetMultiplierIncrement(Math.max(0, e.target.value))}
              />
              <div className="label">
                <span className="label-text-alt">
                  {groupSetMultiplierIncrement > 0 
                    ? `Group multiplier will be 1x + (members × ${groupSetMultiplierIncrement})`
                    : `No automatic multiplier (groups stay at 1x)`
                  }
                </span>
              </div>
            </div>

            <div className="flex justify-center gap-4 mt-4">
              <button
                className="btn btn-success"
                onClick={async () => {
                  await handleUpdateGroupSet();
                  setShowEditGroupSetModal(false);
                }}
              >
                Update Group Set
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowEditGroupSetModal(false);
                  // reset editing state like the existing reset logic
                  setEditingGroupSetId(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {openSiphonModal && (
        <SiphonModal
          group={openSiphonModal}
          classroomId={id} // Use 'id' from useParams, which is the classroomId
          onClose={() => setOpenSiphonModal(null)}
        />
      )}

      {adjustModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="card bg-base-100 p-6 shadow-xl max-w-md w-full">
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
            
            {/* Updated multiplier toggles - separate controls */}
            <div className="space-y-3 mb-4">
              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">Apply group multipliers</span>
                  <input 
                    type="checkbox" 
                    className="toggle toggle-primary" 
                    checked={adjustApplyGroupMultipliers}
                    onChange={(e) => setAdjustApplyGroupMultipliers(e.target.checked)}
                    disabled={Number(adjustAmount) < 0}
                  />
                </label>
                <div className="label">
                  <span className="label-text-alt text-gray-500">
                  {Number(adjustAmount) < 0
                    ? "Disabled for debit adjustments"
                    : (adjustApplyGroupMultipliers 
                        ? "Group multipliers will be applied" 
                        : "Group multipliers will be ignored")
                  }
                  </span>
                </div>
              </div>
              
              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">Apply personal multipliers</span>
                  <input 
                    type="checkbox" 
                    className="toggle toggle-primary" 
                    checked={adjustApplyPersonalMultipliers}
                    onChange={(e) => setAdjustApplyPersonalMultipliers(e.target.checked)}
                    disabled={Number(adjustAmount) < 0}
                  />
                </label>
                <div className="label">
                  <span className="label-text-alt text-gray-500">
                  {Number(adjustAmount) < 0
                    ? "Disabled for debit adjustments"
                    : (adjustApplyPersonalMultipliers 
                        ? "Personal multipliers will be applied" 
                        : "Personal multipliers will be ignored")
                  }
                  </span>
                </div>
              </div>
            </div>

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
            <h2 className="text-lg font-semibold mb-4 text-center">Edit Group</h2>
            <input
              type="text"
              className="input input-bordered w-full mb-4"
              placeholder="Group name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
            <input
              type="number"
              className="input input-bordered w-full mb-4"
              placeholder="Max Members (optional)"
              min="0"
              value={newGroupMaxMembers}
              onChange={(e) => setNewGroupMaxMembers(e.target.value)}
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

      {/* Bulk Delete Groups Confirmation Modal */}
      {confirmBulkDeleteGroups && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white dark:bgbase-100 p-6 rounded-xl shadow-lg w-[90%] max-w-md">
            <h2 className="text-lg font-semibold mb-4 text-center">Delete Groups</h2>
            <p className="text-sm text-center mb-4">
              Are you sure you want to delete the following {confirmBulkDeleteGroups.groupIds.length} group(s)?
            </p>
            <div className="max-h-32 overflow-y-auto mb-4 p-2 bg-gray-50 dark:bg-gray-800 rounded">
              {confirmBulkDeleteGroups.groupNames.map((name, index) => (
                <div key={index} className="text-sm py-1">• {name}</div>
              ))}
            </div>
            <p className="text-xs text-gray-500 text-center mb-4">
              This action cannot be undone.
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setConfirmBulkDeleteGroups(null)}
                className="btn btn-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDeleteGroups}
                className="btn btn-sm btn-error"
              >
                Delete {confirmBulkDeleteGroups.groupIds.length} Group(s)
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteAllGroupSets && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-base-100 p-6 rounded-xl shadow-lg w-[90%] max-w-md">
            <h2 className="text-lg font-semibold mb-4 text-center">Delete All GroupSets</h2>
            <p className="text-sm text-center mb-3">
              Are you sure you want to delete all GroupSets in this classroom? This will delete all groups within them.
            </p>
            <div className="max-h-36 overflow-y-auto mb-4 p-2 bg-gray-50 rounded">
              {confirmDeleteAllGroupSets.names.map((n, i) => (
                <div key={i} className="text-sm py-1">• {n}</div>
              ))}
            </div>
            <div className="flex justify-center gap-4">
              <button onClick={() => setConfirmDeleteAllGroupSets(null)} className="btn btn-sm">Cancel</button>
              <button onClick={handleDeleteAllGroupSets} className="btn btn-sm btn-error">Delete {confirmDeleteAllGroupSets.ids.length} GroupSet(s)</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {addMemberModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Add Member to Group</h3>
            <p className="py-4">Select a student to add. Only students not already in this group set are shown.</p>
            
            <input
              type="text"
              placeholder="Search students by name or email..."
              className="input input-bordered w-full mb-3"
              value={addMemberSearch}
              onChange={(e) => setAddMemberSearch(e.target.value)}
            />
            
            <select
              className="select select-bordered w-full"
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
            >
              <option value="" disabled>Select a student</option>
              {(() => {
                const groupSet = groupSets.find(gs => gs._id === addMemberModal.groupSetId);
                if (!groupSet) return null;

                const memberIdsInGroupSet = new Set(
                  groupSet.groups.flatMap(g => g.members.map(m => m._id._id || m._id))
                );

                const q = (addMemberSearch || '').trim().toLowerCase();

                 // Build banned id sets from current classroom (supports legacy shapes)
                 const bannedIds = new Set(
                   (classroom?.bannedStudents || []).map(b => (b && b._id) ? String(b._id) : String(b))
                 );
                 const banLogIds = new Set(
                   (classroom?.banLog || []).map(br => String(br.user?._id || br.user))
                 );

                const availableStudents = allStudents
                  // exclude anyone already in the groupset
                  .filter(s => !memberIdsInGroupSet.has(s._id))
                  // exclude teacher accounts, the current user, and banned students
                  .filter(s => 
                    (s.role || '').toLowerCase() !== 'teacher' &&
                    String(s._id) !== String(user._id) &&
                    !bannedIds.has(String(s._id)) &&
                    !banLogIds.has(String(s._id)) &&
                    !s.isBanned
                  )
                   // apply search filter (name or email)
                   .filter(s => {
                     if (!q) return true;
                     const name = `${s.firstName || ''} ${s.lastName || ''}`.trim().toLowerCase();
                     const email = (s.email || '').toLowerCase();
                     return name.includes(q) || email.includes(q);
                   });

                if (availableStudents.length === 0) {
                  return <option disabled>No available students</option>;
                }

                return availableStudents.map(student => (
                  <option key={student._id} value={student._id}>
                    {`${student.firstName || ''} ${student.lastName || ''}`.trim() || student.email}
                  </option>
                ));
              })()}
            </select>

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setAddMemberModal(null)}>Cancel</button>
              <button className="btn btn-success" onClick={handleAddMember} disabled={!selectedStudent}>Add</button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Groups;
