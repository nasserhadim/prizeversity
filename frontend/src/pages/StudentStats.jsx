import React, { useState, useEffect, useContext } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext'; // <-- added import
import axios from 'axios';
import socket from '../utils/socket.js';
import { LoaderIcon, RefreshCw, TrendingUp } from 'lucide-react'; // Removed Award import
import Footer from '../components/Footer';
import StatsRadar from '../components/StatsRadar'; // <-- add this import
import { getThemeClasses } from '../utils/themeUtils'; // <-- new import

const StudentStats = () => {
  const { classroomId, id: studentId } = useParams();
  const location = useLocation();
  const { theme } = useContext(ThemeContext); // <-- read theme
  const isDark = theme === 'dark';
  const themeClasses = getThemeClasses(isDark); // <-- derive theme classes
  // Add a single helper for muted copy that respects theme
  const subtleText = isDark ? 'text-base-content/70' : 'text-gray-600';
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [xpData, setXPData] = useState(null);
  const [badges, setBadges] = useState([]);
  // Precompute group multiplier for rendering
  const groupMultiplierValue = Number(stats?.groupMultiplier ?? stats?.student?.groupMultiplier ?? 1);

  // NEW: classroom details for header
  const [classroom, setClassroom] = useState(null);

  useEffect(() => {
    if (!classroomId) return;
    (async () => {
      try {
        const res = await axios.get(`/api/classroom/${classroomId}`, { withCredentials: true });
        setClassroom(res.data);
      } catch (e) {
        console.error('[StudentStats] failed to fetch classroom', e);
      }
    })();
  }, [classroomId]);

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

  // Simplified XP data fetch - only get XP info, not badges
  useEffect(() => {
    const fetchXPData = async () => {
      if (!classroomId || !studentId) return;
      
      try {
        const res = await axios.get(
          `/api/xp/classroom/${classroomId}/user/${studentId}`,
          { withCredentials: true, headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } }
        );
        setXPData(res.data);
      } catch (e) {
        console.error('Failed to fetch XP data', e);
      }
    };
    
    fetchXPData();
  }, [classroomId, studentId]);

  // Determine where we came from to customize the back button
  const backButton = (() => {
    const from = location.state?.from;
    if (from === 'leaderboard') {
      return { to: `/classroom/${classroomId}/leaderboard`, label: '← Back to Leaderboard' };
    } else if (from === 'people') {
      return { to: `/classroom/${classroomId}/people`, label: '← Back to People' };
    } else if (from === 'badges') {
      return { to: `/classroom/${classroomId}/badges`, label: '← Back to Badges' };
    } else {
      return { to: `/classroom/${classroomId}/people`, label: '← Back to People' };
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
        <div className="text-center space-y-1">
          {classroom && (
            <div className="text-xl font-semibold">
              {classroom.name}{classroom.code ? ` (${classroom.code})` : ''}
            </div>
          )}
          <h1 className="text-2xl font-bold">
            {(stats.student.name || stats.student.email.split('@')[0])}'s Stats
          </h1>
        </div>

        {/* XP and Level Progress - Simplified */}
        {xpData && (
          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-3xl font-bold flex items-center gap-2">
                    <TrendingUp className="w-8 h-8 text-primary" />
                    Level {xpData.level}
                  </h2>
                  <p className={`text-sm ${subtleText}`}>
                    {xpData.xp} / {xpData.nextLevelProgress.xpForNextLevel} XP
                  </p>
                </div>

                {/*
                  Compute percent locally as a fallback.
                  Use it for both the label and the progress bar.
                */}
                {(() => {
                  const xp = Number(xpData?.xp ?? 0);
                  const cap = Number(xpData?.nextLevelProgress?.xpForNextLevel ?? 0);
                  const pct = cap > 0 ? Math.min(100, Math.max(0, Math.round((xp / cap) * 100))) : 0;
                  const xpNeeded = Math.max(0, cap - xp);
                  return (
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{pct}%</p>
                      <p className={`text-xs ${subtleText}`}>to next level</p>
                      <progress className="progress progress-primary w-full mt-2" value={pct} max="100" />
                      <p className={`text-sm mt-2 ${subtleText}`}>
                        {xpNeeded} XP needed for Level {xpData.level + 1}
                      </p>
                    </div>
                  );
                })()}
              </div>
              
              {/* Add link to badges page */}
              {classroomId && (
                <Link 
                  to={`/classroom/${classroomId}/badges`}
                  state={{ 
                    studentId: studentId,
                    view: 'collection',
                    // carry where we came from (leaderboard | people), default to people
                    source: location.state?.from || 'people'
                  }}
                  className="btn btn-outline btn-sm mt-4"
                >
                  🏅 View Badge Collection ({xpData.earnedBadges?.length || 0})
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Radar Chart */}
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

        {/* Stats List */}
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
      </div>

      <div className="max-w-md mx-auto mt-6 mb-6">
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
