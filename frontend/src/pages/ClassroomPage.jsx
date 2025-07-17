import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import socket from '../utils/socket';
import toast from 'react-hot-toast';

import { API_BASE } from './config/api';
const socket = io(API_BASE); // no "/api" needed here

export default function ClassroomPage() {
  const { user } = useAuth();
  const [role, setRole] = useState(user?.role || '');
  const [classrooms, setClassrooms] = useState([]);
  const [classroomName, setClassroomName] = useState('');
  const [classroomCode, setClassroomCode] = useState('');
  const [color, setColor] = useState('#22c55e');
  const [backgroundFile, setBackgroundFile] = useState(null);
  const [joinClassroomCode, setJoinClassroomCode] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const BACKEND_URL = '${API_BASE}';

  useEffect(() => {
    setRole(user?.role || '');
  }, [user]);

  useEffect(() => {
    if (role) fetchClassrooms();
  }, [role]);

  const fetchClassrooms = async () => {
    try {
      const endpoint = role === 'teacher' ? '/api/classroom' : '/api/classroom/student';
      const res = await axios.get(endpoint);
      setClassrooms(res.data);
    } catch (err) {
      console.error('Error fetching classrooms', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClassroom = async () => {
    console.group('Creating classroom with');
    console.log({ classroomName, classroomCode, color, backgroundFile });
    console.groupEnd();

    if (!classroomName.trim() || !classroomCode.trim()) {
      toast.error('Please enter both Classroom Name and Code!');
      return;
    }

    const formData = new FormData();
    formData.append('name', classroomName);
    formData.append('code', classroomCode);
    formData.append('color', color);
    if (backgroundFile) {
      formData.append('backgroundImage', backgroundFile);
    }

    console.group('FormData entries:');
    for (let pair of formData.entries()) {
      console.log(pair[0] + ':', pair[1]);
    }
    console.groupEnd();

    try {
      await axios.post('/api/classroom/create', formData);
      toast.success('Classroom Created!');
      setClassroomName('');
      setClassroomCode('');
      setColor('#22c55e');
      setBackgroundFile(null);
      fetchClassrooms();
    } catch (err) {
      console.error('Create error:', err);
      toast.error(err.response?.data?.error || 'Error creating classroom');
    }
  };

  const handleJoinClassroom = async () => {
    if (!joinClassroomCode.trim()) {
      toast.error('Enter a classroom code!');
      return;
    }
    try {
      await axios.post('/api/classroom/join', { code: joinClassroomCode });
      toast.success('Joined classroom!', { duration: 800 });
      setJoinClassroomCode('');
      fetchClassrooms();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error joining classroom');
    }
  };

  const handleCardClick = (id) => {
    navigate(`/classroom/${id}`);
    toast.success('Entered classroom!');
  };

  useEffect(() => {
    socket.on('classroom_update', updated =>
      setClassrooms(prev =>
        prev.map(c => (c._id === updated._id ? updated : c))
      )
    );
    socket.on('notification', note => {
      if (['classroom_update', 'classroom_removal', 'classroom_deletion'].includes(note.type)) {
        fetchClassrooms();
      }
    });
    return () => {
      socket.off('classroom_update');
      socket.off('notification');
    };
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-center">Classroom Dashboard</h1>

      {role === 'teacher' && (
        <div className="text-center my-4">
          <button
            className="btn btn-neutral"
            onClick={() => navigate('/classrooms/archived')}
          >
            Archived Classrooms
          </button>
        </div>
      )}

      {role === 'teacher' && (
        <div className="space-y-4 bg-white p-4 rounded shadow">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Classroom Name
            </label>
            <input
              id="name"
              type="text"
              placeholder="Enter classroom name"
              className="input input-bordered w-full"
              value={classroomName}
              onChange={e => setClassroomName(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="code" className="block text-sm font-medium mb-1">
              Classroom Code
            </label>
            <input
              id="code"
              type="text"
              placeholder="Enter classroom code"
              className="input input-bordered w-full"
              value={classroomCode}
              onChange={e => setClassroomCode(e.target.value)}
            />
          </div>

          <div className="flex space-x-2 items-center">
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-12 h-12 p-0 border rounded"
            />
            <div className="flex items-center space-x-4">
              <input
                type="file"
                name="backgroundImage"
                accept="image/*"
                onChange={e => setBackgroundFile(e.target.files[0])}
                className="file-input file-input-bordered flex-1"
              />
              {backgroundFile && (
                <img
                  src={URL.createObjectURL(backgroundFile)}
                  alt="Preview"
                  className="w-16 h-16 object-cover rounded border"
                />
              )}
            </div>
          </div>

          <button
            className="btn btn-success w-full"
            onClick={handleCreateClassroom}
          >
            Create Classroom
          </button>
        </div>
      )}

      {(role === 'student' || role === 'admin') && (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Classroom Code"
            className="input input-bordered w-full"
            value={joinClassroomCode}
            onChange={e => setJoinClassroomCode(e.target.value)}
          />
          <button
            className="btn btn-accent w-full"
            onClick={handleJoinClassroom}
          >
            Join Classroom
          </button>
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold mt-6">Classrooms</h2>
        <div className="grid gap-4 md:grid-cols-2 mt-2">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card bg-base-200 shadow">
                <div className="card-body">
                  <div className="skeleton h-6 w-1/2 mb-2"></div>
                  <div className="skeleton h-4 w-1/3"></div>
                </div>
              </div>
            ))
          ) : (
            classrooms.map(c => {
              const style = {};
              let textClass = 'text-black';
              if (c.color && c.color.toLowerCase() !== '#ffffff') {
                style.backgroundColor = c.color;
                textClass = 'text-white';
              }
              if (c.backgroundImage) {
                const imageUrl = c.backgroundImage.startsWith('http')
                  ? c.backgroundImage
                  : `${BACKEND_URL}${c.backgroundImage}`;
                style.backgroundImage = `url(${imageUrl})`;
                style.backgroundSize = 'cover';
                style.backgroundPosition = 'center';
                textClass = 'text-white';
              }
              return (
                <div
                  key={c._id}
                  className="card bg-base-200 shadow hover:shadow-lg cursor-pointer transition"
                  style={style}
                  onClick={() => handleCardClick(c._id)}
                >
                  <div className="card-body">
                    <h3 className={`card-title ${textClass}`}>{c.name}</h3>
                    <p className={textClass}>Code: {c.code}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  )
};