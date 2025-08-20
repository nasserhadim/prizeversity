// filepath: frontend/src/components/Logo.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const Logo = () => {
  return (
    <Link to="/" className="flex items-center gap-2" title="Prizeversity Home">
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-success" // Use DaisyUI success color
      >
        {/* Shield Outline */}
        <path
          d="M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z"
          fill="currentColor"
        />
        {/* Graduation Cap */}
        <path
          d="M6 12.5l6-3 6 3-5.5 2.75a1 1 0 0 1-1 0L6 12.5z"
          fill="white"
        />
        <path
          d="M5 13.3V15a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1.7l-7 3.5-7-3.5z"
          fill="white"
          opacity="0.8"
        />
      </svg>
      <span className="text-xl lg:text-2xl font-bold text-base-content">
        Prizeversity
      </span>
    </Link>
  );
};

export default Logo;