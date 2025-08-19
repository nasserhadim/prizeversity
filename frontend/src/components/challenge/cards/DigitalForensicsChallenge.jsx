import { getChallengeColors, getThemeClasses } from '../../../utils/themeUtils';

const DigitalForensicsChallenge = ({ userChallenge, isDark }) => {
  const colors = getChallengeColors(3, isDark);
  const themeClasses = getThemeClasses(isDark);

  return (
    <>
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2`}>🕵️ Your Investigation</h4>
        <p className="text-sm text-gray-700 mb-3">
          One of Wayne State's Alumni left some evidence in a GitHub repository. Your task is to find it and extract the hidden metadata.
        </p>
        <div className="space-y-2">
          <p className="text-xs text-gray-600">🔍 Use OSINT techniques to locate your evidence</p>
          <p className="text-xs text-gray-600">🖼️ Analyze the GitHub repository to extract the information you need</p>
          <p className="text-xs text-gray-600">📊 Each student has unique evidence with personalized data</p>
        </div>
      </div>
      
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2`}>🌐 Forensics Investigation</h4>
        <p className={`text-sm ${themeClasses.mutedText} mb-3`}>Begin your digital forensics investigation:</p>
        <code className={`${isDark ? 'text-blue-300' : 'text-blue-600'} font-mono text-sm block mb-3`}>
          <a 
            href={`/challenge-4-site/${userChallenge.uniqueId}`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:underline"
          >
            /challenge-4-site/{userChallenge.uniqueId}
          </a>
        </code>
        <p className={`text-xs ${isDark ? 'text-base-content/60' : 'text-gray-500'}`}>
          Opens the forensics investigation environment with evidence generation and analysis tools
        </p>
      </div>
    </>
  );
};

export default DigitalForensicsChallenge;
