import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import socket from '../utils/socket.js';
import { LoaderIcon, RefreshCw } from 'lucide-react';
import Footer from '../components/Footer';

const StudentStats = () => {
  const { classroomId, id: studentId } = useParams();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/stats/student/${studentId}`, {
        withCredentials: true
      });
      setStats(res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    const handleDiscountExpired = () => {
      setStats(prev => ({
        ...prev,
        discountShop: 0
      }));
    };

    const handleFocus = () => {
      fetchStats();
    };

    socket.on('discount_expired', handleDiscountExpired);
    window.addEventListener('focus', handleFocus);

    return () => {
      socket.off('discount_expired', handleDiscountExpired);
      window.removeEventListener('focus', handleFocus);
    }
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <LoaderIcon className="animate-spin h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-500">
        {error}
      </div>
    );
  }

  // Render message if no stats are available
  if (!stats || !stats.student) {
    return (
      <div className="p-6 text-center">
        No stats available for this student
      </div>
    );
  }

  return (
    <>
      <div className="max-w-md mx-auto p-6 mt-10 bg-white rounded-xl shadow space-y-6">
        <h1 className="text-2xl font-bold text-center">{(stats.student.name || stats.student.email.split('@')[0])}'s Stats</h1>
        {/* <p className="text-center text-gray-500">{stats.student.email}</p> */}

        <div className="stats stats-vertical shadow w-full">
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
              {stats.shieldActive ? `Active x${stats.shieldCount}` : 'Inactive'}
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
      <Footer />
    </>
  );
};

export default StudentStats;