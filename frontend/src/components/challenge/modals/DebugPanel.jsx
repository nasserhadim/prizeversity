import { CHALLENGE_NAMES } from '../../../constants/challengeConstants';

const DebugPanel = ({ 
  showDebugPanel, 
  setShowDebugPanel, 
  userChallenge, 
  setDebugProgress 
}) => {
  if (!showDebugPanel) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">🔧 Teacher Debug Panel</h3>
          <button
            onClick={() => setShowDebugPanel(false)}
            className="btn btn-sm btn-circle btn-ghost"
          >
            ✕
          </button>
        </div>
        
        <p className="text-gray-600 mb-4">
          Skip to any challenge for testing purposes:
        </p>
        
        <div className="space-y-2">
          {CHALLENGE_NAMES.map((name, index) => (
            <button
              key={index}
              onClick={() => setDebugProgress(index)}
              className={`w-full text-left btn btn-outline ${
                userChallenge?.progress === index ? 'btn-primary' : ''
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="badge badge-neutral">Challenge {index + 1}</span>
                {name}
              </span>
            </button>
          ))}
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <button
            onClick={() => setDebugProgress(4)}
            className="w-full btn btn-success"
          >
            🎉 Complete All Challenges
          </button>
        </div>
      </div>
    </div>
  );
};

export default DebugPanel;
