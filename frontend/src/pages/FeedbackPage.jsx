import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../config/api';

const FeedbackPage = () => {
  const [rating, setRating] = useState(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!rating) {
      setError('Please select a star rating before submitting.');
      return;
    }

    try {
      await axios.post(`${API_BASE}/api/feedback`, { rating, comment });

      // Reset everything
      setRating(null);
      setComment('');
      setSubmitted(true);
      setError('');

    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError('There was a problem submitting your feedback. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="card w-full max-w-md shadow-xl bg-base-100">
        <div className="card-body">
          <h2 className="card-title text-primary">
            Let us know about your experience using Prizeversity!
          </h2>

          {submitted && (
            <div className="alert alert-success shadow-lg my-2">
              <span>Thank you for your feedback!</span>
            </div>
          )}

          {error && (
            <div className="alert alert-error shadow-lg my-2">
              <span>{error}</span>
            </div>
          )}

          {!submitted && (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                      value={star}
                      className="mask mask-star-2 bg-yellow-400"
                      checked={rating === star}
                      onChange={() => {
                        setRating(star);
                        setError('');
                      }}
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
                  onChange={(e) => {
                    setComment(e.target.value);
                    setError('');
                  }}
                  placeholder="Type your feedback here..."
                  rows={4}
                />
              </div>

              <button type="submit" className="btn btn-success w-full">
                Submit
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackPage;
