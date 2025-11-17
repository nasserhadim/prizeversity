import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Coins, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import socket from '../utils/socket';
import apiLeaderboard from '../API/apiLeaderboard.js';
import apiClassroom from '../API/apiClassroom.js';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';

const Leaderboard = () => {
  const { classId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [students, setStudents] = useState([]);
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('balance');
  const [sortDirection, setSortDirection] = useState('desc');
  const [studentsCanViewStats, setStudentsCanViewStats] = useState(true);

  const getDisplayName = (student) => {
    if (student.firstName || student.lastName) {
      return `${student.firstName || ''} ${student.lastName || ''}`.trim();
    }
    return student.email;
  };

  // pull level/xp from either flattened fields or nested stats
  const getLevel = (student) => student.level ?? student.stats?.level ?? 0;
  const getXP = (student) => student.xp ?? student.stats?.xp ?? 0;

  // data fetchers
  const fetchClassroom = async () => {
    try {
      const response = await apiClassroom.get(`/${classId}`);
      setClassroom(response.data);
      // default true; if explicitly false, hide stats from students
      setStudentsCanViewStats(response.data.studentsCanViewStats !== false);
    } catch (err) {
      console.error('Failed to fetch classroom:', err);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await apiLeaderboard.get(`/${classId}/leaderboard`);
      const sorted = [...res.data].sort(
        (a, b) => (Number(b?.xp) || 0) - (Number(a?.xp) || 0)
      );
      setStudents(sorted);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchClassroom();
    fetchLeaderboard();
  }, [classId]);

  // Real-time updates
  useEffect(() => {
    const onBalance = () => fetchLeaderboard();

    const onClassroom = (updatedClassroom) => {
      // Only react to this classroom
      if (!updatedClassroom || String(updatedClassroom._id) !== String(classId)) return;
      setClassroom((prev) => ({ ...prev, ...updatedClassroom }));
      setStudentsCanViewStats(updatedClassroom.studentsCanViewStats !== false);
    };

    socket.on('balance_update', onBalance);
    socket.on('classroom_update', onClassroom);

    return () => {
      socket.off('balance_update', onBalance);
      socket.off('classroom_update', onClassroom);
    };
  }, [classId]);

  // Filter + sort
  const filteredStudents = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filtered = students.filter((s) =>
      getDisplayName(s).toLowerCase().includes(term)
    );
    const dir = sortDirection === 'asc' ? 1 : -1;

    return filtered.sort((a, b) => {
      if (sortField === 'name') {
        return dir * getDisplayName(a).localeCompare(getDisplayName(b));
      }
      if (sortField === 'level') {
        return dir * (getLevel(a) - getLevel(b));
      }
      if (sortField === 'xp') {
        return dir * (getXP(a) - getXP(b));
      }
      // default balance
      return dir * ((a.balance ?? 0) - (b.balance ?? 0));
    });
  }, [students, searchTerm, sortField, sortDirection]);

  // Everyone can sort by any visible column now
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown size={14} className="opacity-50" />;
    return sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-grow p-6 max-w-4xl mx-auto w-full">
        <h1 className="text-3xl font-bold text-center mb-6">
          {classroom
            ? `${classroom.name}${classroom.code ? ` (${classroom.code})` : ''} Leaderboard`
            : 'Classroom Leaderboard'}
        </h1>

        {/* Search and Controls */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search
              size={20}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-base-content/50"
            />
            <input
              type="text"
              placeholder="Search students..."
              className="input input-bordered w-full pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-sm text-base-content/70">
            Showing {filteredStudents.length} of {students.length} students
          </div>
        </div>

        {loading ? (
          <div className="text-center">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full bg-base-100 shadow-md rounded-lg">
              <thead>
                <tr className="bg-base-200 text-base font-semibold">
                  <th>#</th>
                  <th>
                    <button
                      className="flex items-center gap-2 hover:text-primary transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      Name {getSortIcon('name')}
                    </button>
                  </th>

                  {/* Level + XP visible for everyone now */}
                  <th className="w-36">
                    <button
                      className="flex items-center gap-2 hover:text-primary"
                      onClick={() => handleSort('level')}
                    >
                      Level {getSortIcon('level')}
                    </button>
                  </th>
                  <th className="w-36">
                    <button
                      className="flex items-center gap-2 hover:text-primary"
                      onClick={() => handleSort('xp')}
                    >
                      XP {getSortIcon('xp')}
                    </button>
                  </th>

                  <th className="w-[220px]">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center py-8 text-base-content/50"
                    >
                      {searchTerm
                        ? 'No students found matching your search.'
                        : 'No students in this classroom yet.'}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student, index) => {
                    const role = (user?.role || '').toLowerCase();
                    const isSelf = String(student._id) === String(user?._id);

                    // Match People.jsx behavior:
                    // the teacher/admin always see stats
                    // student can always see their own stats
                    // student can see others only if toggle is ON in the people-> settings page
                    const canViewStats =
                      role === 'teacher' ||
                      role === 'admin' ||
                      isSelf ||
                      (role === 'student' && studentsCanViewStats && !isSelf);

                    return (
                      <tr key={student._id} className="hover">
                        <td>
                          <div className="flex items-center gap-2">
                            {index + 1}
                            {index === 0 && <span className="text-yellow-500">🥇</span>}
                            {index === 1 && <span className="text-gray-400">🥈</span>}
                            {index === 2 && <span className="text-orange-600">🥉</span>}
                          </div>
                        </td>

                        <td className="font-medium">
                          <div className="flex items-center gap-2">
                            <Avatar user={student} size={28} />
                            {getDisplayName(student)}
                          </div>
                        </td>

                        {/* Level and the XP values for everyone */}
                        <td className="whitespace-nowrap">
                          <span className="font-semibold">Level {getLevel(student) || 0}</span>
                        </td>
                        <td className="whitespace-nowrap">
                          <span className="font-semibold">{getXP(student) || 0} XP</span>
                        </td>

                        <td>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                              className="btn btn-xs sm:btn-sm btn-outline whitespace-nowrap"
                              onClick={() =>
                                navigate(`/classroom/${classId}/profile/${student._id}`, {
                                  state: { from: 'leaderboard', classroomId: classId },
                                })
                              }
                            >
                              View Profile
                            </button>

                            {canViewStats && (
                              <button
                                className="btn btn-xs sm:btn-sm btn-success whitespace-nowrap"
                                onClick={() => {
                                  navigate(`/classroom/${classId}/student/${student._id}/stats`, {
                                    state: { from: 'leaderboard' },
                                  });
                                }}
                              >
                                View Stats
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Leaderboard;
