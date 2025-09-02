import { getChallengeColors, getThemeClasses } from '../../../utils/themeUtils';

const WayneAWSChallenge = ({ userChallenge, isDark, onExternalLinkClick }) => {
  const colors = getChallengeColors(4, isDark);
  const themeClasses = getThemeClasses(isDark);

  const handleLinkClick = (e) => {
    if (onExternalLinkClick) {
      onExternalLinkClick(e, true);
    }
  };

  return (
    <>
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2`}>🔐 Your Mission</h4>
        <p className={`text-sm ${themeClasses.bodyText} mb-3`}>
          Access the WayneAWS cloud authentication portal, and use your given AWS credentials to locate the secret password to complete this challenge.
        </p>
        <div className="space-y-2">
          <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>🌐 Cloud-based authentication system</p>
          <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>🔑 Secure credential verification process</p>
          <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>⚡ Make sure to correctly configure your AWS credentials in the terminal!</p>
        </div>
      </div>
      
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2`}>🌐 WayneAWS Portal</h4>
        <p className={`text-sm ${themeClasses.bodyText} mb-3`}>Access the secure WayneAWS authentication portal:</p>
        <code className={`${themeClasses.linkText} font-mono text-sm block mb-3`}>
          <a 
            href={`/challenge-5-site/${userChallenge.uniqueId}`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:underline"
            onClick={handleLinkClick}
          >
            /challenge-5-site/{userChallenge.uniqueId}
          </a>
        </code>
        <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
          Opens the WayneAWS authentication portal with secure credential verification
        </p>
      </div>
      
    </>
  );
};

export default WayneAWSChallenge;
