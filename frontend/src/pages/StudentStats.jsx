import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LoaderIcon } from 'lucide-react';

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
  const [xpRefresh] = useState(false); // keep in case you want manual refresh later

  // XP summary from backend (single source of truth)
  const [xpSummary, setXpSummary] = useState(null);

  // Precompute group multiplier for rendering
  const groupMultiplierValue = Number(
    stats?.groupMultiplier ?? stats?.student?.groupMultiplier ?? 1
  );

  // Go to the *student-specific* badge page now
  const handleViewBadges = () => {
    if (!classId || !studentId) return;
    navigate(`/classroom/${classId}/student/${studentId}/badges`, {
      state: {
        from: 'stats', // so badges page knows to go back to stats
      },
    });
  };

  // Fetch student stats + badge count
  useEffect(() => {
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

  // Fetch XP settings for this classroom (for isXPEnabled, etc.)
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

  // XP + the Level from XP summary (preferred) with fallback to student.classroomBalances
  const xpState = useMemo(() => {
    // Prefer the backend XP summary
    if (xpSummary && typeof xpSummary.level === 'number') {
      const totalXP =
        typeof xpSummary.totalXP === 'number'
          ? xpSummary.totalXP
          : typeof xpSummary.totalXp === 'number'
          ? xpSummary.totalXp
          : 0;
      return {
        level: xpSummary.level,
        xp: totalXP,
        XPStartLevel: xpSummary.XPStartLevel ?? 0,
        XPEndLevel: xpSummary.XPEndLevel ?? (xpSummary.nextLevelXP || 0),
        progressPercent: xpSummary.progressPercent ?? 0,
      };
    }

    // derive from student.classroomBalances if summary isn't available
    const student = stats?.student;
    if (!student) {
      return { level: 1, xp: 0, XPStartLevel: 0, XPEndLevel: 100, progressPercent: 0 };
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
      // Simple fallback progress if we don't know real thresholds
      return {
        level,
        xp,
        XPStartLevel: 0,
        XPEndLevel: 100,
        progressPercent: Math.max(0, Math.min(100, (xp / 100) * 100)),
      };
    }

    return { level: 1, xp: 0, XPStartLevel: 0, XPEndLevel: 100, progressPercent: 0 };
  }, [xpSummary, stats, classId, xpRefresh]);

  // Progress numbers for display: "have / need XP"
  const progress = useMemo(() => {
    const span = Math.max(1, (xpState.XPEndLevel ?? 0) - (xpState.XPStartLevel ?? 0));
    const have = (xpState.xp ?? 0) - (xpState.XPStartLevel ?? 0);
    const normalizedHave = Math.max(0, Math.min(span, have));
    const pct =
      typeof xpState.progressPercent === 'number'
        ? xpState.progressPercent
        : Math.round((normalizedHave / span) * 100);

    return {
      have: normalizedHave,
      need: span,
      pct: Math.max(0, Math.min(100, pct)),
    };
  }, [xpState]);

  // Determine where we came from to customize the back button
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

        {/* View Badge Collection button above radar */}
        <div className="flex justify-center mt-4">
          <button
            onClick={handleViewBadges}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition-transform duration-150 active:scale-95"
          >
            View Badge Collection ({badgeCount})
          </button>
        </div>

        {/* XP / Level Card */}
        {xpSettings?.isXPEnabled ? (
          <div className="card bg-white border border-green-200 shadow-sm rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="font-semibold">Level {xpState.level || 1}</div>
              <div className="text-sm text-gray-600">
                {progress.have} / {progress.need} XP
              </div>
            </div>
            <progress
              className="progress w-full"
              value={progress.pct}
              max="100"
            ></progress>
            <div className="text-xs text-gray-500 mt-1">
              {progress.pct}% to next level
            </div>
          </div>
        ) : xpSettings ? (
          <div className="alert alert-info text-sm">
            XP &amp; Leveling is currently disabled by your teacher.
          </div>
        ) : null}

        {/* radar + legend */}
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

          {/* ONLY render Group Multiplier when > 1 */}
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

      <Footer />
    </>
  );
};

export default StudentStats;
