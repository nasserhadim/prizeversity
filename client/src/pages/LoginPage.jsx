import React from 'react';

function LoginPage() {
  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:5000/api/auth/google';
  };
  const handleMicrosoftLogin = () => {
    window.location.href = 'http://localhost:5000/api/auth/microsoft';
  };

  return (
    <div className="container mt-5">
      <h1 className="mb-4">Login</h1>
      <button className="btn btn-danger me-3" onClick={handleGoogleLogin}>Sign in with Google</button>
      <button className="btn btn-primary" onClick={handleMicrosoftLogin}>Sign in with Microsoft</button>
    </div>
  );
}

export default LoginPage;
