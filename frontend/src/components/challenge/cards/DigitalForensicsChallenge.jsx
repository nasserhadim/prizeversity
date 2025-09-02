import { getChallengeColors, getThemeClasses } from '../../../utils/themeUtils';

const DigitalForensicsChallenge = ({ userChallenge, isDark, onExternalLinkClick }) => {
  const colors = getChallengeColors(3, isDark);
  const themeClasses = getThemeClasses(isDark);

  const handleLinkClick = (e) => {
    if (onExternalLinkClick) {
      onExternalLinkClick(e, true);
    }
  };

  return (
    <>
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2`}>🕵️ Your Investigation</h4>
        <p className={`text-sm ${themeClasses.bodyText} mb-3`}>
          One of Wayne State's Alumni left some evidence in a GitHub repository. Your task is to find it and extract the hidden metadata.
        </p>
        <div className="space-y-2">
          <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>🔍 Use OSINT techniques to locate your evidence</p>
          <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>🖼️ Analyze the GitHub repository to extract the information you need</p>
          <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>📊 Each student has unique evidence with personalized data</p>
        </div>
      </div>
      
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2`}>🌐 Forensics Investigation</h4>
        <p className={`text-sm ${themeClasses.bodyText} mb-3`}>Begin your digital forensics investigation:</p>
        <code className={`${themeClasses.linkText} font-mono text-sm block mb-3`}>
          <a 
            href={`/challenge-4-site/${userChallenge.uniqueId}`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:underline"
            onClick={handleLinkClick}
          >
            /challenge-4-site/{userChallenge.uniqueId}
          </a>
        </code>
        <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
          Opens the forensics investigation environment with evidence generation and analysis tools
        </p>
      </div>
    </>
  );
};

export default DigitalForensicsChallenge;
