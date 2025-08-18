import { getChallengeColors, getThemeClasses } from '../../../utils/themeUtils';

const SecurityBugFixChallenge = ({ userChallenge, isDark }) => {
  const colors = getChallengeColors(2, isDark);
  const themeClasses = getThemeClasses(isDark);

  return (
    <>
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2`}>🔧 Your Mission</h4>
        <p className="text-sm text-gray-700 mb-3">
          Identify and fix the security bug in the C++ code. When fixed correctly, you'll receive your password.
        </p>
        <div className="space-y-2">
          <p className="text-xs text-gray-600">🎯 Four possible bug types: logic errors, buffer overflows, array bounds, or integer overflow</p>
          <p className="text-xs text-gray-600">⚡ Each student gets a unique bug type and personalized code</p>
        </div>
      </div>
      
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2`}>🌐 Bug Fix Challenge</h4>
        <p className={`text-sm ${themeClasses.mutedText} mb-3`}>Access your personalized security bug challenge:</p>
        <code className={`${isDark ? 'text-blue-300' : 'text-blue-600'} font-mono text-sm block mb-3`}>
          <a 
            href={`/challenge-3-site/${userChallenge.uniqueId}`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:underline"
          >
            /challenge-3-site/{userChallenge.uniqueId}
          </a>
        </code>
        <p className={`text-xs ${isDark ? 'text-base-content/60' : 'text-gray-500'}`}>
          Opens a simple code editor with your unique security vulnerability to fix
        </p>
      </div>
      
      <div className={themeClasses.infoAlert}>
        <span className="text-sm">
          <strong>Quick Challenge:</strong> This focuses on fundamental security concepts in C++. Typical completion time: 10-20 minutes.
        </span>
      </div>
    </>
  );
};

export default SecurityBugFixChallenge;
