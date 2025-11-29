import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LoaderIcon, Info } from 'lucide-react';

import { ThemeContext } from '../context/ThemeContext';
import socket from '../utils/socket.js';
import Footer from '../components/Footer';
import StatsRadar from '../components/StatsRadar';
import { getThemeClasses } from '../utils/themeUtils';
import { getUserBadges } from '../api/apiBadges';
import { useAuth } from '../context/AuthContext';

const StudentStats = () => {
  const { classroomId, id: studentId } = useParams();
  const classId = classroomId;

  const location = useLocation();
  const navigate = useNavigate();

  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';
  const themeClasses = getThemeClasses(isDark);

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Just the badge count now
  const [badgeCount, setBadgeCount] = useState(0);

  const { user } = useAuth();

  // XP settings (for isXPEnabled flag)
  const [xpSettings, setXpSettings] = useState(null);
  const [xpRefresh] = useState(false);
 
  // XP summary from backend (single source of truth)
  const [xpSummary, setXpSummary] = useState(null);
  const [showXpInfo, setShowXpInfo] = useState(false); // modal toggle

  const fetchStats = async () => {
    try {
      const url = classId
        ? `/api/stats/student/${studentId}?classroomId=${classId}`
        : `/api/stats/student/${studentId}`;

      const res = await axios.get(url, { withCredentials: true });
      setStats(res.data);
      setError('');

      // badge count for button
      try {
        const badgeRes = await getUserBadges(studentId, classId);
        const earnedCount = badgeRes?.badges?.earned?.length || 0;
        setBadgeCount(earnedCount);
      } catch (err) {
        console.error('Error fetching badge count:', err);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };
 
  // Precompute group multiplier for rendering
  const groupMultiplierValue = Number(
    stats?.groupMultiplier ?? stats?.student?.groupMultiplier ?? 1
  );

  // Go to the *student-specific* badge page now
  const handleViewBadges = () => {
    if (!classId || !studentId) return;
    navigate(`/classroom/${classId}/student/${studentId}/badges`, {
      state: { 
        from: 'stats' // so badges page knows to go back to stats
      },
    });
  };

  // Fetch student stats + badge count
  useEffect(() => {
    if (studentId) fetchStats();

    const handleDiscountExpired = () => {
      setStats(prev => (prev ? { ...prev, discountShop: 0 } : prev));
    };

    const handleFocus = () => {
      if (studentId) fetchStats();
    };

    socket.on('discount_expired', handleDiscountExpired);
    window.addEventListener('focus', handleFocus);

    return () => {
      socket.off('discount_expired', handleDiscountExpired);
      window.removeEventListener('focus', handleFocus);
    };
  }, [studentId, classId]);

  // Fetch XP settings for this specific classroom
  useEffect(() => {
    if (!classId) return;
    (async () => {
      try {
        const r = await axios.get(`/api/xpSettings/${classId}`);
        setXpSettings(r.data || {});
      } catch (e) {
        console.error('Failed to load xpSettings', e);
        setXpSettings({});
      }
    })();
  }, [classId, xpRefresh]);

  // Fetch XP summary level and the totalXP and the progress from backend XP route
  useEffect(() => {
    if (!classId || !studentId) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await axios.get('/api/xp/summary', {
          params: { userId: studentId, classroomId: classId },
          withCredentials: true,
        });
        if (!cancelled) setXpSummary(res.data);
      } catch (err) {
        console.error('Failed to load XP summary:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [classId, studentId, xpRefresh]);

  // XP state from summary or classroomBalances
  const xpState = useMemo(() => {
    if (xpSummary && typeof xpSummary.level === 'number') {
      const totalXP =
        typeof xpSummary.totalXP === 'number' ? xpSummary.totalXP : 0;

      const XPStartLevel =
        typeof xpSummary.XPStartLevel === 'number' ? xpSummary.XPStartLevel : 0;
      const XPEndLevel =
        typeof xpSummary.XPEndLevel === 'number' ? xpSummary.XPEndLevel : 0;

      // XP within THIS level (what the teacher/student expect, e.g. 240/250)
      const span = Math.max(1, XPEndLevel - XPStartLevel);
      const inLevelXP = Math.max(
        0,
        Math.min(totalXP - XPStartLevel, span)
      );

      const pct = Math.max(
        0,
        Math.min(
          100,
          Math.round((inLevelXP / span) * 100)
        )
      );

      return {
        level: xpSummary.level,
        totalXP,           // this is the total XP from the backend
        XPStartLevel,
        XPEndLevel,
        inLevelXP,        // XP inside current level
        requiredInLevel: span, // XP required to reach next level
        progressPercent: pct, // percent progress to next level
      };
    }

    // fallback if summary not available
    const student = stats?.student;
    if (!student) {
      return {
        level: 1,
        totalXP: 0,
        XPStartLevel: 0,
        XPEndLevel: 100,
        inLevelXP: 0,
        requiredInLevel: 100,
        progressPercent: 0,
      };
    }

    const balances = Array.isArray(student.classroomBalances)
      ? student.classroomBalances
      : [];

    const classIdStr = String(classId);
    const cb = balances.find(cb => {
      const classroomField = cb.classroom;
      const classroomIdValue =
        classroomField && classroomField._id ? classroomField._id : classroomField;
      return classroomIdValue && String(classroomIdValue) === classIdStr;
    });

    if (cb) {
      const level =
        typeof cb.level === 'number' && !Number.isNaN(cb.level) ? cb.level : 1;
      const xp = typeof cb.xp === 'number' && !Number.isNaN(cb.xp) ? cb.xp : 0;
      const pct = Math.max(0, Math.min(100, xp)); 

      return {
        level,
        totalXP: xp,
        XPStartLevel: 0,
        XPEndLevel: 100,
        inLevelXP: xp,
        requiredInLevel: 100,
        progressPercent: pct,
      };
    }

    return {
      level: 1,
      totalXP: 0,
      XPStartLevel: 0,
      XPEndLevel: 100,
      inLevelXP: 0,
      requiredInLevel: 100,
      progressPercent: 0,
    };
  }, [xpSummary, stats, classId, xpRefresh]);

  // Progress display: numerator and denominator are the XP inside this level
  const progress = useMemo(() => {
    const inLevelXP = xpState.inLevelXP ?? 0;
    const required = xpState.requiredInLevel ?? 0;

    if (!required || required <= 0) {
      return {
        currentXP: inLevelXP,
        required: 0,
        pct: 100,
        xpRemaining: 0,
        totalXP: xpState.totalXP ?? inLevelXP,
      };
    }

    const pct =
      typeof xpState.progressPercent === 'number'
        ? Math.max(0, Math.min(100, xpState.progressPercent))
        : Math.max(
            0,
            Math.min(100, Math.round((inLevelXP / required) * 100))
          );

    const xpRemaining = Math.max(0, required - inLevelXP);

    return {
      currentXP: inLevelXP,      
      required,                        
      pct,                          
      xpRemaining,
      totalXP: xpState.totalXP ?? inLevelXP, // total XP for “Total XP earned”
    };
  }, [xpState]);

  // XP Gain Rates for this classroom (direct mapping from xpSettings.xpRewards)
  const xpRates = useMemo(() => {
    if (!xpSettings) return null;
    const rewards = xpSettings.xpRewards || {};

    return {
      perBitEarned: rewards.xpPerBitEarned,         // XP per bit earned
      perBitSpent: rewards.xpPerBitSpent,           // XP per bit spent
      perStatIncrease: rewards.xpPerStatsBoost,     // XP per stat boost
      dailyCheckInLimit: rewards.dailyCheckInLimit, // allowed check-ins per day
      groupJoin: rewards.groupJoinXP,              // XP for joining groups
      challenge: rewards.challengeXP,              // XP per challenge
      mysteryBoxUse: rewards.mysteryBoxUseXP,      // XP per mystery box use
    };
  }, [xpSettings]);

  const formatRate = (val, text) =>
    typeof val === 'number' ? `${val} XP ${text}` : 'Not set';

  // Back button
  const backButton = (() => {
    const from = location.state?.from;
    if (from === 'leaderboard') {
      return {
        to: `/classroom/${classId}/leaderboard`,
        label: '← Back to Leaderboard',
      };
    } else if (from === 'people') {
      return {
        to: `/classroom/${classId}/people`,
        label: '← Back to People',
      };
    } else {
      return {
        to: `/classroom/${classId}/people`,
        label: '← Back to People',
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
    return <div className="p-6 text-center text-red-500">{error}</div>;
  }

  if (!stats || !stats.student) {
    return <div className="p-6 text-center">No stats available for this student</div>;
  }

  const studentDisplayName =
    stats.student.name || stats.student.email?.split('@')[0] || 'Student';

  return (
    <>
      <div className={`${themeClasses.cardBase} max-w-md mx-auto mt-10 space-y-6`}>
        <h1 className="text-2xl font-bold text-center">
          {studentDisplayName}&apos;s Stats
        </h1>

        {/* XP / Level Card */}
        {xpSettings?.isXPEnabled ? (
          <div className="card bg-white border border-green-200 shadow-sm rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="font-semibold">Level {xpState.level || 1}</div>

                {/* Info icon: XP Gain Rates for this classroom */}
                {xpSettings && (
                  <button
                    type="button"
                    onClick={() => setShowXpInfo(true)}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-gray-300 text-gray-600 text-[10px] hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300"
                    aria-label="Show XP Gain Rates for this classroom"
                  >
                    <Info className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* XP within this level / XP required for next level */}
              <div className="text-sm text-gray-600">
                {progress.currentXP} / {progress.required || progress.currentXP} XP
              </div>
            </div>
            <progress
              className="progress w-full"
              value={progress.pct}
              max="100"
            ></progress>

            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{progress.pct}% to next level</span>
              {progress.required > 0 && (
                <span>
                  {progress.xpRemaining} XP required for level{' '}
                  {(xpState.level || 1) + 1}
                </span>
              )}
            </div>

            <div className="text-xs text-gray-500 mt-1">
              Total XP earned: {progress.totalXP}
            </div>
          </div>
        ) : xpSettings ? (
          <div className="alert alert-info text-sm">
            XP &amp; Leveling is currently disabled by your teacher.
          </div>
        ) : null}

        {/* View Badge Collection button */}
        <div className="flex justify-center mt-4">
          <button
            onClick={handleViewBadges}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition-transform duration-150 active:scale-95"
          >
            View Badge Collection ({badgeCount})
          </button>
        </div>

        {/* Radar chart */}
        <div className="flex justify-center">
          <StatsRadar
            isDark={isDark}
            stats={{
              multiplier: stats.multiplier || stats.student?.multiplier || 1,
              groupMultiplier:
                stats.groupMultiplier ?? stats.student?.groupMultiplier ?? 1,
              luck: stats.luck || stats.student?.luck || 1,
              attackPower: stats.attackPower || stats.student?.attackPower || 0,
              shieldCount: stats.shieldCount || stats.student?.shieldCount || 0,
              discountShop:
                stats.discountShop || stats.student?.discountShop || 0,
            }}
          />
        </div>

        {/* stats list */}
        <div className="stats stats-vertical shadow w-full">
          <div className="stat">
            <div className="stat-figure text-secondary">⚔️</div>
            <div className="stat-title">Attack Bonus</div>
            <div className="stat-value">{stats.attackPower || 0}</div>
          </div>

          <div className="stat">
            <div className="stat-figure text-secondary">🛡</div>
            <div className="stat-title">Shield</div>
            <div className="stat-value">
              {stats.shieldActive ? `Active x${stats.shieldCount}` : 'Inactive'}
            </div>
          </div>

          <div className="stat">
            <div className="stat-figure text-secondary">✖️</div>
            <div className="stat-title">Multiplier</div>
            <div className="stat-value">
              x{Number(stats.multiplier || stats.student?.multiplier || 1).toFixed(1)}
            </div>
          </div>

          {groupMultiplierValue > 1 && (
            <div className="stat">
              <div className="stat-figure text-secondary">👥</div>
              <div className="stat-title">Group Multiplier</div>
              <div className="stat-value">
                x{groupMultiplierValue.toFixed(1)}
              </div>
              <div className="stat-desc">Includes group bonus</div>
            </div>
          )}

          <div className="stat">
            <div className="stat-figure text-secondary">🏷️</div>
            <div className="stat-title">Discount</div>
            <div className="stat-value">
              {stats.discount > 0 ? `${stats.discount}%` : 'None'}
            </div>
            {stats.discount > 0 && (
              <div className="stat-desc">Active in bazaar</div>
            )}
          </div>

          <div className="stat">
            <div className="stat-figure text-secondary">🍀</div>
            <div className="stat-title">Luck</div>
            <div className="stat-value">x{stats.luck || 1}</div>
          </div>
        </div>

        {classId ? (
          <Link to={backButton.to} className="btn btn-outline w-full">
            {backButton.label}
          </Link>
        ) : (
          <button
            disabled
            className="btn btn-outline w-full opacity-50 cursor-not-allowed"
          >
            ← No Classroom Context
          </button>
        )}
      </div>

      {showXpInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className={`${themeClasses.cardBase} w-[90%] max-w-md p-4 rounded-2xl shadow-lg`}>
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
              XP Gain Rates
            </h2>
            <p className="text-xs text-base-content/70 mb-3">
              These XP rewards are specific to this classroom.
            </p>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Bit Earned</span>
                  {formatRate(xpRates?.perBitEarned, 'per bit earned')}
              </div>

              <div className="flex justify-between">
                <span>Bit Spent</span>
                  {formatRate(xpRates?.perBitSpent, 'per bit spent')}
              </div>

              <div className="flex justify-between">
                <span>Stat Increase</span>
                  {formatRate(xpRates?.perStatIncrease, 'per stat boost')}
              </div>

              <div className="flex justify-between">
                <span>Daily Check-in Limit</span>
                  {typeof xpRates?.dailyCheckInLimit === 'number'
                    ? `${xpRates.dailyCheckInLimit} XP earned per day`
                    : 'Not set'}
              </div>

              <div className="flex justify-between">
                <span>Group Join</span>
                  {formatRate(xpRates?.groupJoin, 'for joining groups (one-time)')}
              </div>

              <div className="flex justify-between">
                <span>Challenge Completion</span>
                  {formatRate(xpRates?.challenge, 'per challenge')}
              </div>

              <div className="flex justify-between">
                <span>Mystery Box Use</span>
                  {formatRate(xpRates?.mysteryBoxUse, 'per mystery box use')}
              </div>
            </div>

            <button
              className="btn btn-sm btn-success w-full mt-4"
              onClick={() => setShowXpInfo(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
};

export default StudentStats;
