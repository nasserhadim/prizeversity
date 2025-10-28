import React, { useState } from 'react';
import { Package, Info, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { openMysteryBox } from '../API/apiMysteryBox';
import { resolveMysteryBoxSrc } from '../utils/image';

const MysteryBoxCard = ({ mysteryBox, classroomId, userBalance, userLuck, onOpened }) => {
  const [opening, setOpening] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [wonItem, setWonItem] = useState(null);
  const [showMathBreakdown, setShowMathBreakdown] = useState(false);

  const handleOpen = async () => {
    if (userBalance < mysteryBox.price) {
      toast.error('Insufficient balance!');
      return;
    }

    setOpening(true);
    try {
      const response = await openMysteryBox(classroomId, mysteryBox._id);
      setWonItem(response.data.wonItem);
      setShowRewardModal(true);
      toast.success(`You won: ${response.data.wonItem.name}!`);
      onOpened?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to open mystery box');
    } finally {
      setOpening(false);
    }
  };

  const closeRewardModal = () => {
    setShowRewardModal(false);
    setWonItem(null);
  };

  // Calculate adjusted drop rates based on user's luck
  const calculateAdjustedRates = () => {
    const luckBonus = (userLuck - 1) * mysteryBox.luckMultiplier;
    const rarityOrder = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
    
    const adjustedPool = mysteryBox.itemPool.map(poolItem => {
      const rarityMultiplier = rarityOrder[poolItem.rarity] / 5;
      const luckAdjustment = luckBonus * rarityMultiplier * 10;
      return {
        ...poolItem,
        adjustedChance: Math.min(poolItem.baseDropChance + luckAdjustment, 100)
      };
    });

    // Normalize to 100%
    const totalChance = adjustedPool.reduce((sum, item) => sum + item.adjustedChance, 0);
    return adjustedPool.map(item => ({
      ...item,
      normalizedChance: (item.adjustedChance / totalChance) * 100
    }));
  };

  const adjustedRates = calculateAdjustedRates();

  return (
    <>
      <div className="card bg-base-100 shadow-lg border-2 border-warning hover:shadow-xl transition-shadow">
        <figure className="px-6 pt-6">
          <img
            src={resolveMysteryBoxSrc(mysteryBox.image)}
            alt={mysteryBox.name}
            className="rounded-xl h-40 w-full object-cover"
            onError={(e) => {
              e.currentTarget.src = '/images/mystery-box-placeholder.svg';
            }}
          />
        </figure>

        <div className="card-body">
          <h3 className="card-title text-warning">
            <Package />
            {mysteryBox.name}
          </h3>
          
          <p className="text-sm opacity-70 whitespace-pre-line">{mysteryBox.description}</p>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-2 text-sm mt-2">
            <div className="flex items-center justify-between bg-base-200 p-2 rounded">
              <span className="opacity-70">Price:</span>
              <span className="font-bold">{mysteryBox.price} ₿</span>
            </div>
            
            <div className="flex items-center justify-between bg-base-200 p-2 rounded">
              <div className="flex items-center gap-1">
                <span className="opacity-70">Luck Factor:</span>
                <div className="tooltip tooltip-right" data-tip="Multiplier that affects how much your luck stat influences drop rates. Higher = more luck impact.">
                  <Info size={14} className="text-info cursor-help" />
                </div>
              </div>
              <span className="font-bold">{mysteryBox.luckMultiplier}x</span>
            </div>

            <div className="flex items-center justify-between bg-base-200 p-2 rounded">
              <span className="opacity-70">Your Luck:</span>
              <span className="font-bold text-success">{userLuck.toFixed(1)}x</span>
            </div>

            <div className="flex items-center justify-between bg-base-200 p-2 rounded">
              <div className="flex items-center gap-1">
                <span className="opacity-70">Pity System:</span>
                <div 
                  className="tooltip tooltip-right" 
                  data-tip={
                    mysteryBox.pityEnabled 
                      ? `After ${mysteryBox.guaranteedItemAfter} unsuccessful attempts without a ${mysteryBox.pityMinimumRarity}+ item, you're guaranteed one.`
                      : 'No pity system - drops are purely luck-based'
                  }
                >
                  <Info size={14} className="text-info cursor-help" />
                </div>
              </div>
              <span className={`font-bold ${mysteryBox.pityEnabled ? 'text-success' : 'text-error'}`}>
                {mysteryBox.pityEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            {/* ADD: Max Opens Per Student */}
            {mysteryBox.maxOpensPerStudent && (
              <div className="flex items-center justify-between bg-base-200 p-2 rounded col-span-2">
                <div className="flex items-center gap-1">
                  <span className="opacity-70">Max Opens:</span>
                  <div 
                    className="tooltip tooltip-right" 
                    data-tip="Maximum number of times you can open this mystery box. This limit helps ensure fair distribution of rewards."
                  >
                    <Info size={14} className="text-info cursor-help" />
                  </div>
                </div>
                <span className="font-bold text-warning">
                  {mysteryBox.maxOpensPerStudent} {mysteryBox.maxOpensPerStudent === 1 ? 'time' : 'times'}
                </span>
              </div>
            )}
          </div>

          {/* Pity Details (if enabled) */}
          {mysteryBox.pityEnabled && (
            <div className="bg-info/10 border border-info/30 rounded p-2 text-xs mt-2">
              <p className="font-semibold text-info mb-1">🎁 Pity Guarantee Details:</p>
              <p className="text-base-content/80">
                If you don't get a <strong className="text-warning">{mysteryBox.pityMinimumRarity}</strong> or better item 
                within <strong>{mysteryBox.guaranteedItemAfter}</strong> opens, your next attempt will guarantee one!
              </p>
            </div>
          )}

          {/* Math Breakdown Collapsible */}
          <div className="collapse collapse-arrow bg-base-200 mt-2">
            <input 
              type="checkbox" 
              checked={showMathBreakdown}
              onChange={() => setShowMathBreakdown(!showMathBreakdown)}
            />
            <div className="collapse-title text-sm font-medium flex items-center gap-2">
              <Info size={16} className="text-info" />
              <span>📊 Your Personalized Drop Rates</span>
              {showMathBreakdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
            
            {showMathBreakdown && (
              <div className="collapse-content">
                <div className="space-y-3 pt-2">
                  {/* Summary */}
                  <div className="bg-info/10 border border-info/30 rounded p-2">
                    <p className="text-xs text-base-content/80">
                      <strong className="text-info">Your luck ({userLuck.toFixed(1)}x)</strong> with multiplier 
                      <strong> {mysteryBox.luckMultiplier}x</strong> = 
                      <strong className="text-success"> {((userLuck - 1) * mysteryBox.luckMultiplier).toFixed(1)}</strong> luck bonus.
                    </p>
                  </div>

                  {/* Drop Rate Comparison */}
                  <div className="overflow-x-auto">
                    <table className="table table-xs w-full">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Rarity</th>
                          <th>Base %</th>
                          <th className="text-success">Your %</th>
                          <th>Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adjustedRates.map((item, idx) => {
                          const baseRate = mysteryBox.itemPool[idx].baseDropChance;
                          const yourRate = item.normalizedChance;
                          const change = yourRate - baseRate;
                          const changePercent = ((change / baseRate) * 100).toFixed(0);
                          
                          return (
                            <tr key={idx}>
                              <td className="font-semibold">{item.item?.name || 'Unknown'}</td>
                              <td>
                                <span className={`badge badge-xs ${
                                  item.rarity === 'legendary' ? 'badge-warning' :
                                  item.rarity === 'epic' ? 'badge-secondary' :
                                  item.rarity === 'rare' ? 'badge-primary' :
                                  item.rarity === 'uncommon' ? 'badge-accent' :
                                  'badge-ghost'
                                }`}>
                                  {item.rarity}
                                </span>
                              </td>
                              <td className="opacity-70">{baseRate.toFixed(1)}%</td>
                              <td className="font-bold text-success">{yourRate.toFixed(1)}%</td>
                              <td>
                                <span className={`font-mono text-xs ${
                                  change > 0 ? 'text-success' : change < 0 ? 'text-error' : 'text-gray-400'
                                }`}>
                                  {change > 0 ? '+' : ''}{change.toFixed(1)}%
                                  {change !== 0 && (
                                    <span className="ml-1 opacity-70">
                                      ({change > 0 ? '+' : ''}{changePercent}%)
                                    </span>
                                  )}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Explanation */}
                  <div className="bg-base-300 p-2 rounded text-xs">
                    <p className="text-base-content/80">
                      <strong className="text-info">How it works:</strong> Your luck bonus 
                      ({((userLuck - 1) * mysteryBox.luckMultiplier).toFixed(1)}) is multiplied by 
                      each item's rarity weight (common=0.2, uncommon=0.4, rare=0.6, epic=0.8, legendary=1.0), then normalized so all rates 
                      total 100%. Higher rarity items benefit more from luck!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Open Button */}
          <button
            className="btn btn-warning w-full mt-4"
            onClick={handleOpen}
            disabled={opening || userBalance < mysteryBox.price}
          >
            {opening ? (
              <span className="loading loading-spinner"></span>
            ) : userBalance < mysteryBox.price ? (
              'Insufficient Balance'
            ) : (
              <>
                <Package />
                Open Box ({mysteryBox.price} ₿)
              </>
            )}
          </button>

          {userBalance < mysteryBox.price && (
            <p className="text-xs text-error text-center mt-1">
              Need {mysteryBox.price - userBalance} more ₿
            </p>
          )}
        </div>
      </div>

      {/* Reward Modal (unchanged) */}
      {showRewardModal && wonItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-base-100 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-2xl font-bold text-center text-warning">
              🎉 Ta-da! 🎉
            </h3>
            
            <div className="text-center">
              <p className="text-lg mb-2">You won:</p>
              <p className="text-3xl font-bold text-success">{wonItem.name}</p>
              <span className={`badge badge-lg mt-2 ${
                wonItem.rarity === 'legendary' ? 'badge-warning' :
                wonItem.rarity === 'epic' ? 'badge-secondary' :
                wonItem.rarity === 'rare' ? 'badge-primary' :
                wonItem.rarity === 'uncommon' ? 'badge-accent' :
                'badge-ghost'
              }`}>
                {wonItem.rarity}
              </span>
            </div>

            {wonItem.description && (
              <p className="text-sm text-center opacity-70 whitespace-pre-line">
                {wonItem.description}
              </p>
            )}

            <button
              className="btn btn-success w-full"
              onClick={closeRewardModal}
            >
              Proceed
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default MysteryBoxCard;