import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext'; // <-- added import
import axios from 'axios';
import socket from '../utils/socket.js';
import { LoaderIcon, RefreshCw } from 'lucide-react';
import Footer from '../components/Footer';
import StatsRadar from '../components/StatsRadar'; // <-- add this import
import { getThemeClasses } from '../utils/themeUtils'; // <-- new import
import { useAuth } from '../context/AuthContext';
import { computeProgress } from '../utils/xp';


//HEADER-STYLE PROGRESS (matches top badge: need = base * level) ---
const computeHeaderProgress = (carryXP, level, settings = {}) => {
  const base = Number(settings?.baseXPLevel2 ?? 100);
  const lvl  = Math.max(1, Number(level) || 1);
  const need = base * lvl;                 // e.g., L2 => 200 when base=100
  const have = Math.max(0, Number(carryXP) || 0);
  const pct  = need > 0 ? (have / need) * 100 : 0;
  return {
    have,
    need,
    pct: Math.max(0, Math.min(100, pct))
  };
};


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
  

// Auth and XP settings state
  const { user } = useAuth();
  const [xpSettings, setXpSettings] = useState(null);
  const [xpRefresh, setXpRefresh] = useState(false);


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


  // useEffect(() => {
  //   if (!classroomId) return;
  //   (async () => {
  //     try {
  //       const r = await axios.get(`/api/xpSettings/${classroomId}`);
  //       setXpSettings(r.data || {});
  //     } catch (e) {
  //       console.error('Failed to load xpSettings', e);
  //       setXpSettings({});
  //     }
  //   })();
  // }, [classroomId, xpRefresh]);
    useEffect(() => {
      if (!classroomId) return;
      (async () => {
        try {
          // try public (read-only) first
          const r = await axios.get(`/api/xpSettings/${classroomId}/public`);
          setXpSettings(r.data || {});
        } catch (e1) {
          try {
            // fallback to teacher-only route if public not available
            const r2 = await axios.get(`/api/xpSettings/${classroomId}`);
            setXpSettings(r2.data || {});
          } catch (e2) {
            console.error('Failed to load xpSettings', e2);
            setXpSettings({});
          }
        }
      })();
    }, [classroomId, xpRefresh]);



  //find student balance for classroom 
  // const myClassroomBalance = useMemo(() => {
  //   const list = user?.classroomBalances || [];
  //   const found = list.find(cb => String(cb.classroom) === String(classroomId));
  //   return found || { xp: 0, level: 1 };
  // }, [user, classroomId, xpRefresh]);


  // use the viewed student's balance coming from backend stats
    const viewedBalance = useMemo(() => {
      if (stats?.classroomBalance) return stats.classroomBalance;

      // Fallback if backend only embeds balances on the student object
      const list = stats?.student?.classroomBalances || [];
      const found = list.find(cb => String(cb.classroom) === String(classroomId));
      return found || { xp: 0, level: 1 };
    }, [stats, classroomId, xpRefresh]);

  //compute progress towards next level
  // const progress = useMemo(() => {
  //   if (!xpSettings) return { need: 100, have: 0, pct: 0 };
  //   return computeProgress(myClassroomBalance.xp, myClassroomBalance.level, xpSettings);
  // }, [myClassroomBalance, xpSettings]);


//compute progress towards next level
    // const progress = useMemo(() => {
    //   if (!xpSettings) return { need: 100, have: 0, pct: 0 };
    //   return computeProgress(viewedBalance.xp, viewedBalance.level, xpSettings);
    // }, [viewedBalance, xpSettings]);
      const progress = useMemo(() => {
        if (!xpSettings) return { need: 100, have: 0, pct: 0 };
        // Use the same formula as the header badge
        return computeHeaderProgress(viewedBalance.xp, viewedBalance.level, xpSettings);
      }, [viewedBalance, xpSettings]);




  // Determine where we came from to customize the back button
  const backButton = (() => {
    const from = location.state?.from;
    if (from === 'leaderboard') {
      return {
        to: `/classroom/${classroomId}/leaderboard`,
        label: '← Back to Leaderboard'
        //test
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
          {/* Always show level/XP; banner simply informs if earning is disabled */}
          <div className="card bg-white border border-green-200 shadow-sm rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="font-semibold">
                Level {viewedBalance.level}
              </div>
              <div className="text-sm text-gray-600">
                {progress.have} / {progress.need} XP
              </div>
            </div>
            <progress className="progress progress-success w-full" value={Math.min(100, Math.max(0, Math.round(progress.pct)))} max="100"></progress>

            <div className="text-xs text-gray-500 mt-1">{Math.round(progress.pct)}% to next level</div>
          </div>

          {xpSettings && xpSettings.isXPEnabled === false && (
            <div className="alert alert-info text-sm">
              XP earning is currently disabled by your teacher (your level &amp; history remain visible).
            </div>
          )}
          
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
          <div className="stat">
            <div className="stat-figure text-secondary">
              🏷️
            </div>
            <div className="stat-title">Discount</div>
            <div className="stat-value">
              {Number(stats.discountShop || 0) > 0 ? `${stats.discountShop}%` : 'None'}
            </div>
            {Number(stats.discountShop || 0) > 0 && (
              <div className="stat-desc">Active in bazaar</div>
            )}
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
    
      <Footer />
    </>
  );
};

export default StudentStats;
