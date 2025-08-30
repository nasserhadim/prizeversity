import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import PendingApprovals from '../components/PendingApprovals';
import socket from '../utils/socket'; // Add this import
import Footer from '../components/Footer';


const ROLE_LABELS = {
  student: 'Student',
  admin: 'Admin/TA',
  teacher: 'Teacher',
};

const People = () => {
  // Get classroom ID from URL params
  const { id: classroomId } = useParams();
  const { user } = useAuth();
  const [studentSendEnabled, setStudentSendEnabled] = useState(null);
  const [tab, setTab] = useState('everyone');
  const [taBitPolicy, setTaBitPolicy] = useState('full');
  const [students, setStudents] = useState([]);
  const [groupSets, setGroupSets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('default');
  const [classroom, setClassroom] = useState(null); // Add classroom state

  const navigate = useNavigate();

  // Fetch classroom data
  const fetchClassroom = async () => {
    try {
      const res = await axios.get(`/api/classroom/${classroomId}`, {
        withCredentials: true,
      });
      setClassroom(res.data);
    } catch (err) {
      console.error('Failed to fetch classroom', err);
    }
  };

  // Fetch Admin/TA bit sending policy for classroom
  const fetchTaBitPolicy = async () => {
    try {
      const res = await axios.get(
        `/api/classroom/${classroomId}/ta-bit-policy`,
        { withCredentials: true }
      );
      setTaBitPolicy(res.data.taBitPolicy);
    } catch (err) {
      console.error('Failed to fetch Admin/TA bit policy', err);
    }
  };

  // Initial data fetch on classroomId change
  useEffect(() => {
    fetchClassroom(); // Add this line
    fetchStudents();
    fetchGroupSets();
    fetchTaBitPolicy();

    // Fetch if student send is enabled, with fallback default false
    axios
      .get(`/api/classroom/${classroomId}/student-send-enabled`, {
        withCredentials: true,
      })
     .then((r) => setStudentSendEnabled(!!r.data.studentSendEnabled))
      .catch(() => setStudentSendEnabled(false)); // safe default

      socket.on('classroom_update', (updatedClassroom) => {
        // Refresh student list when classroom updates
        fetchStudents();
        fetchClassroom(); // Also refresh classroom data
      });
      
      socket.on('user_profile_update', (data) => {
        // Update specific student in the list
        setStudents(prev => prev.map(student => 
          student._id === data.userId 
            ? { ...student, firstName: data.firstName, lastName: data.lastName }
            : student
        ));
      });
      
      return () => {
        socket.off('classroom_update');
        socket.off('user_profile_update');
      };
  }, [classroomId]);


// Fetch students with per-classroom balances
  const fetchStudents = async () => {
    try {
      const res = await axios.get(`/api/classroom/${classroomId}/students`, { withCredentials: true });
      setStudents(res.data); // Should include per-classroom balance
    } catch (err) {
      console.error('Failed to fetch students', err);
    }
  };

  // Fetch group sets for this classroom
  const fetchGroupSets = async () => {
    try {
      const res = await axios.get(`/api/group/groupset/classroom/${classroomId}`);
      setGroupSets(res.data);
    } catch (err) {
      console.error('Failed to fetch group sets', err);
    }
  };

  // Filter and sort students based on searchQuery and sortOption
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

    // Handle bulk user upload via Excel file
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

  // Export filtered students list to Excel file
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
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow p-6 w-full max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">
            {classroom ? `${classroom.name} People` : 'People'}
          </h1>
        </div>

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
          {user?.role?.toLowerCase() === 'teacher' && (                    
           <button
             className={`btn ${tab === 'settings' ? 'btn-success' : 'btn-outline'}`}
             onClick={() => setTab('settings')}
           >
             Settings
           </button>
         )}
        </div>
{/* ─────────────── Settings TAB ─────────────── */}
        {tab === 'settings' && (user?.role || '').toLowerCase() === 'teacher' && (
          <div className="w-full space-y-6 min-w-0">
             <h2 className="text-2xl font-semibold">Classroom Settings</h2>

            <label className="form-control w-full">
              <span className="label-text mb-2 font-medium">
                Admin/TA bit assignment
              </span>

              <select
                className="select select-bordered w-full"
                value={taBitPolicy ?? 'full'}
                onChange={async (e) => {
                  const newPolicy = e.target.value;
                  try {
                    await axios.patch(
                      `/api/classroom/${classroomId}/ta-bit-policy`,
                      { taBitPolicy: newPolicy },
                      { withCredentials: true }
                    );
                    toast.success('Updated Admin/TA bit policy');
                    setTaBitPolicy(newPolicy);
                  } catch (err) {
                    toast.error(
                      err.response?.data?.error || 'Failed to update policy'
                    );
                  }
                }}
              >
                <option value="full">① Full power (Admins/TAs can assign bits)</option>
                <option value="approval">② Needs teacher approval</option>
                <option value="none">③ Cannot assign bits</option>
              </select>
            </label>

             {/* render only after we know the value */}



    

          {/* Show teacher’s approval queue when policy=approval */}
    {taBitPolicy === 'approval' && (
      <PendingApprovals classroomId={classroomId} />
    )}
          </div>
        )}
        {/* ───────────────────────────────────────────── */}
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

              <div className="flex flex-wrap gap-2 items-center">
               {user?.role?.toLowerCase() === 'teacher' && (
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
                        Balance: B{student.balance?.toFixed(2) || '0.00'}
                      </div>

                      <div className="flex gap-2 mt-2 flex-wrap">
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => navigate(`/classroom/${classroomId}/profile/${student._id}`)}
                        >
                          View Profile
                        </button>

                        {(user?.role?.toLowerCase() === 'teacher' || 
                          user?.role?.toLowerCase() === 'admin' ||
                          (user?.role?.toLowerCase() === 'student' && String(student._id) === String(user._id))) && (
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => navigate(`/classroom/${classroomId}/student/${student._id}/stats`)}
                          >
                            View Stats
                          </button>
                        )}

                        {user?.role?.toLowerCase() === 'teacher'
            && student.role !== 'teacher'
          && String(student._id) !== String(user._id) && (
                          <select
                            className="select select-sm ml-2"
                            value={student.role}
                            onChange={async (e) => {
                              const newRole = e.target.value;
                              try {
                                if (newRole === 'admin') {
                                  await axios.post(`/api/users/${student._id}/make-admin`,{ classroomId });
                                  console.log('Student promoted to Admin/TA in classroom:', classroomId);
                                  toast.success('Student promoted to Admin/TA');
                                } else {
                                  await axios.post(`/api/users/${student._id}/demote-admin`, { classroomId });
                                  console.log('Admin/TA demoted to Student in classroom:', classroomId);
                                  toast.success('Admin/TA demoted to Student');
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
          <div className="space-y-6 w-full min-w-0">
            {groupSets.length === 0 ? (
              <p>No groups available yet.</p>
            ) : (
              groupSets.map((gs) => (
                <div key={gs._id} className="w-full min-w-0">
                  <h2 className="text-xl font-semibold">{gs.name}</h2>
                  <div className="mt-2 grid grid-cols-1 gap-4 w-full">
                    {gs.groups.map((group) => (
                      <div key={group._id} className="border p-4 rounded w-full min-w-0 bg-base-100">
                         <h3 className="text-lg font-bold">{group.name}</h3>
                         {group.members.length === 0 ? (
                           <p className="text-gray-500">No members</p>
                        ) : (
                          <ul className="list-disc ml-5 space-y-1">
                            {group.members.map((m) => (
                              <li key={m._id._id} className="flex justify-between items-center w-full">
                                 <span>
                                  {m._id.firstName || m._id.lastName
                                    ? `${m._id.firstName || ''} ${m._id.lastName || ''}`.trim()
                                    : m._id.name || m._id.email}
                                </span>
                                <button
                                  className="btn btn-sm btn-outline ml-4"
                                  onClick={() => navigate(`/classroom/${classroomId}/profile/${m._id._id}`)}
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
      </main>
       <Footer />
     </div>
   );
 };
 
 export default People;
