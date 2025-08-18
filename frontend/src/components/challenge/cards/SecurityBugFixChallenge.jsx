import { useState } from 'react';
import { getChallengeColors, getThemeClasses } from '../../../utils/themeUtils';

const SecurityBugFixChallenge = ({ userChallenge, isDark }) => {
  const [showMissionModal, setShowMissionModal] = useState(false);
  const colors = getChallengeColors(2, isDark);
  const themeClasses = getThemeClasses(isDark);

  return (
    <>
      <div className={`${colors.sectionBg} rounded-lg p-4 border-l-4 border-red-500`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2 text-red-600`}>🚨 SECURITY BREACH DETECTED</h4>
        <p className="text-sm text-gray-700 mb-3">
          <strong>URGENT:</strong> Malicious code intercepted! Analyze the cryptographic payload and extract its output before attackers detect our surveillance.
        </p>
        <div className="space-y-2">
          <p className="text-xs text-gray-600">⏱️ <strong>Time Limit:</strong> 30 minutes before detection</p>
          <p className="text-xs text-gray-600">🎯 <strong>Objective:</strong> Debug code and extract cryptographic string</p>
          <p className="text-xs text-gray-600">🔄 <strong>Attempts:</strong> Maximum 5 decryption tries</p>
        </div>
      </div>
      
      <div className={`${colors.sectionBg} rounded-lg p-4`}>
        <h4 className={`font-semibold ${colors.textColor} mb-2`}>🚨 Cryptographic Mission</h4>
        <p className={`text-sm ${themeClasses.mutedText} mb-4`}>Emergency: Intercepted code requires immediate analysis!</p>
        
        <div className="flex justify-center">
          <button
            onClick={() => setShowMissionModal(true)}
            className="btn btn-error btn-wide gap-2 animate-pulse hover:animate-none"
          >
            🚀 ENTER MISSION
          </button>
        </div>
        
        <p className={`text-xs ${isDark ? 'text-base-content/60' : 'text-gray-500'} mt-3 text-center`}>
          ⚠️ Opens secure analysis environment with 30-minute time limit
        </p>
      </div>
      
      <div className="bg-red-900 border border-red-600 rounded-lg p-3">
        <span className="text-sm text-red-200">
          <strong>⚠️ WARNING:</strong> Once you enter the mission, the 30-minute countdown begins immediately. No external assistance permitted due to security protocols.
        </span>
      </div>

      {/* Mission Start Modal */}
      {showMissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="max-w-2xl w-full bg-gray-800 border-2 border-red-500 rounded-lg shadow-2xl">
            <div className="p-8 text-center space-y-6">
              <div className="text-6xl animate-pulse">🚨</div>
              <h1 className="text-4xl font-bold text-red-400 animate-pulse">URGENT: CRYPTOGRAPHIC BREACH</h1>
              
              <div className="space-y-4 text-lg">
                <p className="text-red-300">⚠️ SECURITY ALERT: Our systems have been compromised!</p>
                <p className="text-white">We've intercepted malicious code from an unknown source. <strong className="text-yellow-400">Time is running out</strong> - we need you to analyze this code and decipher its cryptographic output before the attackers notice.</p>
              </div>

              <div className="bg-gray-900 border border-yellow-500 rounded-lg p-6 space-y-3">
                <h3 className="text-xl font-bold text-yellow-400">⏱️ MISSION PARAMETERS</h3>
                <div className="space-y-2 text-left text-sm">
                  <p className="text-gray-300">🎯 <strong>Objective:</strong> Debug the intercepted code and extract its output</p>
                  <p className="text-gray-300">⏳ <strong>Time Limit:</strong> 30 minutes before they detect our analysis</p>
                  <p className="text-gray-300">🔄 <strong>Attempts:</strong> Maximum 5 decryption attempts</p>
                  <p className="text-gray-300">🚫 <strong>Restrictions:</strong> No external assistance - security protocols active</p>
                  <p className="text-gray-300">💡 <strong>Hint:</strong> Look for subtle bugs in the code logic</p>
                </div>
              </div>

              <div className="text-red-300 font-semibold">
                Once you start, there's no turning back. The clock will begin ticking immediately.
              </div>

              <div className="flex gap-4 justify-center pt-4">
                <button
                  onClick={() => setShowMissionModal(false)}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors text-white"
                >
                  Cancel Mission
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Are you SURE you want to start the cryptographic analysis? The 30-minute timer will begin immediately and cannot be paused!')) {
                      setShowMissionModal(false);
                      window.open(`/challenge-3-site/${userChallenge.uniqueId}`, '_blank');
                    }
                  }}
                  className="px-8 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-bold animate-pulse text-white"
                >
                  🚀 START MISSION
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SecurityBugFixChallenge;
