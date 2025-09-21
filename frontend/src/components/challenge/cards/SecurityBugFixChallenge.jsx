import { useState } from 'react';
import { getChallengeColors, getThemeClasses } from '../../../utils/themeUtils';

const CppBugHuntChallenge = ({ userChallenge, isDark, onExternalLinkClick }) => {
  const colors = getChallengeColors(2, isDark);
  const themeClasses = getThemeClasses(isDark);

  const handleLinkClick = (e) => {
    if (onExternalLinkClick) {
      onExternalLinkClick(e, true);
    }
  };

  // No modal; direct navigation handled via link and external click handler

  return (
    <>
      <div className={`${colors.sectionBg} rounded-lg p-4 border-l-4 border-blue-500`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2 text-blue-600`}>🔐 PERSONALIZED C++ CHALLENGE</h4>
        <p className={`text-sm ${themeClasses.bodyText} mb-3`}>
          <strong>MISSION:</strong> Debug a C++ program that's personalized with YOUR student data. Trace through the execution manually to find the output.
        </p>
        <div className="space-y-2">
          <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>⏱️ <strong>Time Limit:</strong> 2 hours to solve</p>
          <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>🎯 <strong>Objective:</strong> Calculate the final output step-by-step</p>
          <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>🔄 <strong>Attempts:</strong> Maximum 5 tries</p>
          <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>🔒 <strong>Anti-Cheat:</strong> Uses YOUR name and ID - AI can't solve it!</p>
        </div>
      </div>
      
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2`}>🎯 Debugging Challenge</h4>
        <p className={`text-sm ${themeClasses.mutedText} mb-4`}>Ready to put your C++ skills to the test? Debug the code and trace through the execution!</p>
        
        <div className="flex justify-center">
          <a
            href={`/challenge-3-site/${userChallenge.uniqueId}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleLinkClick}
            className="btn btn-primary btn-wide gap-2 hover:scale-105 transition-transform"
          >
            🔍 START DEBUGGING
          </a>
        </div>
        
        <p className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-500'} mt-3 text-center`}>
          🎓 Opens the C++ debugging environment - perfect for practicing your programming skills!
        </p>
      </div>

      {/* Mission modal removed to allow direct access */}
    </>
  );
};

export default CppBugHuntChallenge;
