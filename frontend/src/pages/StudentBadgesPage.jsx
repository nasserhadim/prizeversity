import React, { useEffect, useState } from 'react';
import { getUserBadges } from '../api/apiBadges';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const StudentBadgesPage = ({ classroomId }) => {
  const { user } = useAuth();
  const [classroom, setClassroom] = useState(null);
  const [badgeData, setBadgeData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!classroomId || !user?._id) return;

        // Get classroom info
        const classRes = await axios.get(`/api/classroom/${classroomId}`);
        setClassroom(classRes.data);

        // Get earned and locked badges from XP route
        const res = await getUserBadges(user._id, classroomId);
        setBadgeData(res);
      } catch (err) {
        console.error('Error fetching student badge data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [classroomId, user]);

  if (loading) return <p className="p-6">Loading badges...</p>;
  if (!badgeData) return <p className="p-6">No badge data available.</p>;

  const earnedBadges = badgeData.badges?.earned || [];
  const lockedBadges = badgeData.badges?.locked || [];
  const earnedCount = badgeData.badgesEarnedCount || 0;
  const totalBadges = badgeData.totalBadges || 0;
  const completion = badgeData.completionPercent || 0;

  return (
    <div className="p-6">

      {/* Header */}
      <h2 className="text-xl font-bold mb-1">Badge Collection</h2>
      {classroom && (
        <p className="text-gray-600 mb-4">
          {classroom.name} ({classroom.code}) — {user?.firstName} {user?.lastName}
        </p>
      )}

      {/* Summary Box */}
      <div className="grid grid-cols-3 divide-x border rounded-md mb-6">
        <div className="text-center py-2">
          <p className="font-semibold">Badges Earned</p>
          <p>{earnedCount}</p>
        </div>
        <div className="text-center py-2">
          <p className="font-semibold">Total Badges</p>
          <p>{totalBadges}</p>
        </div>
        <div className="text-center py-2">
          <p className="font-semibold">Completion</p>
          <p>{completion}%</p>
        </div>
      </div>

      {/* Earned Badges */}
      <h3 className="font-semibold mb-2">Earned Badges ({earnedCount})</h3>
      {earnedBadges.length === 0 ? (
        <p className="text-gray-500 mb-6">No badges earned yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {earnedBadges.map((badge) => (
            <div
              key={badge._id}
              className="border rounded-md p-3 shadow bg-green-100 border-green-400"
            >
              <p className="text-lg font-bold">
                {badge.icon || '🏅'} {badge.name}
              </p>
              <p className="text-sm text-gray-700">{badge.description}</p>
              <p className="text-sm mt-1">Level {badge.levelRequired}</p>
              {badge.dateEarned && (
                <p className="text-xs text-gray-600 mt-1 italic">
                  Earned: {new Date(badge.dateEarned).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Locked Badges */}
      <h3 className="font-semibold mb-2">Locked Badges ({lockedBadges.length})</h3>
      {lockedBadges.length === 0 ? (
        <p className="text-gray-500">No locked badges remaining.</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {lockedBadges.map((badge) => (
            <div
              key={badge._id}
              className="border rounded-md p-3 shadow bg-gray-100 opacity-70 border-gray-400"
            >
              <p className="text-lg font-bold">
                {badge.icon || '🏅'} {badge.name}
              </p>
              <p className="text-sm text-gray-600">{badge.description}</p>
              <p className="text-sm mt-1">Level {badge.levelRequired} Required</p>
              <p className="text-gray-500 text-sm mt-1 flex items-center">🔒 Locked</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentBadgesPage;
