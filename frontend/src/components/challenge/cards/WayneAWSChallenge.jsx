import { getChallengeColors, getThemeClasses } from '../../../utils/themeUtils';

const WayneAWSChallenge = ({ userChallenge, isDark }) => {
  const colors = getChallengeColors(4, isDark);
  const themeClasses = getThemeClasses(isDark);

  return (
    <>
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2`}>🔐 Your Mission</h4>
        <p className="text-sm text-gray-700 mb-3">
          Access the WayneAWS cloud authentication portal and verify your credentials. You'll need to find the correct username and secret password to complete this challenge.
        </p>
        <div className="space-y-2">
          <p className="text-xs text-gray-600">🌐 Cloud-based authentication system</p>
          <p className="text-xs text-gray-600">🔑 Secure credential verification process</p>
          <p className="text-xs text-gray-600">⚡ Real-time authentication with WayneAWS API</p>
        </div>
      </div>
      
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2`}>🌐 WayneAWS Portal</h4>
        <p className={`text-sm ${themeClasses.mutedText} mb-3`}>Access the secure WayneAWS authentication portal:</p>
        <code className={`${isDark ? 'text-blue-300' : 'text-blue-600'} font-mono text-sm block mb-3`}>
          <a 
            href={`/challenge-5-site/${userChallenge.uniqueId}`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:underline"
          >
            /challenge-5-site/{userChallenge.uniqueId}
          </a>
        </code>
        <p className={`text-xs ${isDark ? 'text-base-content/60' : 'text-gray-500'}`}>
          Opens the WayneAWS authentication portal with secure credential verification
        </p>
      </div>
      
    </>
  );
};

export default WayneAWSChallenge;
