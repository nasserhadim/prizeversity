import { getChallengeColors, getThemeClasses } from '../../../utils/themeUtils';

const NeedleInAHaystackChallenge = ({ userChallenge, isDark }) => {
  const colors = getChallengeColors(1, isDark);
  const themeClasses = getThemeClasses(isDark);

  return (
    <>
    <h4 className={`font-semibold ${colors.textColor} mb-3`}>There's a whole lot of data out there...we need <i>somewhere</i> to store it.</h4>                
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2`}>Challenge Terminal</h4>
        <p className={`text-sm ${themeClasses.mutedText} mb-3`}>Access the challenge terminal:</p>
        <code className={`${isDark ? 'text-blue-300' : 'text-blue-600'} font-mono text-sm block mb-3`}>
          <a 
            href={`/challenge-6-site/${userChallenge.uniqueId}`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:underline"
          >
            /challenge-6-site/{userChallenge.uniqueId}
          </a>
        </code>
      </div>
      
      <div className={themeClasses.warningAlert}>
        <span className="text-sm">
          <strong>Remember:</strong> Your unique ID is the key to finding your personal password!
        </span>
      </div>
    </>
  );
};

export default NeedleInAHaystackChallenge;
      