import React from 'react';

// It will show when the user uses the swapper item and give an option to select which user to swap the bits luck or multiplier with
const SwapModal = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  targetName 
}) => {
  if (!isOpen) return null;

  // Rendering - // Overlay background covering entire viewport
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 text-base-content p-6 rounded-lg shadow-xl max-w-md w-full border border-base-300">
        <h3 className="text-xl font-bold mb-4">
          Swap Attributes with {targetName}
        </h3>
        
        <p className="mb-4 text-base-content/70">
          Select which attribute you want to swap with this student:
        </p>
        
        <div className="space-y-3">
          <button
            onClick={() => onSelect('bits')}
            className="btn btn-block btn-outline hover:bg-base-200"
          >
            <div className="flex items-center justify-between w-full">
              <span>💰 ₿ (Balances)</span>
              <span className="badge badge-info">Swap</span>
            </div>
          </button>
          
          <button
            onClick={() => onSelect('multiplier')}
            className="btn btn-block btn-outline hover:bg-base-200"
          >
            <div className="flex items-center justify-between w-full">
              <span>✖️ Multiplier</span>
              <span className="badge badge-info">Swap</span>
            </div>
          </button>
          
          <button
            onClick={() => onSelect('luck')}
            className="btn btn-block btn-outline hover:bg-base-200"
          >
            <div className="flex items-center justify-between w-full">
              <span>🍀 Luck</span>
              <span className="badge badge-info">Swap</span>
            </div>
          </button>
        </div>
        
        <div className="mt-4 flex justify-end">
          <button 
            onClick={onClose}
            className="btn btn-ghost"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default SwapModal;