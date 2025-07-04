// frontend/src/pages/ArchivedClassrooms.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { LoaderIcon } from 'lucide-react';

export default function ArchivedClassrooms() {
    const [archives, setArchives] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Fetch archived classrooms on mount
    useEffect(() => {
        const fetchArchives = async () => {
            try {
                const res = await axios.get(
                    '/api/classroom/archived',
                    { withCredentials: true }
                );
                console.log('Fetched archives:', res.data);
                setArchives(res.data);
            } catch (err) {
                console.error('Error fetching archived classrooms:', err.response || err);
                toast.error(err.response?.data?.error || 'Could not load archives');
            } finally {
                setLoading(false);
            }
        };
        fetchArchives();
    }, []);

    // Restore (unarchive) a classroom
    const handleRestore = async (id) => {
        try {
            await axios.put(
                `/api/classroom/${id}/unarchive`,
                {},
                { withCredentials: true }
            );
            toast.success('Classroom restored!');
            setArchives(prev => prev.filter(cls => cls._id !== id));
        } catch (err) {
            console.error('Error restoring classroom:', err.response || err);
            toast.error(err.response?.data?.error || 'Restore failed');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-base-200 flex items-center justify-center">
                <LoaderIcon className="animate-spin size-10" />
            </div>
        );
    }

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-4">Archived Classrooms</h1>

            {archives.length === 0 ? (
                <p className="text-gray-500">No archived classrooms.</p>
            ) : (
                <div className="space-y-4">
                    {archives.map(cls => (
                        <div
                            key={cls._id}
                            className="card bg-base-100 shadow-md p-4 flex justify-between items-center"
                        >
                            <div>
                                <h2 className="text-xl font-semibold">{cls.name}</h2>
                                <p className="text-sm text-gray-500">Code: {cls.code}</p>
                            </div>
                            <button
                                className="btn btn-success"
                                onClick={() => handleRestore(cls._id)}
                            >
                                Restore
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <button
                className="btn btn-ghost mt-6"
                onClick={() => navigate('/classrooms')}
            >
                ← Back to My Classrooms
            </button>
        </div>
    );
}