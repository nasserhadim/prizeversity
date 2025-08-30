// import React, { useState } from 'react';
// import { useParams } from 'react-router-dom';
// import axios from 'axios';
// import { API_BASE } from '../config/api';
// import Footer from '../components/Footer';
// import { toast } from 'react-hot-toast';
// const ClassroomFeedbackPage = () => {
//   const { classroomId } = useParams();
//   const [rating, setRating] = useState(null);
//   const [comment, setComment] = useState('');
//   const [submitted, setSubmitted] = useState(false);

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     try {
//       await axios.post(`${API_BASE}/api/feedback`, {
//         classroomId,
//         rating,
//         comment,
//       });
//       setRating(null);
//       setComment('');
//       setSubmitted(true);
//       setTimeout(() => setSubmitted(false), 3000);
//       toast.success('Thank you for your feedback!');
//     } catch (err) {
//       console.error('Error submitting feedback:', err);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-base-200 flex flex-col justify-between">
//       {/* Centered content */}
//       <div className="flex-grow flex items-center justify-center p-4">
//         <div className="card w-full max-w-md shadow-xl bg-base-100">
//           <div className="card-body">
//             <h2 className="card-title text-primary">
//               Let us know how this classroom is doing!
//             </h2>

//             <form onSubmit={handleSubmit} key={submitted} className="space-y-4">
//               <div>
//                 <label className="label">
//                   <span className="label-text">Star Rating</span>
//                 </label>
//                 <div className="rating">
//                   {[1, 2, 3, 4, 5].map((star) => (
//                     <input
//                       key={star}
//                       type="radio"
//                       name="rating"
//                       className="mask mask-star-2 bg-yellow-400"
//                       checked={rating === star}
//                       onChange={() => setRating(star)}
//                     />
//                   ))}
//                 </div>
//               </div>

//               <div>
//                 <label className="label">
//                   <span className="label-text">Your Comment</span>
//                 </label>
//                 <textarea
//                   className="textarea textarea-bordered w-full"
//                   value={comment}
//                   onChange={(e) => setComment(e.target.value)}
//                   placeholder="Type your feedback here..."
//                   rows={4}
//                 />
//               </div>

//               <button
//                 type="submit"
//                 className="btn btn-success w-full"
//                 disabled={!rating || comment.trim() === ''}
//               >
//                 Submit
//               </button>
//             </form>
//           </div>
//         </div>
//       </div>

//       {/* Footer pinned at bottom */}
//       <Footer />
//     </div>
//   );
// };

// export default ClassroomFeedbackPage;

import React, { useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { API_BASE } from "../config/api";
import Footer from "../components/Footer";
import { toast } from "react-hot-toast";

const ClassroomFeedbackPage = ({ userId }) => {
  const { classroomId } = useParams();
  const [rating, setRating] = useState(null);
  const [comment, setComment] = useState("");
  const [anonymous, setAnonymous] = useState(false); // ✅ new state
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/feedback`, {
        classroomId,
        rating,
        comment,
        anonymous,
        userId: anonymous ? null : userId, // ✅ pass null if anonymous
      });
      setRating(null);
      setComment("");
      setAnonymous(false);
      setSubmitted(true);
      toast.success("Thank you for your feedback!");
    } catch (err) {
      console.error("Error submitting feedback:", err);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col justify-between">
      <div className="flex-grow flex items-center justify-center p-4">
        <div className="card w-full max-w-md shadow-xl bg-base-100 mt-20">
          <div className="card-body">
            <h2 className="card-title text-primary">
              Let us know how this classroom is doing!
            </h2>


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

              <div className="form-control">
                <label className="cursor-pointer label">
                  <span className="label-text">Submit as Anonymous</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={anonymous}
                    onChange={(e) => setAnonymous(e.target.checked)}
                  />
                </label>
              </div>

              <button
                type="submit"
                className="btn btn-success w-full"
                disabled={!rating || comment.trim() === ""}
              >
                Submit
              </button>
            </form>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ClassroomFeedbackPage;