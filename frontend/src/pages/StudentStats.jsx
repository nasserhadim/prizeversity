// import React, { useState, useEffect, useContext, useMemo } from 'react';
// import { useParams, Link, useLocation } from 'react-router-dom';
// import { ThemeContext } from '../context/ThemeContext';
// import axios from 'axios';
// import socket from '../utils/socket.js';
// import { LoaderIcon, RefreshCw } from 'lucide-react';
// import Footer from '../components/Footer';
// import StatsRadar from '../components/StatsRadar'; // add
// import { getThemeClasses } from '../utils/themeUtils'; // add
// import { getUserBadges } from '../api/apiBadges';

// const StudentStats = () => {
//   const { classroomId, id: studentId } = useParams();
//   const location = useLocation();
//   const { theme } = useContext(ThemeContext); // <-- read theme
//   const isDark = theme === 'dark';
//   const themeClasses = getThemeClasses(isDark); // derive theme classes

//   const [stats, setStats] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState('');

//   // Precompute group multiplier for rendering
//   const groupMultiplierValue = Number(stats?.groupMultiplier ?? stats?.student?.groupMultiplier ?? 1);

//   // --- Badge Collection Modal State ---
// const [badgeModalOpen, setBadgeModalOpen] = useState(false);
// const [badgeData, setBadgeData] = useState(null);
// const [badgeLoading, setBadgeLoading] = useState(false);

//   // --- Function to open modal and fetch badges ---
//   const handleViewBadges = async () => {
//     if (!studentId || !classroomId) return;
//     setBadgeModalOpen(true);
//     setBadgeLoading(true);
//     try {
//       const res = await getUserBadges(studentId, classroomId);
//       setBadgeData(res);
//     } catch (err) {
//       console.error('Error fetching badge data:', err);
//     } finally {
//       setBadgeLoading(false);
//     }
//   };

// const { user } = useAuth();
// const [xpSettings, setXpSettings] = useState(null);
// const [xpRefresh, setXpRefresh] = useState(false);

// // Use the *student’s* classroom balance, not the logged-in user's
//   const myClassroomBalance = useMemo(() => {
//     const student = stats?.student;
//     if (!student) return { xp: 0, level: 1 };

//     const list = student.classroomBalances || [];
//     const found = list.find(cb => String(cb.classroom) === String(classroomId));
//     return found || { xp: 0, level: 1 };
//   }, [stats, classroomId, xpRefresh]);
//   }


//   const badgeRes = await getUserBadges(studentId, classroomId);
   

//   // Determine where we came from to customize the back button
//   const backButton = (() => {
//     const from = location.state?.from;
//     if (from === 'leaderboard') {
//       return { to: `/classroom/${classroomId}/leaderboard`, label: '← Back to Leaderboard' };
//     } else if (from === 'people') {
//       return { to: `/classroom/${classroomId}/people`, label: '← Back to People' };
//     } else {
//       return { to: `/classroom/${classroomId}/people`, label: '← Back to People' };
//     }
//   })();

//   if (loading) {
//     return (
//       <div className="flex items-center justify-center p-6">
//         <LoaderIcon className="animate-spin h-8 w-8" />
//       </div>
//     );
//   }

//   if (error) {
//     return <div className="p-6 text-center text-red-500">{error}</div>;
//   }

//   // Render message if no stats are available
//   if (!stats || !stats.student) {
//     return <div className="p-6 text-center">No stats available for this student</div>;
//     }

//   return (
//     <>
//       <div className={`${themeClasses.cardBase} max-w-md mx-auto mt-10 space-y-6`}>
//         <h1 className="text-2xl font-bold text-center">
//           {(stats.student.name || stats.student.email.split('@')[0])}'s Stats
//         </h1>

//         {/* View Badge Collection button above radar */}
//         <div className="flex justify-center mt-4">
//           <button
//             onClick={() =>
//               navigate(`/classroom/${classroomId}/badges?studentId=${studentId}`, {
//                 state: { from: location.state?.from || 'people' },
//               })
//             }
//             className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition-transform duration-150 active:scale-95"
//           >
//             View Badge Collection ({badgeCount})
//           </button>
//         </div>

//         {xpSettings?.isXPEnabled ? (
//           <div className="card bg-white border border-green-200 shadow-sm rounded-lg p-4">
//             <div className="flex items-center justify-between mb-1">
//               <div className="font-semibold">Level {myClassroomBalance.level}</div>
//               <div className="text-sm text-gray-600">
//                 {progress.have} / {progress.need} XP
//               </div>
//             </div>
//             <progress className="progress w-full" value={progress.pct} max="100"></progress>
//             <div className="text-xs text-gray-500 mt-1">{progress.pct}% to next level</div>
//           </div>
//         ) : xpSettings ? (
//           <div className="alert alert-info text-sm">
//             XP &amp; Leveling is currently disabled by your teacher.
//           </div>
//         ) : null}

