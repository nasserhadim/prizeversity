import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const XPBar = ({ userId, classroomId, xpRefresh }) => {
  const { user } = useAuth();
  const [xp, setXP] = useState(0);
  const [level, setLevel] = useState(1);
  const [xpNeeded, setXpNeeded] = useState(100);
  const previousLevel = useRef(1);

  useEffect(() => {
    const fetchXPData = async () => {
      try {
        const res = await axios.get(`/api/users/${userId}/xp`);
        const classroomBalances = res.data.classroomBalances || [];

        // Find classroom specific XP data
        const classroom = classroomBalances.find(
          c => c.classroom?.toString() === classroomId?.toString()
        );

        if (classroom) {
          setXP(classroom.xp || 0);
          const newLevel = classroom.level || 1;

           if (
            user?.role === 'student' &&
            newLevel > previousLevel.current &&
            previousLevel.current !== 1
          ) {
            toast.success(`🎉 Level Up! You reached Level ${newLevel}!`, {
              duration: 4000,
              style: {
                background: '#22c55e',
                color: '#fff',
                fontWeight: 'bold',
              },
            });
          }
          previousLevel.current = newLevel;

          setLevel(newLevel);
          setXpNeeded((newLevel || 1) * 100);
        } else {
          setXP(0);
          setLevel(1);
          setXpNeeded(100);
        }
      } catch (err) {
        console.error('Error fetching XP data:', err);
      }
    };

    fetchXPData();
  }, [userId, classroomId, xpRefresh]);

  const progressPercent = Math.min((xp / xpNeeded) * 100, 100);

  return (
    <div className="flex flex-col items-center justify-center min-w-[150px]">

      <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden">
        <div
          className="bg-yellow-400 h-2 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <p className="text-xs text-gray-700 mt-1 text-center">
        Lv. {level} — {xp}/{xpNeeded} XP
      </p>
    </div>
  );
};

export default XPBar;
