import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const StudentStats = () => {
    const { classroomId, id: studentId } = useParams();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await axios.get(`/api/stats/student/${studentId}`, {
                    withCredentials: true,
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                });
                setStats(res.data);
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to load stats');
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [studentId]);

    if (loading) {
        return <div className="p-6 text-center">Loading...</div>;
    }

    if (error) {
        return (
            <div className="p-6 text-center text-red-500">
                {error}
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto p-6 mt-10 bg-white rounded-xl shadow space-y-6">
            <h2 className="text-2xl font-bold text-center">🎯 Student Stats</h2>

            <table className="table w-full">
                <tbody>
                    <tr>
                        <td>⚔️ Attack Bonus</td>
                        <td>{stats.attackPower || 0}</td>
                    </tr>
                    <tr>
                        <td>🛡 Shield</td>
                        <td>{stats.shieldActive ? 'Active' : 'Inactive'}</td>
                    </tr>
                    <tr>
                        <td>💰 Multiplier</td>
                        <td>{stats.doubleEarnings ? '2x Earnings' : 'Normal'}</td>
                    </tr>
                    <tr>
                        <td>🏷️ Discount</td>
                        <td>{stats.discountShop ? '20% Off Shop' : 'None'}</td>
                    </tr>
                    <tr>
                        <td>🍀 Luck</td>
                        <td>{typeof stats.luck === 'number' ? stats.luck : '0'}</td>
                    </tr>
                </tbody>
            </table>

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
