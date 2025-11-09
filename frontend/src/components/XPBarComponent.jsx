import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const XPBar = ({ userId, classroomId, xpRefresh }) => {
  const { user } = useAuth();
  const [totalXP, setTotalXP] = useState(0);
  const [level, setLevel] = useState(1);
  const [XPStartLevel, setXPStartLevel] = useState(0);
  const [XPEndLevel, setXPEndLevel] = useState(100);
  const [progressPercent, setProgressPercent] = useState(0);
  const previousLevel = useRef(1);

  useEffect(() => {
    // fetchXPData: gets computed summary from backend (keeps logic consistent)
    const fetchXPData = async () => {
      try {
        const res = await axios.get('/api/xp/summary', {
          params: { userId, classroomId },
        });

        const {
          totalXP: t = 0,
          level: newLevel = 1,
          XPStartLevel: start = 0,
          XPEndLevel: end = 100,
          progressPercent: pct = 0,
        } = res.data || {};

        // show toast only when a student levels up
        if (
          user?.role === 'student' &&
          newLevel > previousLevel.current &&
          previousLevel.current !== 1
        ) {
          toast.success(`🎉 Level Up! You reached Level ${newLevel}!`, {
            duration: 4000,
            style: { background: '#22c55e', color: '#fff', fontWeight: 'bold' },
          });
        }
        previousLevel.current = newLevel;

        setTotalXP(t);
        setLevel(newLevel);
        setXPStartLevel(start);
        setXPEndLevel(end);
        setProgressPercent(Math.max(0, Math.min(100, Number(pct) || 0)));
      } catch (err) {
        console.error('Error fetching XP summary:', err);
      }
    };

    if (userId && classroomId) fetchXPData();
  }, [userId, classroomId, xpRefresh, user?.role]);

  // xpWithinLevel: progress numerator to show current XP inside this level
  const xpWithinLevel = Math.max(0, totalXP - XPStartLevel);

  // levelSpan: this will show XP needed across this level
  const levelSpan = Math.max(1, XPEndLevel - XPStartLevel);

  return (
    <div className="flex flex-col items-center justify-center min-w-[150px]">
      {/* progress bar */}
      <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden">
        <div
          className="bg-yellow-400 h-2 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <p className="text-xs text-gray-700 mt-1 text-center">
        Lv. {level} — {xpWithinLevel}/{levelSpan} XP
      </p>
    </div>
  );
};

export default XPBar;