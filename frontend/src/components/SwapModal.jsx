import React from 'react';
import { normalizeSwapOptions } from '../utils/itemHelpers';

const SwapModal = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  targetName,
  allowedOptions = ['bits', 'multiplier', 'luck']
}) => {
  if (!isOpen) return null;

  // Unconditional debug to ensure we see what was passed
  console.log('[SwapModal] opened. allowedOptions (raw):', allowedOptions);

  // Try normalization first, but fall back to simple filtering of known tokens
  const normalized = normalizeSwapOptions(allowedOptions);
  let finalOptions = Array.isArray(normalized) && normalized.length ? normalized : [];

  if (finalOptions.length === 0 && Array.isArray(allowedOptions) && allowedOptions.length) {
    finalOptions = allowedOptions
      .map(v => (typeof v === 'string' ? v.toLowerCase().trim() : String(v).toLowerCase().trim()))
      .filter(v => ['bits', 'multiplier', 'luck'].includes(v));
  }

  // Also log normalization result so we can see why finalOptions is empty
  console.log('[SwapModal] normalizeSwapOptions ->', normalized, 'finalOptions ->', finalOptions);

  const showDefaultMessage = finalOptions.length === 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 text-base-content p-6 rounded-lg shadow-xl max-w-md w-full border border-base-300">
        <h3 className="text-xl font-bold mb-4">Swap Attributes with {targetName}</h3>
        <p className="mb-4 text-base-content/70">Select which attribute you want to swap with this student:</p>
        <div className="space-y-3">
          {showDefaultMessage ? (
            <div className="text-sm text-center text-gray-500">This item has no attributes configured for swapping.</div>
          ) : (
            <>
              {finalOptions.includes('bits') && <button onClick={() => onSelect('bits')} className="btn btn-block btn-outline">💰 Swap Bits</button>}
              {finalOptions.includes('multiplier') && <button onClick={() => onSelect('multiplier')} className="btn btn-block btn-outline">✖️ Swap Multiplier</button>}
              {finalOptions.includes('luck') && <button onClick={() => onSelect('luck')} className="btn btn-block btn-outline">🍀 Swap Luck</button>}
            </>
          )}
        </div>
        <button onClick={onClose} className="btn btn-ghost w-full mt-4">Cancel</button>
      </div>
    </div>
  );
};

export default SwapModal;