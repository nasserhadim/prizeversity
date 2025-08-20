import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../config/api';
import Footer from '../components/Footer';
import { toast } from 'react-hot-toast';

const FeedbackPage = () => {
  const [rating, setRating] = useState(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) {
      alert("Please select a star rating before submitting.");
      return;
    }
    try {
      const res = await axios.post(`${API_BASE}/api/feedback`, {
        rating,
        comment,
      });

      setRating(null);
      setComment('');
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000); // Reset submitted state after 3 seconds
      toast.success("Thank you for your feedback!"); 
    } catch (err) {
  if (err.response) {
    // The server responded but with an error code
    console.error("Error response:", err.response.status, err.response.data);
  } else if (err.request) {
    // The request was made but no response
    console.error("No response from server:", err.request);
  } else {
    // Something else
    console.error("Error setting up request:", err.message);
  }
}
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <main className="flex-grow flex items-center justify-center p-4 pt-24">
        <div className="card w-full max-w-md shadow-xl bg-base-100">
          <div className="card-body">
            <h2 className="card-title text-primary">Let us know about your experience using Prizeversity!</h2>

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
      </main>
      <Footer />
    </div>
  );
};

export default FeedbackPage;