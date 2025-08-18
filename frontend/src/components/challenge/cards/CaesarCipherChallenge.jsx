import { getChallengeColors, getThemeClasses } from '../../../utils/themeUtils';

const CaesarCipherChallenge = ({ userChallenge, isDark }) => {
  const colors = getChallengeColors(0, isDark);
  const themeClasses = getThemeClasses(isDark);

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
        <ol className={`list-decimal list-inside text-sm ${themeClasses.mutedText} space-y-1`}>
          <li>Decrypt the encrypted ID above using cryptographic techniques</li>
          <li>Use your decrypted result as the password</li>
          <li>Access the challenge site with your password</li>
        </ol>
      </div>
      
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2`}>🌐 Challenge Site</h4>
        <p className={`text-sm ${themeClasses.mutedText} mb-3`}>Once you decrypt your ID, access the challenge site:</p>
        <code className={`${isDark ? 'text-blue-300' : 'text-blue-600'} font-mono text-sm block mb-3`}>
          <a 
            href={`/challenge-site/${userChallenge.uniqueId}`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:underline"
          >
            /challenge-site/{userChallenge.uniqueId}
          </a>
        </code>
      </div>
      
      <div className={themeClasses.warningAlert}>
        <span className="text-sm">
          <strong>Remember:</strong> Each student has a unique encrypted ID, so you can't share answers with classmates!
        </span>
      </div>
    </>
  );
};

export default CaesarCipherChallenge;
