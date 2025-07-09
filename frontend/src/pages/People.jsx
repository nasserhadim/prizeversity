import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

const ROLE_LABELS = {
  student: 'Student',
  admin: 'TA',
  teacher: 'Teacher',
};

const People = () => {
  const { id: classroomId } = useParams();
  const { user } = useAuth();

  const [tab, setTab] = useState('everyone');
  const [students, setStudents] = useState([]);
  const [groupSets, setGroupSets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('default');

  const navigate = useNavigate();

  useEffect(() => {
    fetchStudents();
    fetchGroupSets();
  }, [classroomId]);

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

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      try {
        await axios.post(
          '/api/users/bulk-upload',
          { classroomId, users: jsonData },
          { withCredentials: true }
        );
        toast.success('Users uploaded successfully');
        fetchStudents();
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to upload users');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleExportToExcel = () => {
    const dataToExport = filteredStudents.map((student) => ({
      Name: `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.name || student.email,
      Email: student.email,
      Balance: student.balance?.toFixed(2) || '0.00',
      Role: ROLE_LABELS[student.role] || student.role,
      Classes: student.classrooms?.map((c) => c.name).join(', ') || 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'People');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, 'people.xlsx');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">People</h1>

      <div className="flex space-x-4 mb-6">
        <button
          className={`btn ${tab === 'everyone' ? 'btn-success' : 'btn-outline'}`}
          onClick={() => setTab('everyone')}
        >
          Everyone
        </button>
        <button
          className={`btn ${tab === 'groups' ? 'btn-success' : 'btn-outline'}`}
          onClick={() => setTab('groups')}
        >
          Groups
        </button>
      </div>

      {tab === 'everyone' && (
        <div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <input
              type="text"
              placeholder="Search by name or email..."
              className="input input-bordered w-full md:w-1/2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div className="flex gap-2 items-center">
              {user?.role === 'teacher' && (
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  className="file-input file-input-sm"
                  onChange={handleExcelUpload}
                />
              )}

              <button
                className="btn btn-sm btn-accent"
                onClick={handleExportToExcel}
              >
                Export to Excel
              </button>

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
                      <span className="ml-2 text-gray-600 text-sm">
                        – Role: {ROLE_LABELS[student.role] || student.role}
                      </span>
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

                      {user?.role === 'teacher' && (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => navigate(`/classroom/${classroomId}/student/${student._id}/stats`)}
                        >
                          View Stats
                        </button>
                      )}

                      {user?.role === 'teacher' && (
                        <select
                          className="select select-sm ml-2"
                          value={student.role}
                          onChange={async (e) => {
                            const newRole = e.target.value;
                            try {
                              if (newRole === 'admin') {
                                await axios.post(`/api/users/${student._id}/make-admin`);
                                toast.success('Student promoted to TA');
                              } else {
                                await axios.post(`/api/users/${student._id}/demote-admin`);
                                toast.success('TA demoted to Student');
                              }
                              fetchStudents();
                            } catch (err) {
                              toast.error(err.response?.data?.error || 'Error changing role');
                            }
                          }}
                        >
                          <option value="student">{ROLE_LABELS.student}</option>
                          <option value="admin">{ROLE_LABELS.admin}</option>
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

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

export default People;
