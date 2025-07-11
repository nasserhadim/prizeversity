import React, { useState } from 'react';
import axios from 'axios';

const FeedbackPage = () => {
  const [rating, setRating] = useState(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/feedback', {
        rating,
        comment,
      });
      setRating(null);
      setComment('');
      setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000); // Reset submitted state after 3 seconds
    } catch (err) {
      console.error('Error submitting feedback:', err);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="card w-full max-w-md shadow-xl bg-base-100">
        <div className="card-body">
          <h2 className="card-title text-primary">Let us know about your experience using Prizeversity!</h2>

          {submitted && (
            <div className="alert alert-success shadow-lg my-2">
              <span>Thank you for your feedback!</span>
            </div>
          )}
          <form onSubmit={handleSubmit} key={submitted} className="space-y-4">
            <div>
              <label className="label">
                <span className="label-text">Star Rating</span>
              </label>
              <div className="rating">
                {[1, 2, 3, 4, 5].map((star) => (
                  <input
                    key={star}
                    type="radio"
                    name="rating"
                    className="mask mask-star-2 bg-yellow-400"
                    checked={rating === star}
                    onChange={() => setRating(star)}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="label">
                <span className="label-text">Your Comment</span>
              </label>
              <textarea
                className="textarea textarea-bordered w-full"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Type your feedback here..."
                rows={4}
              />
            </div>

            <button type="submit" className="btn btn-success w-full">
              Submit
            </button>
          </form>

          
        </div>
      </div>
    </div>
  );
};

export default FeedbackPage;