//         {/* radar + legend */}
//         <div className="flex justify-center">
//           <StatsRadar
//             isDark={isDark}
//             stats={{
//               multiplier: stats.multiplier || stats.student?.multiplier || 1,
//               groupMultiplier: stats.groupMultiplier ?? stats.student?.groupMultiplier ?? 1,
//               luck: stats.luck || stats.student?.luck || 1,
//               attackPower: stats.attackPower || stats.student?.attackPower || 0,
//               shieldCount: stats.shieldCount || stats.student?.shieldCount || 0,
//               discountShop: stats.discountShop || stats.student?.discountShop || 0,
//             }}
//           />
//         </div>

//         {/* stats list */}
//         <div className="stats stats-vertical shadow w-full">
//           <div className="stat">
//             <div className="stat-figure text-secondary">⚔️</div>
//             <div className="stat-title">Attack Bonus</div>
//             <div className="stat-value">{stats.attackPower || 0}</div>
//           </div>

//           <div className="stat">
//             <div className="stat-figure text-secondary">🛡</div>
//             <div className="stat-title">Shield</div>
//             <div className="stat-value">
//               {stats.shieldActive ? `Active x${stats.shieldCount}` : 'Inactive'}
//             </div>
//           </div>

//           <div className="stat">
//             <div className="stat-figure text-secondary">✖️</div>
//             <div className="stat-title">Multiplier</div>
//             <div className="stat-value">
//               x{Number(stats.multiplier || stats.student?.multiplier || 1).toFixed(1)}
//             </div>
//           </div>

//           {/* ONLY render Group Multiplier when > 1 */}
//           {groupMultiplierValue > 1 && (
//             <div className="stat">
//               <div className="stat-figure text-secondary">👥</div>
//               <div className="stat-title">Group Multiplier</div>
//               <div className="stat-value">x{groupMultiplierValue.toFixed(1)}</div>
//               <div className="stat-desc">Includes group bonus</div>
//             </div>
//           )}

//           <div className="stat">
//             <div className="stat-figure text-secondary">🏷️</div>
//             <div className="stat-title">Discount</div>
//             <div className="stat-value">
//               {stats.discount > 0 ? `${stats.discount}%` : 'None'}
//             </div>
//             {stats.discount > 0 && <div className="stat-desc">Active in bazaar</div>}
//           </div>

//           <div className="stat">
//             <div className="stat-figure text-secondary">🍀</div>
//             <div className="stat-title">Luck</div>
//             <div className="stat-value">x{stats.luck || 1}</div>
//           </div>
//         </div>

//         {classroomId ? (
//           <Link to={backButton.to} className="btn btn-outline w-full">
//             {backButton.label}
//           </Link>
//         ) : (
//           <button disabled className="btn btn-outline w-full opacity-50 cursor-not-allowed">
//             ← No Classroom Context
//           </button>
//         )}
//       </div>

//       {/* Badge Collection Modal */}
//       {badgeModalOpen && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//           <div
//             className={`${
//               isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
//             } rounded-lg shadow-lg w-11/12 max-w-lg p-6 relative`}
//           >
//             {/* Close Button */}
//             <button
//               onClick={() => setBadgeModalOpen(false)}
//               className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
//             >
//               ✖
//             </button>

//             <h2 className="text-xl font-bold mb-4 text-center">Badge Collection</h2>

//             {badgeLoading ? (
//               <p className="text-center text-gray-500">Loading badges...</p>
//             ) : !badgeData ? (
//               <p className="text-center text-gray-500">No badge data found.</p>
//             ) : (
//               <div className="space-y-4">
//                 {badgeData.badges?.earned?.length > 0 ? (
//                   badgeData.badges.earned.map((badge) => (
//                     <div
//                       key={badge.id}
//                       className="border rounded-md p-3 shadow bg-green-100 border-green-400"
//                     >
//                       <p className="text-lg font-bold">
//                         {badge.icon || '🏅'} {badge.name}
//                       </p>
//                       <p className="text-sm text-gray-700">{badge.description}</p>
//                       <p className="text-sm mt-1">Level {badge.levelRequired} Required</p>
//                     </div>
//                   ))
//                 ) : (
//                   <p className="text-gray-500 text-center">No badges earned yet.</p>
//                 )}
//               </div>
//             )}
//           </div>
//         </div>
//       )}
//       <Footer />
//     </>
//   );
// };

// export default StudentStats;







import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { LoaderIcon } from 'lucide-react';

import { ThemeContext } from '../context/ThemeContext';
import socket from '../utils/socket.js';
import Footer from '../components/Footer';
import StatsRadar from '../components/StatsRadar';
import { getThemeClasses } from '../utils/themeUtils';
import { getUserBadges } from '../api/apiBadges';

