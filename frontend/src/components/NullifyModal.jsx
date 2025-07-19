import React from 'react';

const NullifyModal = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  targetName 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
        <h3 className="text-xl font-bold mb-4">
          Nullify Attributes for {targetName}
        </h3>
        
        <p className="mb-4 text-gray-600">
          Select which attribute you want to reset to default:
        </p>
        
        <div className="space-y-3">
          <button
            onClick={() => onSelect('bits')}
            className="btn btn-block btn-outline hover:bg-red-50"
          >
            <div className="flex items-center justify-between w-full">
              <span>💰 Bits (Set to 0)</span>
              <span className="badge badge-error">Nullify</span>
            </div>
          </button>
          
          <button
            onClick={() => onSelect('multiplier')}
            className="btn btn-block btn-outline hover:bg-red-50"
          >
            <div className="flex items-center justify-between w-full">
              <span>✖️ Multiplier (Set to 1x)</span>
              <span className="badge badge-error">Nullify</span>
            </div>
          </button>
          
          <button
            onClick={() => onSelect('luck')}
            className="btn btn-block btn-outline hover:bg-red-50"
          >
            <div className="flex items-center justify-between w-full">
              <span>🍀 Luck (Set to 1x)</span>
              <span className="badge badge-error">Nullify</span>
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

export default NullifyModal;