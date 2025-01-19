// client/src/pages/LoginPage.jsx
import React from 'react';

function LoginPage() {
  return (
    <div style={{ marginTop: '50px' }}>
      <h2>Login Page</h2>
      <a href="http://localhost:5000/api/auth/google">
        <button style={{ background: 'red', color: '#fff', marginRight: '10px' }}>
          Sign in w/ Google
        </button>
      </a>
      <a href="http://localhost:5000/api/auth/microsoft">
        <button style={{ background: 'blue', color: '#fff' }}>
          Sign in w/ Microsoft
        </button>
      </a>
    </div>
  );
}

export default LoginPage;
