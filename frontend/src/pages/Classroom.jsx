import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import '../styles/MemberManagement.css';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LoaderIcon } from 'lucide-react';

const Classroom = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // State variables
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [updateClassroomName, setUpdateClassroomName] = useState('');
  const [updateClassroomImage, setUpdateClassroomImage] = useState('');
  const [editingClassroom, setEditingClassroom] = useState(false);

  // Fetch classroom and student data on mount
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        await fetchClassroomDetails();
      } catch (err) {
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

  // Fetch classroom info and ensure user has access
  const fetchClassroomDetails = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/classroom/${id}`);
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
      await fetchStudents();
    } catch (err) {
      if (err.response?.status === 403) {
        alert('You no longer have access to this classroom');
        navigate('/');
        return;
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Fetch the list of students in the classroom
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

  // Update classroom details (name/image)
  const handleUpdateClassroom = async () => {
    try {
      const response = await axios.put(`/api/classroom/${id}`, {
        name: updateClassroomName || classroom.name,
        image: updateClassroomImage || classroom.image
      });

      if (response.data.message === 'No changes were made') {
        toast.error('No changes were made!');
      } else {
        toast.success('Classroom updated successfully!');
        setEditingClassroom(false);
        setUpdateClassroomName('');
        setUpdateClassroomImage('');
        fetchClassroomDetails();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to update classroom';
      toast.error(errorMessage);
    }
  };

  // Confirm and remove student from classroom
  const handleRemoveStudentConfirm = async (studentId) => {
    if (window.confirm('Are you sure you want to remove this student?')) {
      try {
        await axios.delete(`/api/classroom/${id}/students/${studentId}`);
        toast.success('Student removed successfully!');
        fetchStudents();
      } catch (err) {
        console.error('Failed to remove student', err);
        toast.error('Failed to remove student');
      }
    }
  };

  // Confirm and leave classroom
  const handleLeaveClassroomConfirm = async () => {
    if (window.confirm(`You are about to leave the classroom "${classroom.name}". Are you sure?`)) {
      try {
        await axios.post(`/api/classroom/${id}/leave`);
        toast.success('Left classroom successfully!');
        navigate('/classrooms');
      } catch (err) {
        console.error('Failed to leave classroom', err);
        toast.error('Failed to leave classroom!');
      }
    }
  };

  // Confirm and delete classroom
  const handleDeleteClassroomConfirm = async () => {
    if (window.confirm(`You're about to delete classroom "${classroom.name}". All data will be purged! Are you sure?`)) {
      try {
        await axios.delete(`/api/classroom/${id}`);
        toast.success('Classroom deleted successfully!');
        navigate('/');
      } catch (err) {
        console.error('Failed to delete classroom', err);
        toast.error('Failed to delete classroom!');
      }
    }
  };

  // Cancel editing state
  const handleCancelUpdate = () => {
    setEditingClassroom(false);
    setUpdateClassroomName('');
    setUpdateClassroomImage('');
  };

  // Render loading spinner
  if (loading || !user) {
    return (
      <div className='min-h-screen bg-base-200 flex items-center justify-center'>
        <LoaderIcon className='animate-spin size-10' />
      </div>
    );
  }

  // Render empty state
  if (!classroom) {
    return (
      <div className='min-h-screen bg-base-200 flex items-center justify-center'>
        <LoaderIcon className='animate-spin size-10' />
      </div>
    );
  }

  // Main render
  return (
    <div className="p-6 space-y-6">
      {/* Navigation */}
      <Link to="/classrooms" className="link text-accent">
        ← Back to Classroom Dashboard
      </Link>

      <nav className="flex space-x-4 mb-4">
        <Link to={`/classroom/${id}/news`}>Announcements</Link>
        {user.role === 'teacher' && (
          <Link to={`/classroom/${id}/teacher-news`}>Manage Announcements</Link>
        )}
      </nav>

      <h1 className="text-3xl font-bold">{classroom.name}</h1>
      <p className="text-sm text-gray-500">Class Code: {classroom.code}</p>

      {/* Teacher/Admin Controls */}
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

          {/* Students List */}
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
        </div>
      )}

      {/* Student View */}
      {user.role === 'student' && (
        <div className="space-y-6">
          <button className="btn btn-warning" onClick={handleLeaveClassroomConfirm}>Leave Classroom</button>
        </div>
      )}
    </div>
  );
};

export default Classroom;
