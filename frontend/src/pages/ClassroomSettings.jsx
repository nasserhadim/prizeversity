// prizeversity/frontend/src/pages/ClassroomSettings.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
    const [updateColor, setUpdateColor] = useState('#ffffff');
    const [updateBackgroundFile, setUpdateBackgroundFile] = useState(null);
    const [archived, setArchived] = useState(false);

    // Fetch classroom details
    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await axios.get(`/api/classroom/${id}`);
                const cls = res.data;
                setArchived(cls.archived);
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

    // Initialize edit fields when entering edit mode
    useEffect(() => {
        if (editingClassroom && classroom) {
            setUpdateClassroomName(classroom.name);
            setUpdateColor(classroom.color || '#ffffff');
            setUpdateBackgroundFile(null);
        }
    }, [editingClassroom, classroom]);

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

    // Toggle archive status
    const handleToggleArchive = async () => {
        try {
            // send JSON instead of FormData
            const res = await axios.put(
                `/api/classroom/${id}`,
                { archived: !archived }
            );
            toast.success(`Classroom ${archived ? 'restored' : 'archived'}!`);
            setArchived(!archived);
            setClassroom(res.data);
        } catch (err) {
            console.error('Toggle-archive error:', err.response || err);
            toast.error(err.response?.data?.error || 'Failed to update archive status');
        }
    };

    // Update classroom (name, color, background image)
    const handleUpdateClassroom = async () => {
        try {
            const formData = new FormData();
            formData.append('name', updateClassroomName || classroom.name);
            formData.append('color', updateColor);
            if (updateBackgroundFile) {
                formData.append('backgroundImage', updateBackgroundFile);
            }

            const res = await axios.put(`/api/classroom/${id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            toast.success('Classroom updated!');
            setEditingClassroom(false);
            setUpdateClassroomName('');
            setUpdateColor('#ffffff');
            setUpdateBackgroundFile(null);
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
        setUpdateColor('#ffffff');
        setUpdateBackgroundFile(null);
    };

    if (loading || !classroom) {
        return (
            <div className="min-h-screen bg-base-200 flex flex-col justify-between items-center p-4">
                <LoaderIcon className="animate-spin size-10" />
            </div>
        );
    }

    return (
        <div className="h-screen bg-base-200 flex flex-col justify-between items-center p-4">
            <div className="w-full max-w-3xl space-y-4 flex flex-col items-center">
                <Link to={`/classroom/${id}`} className="link text-accent self-start">
                    ← Back to Classroom
                </Link>
                <h1 className="text-3xl font-bold text-center">{classroom.name}</h1>
                <p className="text-sm text-gray-500 text-center">Class Code: {classroom.code}</p>

                {editingClassroom ? (
                    <div className="card bg-base-100 shadow-md p-4 w-full">
                        <h4 className="text-lg font-semibold">Update Classroom</h4>
                        <input
                            className="input input-bordered w-full mt-2"
                            type="text"
                            placeholder="New Classroom Name"
                            value={updateClassroomName}
                            onChange={(e) => setUpdateClassroomName(e.target.value)}
                        />
                        <input
                            type="color"
                            value={updateColor}
                            onChange={(e) => setUpdateColor(e.target.value)}
                            className="input w-full h-10 p-0 border mt-2"
                        />
                        <div className="flex items-center space-x-4 mt-2">
                            <input
                                type="file"
                                name="backgroundImage"
                                accept="image/*"
                                onChange={e => setUpdateBackgroundFile(e.target.files[0])}
                                className="file-input file-input-bordered flex-1"
                            />
                            {updateBackgroundFile && (
                                <img
                                    src={URL.createObjectURL(updateBackgroundFile)}
                                    alt="Preview"
                                    className="w-16 h-16 object-cover rounded border"
                                />
                            )}
                        </div>
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

                <div className="flex gap-2 justify-center w-full">
                    <button className="btn btn-warning" onClick={handleLeave}>
                        Leave Classroom
                    </button>
                    <button className="btn btn-error" onClick={handleDelete}>
                        Delete Classroom
                    </button>

                    <button
                        className={`btn ${archived ? 'btn-success' : 'btn-outline'} `}
                        onClick={handleToggleArchive}
                    >
                        {archived ? 'Unarchive Classroom' : 'Archive Classroom'}
                    </button>

                </div>

                <button
                    className="btn btn-neutral mt-4"
                    onClick={() => navigate('/classrooms/archived')}
                >
                    View Archived Classrooms
                </button>

            </div>
            <footer className="mt-auto w-full bg-base-100 py-4 text-center">
                <p className="text-sm text-gray-500">Powered by Prizeversity © 2025</p>
            </footer>
        </div>
    );
}