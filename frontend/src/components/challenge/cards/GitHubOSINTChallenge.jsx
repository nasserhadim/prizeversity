import { getChallengeColors, getThemeClasses } from '../../../utils/themeUtils';

const GitHubOSINTChallenge = ({ userChallenge, isDark }) => {
  const colors = getChallengeColors(1, isDark);
  const themeClasses = getThemeClasses(isDark);

  return (
    <>
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-3`}>🔗 Your Starting Point</h4>
        <div className="space-y-3">
          <div>
            <span className={`text-sm font-medium ${themeClasses.mutedText}`}>LinkedIn Profile:</span>
            <br />
            <a 
              href="https://www.linkedin.com/in/paul-glantz-1b3488378/" 
              target="_blank" 
              rel="noopener noreferrer"
              className={`${themeClasses.linkText} hover:underline`}
            >
              linkedin.com/in/paul-glantz-1b3488378/
            </a>
          </div>
          <div>
            <span className={`text-sm font-medium ${themeClasses.mutedText}`}>Your Unique ID:</span>
            <br />
            <code className={`${themeClasses.codeBlue} px-2 py-1 rounded font-mono`}>
              {userChallenge.uniqueId}
            </code>
          </div>
        </div>
      </div>                 
      
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2`}>Challenge Terminal</h4>
        <p className={`text-sm ${themeClasses.bodyText} mb-3`}>Access the challenge terminal:</p>
        <code className={`${themeClasses.linkText} font-mono text-sm block mb-3`}>
          <a 
            href={`/challenge-2-site/${userChallenge.uniqueId}`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:underline"
          >
            /challenge-2-site/{userChallenge.uniqueId}
          </a>
        </code>
        <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
          Look closely! You'll need to find the password in the repository.
        </p>
      </div>
      
      <div className={themeClasses.warningAlert}>
        <span className="text-sm">
          <strong>Remember:</strong> Your unique ID is the key to finding your personal password!
        </span>
      </div>
    </>
  );
};

export default GitHubOSINTChallenge;
