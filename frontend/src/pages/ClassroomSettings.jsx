// prizeversity/frontend/src/pages/ClassroomSettings.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { LoaderIcon } from 'lucide-react';

export default function ClassroomSettings() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [classroom, setClassroom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editingClassroom, setEditingClassroom] = useState(false);
    const [updateClassroomName, setUpdateClassroomName] = useState('');
    const [updateClassroomImage, setUpdateClassroomImage] = useState('');

    // Fetch classroom details
    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await axios.get(`/api/classroom/${id}`);
                const cls = res.data;
                // Only teacher/admin can access
                const hasAccess =
                    user.role === 'admin' ||
                    (user.role === 'teacher' && cls.teacher === user._id);
                if (!hasAccess) {
                    alert('You no longer have access to this classroom');
                    navigate('/');
                    return;
                }
                setClassroom(cls);
            } catch (err) {
                console.error('Error fetching classroom:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [id, user, navigate]);

    // Leave classroom
    const handleLeave = async () => {
        if (!window.confirm(`Leave "${classroom.name}"?`)) return;
        try {
            await axios.post(`/api/classroom/${id}/leave`);
            toast.success('Left classroom!');
            navigate('/classrooms');
        } catch (err) {
            console.error(err);
            toast.error('Failed to leave classroom');
        }
    };

    // Delete classroom
    const handleDelete = async () => {
        if (!window.confirm(`Delete "${classroom.name}"? All data will be lost!`)) return;
        try {
            await axios.delete(`/api/classroom/${id}`);
            toast.success('Classroom deleted!');
            navigate('/');
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete classroom');
        }
    };

    const handleUpdateClassroom = async () => {
        try {
            const res = await axios.put(`/api/classroom/${id}`, {
                name: updateClassroomName || classroom.name,
                image: updateClassroomImage || classroom.image
            });
            toast.success('Classroom updated!');
            setEditingClassroom(false);
            setUpdateClassroomName('');
            setUpdateClassroomImage('');
            setClassroom(res.data);
        } catch (err) {
            const msg = err.response?.data?.message || 'Update failed';
            toast.error(msg);
        }
    };

    // Cancel edit mode
    const handleCancelUpdate = () => {
        setEditingClassroom(false);
        setUpdateClassroomName('');
        setUpdateClassroomImage('');
    };

    if (loading || !classroom) {
        return (
            <div className="min-h-screen bg-base-200 flex items-center justify-center">
                <LoaderIcon className="animate-spin size-10" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-3xl font-bold">{classroom.name}</h1>
            <p className="text-sm text-gray-500">Class Code: {classroom.code}</p>
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
                        <button className="btn btn-primary" onClick={handleUpdateClassroom}>
                            Update
                        </button>
                        <button className="btn btn-ghost" onClick={handleCancelUpdate}>
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    className="btn btn-outline btn-info"
                    onClick={() => setEditingClassroom(true)}
                >
                    Edit Classroom
                </button>
            )}
            <div className="flex gap-2">
                <button className="btn btn-warning" onClick={handleLeave}>
                    Leave Classroom
                </button>
                <button className="btn btn-error" onClick={handleDelete}>
                    Delete Classroom
                </button>
            </div>
        </div>
    );
}