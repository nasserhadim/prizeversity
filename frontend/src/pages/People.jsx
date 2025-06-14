import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const People = () => {
  const { id: classroomId } = useParams();
  const { user } = useAuth();

  const [tab, setTab] = useState('everyone'); // 'everyone' or 'groups'
  const [students, setStudents] = useState([]);
  const [groupSets, setGroupSets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('default');

  const navigate = useNavigate();


  useEffect(() => {
    fetchStudents();
    fetchGroupSets();
  }, [classroomId]);

  /* The following features will fetch the students and the groups for the specific classrooms */

  const fetchStudents = async () => {
    try {
      const res = await axios.get(`/api/classroom/${classroomId}/students`);
      setStudents(res.data);
    } catch (err) {
      console.error('Failed to fetch students', err);
    }
  };

  const fetchGroupSets = async () => {
    try {
      const res = await axios.get(`/api/group/groupset/classroom/${classroomId}`);
      setGroupSets(res.data);
    } catch (err) {
      console.error('Failed to fetch group sets', err);
    }
  };

  const filteredStudents = [...students]
  .filter((student) => {
    const name = (student.firstName || student.name || '').toLowerCase();
    const email = (student.email || '').toLowerCase();
    return (
      name.includes(searchQuery.toLowerCase()) ||
      email.includes(searchQuery.toLowerCase())
    );
  })
  .sort((a, b) => {
    if (sortOption === 'balanceDesc') {
      return (b.balance || 0) - (a.balance || 0);
    } else if (sortOption === 'nameAsc') {
      const nameA = (a.firstName || a.name || '').toLowerCase();
      const nameB = (b.firstName || b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    }
    return 0;
  });


  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">People</h1>

      <div className="flex space-x-4 mb-6">
        <button
          className={`btn ${tab === 'everyone' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setTab('everyone')}
        >
          Everyone
        </button>
        <button
          className={`btn ${tab === 'groups' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setTab('groups')}
        >
          Groups
        </button>
      </div>

      {/* Everyone Tab */}
      {tab === 'everyone' && (
        <div>
          {/* Search + Sort Controls */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <input
              type="text"
              placeholder="Search by name or email..."
              className="input input-bordered w-full md:w-1/2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <select
              className="select select-bordered"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
            >
              <option value="default">Sort By</option>
              <option value="balanceDesc">Balance (High → Low)</option>
              <option value="nameAsc">Name (A → Z)</option>
            </select>
          </div>

          <div className="space-y-2">
            {filteredStudents.length === 0 ? (
              <p>No matching students found.</p>
            ) : (
              filteredStudents.map((student) => (
                <div
                  key={student._id}
                  className="border p-3 rounded shadow flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium text-lg">
                      {student.firstName || student.lastName
                        ? `${student.firstName || ''} ${student.lastName || ''}`.trim()
                        : student.name || student.email}
                      <span className="ml-2 text-gray-600 text-sm">– Role: {student.role}</span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Balance: B{student.balance?.toFixed(2) || '0.00'} <br />
                      Classes:{' '}
                      {student.classrooms?.length > 0
                        ? student.classrooms.map((c) => c.name).join(', ')
                        : 'N/A'}
                    </div>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => navigate(`/profile/${student._id}`)}
                      >
                        View Profile
                      </button>
                      {user?.role === 'teacher' && student.role === 'student' && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={async () => {
                            try {
                              await axios.post(
                                `/api/users/${student._id}/make-admin`,
                                {},
                                { withCredentials: true }
                              );
                              alert('Student promoted to admin');
                              fetchStudents(); // Refresh list
                            } catch (err) {
                              console.error('Failed to promote student', err);
                              alert('Error promoting student');
                            }
                          }}
                        >
                          Make Admin
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Groups Tab */}
      {tab === 'groups' && (
        <div className="space-y-6">
          {groupSets.length === 0 ? (
            <p>No groups available yet.</p>
          ) : (
            groupSets.map((gs) => (
              <div key={gs._id}>
                <h2 className="text-xl font-semibold">{gs.name}</h2>
                <div className="ml-4 mt-2 space-y-4">
                  {gs.groups.map((group) => (
                    <div key={group._id} className="border p-4 rounded">
                      <h3 className="text-lg font-bold">{group.name}</h3>
                      {group.members.length === 0 ? (
                        <p className="text-gray-500">No members</p>
                      ) : (
                        <ul className="list-disc ml-5 space-y-1">
                          {group.members.map((m) => (
                            <li key={m._id._id} className="flex justify-between items-center">
                              <span>
                                {m._id.firstName || m._id.lastName
                                  ? `${m._id.firstName || ''} ${m._id.lastName || ''}`.trim()
                                  : m._id.name || m._id.email}
                              </span>
                              <button
                                className="btn btn-sm btn-outline ml-4"
                                onClick={() => navigate(`/profile/${m._id._id}`)}
                              >
                                View Profile
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default People;