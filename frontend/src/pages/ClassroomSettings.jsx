// prizeversity/frontend/src/pages/ClassroomSettings.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { LoaderIcon } from 'lucide-react';
import Footer from '../components/Footer';

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
    // New: keep same UX as "Create Classroom" (file vs url)
    const [updateBackgroundImageSource, setUpdateBackgroundImageSource] = useState('file'); // 'file' | 'url'
    const [updateBackgroundImageUrl, setUpdateBackgroundImageUrl] = useState('');
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
                    toast.error('You no longer have access to this classroom');
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

    // Leave classroom with toast confirmation
    const handleLeave = () => {
        toast((t) => (
            <div className="flex flex-col">
                <span>Leave "{classroom.name}"?</span>
                <div className="flex justify-end gap-2 mt-2">
                    <button
                        className="btn btn-warning btn-sm"
                        onClick={async () => {
                            toast.dismiss(t.id);
                            try {
                                await axios.post(`/api/classroom/${id}/leave`);
                                navigate('/classrooms');
                                const toastId = toast.success('Left classroom!');
                                // Force dismiss after 3 seconds
                                setTimeout(() => toast.dismiss(toastId), 3000);
                            } catch (err) {
                                console.error(err);
                                toast.error('Failed to leave classroom');
                            }
                        }}
                    >
                        Leave
                    </button>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => toast.dismiss(t.id)}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        ));
    };

    // Delete classroom with toast confirmation
    const handleDelete = () => {
        toast((t) => (
            <div className="flex flex-col">
                <span>Delete "{classroom.name}"? All data will be lost!</span>
                <div className="flex justify-end gap-2 mt-2">
                    <button
                        className="btn btn-error btn-sm"
                        onClick={async () => {
                            toast.dismiss(t.id);
                            try {
                                await axios.delete(`/api/classroom/${id}`);
                                navigate('/');
                                const toastId = toast.success('Classroom deleted!');
                                // Force dismiss after 3 seconds
                                setTimeout(() => toast.dismiss(toastId), 3000);
                            } catch (err) {
                                console.error(err);
                                toast.error('Failed to delete classroom');
                            }
                        }}
                    >
                        Delete
                    </button>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => toast.dismiss(t.id)}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        ));
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
            // If user chose a file, append the file. If they chose URL, append the URL string.
            if (updateBackgroundImageSource === 'file' && updateBackgroundFile) {
                formData.append('backgroundImage', updateBackgroundFile);
            } else if (updateBackgroundImageSource === 'url' && updateBackgroundImageUrl.trim()) {
                formData.append('backgroundImage', updateBackgroundImageUrl.trim());
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
            const msg = err.response?.data?.error || 'Update failed';
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
                <h1 className="text-3xl font-bold text-center">
                    {classroom.name}{classroom.code ? ` (${classroom.code})` : ''}
                </h1>
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
                        <div className="mb-4">
                          <label className="label">
                            <span className="label-text">Background Image</span>
                            <span className="label-text-alt">Optional</span>
                          </label>

                          <div className="inline-flex rounded-full bg-gray-200 p-1 mb-2">
                            <button
                              type="button"
                              onClick={() => setUpdateBackgroundImageSource('file')}
                              className={`px-3 py-1 rounded-full text-sm transition ${updateBackgroundImageSource === 'file' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                              Upload
                            </button>
                            <button
                              type="button"
                              onClick={() => setUpdateBackgroundImageSource('url')}
                              className={`ml-1 px-3 py-1 rounded-full text-sm transition ${updateBackgroundImageSource === 'url' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                              Use image URL
                            </button>
                          </div>

                          {updateBackgroundImageSource === 'file' ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                name="backgroundImage"
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                onChange={e => {
                                  setUpdateBackgroundFile(e.target.files[0]);
                                  // keep URL empty when choosing file
                                  setUpdateBackgroundImageUrl('');
                                }}
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
                          ) : (
                            <input
                              type="url"
                              placeholder="https://example.com/background.jpg"
                              value={updateBackgroundImageUrl}
                              onChange={e => {
                                setUpdateBackgroundImageUrl(e.target.value);
                                // clear file when entering URL
                                setUpdateBackgroundFile(null);
                              }}
                              className="input input-bordered w-full"
                            />
                          )}
                          <p className="text-xs text-gray-500 mt-2">Allowed: jpg, png, webp, gif. Max: 5 MB.</p>
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

                <div className="flex flex-wrap gap-2 justify-center w-full">
                    {user.role !== 'teacher' && (
                        <button className="btn btn-warning" onClick={handleLeave}>
                            Leave Classroom
                        </button>
                    )}
                    {user.role === 'teacher' && (
                        <>
                            <button className="btn btn-error" onClick={handleDelete}>
                                Delete Classroom
                            </button>
                            <button
                                className={`btn ${archived ? 'btn-success' : 'btn-outline'} `}
                                onClick={handleToggleArchive}
                            >
                                {archived ? 'Unarchive Classroom' : 'Archive Classroom'}
                            </button>
                        </>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
}