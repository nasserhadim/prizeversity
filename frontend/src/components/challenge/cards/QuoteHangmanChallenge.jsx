import { getChallengeColors, getThemeClasses } from '../../../utils/themeUtils';

const QuoteHangmanChallenge = ({ userChallenge, isDark, onExternalLinkClick }) => {
  const colors = getChallengeColors(1, isDark);
  const themeClasses = getThemeClasses(isDark);

  const handleLinkClick = (e) => {
    if (onExternalLinkClick) {
      onExternalLinkClick(e, true);
    }
  };

  return (
    <>
      <h4 className={`font-semibold ${colors.textColor} mb-3`}>🎯 Hangman</h4>
      <p className={`text-sm ${themeClasses.mutedText} mb-4`}>
        A classic word game with a digital twist. Reveal each word in the quote by finding its 
        correct token ID. Complete the quote to win.
      </p>
      
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2`}>💻 Challenge Terminal</h4>
        <p className={`text-sm ${themeClasses.bodyText} mb-3`}>Access the hangman challenge:</p>
        <code className={`${themeClasses.linkText} font-mono text-sm block mb-3`}>
          <a 
            href={`/challenge-7-site/${userChallenge.uniqueId}`} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="hover:underline"
            onClick={handleLinkClick}
          >
            /challenge-7-site/{userChallenge.uniqueId}
          </a>
        </code>
        
        <div className="space-y-2 mt-4">
          <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>📜 View your assigned quote</p>
          <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>🎯 Select words to reveal</p>
          <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>🔢 Find correct token IDs for each word</p>
          <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>✅ Complete the entire quote to win</p>
        </div>
      </div>
      
      <div className={themeClasses.warningAlert}>
        <span className="text-sm">
          <strong>Tokenization Hint:</strong> This challenge requires understanding how 
          AI systems convert words into numerical tokens. Each word may have multiple valid token IDs.
        </span>
      </div>
      
      <div className={`${isDark ? 'bg-blue-900/30 border-blue-600' : 'bg-blue-100 border-blue-300'} border rounded-lg p-3`}>
        <p className={`text-xs ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
          <strong>Challenge:</strong> This is a hangman-style game where you reveal the complete 
          quote by finding the correct token IDs for each word. Complete all words to win.
        </p>
      </div>
    </>
  );
};

export default QuoteHangmanChallenge;
