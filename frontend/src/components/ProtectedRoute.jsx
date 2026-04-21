import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { getThemeClasses } from '../utils/themeUtils';
import Footer from './Footer';
import Logo from './Logo';

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';
  const themeClasses = getThemeClasses(isDark);

  if (!user) {
    return (
      <div className={`min-h-screen flex flex-col ${isDark ? 'bg-base-300' : 'bg-base-200'}`}>
        <header className={`w-full px-6 py-3 ${isDark ? 'bg-base-200' : 'bg-base-100'} shadow-sm flex justify-center`}>
          <Logo />
        </header>
        <div className="flex-grow flex items-center justify-center p-6">
          <div className={`${themeClasses.cardBase} max-w-xl text-center`}>
            <div className="text-5xl mb-4">🔒</div>
            <h1 className="text-2xl font-bold mb-3">Sign in to continue</h1>
            <p className={`${themeClasses.mutedText} mb-6`}>
              This page is only available to signed-in users. Please sign in with your account to access it.
            </p>

            <div className="flex flex-col gap-3 items-center">
              <button
                onClick={() => (window.location.href = '/api/auth/google')}
                className="btn btn-outline w-full max-w-xs flex items-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 48 48">
                  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2v6h7.7c4.5-4.1 7-10.2 7-17.2z" />
                  <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.8 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9H2.5v6.2C6.5 42.8 14.7 48 24 48z" />
                  <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6v-6.2H2.5C.9 16.4 0 20.1 0 24s.9 7.6 2.5 10.8l8-6.2z" />
                  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.1 30.5 0 24 0 14.7 0 6.5 5.2 2.5 13.2l8 6.2C12.4 13.7 17.7 9.5 24 9.5z" />
                </svg>
                Continue with Google
              </button>

              <button
                onClick={() => (window.location.href = '/api/auth/microsoft')}
                className="btn btn-outline w-full max-w-xs flex items-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 21 21">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                </svg>
                Continue with Microsoft
              </button>
            </div>

            <p className="text-xs text-base-content/50 mt-6">
              <Link to="/" className="underline hover:text-base-content">Go back home</Link>
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return children;
}
