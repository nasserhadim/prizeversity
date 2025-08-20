import { getChallengeColors, getThemeClasses } from '../../../utils/themeUtils';

const NeedleInAHaystackChallenge = ({ userChallenge, isDark }) => {
  const colors = getChallengeColors(1, isDark);
  const themeClasses = getThemeClasses(isDark);

  return (
    <>
      <h4 className={`font-semibold ${colors.textColor} mb-3`}>🔍 Digital Archaeology</h4>
      <p className={`text-sm ${themeClasses.mutedText} mb-4`}>
        In the vast digital consciousness, words are transformed into numerical tokens. 
        Your mission: excavate the true numerical identity of your assigned word.
      </p>
      
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2`}>🌐 Archaeological Site</h4>
        <p className={`text-sm ${themeClasses.mutedText} mb-3`}>Access the digital excavation terminal:</p>
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
        
        <div className="space-y-2 mt-4">
          <p className="text-xs text-gray-600">🎯 Locate your target word</p>
          <p className="text-xs text-gray-600">🔢 Find its numerical token position</p>
          <p className="text-xs text-gray-600">🛠️ Discover the tools for digital excavation</p>
        </div>
      </div>
      
      <div className={themeClasses.warningAlert}>
        <span className="text-sm">
          <strong>Digital Hint:</strong> The machines speak in tokens. Modern language models 
          break text into numerical pieces - your word has a specific ID in this vast numerical space.
        </span>
      </div>
      
      <div className={`${isDark ? 'bg-orange-900/20 border-orange-700' : 'bg-orange-100 border-orange-300'} border rounded-lg p-3`}>
        <p className="text-xs text-orange-600">
          <strong>Research Required:</strong> This challenge requires external research and tool discovery. 
          The answer lies in understanding how artificial intelligence processes language.
        </p>
      </div>
    </>
  );
};

export default NeedleInAHaystackChallenge;
      