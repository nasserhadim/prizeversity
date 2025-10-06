import React, { useEffect, useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { getThemeClasses } from '../utils/themeUtils';

export default function NotFound() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);
  const { user } = useAuth();
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  const themeClasses = getThemeClasses(isDark);

  useEffect(() => {
    if (countdown <= 0) {
      navigate('/');
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, navigate]);

  return (
    <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-base-300' : 'bg-base-200'} p-6`}>
      <div className={`${themeClasses.cardBase} max-w-xl text-center`}>
        <h1 className="text-2xl font-bold mb-4">We couldn't find that page</h1>
        <p className={`${themeClasses.mutedText} mb-6`}>
          The page you requested doesn't exist or the URL is incorrect. We'll redirect you to the home page in {countdown} second{countdown !== 1 ? 's' : ''}.
        </p>

        <div className="flex justify-center gap-3">
          <Link to="/" className="btn btn-primary">Go home now</Link>

          {/* Only show Classrooms link when user is signed in */}
          {user ? (
            <Link to="/classrooms" className="btn btn-outline">
              Classrooms
            </Link>
          ) : null}
        </div>

        <p className="text-xs text-base-content/50 mt-4">If you believe this is an error, check the URL or contact support.</p>
      </div>
    </div>
  );
}