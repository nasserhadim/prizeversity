import { X } from 'lucide-react';

const HintModal = ({ isOpen, onClose, hint, challengeName, hintNumber }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            💡 Hint #{hintNumber} Unlocked
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {challengeName}
          </div>

          <div className="bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded-lg p-6 shadow-lg">
            {/* CHANGED: add wrap-any so long/unbroken strings wrap instead of overflowing */}
            <div className="text-black dark:text-white whitespace-pre-wrap wrap-any text-lg leading-relaxed font-bold">
              {hint}
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            This hint will remain available in your challenge card for future reference.
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default HintModal;
