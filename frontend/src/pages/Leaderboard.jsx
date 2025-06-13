import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

export default function Leaderboard() {
  const { classId } = useParams();      // ← grab the classroom ID from the URL
  const [board, setBoard] = useState([]);  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBoard() {
      try {
        const res = await axios.get(`/api/classrooms/${classId}/leaderboard`);
        setBoard(res.data);
      } catch (err) {
        console.error('Failed to load leaderboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadBoard();
  }, [classId]);

  if (loading) return <p>Loading leaderboard…</p>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Bits Leaderboard</h2>
      <table className="min-w-full table-auto">
        <thead>
          <tr>
            <th className="px-4 py-2">#</th>
            <th className="px-4 py-2 text-left">Student</th>
            <th className="px-4 py-2 text-left">Bits</th>
          </tr>
        </thead>
        <tbody>
          {board.map((user, idx) => (
            <tr key={user._id} className={idx % 2 ? 'bg-gray-100' : ''}>
              <td className="px-4 py-2">{idx + 1}</td>
              <td className="px-4 py-2">{user.email}</td>
              <td className="px-4 py-2">{user.balance}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}