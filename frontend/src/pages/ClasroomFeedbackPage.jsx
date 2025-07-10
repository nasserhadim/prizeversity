import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';

const ClassroomFeedbackPage = () => {
  const { classroomId } = useParams(); // Get ID from URL
  const [rating, setRating] = useState(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [feedbacks, setFeedbacks] = useState([]);

  useEffect(() => {
    axios.get(`http://localhost:5000/api/feedback/classroom/${classroomId}`)
      .then(res => setFeedbacks(res.data))
      .catch(err => console.error(err));
  }, [classroomId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/feedback/classroom', {
        rating,
        comment,
        classroomId
      });
      setRating(null);
      setComment('');
      setSubmitted(true);

      const res = await axios.get(`http://localhost:5000/api/feedback/classroom/${classroomId}`);
      setFeedbacks(res.data);

      setTimeout(() => setSubmitted(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Classroom Feedback</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* rating and comment inputs (same as before) */}
      </form>

      {submitted && (
        <div className="alert alert-success shadow-lg my-2">
          <span>Thanks for your classroom feedback!</span>
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-lg font-semibold">Recent Feedback</h3>
        {feedbacks.map((fb, i) => (
          <div key={i} className="card bg-base-200 shadow p-3 my-2">
            <div className="text-yellow-400">{'⭐'.repeat(fb.rating)}</div>
            <p className="text-gray-600 text-sm">{fb.comment}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClassroomFeedbackPage;