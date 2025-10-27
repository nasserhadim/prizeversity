import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext'; // <-- added import
import axios from 'axios';
import socket from '../utils/socket.js';
import { LoaderIcon, RefreshCw } from 'lucide-react';
import Footer from '../components/Footer';
import StatsRadar from '../components/StatsRadar'; // <-- add this import
import { getThemeClasses } from '../utils/themeUtils'; // <-- new import

const StudentStats = () => {
  const { classroomId, id: studentId } = useParams();
  const location = useLocation();
  const { theme } = useContext(ThemeContext); // <-- read theme
  const isDark = theme === 'dark';
  const themeClasses = getThemeClasses(isDark); // <-- derive theme classes
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Precompute group multiplier for rendering
  const groupMultiplierValue = Number(stats?.groupMultiplier ?? stats?.student?.groupMultiplier ?? 1);
  
  useEffect(() => {
    // Async function to fetch student stats from backend
    const fetchStats = async () => {
      try {
        const url = classroomId
          ? `/api/stats/student/${studentId}?classroomId=${classroomId}`
          : `/api/stats/student/${studentId}`;
        const res = await axios.get(url, { withCredentials: true });
        setStats(res.data);
        setError('');
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    };

    if (studentId) fetchStats();

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
  }, [studentId, classroomId]);

  // Determine where we came from to customize the back button
  const backButton = (() => {
    const from = location.state?.from;
    if (from === 'leaderboard') {
      return {
        to: `/classroom/${classroomId}/leaderboard`,
        label: '← Back to Leaderboard'
      };
    } else if (from === 'people') {
      return {
        to: `/classroom/${classroomId}/people`,
        label: '← Back to People'
      };
    } else {
      // Default fallback
      return {
        to: `/classroom/${classroomId}/people`,
        label: '← Back to People'
      };
    }
  })();

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
      <div className={`${themeClasses.cardBase} max-w-md mx-auto mt-10 space-y-6`}>
        <h1 className="text-2xl font-bold text-center">{(stats.student.name || stats.student.email.split('@')[0])}'s Stats</h1>

        {/* radar + legend (unchanged) */}
        <div className="flex justify-center">
          <StatsRadar
            isDark={isDark}
            stats={{
              multiplier: stats.multiplier || stats.student?.multiplier || 1,
              groupMultiplier: stats.groupMultiplier ?? stats.student?.groupMultiplier ?? 1,
              luck: stats.luck || stats.student?.luck || 1,
              attackPower: stats.attackPower || stats.student?.attackPower || 0,
              shieldCount: stats.shieldCount || stats.student?.shieldCount || 0,
              discountShop: stats.discountShop || stats.student?.discountShop || 0
            }}
          />
        </div>

        {/* stats list */}
        <div className="stats stats-vertical shadow w-full">
          {/* Attack, Shield, Multiplier (existing items) */}
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
            <div className="stat-value">
              x{Number(stats.multiplier || stats.student?.multiplier || 1).toFixed(1)}
            </div>
          </div>

          {/* ONLY render Group Multiplier when > 1 */}
          {groupMultiplierValue > 1 && (
            <div className="stat">
              <div className="stat-figure text-secondary">
                👥
              </div>
              <div className="stat-title">Group Multiplier</div>
              <div className="stat-value">
                x{groupMultiplierValue.toFixed(1)}
              </div>
              <div className="stat-desc">Includes group bonus</div>
            </div>
          )}
          
          <div className="stat">
            <div className="stat-figure text-secondary">
              🏷️
            </div>
            <div className="stat-title">Discount</div>
            <div className="stat-value">
              {stats.discount > 0 ? `${stats.discount}%` : 'None'}
            </div>
            {stats.discount > 0 && (
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
          <Link to={backButton.to} className="btn btn-outline w-full">
            {backButton.label}
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
