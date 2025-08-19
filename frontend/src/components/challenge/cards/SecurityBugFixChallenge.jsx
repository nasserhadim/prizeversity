import { useState } from 'react';
import { getChallengeColors, getThemeClasses } from '../../../utils/themeUtils';

const CppBugHuntChallenge = ({ userChallenge, isDark }) => {
  const [showMissionModal, setShowMissionModal] = useState(false);
  const colors = getChallengeColors(2, isDark);
  const themeClasses = getThemeClasses(isDark);

  return (
    <>
      <div className={`${colors.sectionBg} rounded-lg p-4 border-l-4 border-blue-500`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2 text-blue-600`}>🔐 PERSONALIZED C++ CHALLENGE</h4>
        <p className="text-sm text-gray-700 mb-3">
          <strong>MISSION:</strong> Debug a C++ program that's personalized with YOUR student data. Trace through the execution manually to find the output.
        </p>
        <div className="space-y-2">
          <p className="text-xs text-gray-600">⏱️ <strong>Time Limit:</strong> 30 minutes to solve</p>
          <p className="text-xs text-gray-600">🎯 <strong>Objective:</strong> Calculate the final output step-by-step</p>
          <p className="text-xs text-gray-600">🔄 <strong>Attempts:</strong> Maximum 5 tries</p>
          <p className="text-xs text-gray-600">🔒 <strong>Anti-Cheat:</strong> Uses YOUR name and ID - AI can't solve it!</p>
        </div>
      </div>
      
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2`}>🎯 Debugging Challenge</h4>
        <p className={`text-sm ${themeClasses.mutedText} mb-4`}>Ready to put your C++ skills to the test? Debug the code and trace through the execution!</p>
        
        <div className="flex justify-center">
          <button
            onClick={() => setShowMissionModal(true)}
            className="btn btn-primary btn-wide gap-2 hover:scale-105 transition-transform"
          >
            🔍 START DEBUGGING
          </button>
        </div>
        
        <p className={`text-xs ${isDark ? 'text-base-content/60' : 'text-gray-500'} mt-3 text-center`}>
          🎓 Opens the C++ debugging environment - perfect for practicing your programming skills!
        </p>
      </div>
      
      <div className="bg-red-900 border border-red-600 rounded-lg p-3">
        <span className="text-sm text-red-200">
          <strong>🔒 ANTI-CHEAT WARNING:</strong> This code is personalized with your name and student ID. Copying it to AI tools will give wrong answers because they don't know YOUR specific data!
        </span>
      </div>

      {/* Mission Start Modal */}
      {showMissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="max-w-2xl w-full bg-gray-800 border-2 border-blue-500 rounded-lg shadow-2xl">
            <div className="p-8 text-center space-y-6">
              <div className="text-6xl">🐛</div>
              <h1 className="text-4xl font-bold text-blue-400">C++ DEBUG MISSION</h1>
              
              <div className="space-y-4 text-lg">
                <p className="text-blue-300">🔐 PERSONALIZED CHALLENGE: This code is unique to YOU!</p>
                <p className="text-white">You'll get a C++ program personalized with your name and student data. <strong className="text-yellow-400">Manual calculation required - AI shortcuts won't work!</strong></p>
              </div>

              <div className="bg-gray-900 border border-yellow-500 rounded-lg p-6 space-y-3">
                <h3 className="text-xl font-bold text-yellow-400">🔒 ANTI-CHEAT SYSTEM</h3>
                <div className="space-y-2 text-left text-sm">
                  <p className="text-gray-300">🎯 <strong>Goal:</strong> Manually trace through YOUR personalized C++ code</p>
                  <p className="text-gray-300">⏳ <strong>Time Limit:</strong> 30 minutes for careful calculation</p>
                  <p className="text-gray-300">🔄 <strong>Attempts:</strong> 5 tries to get the right answer</p>
                  <p className="text-gray-300">🔒 <strong>Security:</strong> Code uses your name/ID - unique per student</p>
                  <p className="text-gray-300">🚫 <strong>AI-Proof:</strong> ChatGPT/AI can't solve without your personal data</p>
                  <p className="text-gray-300">💡 <strong>Strategy:</strong> Work step-by-step, iteration by iteration</p>
                </div>
              </div>

              <div className="text-red-300 font-semibold">
                🚨 This challenge is specifically designed to prevent AI shortcuts. You must manually calculate the answer using YOUR personalized values!
              </div>

              <div className="flex gap-4 justify-center pt-4">
                <button
                  onClick={() => setShowMissionModal(false)}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors text-white"
                >
                  Maybe Later
                </button>
                <button
                  onClick={() => {
                    setShowMissionModal(false);
                    window.open(`/challenge-3-site/${userChallenge.uniqueId}`, '_blank');
                  }}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-bold text-white"
                >
                  🔍 START DEBUGGING
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CppBugHuntChallenge;
