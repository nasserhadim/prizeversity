import React from 'react';

const NullifyModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  targetName,
  allowedOptions = ['bits', 'multiplier', 'luck']
}) => {
  if (!isOpen) return null;

  const showDefaultMessage = !Array.isArray(allowedOptions) || allowedOptions.length === 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 text-base-content p-6 rounded-lg shadow-xl max-w-md w-full border border-base-300">
        <h3 className="text-xl font-bold mb-4">Nullify Attributes for {targetName}</h3>
        <p className="mb-4 text-base-content/70">Select which attribute you want to reset to default:</p>
        <div className="space-y-3">
          {showDefaultMessage && (
            <div className="text-sm text-center text-gray-500">This item has no attributes configured to nullify.</div>
          )}
          {!showDefaultMessage && (
            <>
              {allowedOptions.includes('bits') && <button onClick={() => onConfirm('bits')} className="btn btn-block btn-outline hover:bg-base-200">💰 Reset Bits to 0</button>}
              {allowedOptions.includes('multiplier') && <button onClick={() => onConfirm('multiplier')} className="btn btn-block btn-outline hover:bg-base-200">✖️ Reset Multiplier to 1x</button>}
              {allowedOptions.includes('luck') && <button onClick={() => onConfirm('luck')} className="btn btn-block btn-outline hover:bg-base-200">🍀 Reset Luck to 1</button>}
            </>
          )}
        </div>
        <button onClick={onClose} className="btn btn-ghost w-full mt-4">Cancel</button>
      </div>
    </div>
  );
};

export default NullifyModal;