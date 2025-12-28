import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext'; // <-- added import
import axios from 'axios';
import socket from '../utils/socket.js';
import {
  LoaderIcon,
  RefreshCw,
  TrendingUp,
  Info,
} from 'lucide-react'; // Removed Award import
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
  const [xpPopoverOpen, setXPPopoverOpen] = useState(false);
  const popoverRef = useRef(null);
  // Precompute group multiplier for rendering
  const groupMultiplierValue = Number(stats?.groupMultiplier ?? stats?.student?.groupMultiplier ?? 1);

  // NEW: normalized/pretty display for Luck
  const luckValue = Number(stats?.luck ?? stats?.student?.luck ?? 1);
  const displayLuck = Number.isFinite(luckValue) ? luckValue.toFixed(1) : '1.0';

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

  useEffect(() => {
    const onDocClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setXPPopoverOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setXPPopoverOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // Replace the old buildXPInfoTip string builder with a JSX popover renderer
  const renderXPPopoverContent = () => {
    if (!classroom || !classroom.xpSettings) {
      return <div className="text-sm">XP info not available.</div>;
    }
    const s = classroom.xpSettings;
    if (!s.enabled) {
      return <div className="text-sm">XP system is disabled in this classroom.</div>;
    }

    return (
      <div className="text-sm space-y-3 max-w-sm">  {/* { changed code } */}
        <div>
          <strong>Total cumulative XP</strong>
          <div className="text-xs text-base-content/70">Total cumulative XP earned in this classroom (includes all prior levels).</div>
        </div>

        <div>
          <div className="font-semibold">Configured values for earning XP</div>
          <ul className="list-disc ml-4 mt-1 space-y-1">
            <li>Bits Earned: <strong>{s.bitsEarned ?? 0}</strong> XP per bit (balance adjustments)</li>
            <li>Bits Spent: <strong>{s.bitsSpent ?? 0}</strong> XP per bit (bazaar purchases)</li>
            <li>Stat Increase: <strong>{s.statIncrease ?? 0}</strong> XP per stat (boosts/increases)</li>
            <li>Challenge Completion: <strong>{s.challengeCompletion ?? 0}</strong> XP</li>
            <li>Daily Check‑in: <strong>{s.dailyCheckIn ?? 0}</strong> XP</li>
            <li>Mystery Box: <strong>{s.mysteryBox ?? 0}</strong> XP</li>
            <li>Group Join: <strong>{s.groupJoin ?? 0}</strong> XP (one‑time per GroupSet)</li>
            <li>Feedback Submission: <strong>{s.feedbackSubmission ?? 0}</strong> XP</li>
            <li>Bits→XP Basis: <strong>{s.bitsXPBasis === 'base' ? 'Base (before multipliers)' : 'Final (after multipliers)'}</strong></li>
          </ul>
        </div>

        <div>
          <div className="font-semibold">Applicability notes</div>
          <ul className="list-disc ml-4 mt-1 space-y-1 text-xs">
            <li>Bits earned includes Teacher or Admin/TA balance adjustments, challenge rewards, attack gains, and feedback bit rewards (if enabled).</li>
            <li>Bits Spent applies to intentional spending (i.e. bazaar purchases) and does NOT include balance debits such as wallet transfers or siphons/attacks.</li>
            <li>Certain bit awards (e.g., balance adjustments or feedback bit rewards if enabled) may yield more XP depending on multipliers and the Bits→XP basis setting.</li>
          </ul>
        </div>

        <div className="text-right">
          <button className="btn btn-ghost btn-sm" onClick={() => setXPPopoverOpen(false)}>Close</button>
        </div>
      </div>
    );
  };

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

  // Add a stat help text map near the top of the file
  const STAT_HELP = {
    attackPower: 'Bazaar items that let students target others’ stats (e.g., drain, swap, nullify) to gain advantage.',
    shield: 'Protects against attack effects; shields are stackable and consumed when triggered.',
    multiplier: 'Boosts earnings from classroom rewards; higher multiplier means faster bit/XP growth.',
    groupMultiplier: 'Adds additional earning scaling based on group size; applies when enabled by the teacher.',
    discountShop: 'Reduces purchase prices in the classroom Bazaar, stretching bits further.',
    luck: 'Improves chances for better outcomes in activities like Mystery Box.',
  };

  // Helper to render a title with an Info tooltip
  const StatTitle = ({ children, statKey }) => (
    <div className="flex items-center gap-1">
      <span>{children}</span>
      <span
        className="tooltip tooltip-bottom"
        data-tip={STAT_HELP[statKey] || ''}
        aria-label={STAT_HELP[statKey] || ''}
      >
        <Info size={14} className="inline-block text-base-content/60 cursor-help" />
      </span>
    </div>
  );

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
                    <span className="relative inline-block ml-2" ref={popoverRef}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs p-0"
                        onClick={(e) => { e.stopPropagation(); setXPPopoverOpen((v) => !v); }}
                        aria-expanded={xpPopoverOpen}
                        aria-haspopup="dialog"
                        title="XP details"
                      >
                        <Info size={16} className="inline-block text-base-content/60" />
                      </button>

                      {xpPopoverOpen && (
                        <div
                          className="absolute top-full mt-2 z-50"
                          style={{ left: '50%', transform: 'translateX(-38%)' }} // { changed code }
                        >
                          <div className={`${themeClasses.cardBase} p-4 rounded shadow-lg w-96 max-w-[92vw]`}>
                            {renderXPPopoverContent()}
                          </div>
                        </div>
                      )}
                    </span>
                  </p>
                </div>

                {/*
                  Compute percent using server progress, with a correct local fallback.
                */}
                {(() => {
                  const nlp = xpData?.nextLevelProgress || {};
                  // Prefer server-calculated progress (already floors)
                  let pct = Number.isFinite(nlp.progress) ? Number(nlp.progress) : undefined;

                  if (!Number.isFinite(pct)) {
                    // Fallback: per-level progress, floor and clamp to 99% until reached
                    const xp = Number(xpData?.xp ?? 0);
                    const cur = Number(nlp.xpForCurrentLevel ?? 0);
                    const next = Number(nlp.xpForNextLevel ?? 0);
                    const inLevel = Math.max(0, xp - cur);
                    const required = Math.max(1, next - cur);
                    pct = Math.floor((inLevel / required) * 100);
                    pct = Math.max(0, Math.min(pct, xp >= next ? 100 : 99));
                  }

                  const xpNeeded = Math.max(0, Number(nlp.xpForNextLevel ?? 0) - Number(xpData?.xp ?? 0));
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
            <div className="stat-figure text-secondary">⚔️</div>
            <div className="stat-title">
              <StatTitle statKey="attackPower">Attack Bonus</StatTitle>
            </div>
            <div className="stat-value">{stats.attackPower || 0}</div>
          </div>

          <div className="stat">
            <div className="stat-figure text-secondary">🛡</div>
            <div className="stat-title">
              <StatTitle statKey="shield">Shield</StatTitle>
            </div>
            <div className="stat-value">
              {stats.shieldActive ? `Active x${stats.shieldCount}` : 'Inactive'}
            </div>
          </div>

          <div className="stat">
            <div className="stat-figure text-secondary">✖️</div>
            <div className="stat-title">
              <StatTitle statKey="multiplier">Multiplier</StatTitle>
            </div>
            <div className="stat-value">
              x{Number(stats.multiplier || stats.student?.multiplier || 1).toFixed(1)}
            </div>
          </div>

          {/* ONLY render Group Multiplier when > 1 */}
          {groupMultiplierValue > 1 && (
            <div className="stat">
              <div className="stat-figure text-secondary">👥</div>
              <div className="stat-title">
                <StatTitle statKey="groupMultiplier">Group Multiplier</StatTitle>
              </div>
              <div className="stat-value">
                x{Number(groupMultiplierValue).toFixed(1)}
              </div>
              <div className="text-xs text-base-content/60">Includes group bonus</div>
            </div>
          )}

          <div className="stat">
            <div className="stat-figure text-secondary">🏷️</div>
            <div className="stat-title">
              <StatTitle statKey="discountShop">Discount</StatTitle>
            </div>
            <div className="stat-value">
              {Number(stats.discountShop || stats.student?.discountShop || 0) > 0
                ? `${Number(stats.discountShop || stats.student?.discountShop || 0)}%`
                : 'None'}
            </div>
          </div>

          <div className="stat">
            <div className="stat-figure text-secondary">🍀</div>
            <div className="stat-title">
              <StatTitle statKey="luck">Luck</StatTitle>
            </div>
            <div className="stat-value">x{displayLuck}</div>
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
