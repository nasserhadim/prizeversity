import { useEffect, useState } from 'react';
import axios from 'axios';

const XPBar = ({ userId, classroomId, xpRefresh }) => {
  const [xp, setXP] = useState(0);
  const [level, setLevel] = useState(1);
  const [xpNeeded, setXpNeeded] = useState(100);

  useEffect(() => {
    const fetchXPData = async () => {
      try {
        const res = await axios.get(`/api/users/${userId}/xp`);
        const user = res.data;

        // Find classroom-specific XP data
        const classroom = user.classroomBalances.find(
          c => c.classroom?.toString() === classroomId?.toString()
        );

        if (classroom) {
          setXP(classroom.xp || 0);
          setLevel(classroom.level || 1);
          setXpNeeded((classroom.level || 1) * 100);
        }
      } catch (err) {
        console.error('Error fetching XP data:', err);
      }
    };

    fetchXPData();
  }, [userId, classroomId, xpRefresh]);

  const progressPercent = Math.min((xp / xpNeeded) * 100, 100);

  return (
    <div style={{
      position: 'absolute',
      top: '70px',
      right: '20px',
      width: '200px',
      backgroundColor: '#ccc',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      <div
        style={{
          height: '12px',
          width: `${progressPercent}%`,
          backgroundColor: '#FFD700',
          transition: 'width 0.3s ease'
        }}
      />
      <p style={{
        margin: '5px 0 0 0',
        textAlign: 'center',
        fontSize: '13px',
        color: '#333'
      }}>
        Level {level} — {xp}/{xpNeeded} XP
      </p>
    </div>
  );
};

export default XPBar;
