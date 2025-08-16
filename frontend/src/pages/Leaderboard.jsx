import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Coins } from 'lucide-react';
import socket from '../utils/socket'; // Add this import
import apiLeaderboard from '../API/apiLeaderboard.js';
import Footer from '../components/Footer';

const Leaderboard = () => {
  const { classId } = useParams();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetching all the students to load them in the leaderboard 
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await apiLeaderboard.get(`/${classId}/leaderboard`);
        setStudents(response.data);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [classId]);

  // Add real-time leaderboard updates
  useEffect(() => {
    socket.on('balance_update', () => {
      fetchLeaderboard(); // Refresh leaderboard when any balance changes
    });
    
    socket.on('classroom_update', () => {
      fetchLeaderboard(); // Refresh when classroom changes
    });
    
    return () => {
      socket.off('balance_update');
      socket.off('classroom_update');
    };
  }, [classId]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6">Classroom Leaderboard</h1>

      {loading ? (
        <div className="text-center">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table w-full bg-base-100 shadow-md rounded-lg">
            <thead>
              <tr className="bg-base-200 text-base font-semibold text-base-content">
                <th>#</th>
                <th>Email</th>
                <th className="flex items-center gap-2"><Coins size={16} /> Balance</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, index) => (
                <tr key={student._id} className="hover">
                  <td>{index + 1}</td>
                  <td>{student.email}</td>
                  <td>{student.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Footer />
    </div>
  );
};

export default Leaderboard;
