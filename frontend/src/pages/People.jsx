import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const People = () => {
  const { id: classroomId } = useParams();
  const { user } = useAuth();

  const [tab, setTab] = useState('everyone'); // 'everyone' or 'groups'
  const [students, setStudents] = useState([]);
  const [groupSets, setGroupSets] = useState([]);

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

  return (
    // 
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

      {tab === 'everyone' && (
        <div className="space-y-2">
          {students.length === 0 ? (
            <p>No students enrolled yet.</p>
          ) : (
            students.map((student) => (
              <div key={student._id} className="border p-3 rounded shadow flex justify-between items-center">
                <span>{student.name || student.email} - Role: {student.role}</span>
                {user.role === 'teacher' && student.role === 'student' && (
                  // Make Admin button still not works
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={async () => {
                      try {
                        await axios.post(`/api/users/${student._id}/make-admin`, {}, { withCredentials: true });
                        alert('Student promoted to admin');
                        fetchStudents(); // refresh in real time 
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
            ))
          )}
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
                        <ul className="list-disc ml-5">
                          {group.members.map((m) => (
                            <li key={m._id._id}>{m._id.email}</li>
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