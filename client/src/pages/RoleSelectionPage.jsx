import React, { useState } from 'react';
import axios from 'axios';

function RoleSelectionPage() {
  const [role, setRole] = useState('student');

  const handleSubmit = async () => {
    try {
      const res = await axios.post('http://localhost:5000/api/auth/select-role', { role }, { withCredentials: true });
      if (res.data.success) {
        window.location.href = '/';
      }
    } catch (err) {
      console.error(err);
      alert('Error setting role');
    }
  };

  return (
    <div className="container mt-5">
      <h2>Select Your Role</h2>
      <div className="form-check mt-3">
        <input
          className="form-check-input"
          type="radio"
          name="role"
          id="teacherRole"
          value="teacher"
          checked={role === 'teacher'}
          onChange={() => setRole('teacher')}
        />
        <label className="form-check-label" htmlFor="teacherRole">
          Teacher
        </label>
      </div>
      <div className="form-check mb-3">
        <input
          className="form-check-input"
          type="radio"
          name="role"
          id="studentRole"
          value="student"
          checked={role === 'student'}
          onChange={() => setRole('student')}
        />
        <label className="form-check-label" htmlFor="studentRole">
          Student
        </label>
      </div>
      <button className="btn btn-primary" onClick={handleSubmit}>Submit</button>
    </div>
  );
}

export default RoleSelectionPage;