const StudentStats = () => {
  const { classroomId, id: studentId } = useParams();
  const location = useLocation();
  const { theme } = useContext(ThemeContext); // <-- read theme
  const isDark = theme === 'dark';
  const themeClasses = getThemeClasses(isDark); // derive theme classes

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Precompute group multiplier for rendering
  const groupMultiplierValue = Number(
    stats?.groupMultiplier ?? stats?.student?.groupMultiplier ?? 1
  );

  // --- Badge Collection Modal State ---
const [badgeModalOpen, setBadgeModalOpen] = useState(false);
const [badgeData, setBadgeData] = useState(null);
const [badgeLoading, setBadgeLoading] = useState(false);

  // --- Function to open modal and fetch badges ---
  const handleViewBadges = async () => {
    if (!studentId || !classroomId) return;
    setBadgeModalOpen(true);
    setBadgeLoading(true);
    try {
      const res = await getUserBadges(studentId, classroomId);
      setBadgeData(res);
    } catch (err) {
      console.error('Error fetching badge data:', err);
    } finally {
      setBadgeLoading(false);
    }
  };

  // Auth and XP settings state
  const { user } = useAuth();
  const [xpSettings, setXpSettings] = useState(null);
  const [xpRefresh] = useState(false); // kept in case you want manual refresh later

  // ---- Fetch student stats + badge count ----
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const url = classroomId
          ? `/api/stats/student/${studentId}?classroomId=${classroomId}`
          : `/api/stats/student/${studentId}`;

        const res = await axios.get(url, { withCredentials: true });
        setStats(res.data);
        setError('');

        // badge count (no modal data here, just the number)
        try {
          const badgeRes = await getUserBadges(studentId, classroomId);
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
  }, [studentId, classroomId]);

  // ---- Fetch XP settings for this classroom ----
  useEffect(() => {
    if (!classroomId) return;
    (async () => {
      try {
        const r = await axios.get(`/api/xpSettings/${classroomId}`);
        setXpSettings(r.data || {});
      } catch (e) {
        console.error('Failed to load xpSettings', e);
        setXpSettings({});
      }
    })();
  }, [classroomId, xpRefresh]);

  // ---- XP + Level: ONLY use student.classroomBalances (source of truth for awardXP) ----
  const xpState = useMemo(() => {
    const student = stats?.student;
    if (!student) return { level: 1, xp: 0 };

    const list = Array.isArray(student.classroomBalances)
      ? student.classroomBalances
      : [];

    const cb = list.find(cb => String(cb.classroom) === String(classroomId));

    if (cb) {
      return {
        level:
          typeof cb.level === 'number' && !Number.isNaN(cb.level)
            ? cb.level
            : 1,
        xp:
          typeof cb.xp === 'number' && !Number.isNaN(cb.xp)
            ? cb.xp
            : 0,
      };
    }

    // fallback if no entry yet
    return { level: 1, xp: 0 };
  }, [stats, classroomId, xpRefresh]);

  // ---- Compute progress towards next level ----
  const progress = useMemo(() => {
    if (!xpSettings) return { need: 100, have: 0, pct: 0 };
    return computeProgress(myClassroomBalance.xp, myClassroomBalance.level, xpSettings);
  }, [myClassroomBalance, xpSettings]);

  // Determine where we came from to customize the back button
  const backButton = (() => {
    const from = location.state?.from;
    if (from === 'leaderboard') {
      return {
        to: `/classroom/${classroomId}/leaderboard`,
        label: '← Back to Leaderboard',
      };
    } else if (from === 'people') {
      return {
        to: `/classroom/${classroomId}/people`,
        label: '← Back to People',
      };
    } else {
      return {
        to: `/classroom/${classroomId}/people`,
        label: '← Back to People',
      };
    }
  })();

  // ---- Loading / error / empty states ----
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

  // ---- Render ----
  return (
    <>
      <div className={`${themeClasses.cardBase} max-w-md mx-auto mt-10 space-y-6`}>
        <h1 className="text-2xl font-bold text-center">
          {studentDisplayName}&apos;s Stats
        </h1>

        {/* View Badge Collection button above radar */}
        <div className="flex justify-center mt-4">
          <button
            onClick={() =>
              navigate(`/classroom/${classroomId}/badges?studentId=${studentId}`, {
                state: { from: location.state?.from || 'people' },
              })
            }
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

        {classroomId ? (
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

      {/* Badge Collection Modal */}
      {badgeModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            className={`${
              isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
            } rounded-lg shadow-lg w-11/12 max-w-lg p-6 relative`}
          >
            {/* Close Button */}
            <button
              onClick={() => setBadgeModalOpen(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            >
              ✖
            </button>

            <h2 className="text-xl font-bold mb-4 text-center">
              Badge Collection
            </h2>

            {badgeLoading ? (
              <p className="text-center text-gray-500">Loading badges...</p>
            ) : !badgeData ? (
              <p className="text-center text-gray-500">No badge data found.</p>
            ) : (
              <div className="space-y-4">
                {badgeData.badges?.earned?.length > 0 ? (
                  badgeData.badges.earned.map(badge => (
                    <div
                      key={badge.id}
                      className="border rounded-md p-3 shadow bg-green-100 border-green-400"
                    >
                      <p className="text-lg font-bold">
                        {badge.icon || '🏅'} {badge.name}
                      </p>
                      <p className="text-sm text-gray-700">
                        {badge.description}
                      </p>
                      <p className="text-sm mt-1">
                        Level {badge.levelRequired} Required
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center">
                    No badges earned yet.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <Footer />
    </>
  );
};

export default StudentStats;
