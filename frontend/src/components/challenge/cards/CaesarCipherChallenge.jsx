import { getChallengeColors, getThemeClasses } from '../../../utils/themeUtils';

const CaesarCipherChallenge = ({ userChallenge, isDark, onExternalLinkClick }) => {
  const colors = getChallengeColors(0, isDark);
  const themeClasses = getThemeClasses(isDark);
  
  const isChallengeStarted = (userChallenge?.currentChallenge !== undefined && userChallenge?.currentChallenge === 0) || userChallenge?.completedChallenges?.[0];

  const handleLinkClick = (e) => {
    if (onExternalLinkClick) {
      onExternalLinkClick(e, true);
    }
  };

  return (
    <>
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-3`}>🔐 Your Encrypted ID</h4>
        <code className={`${themeClasses.codeRed} px-4 py-3 rounded text-2xl font-mono block text-center border`}>
          {userChallenge.uniqueId}
        </code>
      </div>
      
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2`}>📋 Instructions</h4>
        <ol className={`list-decimal list-inside text-sm ${themeClasses.bodyText} space-y-1`}>
          <li>Decrypt the encrypted ID above using cryptographic techniques</li>
          <li>Use your decrypted result as the password</li>
          <li>Access the challenge site with your password</li>
        </ol>
      </div>
      
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2`}>🌐 Challenge Site</h4>
        <p className={`text-sm ${themeClasses.bodyText} mb-3`}>Once you decrypt your ID, access the challenge site:</p>
        {isChallengeStarted ? (
          <code className={`${themeClasses.linkText} font-mono text-sm block mb-3`}>
            <a 
              href={`/challenge-site/${userChallenge.uniqueId}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:underline"
              onClick={handleLinkClick}
            >
              /challenge-site/{userChallenge.uniqueId}
            </a>
          </code>
        ) : (
          <code className={`${isDark ? 'text-gray-500 bg-gray-800' : 'text-gray-400 bg-gray-100'} font-mono text-sm block mb-3 px-2 py-1 rounded cursor-not-allowed`}>
            /challenge-site/{userChallenge.uniqueId} (Start challenge first)
          </code>
        )}
      </div>
      
    </>
  );
};

export default CaesarCipherChallenge;
