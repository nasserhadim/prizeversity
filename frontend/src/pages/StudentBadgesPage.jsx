import React, { useEffect, useState } from 'react';
import { getUserBadges } from '../api/apiBadges';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';



const StudentBadgesPage = ({ classroomId, studentId }) => {
  const { user } = useAuth();
  const { theme } = useContext(ThemeContext);
  const location = useLocation();
  const navigate = useNavigate();
  const from = location.state?.from || 'people';
  const [classroom, setClassroom] = useState(null);
  const [badgeData, setBadgeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewedStudent, setViewedStudent] = useState(null);

  useEffect(() => {
    const fetchStudentInfo = async () => {
      if (!studentId) return;
      try {
        // Try the main users route first
        const res = await axios.get(`/api/users/${studentId}`, { withCredentials: true });
        setViewedStudent(res.data);
      } catch (err1) {
        try {
          const resAlt = await axios.get(`/api/user/${studentId}`, { withCredentials: true });
          setViewedStudent(resAlt.data);
        } catch (err2) {
          console.error("Failed to fetch student info:", err2);
        }
      }
    };
    fetchStudentInfo();
  }, [studentId]);



  useEffect(() => {
    const fetchData = async () => {
      try {
        const targetUserId = studentId || user?._id;
        if (!classroomId || !targetUserId) return;

        // Get classroom info
        const classRes = await axios.get(`/api/classroom/${classroomId}`);
        setClassroom(classRes.data);

        // Get earned and locked badges from XP route
        const res = await getUserBadges(targetUserId, classroomId);
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
      {/* Dynamic Back Link */}
      <div className="mb-4">
        <button
          onClick={() =>
            navigate(
              from === 'leaderboard'
                ? `/classroom/${classroomId}/leaderboard`
                : `/classroom/${classroomId}/people`
            )
          }
          className="text-blue-600 hover:underline flex items-center gap-1"
        >
          ← Back to {from === 'leaderboard' ? 'Leaderboard' : 'People'}
        </button>
      </div>
      {/* Header */}
      <h2 className="text-xl font-bold mb-1">Badge Collection</h2>
      {classroom && (
        <p className="text-gray-600 mb-4">
          {classroom?.name} ({classroom?.code}) —{' '}
          {viewedStudent
            ? viewedStudent.name ||
              `${viewedStudent.firstName || ''} ${viewedStudent.lastName || ''}`.trim() ||
              viewedStudent.email?.split('@')[0] ||
              'Unknown Student'
            : `${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
        </p>
      )}

      {/* Summary Box */}
      <div
        className="
          stats
          flex flex-row justify-start items-stretch
          bg-base-100 text-base-content
          border border-base-300 shadow-md rounded-xl
          mb-10 w-full max-w-5xl
        "
      >
        <div className="stat flex-1 px-8 py-6">
          <div className="stat-title text-lg font-semibold">
            Badges Earned
          </div>
          <div className="stat-value text-xl font-bold text-success mt-1">
            {earnedCount}
          </div>
        </div>

        <div className="stat flex-1 px-8 py-6 border-l border-base-300">
          <div className="stat-title text-lg font-semibold">
            Total Badges
          </div>
          <div className="stat-value text-xl font-bold mt-1">
            {totalBadges}
          </div>
        </div>

        <div className="stat flex-1 px-8 py-6 border-l border-base-300">
          <div className="stat-title text-lg font-semibold">
            Completion
          </div>
          <div className="stat-value text-xl font-bold mt-1">
            {completion}%
          </div>
        </div>
      </div>

      {/* Earned Badges */}
      <h3 className="font-semibold mt-4 mb-2">
        Earned Badges ({earnedCount})
      </h3>
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
