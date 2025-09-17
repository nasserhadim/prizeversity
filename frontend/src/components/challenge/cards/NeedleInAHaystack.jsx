import { getChallengeColors, getThemeClasses } from '../../../utils/themeUtils';

const NeedleInAHaystackChallenge = ({ userChallenge, isDark, onExternalLinkClick }) => {
  const colors = getChallengeColors(1, isDark);
  const themeClasses = getThemeClasses(isDark);

  const handleLinkClick = (e) => {
    if (onExternalLinkClick) {
      onExternalLinkClick(e, true);
    }
  };

  return (
    <>
      <h4 className={`font-semibold ${colors.textColor} mb-3`}>🔍 Digital Archaeology</h4>
      <p className={`text-sm ${themeClasses.mutedText} mb-4`}>
        Explore our digital archives. Your mission: determine the required number for your assigned word.
      </p>
      
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2`}>🌐 Archaeological Site</h4>
        <p className={`text-sm ${themeClasses.bodyText} mb-3`}>Access the digital excavation terminal:</p>
        <code className={`${themeClasses.linkText} font-mono text-sm block mb-3`}>
          <a 
            href={`/challenge-6-site/${userChallenge.uniqueId}`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:underline"
            onClick={handleLinkClick}
          >
            /challenge-6-site/{userChallenge.uniqueId}
          </a>
        </code>
        
        <div className="space-y-2 mt-4">
          <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>🎯 Locate your target word</p>
          <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>🔢 Determine its required number</p>
          <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>🛠️ Use any resources at your disposal</p>
        </div>
      </div>
      
    </>
  );
};

export default NeedleInAHaystackChallenge;

