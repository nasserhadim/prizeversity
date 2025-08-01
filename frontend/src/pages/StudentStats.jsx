import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import socket from '../utils/socket.js';
import { LoaderIcon } from 'lucide-react';

const StudentStats = () => {
    const { classroomId, id: studentId } = useParams();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        // Async function to fetch student stats from backend
        const fetchStats = async () => {
            try {
                const res = await axios.get(`/api/stats/student/${studentId}`, {
                    withCredentials: true
                });
                setStats(res.data);
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to load stats');
            } finally {
                setLoading(false);
            }
        };

        fetchStats();

        // Listen for discount expiration
        const handleDiscountExpired = () => {
            setStats(prev => ({
                ...prev,
                discountShop: 0
            }));
        };

        socket.on('discount_expired', handleDiscountExpired);

        return () => {
            socket.off('discount_expired', handleDiscountExpired);
        }
    }, [studentId]);

    // Render loading spinner while loading
    if (loading) {
        return (
            <div className="flex items-center justify-center p-6">
                <LoaderIcon className="animate-spin h-8 w-8" />
            </div>
        );
    }

    // Render error message if error occurred
    if (error) {
        return (
            <div className="p-6 text-center text-red-500">
                {error}
            </div>
        );
    }

    // Render message if no stats are available
    if (!stats) {
        return (
            <div className="p-6 text-center">
                No stats available for this student
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto p-6 mt-10 bg-white rounded-xl shadow space-y-6">
            <h2 className="text-2xl font-bold text-center">🎯 Student Stats</h2>

            <div className="stats stats-vertical shadow w-full">
                {/* ... other stats ... */}

                <div className="stat">
                    <div className="stat-figure text-secondary">
                        ⚔️
                    </div>
                    <div className="stat-title">Attack Bonus</div>
                    <div className="stat-value">{stats.attackPower || 0}</div>
                </div>
                
                <div className="stat">
                    <div className="stat-figure text-secondary">
                        🛡
                    </div>
                    <div className="stat-title">Shield</div>
                    <div className="stat-value">
                        {stats.shieldActive ? 'Active' : 'Inactive'}
                    </div>
                </div>
                
                <div className="stat">
                <div className="stat-figure text-secondary">
                    ✖️
                </div>
                <div className="stat-title">Multiplier</div>
                <div className="stat-value">x{stats.multiplier || 1}</div>
                </div>
                
                <div className="stat">
                <div className="stat-figure text-secondary">
                    🏷️
                </div>
                <div className="stat-title">Discount</div>
                <div className="stat-value">
                    {stats.discountShop ? `${stats.discountShop}%` : 'None'}
                </div>
                {stats.discountShop > 0 && (
                    <div className="stat-desc">Active in bazaar</div>
                )}
                </div>
                
                <div className="stat">
                <div className="stat-figure text-secondary">
                    🍀
                </div>
                <div className="stat-title">Luck</div>
                <div className="stat-value">x{stats.luck || 1}</div>
                </div>
            </div>

            {classroomId ? (
                <Link to={`/classroom/${classroomId}/people`} className="btn btn-outline w-full">
                    ← Back to People
                </Link>
            ) : (
                <button disabled className="btn btn-outline w-full opacity-50 cursor-not-allowed">
                    ← No Classroom Context
                </button>
            )}
        </div>
    );
};

export default StudentStats;