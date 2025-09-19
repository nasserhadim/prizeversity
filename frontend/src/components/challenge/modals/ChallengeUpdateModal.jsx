import React, { useState, useEffect } from 'react';
import { Edit3, Save } from 'lucide-react';
import { CHALLENGE_NAMES } from '../../../constants/challengeConstants';
import { updateChallenge } from '../../../API/apiChallenge';
import toast from 'react-hot-toast';

const ChallengeUpdateModal = ({ 
  showUpdateModal, 
  setShowUpdateModal, 
  challengeData,
  fetchChallengeData,
  classroomId
}) => {
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState('bits');
  const [updateData, setUpdateData] = useState({
    title: '',
    challengeBits: [],
    totalRewardBits: 0,
    rewardMode: 'individual',
    challengeMultipliers: [],
    totalMultiplier: 1.0,
    multiplierMode: 'individual',
    challengeLuck: [],
    totalLuck: 1.0,
    luckMode: 'individual',
    challengeDiscounts: [],
    totalDiscount: 0,
    discountMode: 'individual',
    challengeShields: [],
    totalShield: false,
    shieldMode: 'individual',
    challengeHints: [[], [], [], [], [], [], []],
    challengeHintsEnabled: [false, false, false, false, false, false, false],
    hintPenaltyPercent: 25,
    maxHintsPerChallenge: 2,
    dueDateEnabled: false,
    dueDate: ''
  });

  useEffect(() => {
    if (challengeData && showUpdateModal) {
      setUpdateData({
        title: challengeData.title || '',
        challengeBits: challengeData.settings?.challengeBits || [50, 75, 100, 125, 150, 175, 200],
        totalRewardBits: challengeData.settings?.totalRewardBits || 0,
        rewardMode: challengeData.settings?.rewardMode || 'individual',
        challengeMultipliers: challengeData.settings?.challengeMultipliers || [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
        totalMultiplier: challengeData.settings?.totalMultiplier || 1.0,
        multiplierMode: challengeData.settings?.multiplierMode || 'individual',
        challengeLuck: challengeData.settings?.challengeLuck || [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
        totalLuck: challengeData.settings?.totalLuck || 1.0,
        luckMode: challengeData.settings?.luckMode || 'individual',
        challengeDiscounts: challengeData.settings?.challengeDiscounts || [0, 0, 0, 0, 0, 0, 0],
        totalDiscount: challengeData.settings?.totalDiscount || 0,
        discountMode: challengeData.settings?.discountMode || 'individual',
        challengeShields: challengeData.settings?.challengeShields || [false, false, false, false, false, false, false],
        totalShield: challengeData.settings?.totalShield || false,
        shieldMode: challengeData.settings?.shieldMode || 'individual',
        challengeHints: challengeData.settings?.challengeHints || [[], [], [], [], [], [], []],
        challengeHintsEnabled: challengeData.settings?.challengeHintsEnabled || [false, false, false, false, false, false, false],
        hintPenaltyPercent: challengeData.settings?.hintPenaltyPercent || 25,
        maxHintsPerChallenge: challengeData.settings?.maxHintsPerChallenge || 2,
        dueDateEnabled: challengeData.settings?.dueDateEnabled || false,
        dueDate: challengeData.settings?.dueDate ? new Date(challengeData.settings.dueDate).toISOString().slice(0, 16) : ''
      });
    }
  }, [challengeData, showUpdateModal]);

  const handleUpdateChallenge = async () => {
    try {
      setUpdating(true);
      await updateChallenge(classroomId, updateData);
      toast.success('Challenge updated successfully');
      setShowUpdateModal(false);
      await fetchChallengeData();
    } catch (error) {
      console.error('Error updating challenge:', error);
      toast.error(error.message || 'Failed to update challenge');
    } finally {
      setUpdating(false);
    }
  };

  const handleHintChange = (challengeIndex, hintIndex, value) => {
    setUpdateData(prev => {
      const newHints = [...prev.challengeHints];
      if (!newHints[challengeIndex]) {
        newHints[challengeIndex] = [];
      }
      newHints[challengeIndex][hintIndex] = value;
      return { ...prev, challengeHints: newHints };
    });
  };

  const addHint = (challengeIndex) => {
    setUpdateData(prev => {
      const newHints = [...prev.challengeHints];
      if (!newHints[challengeIndex]) {
        newHints[challengeIndex] = [];
      }
      newHints[challengeIndex].push('');
      return { ...prev, challengeHints: newHints };
    });
  };

  const removeHint = (challengeIndex, hintIndex) => {
    setUpdateData(prev => {
      const newHints = [...prev.challengeHints];
      newHints[challengeIndex].splice(hintIndex, 1);
      return { ...prev, challengeHints: newHints };
    });
  };

  if (!showUpdateModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="card bg-base-100 w-full max-w-6xl my-8 shadow-xl">
        <div className="card-body p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <Edit3 className="w-6 h-6 text-blue-500" />
            <h2 className="text-2xl font-bold">Update Challenge Series</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label className="label">
                <span className="label-text font-semibold">Challenge Series Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={updateData.title}
                onChange={(e) => setUpdateData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter challenge series name"
              />
            </div>

            <div className="divider">Reward Settings</div>

            <div className="tabs tabs-boxed mb-6">
              <a 
                className={`tab ${activeTab === 'bits' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('bits')}
              >
                💰 Bits
              </a>
              <a 
                className={`tab ${activeTab === 'multiplier' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('multiplier')}
              >
                ⚡ Multiplier
              </a>
              <a 
                className={`tab ${activeTab === 'luck' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('luck')}
              >
                🍀 Luck
              </a>
              <a 
                className={`tab ${activeTab === 'discount' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('discount')}
              >
                🏷️ Discount
              </a>
              <a 
                className={`tab ${activeTab === 'shield' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('shield')}
              >
                🛡️ Shield
              </a>
            </div>

            {activeTab === 'bits' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="font-semibold">Reward Mode:</span>
                  <div className="form-control">
                    <label className="label cursor-pointer gap-2">
                      <input
                        type="radio"
                        name="rewardMode"
                        className="radio"
                        checked={updateData.rewardMode === 'individual'}
                        onChange={() => setUpdateData(prev => ({ ...prev, rewardMode: 'individual' }))}
                      />
                      <span className="label-text">Individual</span>
                    </label>
                  </div>
                  <div className="form-control">
                    <label className="label cursor-pointer gap-2">
                      <input
                        type="radio"
                        name="rewardMode"
                        className="radio"
                        checked={updateData.rewardMode === 'total'}
                        onChange={() => setUpdateData(prev => ({ ...prev, rewardMode: 'total' }))}
                      />
                      <span className="label-text">Total</span>
                    </label>
                  </div>
                </div>

                {updateData.rewardMode === 'total' && (
                  <div>
                    <label className="label">
                      <span className="label-text font-semibold">Total Reward Bits</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered w-32"
                      value={updateData.totalRewardBits}
                      onChange={(e) => setUpdateData(prev => ({ ...prev, totalRewardBits: parseInt(e.target.value) || 0 }))}
                      min="0"
                    />
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="table table-compact w-full">
                    <thead>
                      <tr>
                        <th>Challenge</th>
                        <th>Bits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CHALLENGE_NAMES.map((name, index) => (
                        <tr key={index}>
                          <td className="font-medium">
                            Challenge {index + 1}: {name}
                          </td>
                          <td>
                            <input
                              type="number"
                              className="input input-bordered input-sm w-20"
                              value={updateData.challengeBits[index] || 0}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 0;
                                setUpdateData(prev => {
                                  const newBits = [...prev.challengeBits];
                                  newBits[index] = value;
                                  return { ...prev, challengeBits: newBits };
                                });
                              }}
                              min="0"
                              disabled={updateData.rewardMode !== 'individual'}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'multiplier' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="font-semibold">Multiplier Mode:</span>
                  <div className="form-control">
                    <label className="label cursor-pointer gap-2">
                      <input
                        type="radio"
                        name="multiplierMode"
                        className="radio"
                        checked={updateData.multiplierMode === 'individual'}
                        onChange={() => setUpdateData(prev => ({ ...prev, multiplierMode: 'individual' }))}
                      />
                      <span className="label-text">Individual</span>
                    </label>
                  </div>
                  <div className="form-control">
                    <label className="label cursor-pointer gap-2">
                      <input
                        type="radio"
                        name="multiplierMode"
                        className="radio"
                        checked={updateData.multiplierMode === 'total'}
                        onChange={() => setUpdateData(prev => ({ ...prev, multiplierMode: 'total' }))}
                      />
                      <span className="label-text">Total</span>
                    </label>
                  </div>
                </div>

                {updateData.multiplierMode === 'total' && (
                  <div>
                    <label className="label">
                      <span className="label-text font-semibold">Total Multiplier</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      className="input input-bordered w-32"
                      value={updateData.totalMultiplier}
                      onChange={(e) => setUpdateData(prev => ({ ...prev, totalMultiplier: parseFloat(e.target.value) || 1.0 }))}
                      min="0"
                    />
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="table table-compact w-full">
                    <thead>
                      <tr>
                        <th>Challenge</th>
                        <th>Multiplier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CHALLENGE_NAMES.map((name, index) => (
                        <tr key={index}>
                          <td className="font-medium">
                            Challenge {index + 1}: {name}
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.1"
                              className="input input-bordered input-sm w-20"
                              value={updateData.challengeMultipliers[index] || 1.0}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 1.0;
                                setUpdateData(prev => {
                                  const newMults = [...prev.challengeMultipliers];
                                  newMults[index] = value;
                                  return { ...prev, challengeMultipliers: newMults };
                                });
                              }}
                              min="0"
                              disabled={updateData.multiplierMode !== 'individual'}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'luck' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="font-semibold">Luck Mode:</span>
                  <div className="form-control">
                    <label className="label cursor-pointer gap-2">
                      <input
                        type="radio"
                        name="luckMode"
                        className="radio"
                        checked={updateData.luckMode === 'individual'}
                        onChange={() => setUpdateData(prev => ({ ...prev, luckMode: 'individual' }))}
                      />
                      <span className="label-text">Individual</span>
                    </label>
                  </div>
                  <div className="form-control">
                    <label className="label cursor-pointer gap-2">
                      <input
                        type="radio"
                        name="luckMode"
                        className="radio"
                        checked={updateData.luckMode === 'total'}
                        onChange={() => setUpdateData(prev => ({ ...prev, luckMode: 'total' }))}
                      />
                      <span className="label-text">Total</span>
                    </label>
                  </div>
                </div>

                {updateData.luckMode === 'total' && (
                  <div>
                    <label className="label">
                      <span className="label-text font-semibold">Total Luck</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      className="input input-bordered w-32"
                      value={updateData.totalLuck}
                      onChange={(e) => setUpdateData(prev => ({ ...prev, totalLuck: parseFloat(e.target.value) || 1.0 }))}
                      min="1.0"
                    />
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="table table-compact w-full">
                    <thead>
                      <tr>
                        <th>Challenge</th>
                        <th>Luck</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CHALLENGE_NAMES.map((name, index) => (
                        <tr key={index}>
                          <td className="font-medium">
                            Challenge {index + 1}: {name}
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.1"
                              className="input input-bordered input-sm w-20"
                              value={updateData.challengeLuck[index] || 1.0}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value) || 1.0;
                                setUpdateData(prev => {
                                  const newLuck = [...prev.challengeLuck];
                                  newLuck[index] = value;
                                  return { ...prev, challengeLuck: newLuck };
                                });
                              }}
                              min="1.0"
                              disabled={updateData.luckMode !== 'individual'}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'discount' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="font-semibold">Discount Mode:</span>
                  <div className="form-control">
                    <label className="label cursor-pointer gap-2">
                      <input
                        type="radio"
                        name="discountMode"
                        className="radio"
                        checked={updateData.discountMode === 'individual'}
                        onChange={() => setUpdateData(prev => ({ ...prev, discountMode: 'individual' }))}
                      />
                      <span className="label-text">Individual</span>
                    </label>
                  </div>
                  <div className="form-control">
                    <label className="label cursor-pointer gap-2">
                      <input
                        type="radio"
                        name="discountMode"
                        className="radio"
                        checked={updateData.discountMode === 'total'}
                        onChange={() => setUpdateData(prev => ({ ...prev, discountMode: 'total' }))}
                      />
                      <span className="label-text">Total</span>
                    </label>
                  </div>
                </div>

                {updateData.discountMode === 'total' && (
                  <div>
                    <label className="label">
                      <span className="label-text font-semibold">Total Discount %</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered w-32"
                      value={updateData.totalDiscount}
                      onChange={(e) => setUpdateData(prev => ({ ...prev, totalDiscount: parseInt(e.target.value) || 0 }))}
                      min="0"
                      max="100"
                    />
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="table table-compact w-full">
                    <thead>
                      <tr>
                        <th>Challenge</th>
                        <th>Discount %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CHALLENGE_NAMES.map((name, index) => (
                        <tr key={index}>
                          <td className="font-medium">
                            Challenge {index + 1}: {name}
                          </td>
                          <td>
                            <input
                              type="number"
                              className="input input-bordered input-sm w-20"
                              value={updateData.challengeDiscounts[index] || 0}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 0;
                                setUpdateData(prev => {
                                  const newDiscounts = [...prev.challengeDiscounts];
                                  newDiscounts[index] = value;
                                  return { ...prev, challengeDiscounts: newDiscounts };
                                });
                              }}
                              min="0"
                              max="100"
                              disabled={updateData.discountMode !== 'individual'}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'shield' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="font-semibold">Shield Mode:</span>
                  <div className="form-control">
                    <label className="label cursor-pointer gap-2">
                      <input
                        type="radio"
                        name="shieldMode"
                        className="radio"
                        checked={updateData.shieldMode === 'individual'}
                        onChange={() => setUpdateData(prev => ({ ...prev, shieldMode: 'individual' }))}
                      />
                      <span className="label-text">Individual</span>
                    </label>
                  </div>
                  <div className="form-control">
                    <label className="label cursor-pointer gap-2">
                      <input
                        type="radio"
                        name="shieldMode"
                        className="radio"
                        checked={updateData.shieldMode === 'total'}
                        onChange={() => setUpdateData(prev => ({ ...prev, shieldMode: 'total' }))}
                      />
                      <span className="label-text">Total</span>
                    </label>
                  </div>
                </div>

                {updateData.shieldMode === 'total' && (
                  <div>
                    <label className="label cursor-pointer gap-2">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={updateData.totalShield}
                        onChange={(e) => setUpdateData(prev => ({ ...prev, totalShield: e.target.checked }))}
                      />
                      <span className="label-text font-semibold">Award Total Shield</span>
                    </label>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="table table-compact w-full">
                    <thead>
                      <tr>
                        <th>Challenge</th>
                        <th>Shield</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CHALLENGE_NAMES.map((name, index) => (
                        <tr key={index}>
                          <td className="font-medium">
                            Challenge {index + 1}: {name}
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              className="checkbox"
                              checked={updateData.challengeShields[index] || false}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setUpdateData(prev => {
                                  const newShields = [...prev.challengeShields];
                                  newShields[index] = checked;
                                  return { ...prev, challengeShields: newShields };
                                });
                              }}
                              disabled={updateData.shieldMode !== 'individual'}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="divider">Hint Settings</div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div>
                  <label className="label">
                    <span className="label-text">Hint Penalty %</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered input-sm w-20"
                    value={updateData.hintPenaltyPercent}
                    onChange={(e) => setUpdateData(prev => ({ ...prev, hintPenaltyPercent: parseInt(e.target.value) || 25 }))}
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label className="label">
                    <span className="label-text">Max Hints Per Challenge</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered input-sm w-20"
                    value={updateData.maxHintsPerChallenge}
                    onChange={(e) => setUpdateData(prev => ({ ...prev, maxHintsPerChallenge: parseInt(e.target.value) || 2 }))}
                    min="0"
                  />
                </div>
              </div>

              <div className="space-y-6">
                {CHALLENGE_NAMES.map((name, challengeIndex) => (
                  <div key={challengeIndex} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold">Challenge {challengeIndex + 1}: {name}</h4>
                      <label className="label cursor-pointer gap-2">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={updateData.challengeHintsEnabled[challengeIndex]}
                          onChange={(e) => {
                            setUpdateData(prev => {
                              const newEnabled = [...prev.challengeHintsEnabled];
                              newEnabled[challengeIndex] = e.target.checked;
                              return { ...prev, challengeHintsEnabled: newEnabled };
                            });
                          }}
                        />
                        <span className="label-text">Enable Hints</span>
                      </label>
                    </div>

                    {updateData.challengeHintsEnabled[challengeIndex] && (
                      <div className="space-y-2">
                        {(updateData.challengeHints[challengeIndex] || []).map((hint, hintIndex) => (
                          <div key={hintIndex} className="flex gap-2 items-center">
                            <span className="text-sm font-medium w-16">Hint {hintIndex + 1}:</span>
                            <textarea
                              className="textarea textarea-bordered flex-1"
                              rows="2"
                              value={hint}
                              onChange={(e) => handleHintChange(challengeIndex, hintIndex, e.target.value)}
                              placeholder="Enter hint text..."
                            />
                            <button
                              className="btn btn-sm btn-error"
                              onClick={() => removeHint(challengeIndex, hintIndex)}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => addHint(challengeIndex)}
                        >
                          + Add Hint
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="divider">Due Date</div>

            <div className="space-y-4">
              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-3">
                  <input 
                    type="checkbox" 
                    className="checkbox"
                    checked={updateData.dueDateEnabled}
                    onChange={(e) => setUpdateData(prev => ({ ...prev, dueDateEnabled: e.target.checked }))}
                  />
                  <span className="label-text font-semibold">Set due date for challenge series</span>
                </label>
              </div>
              
              {updateData.dueDateEnabled && (
                <div>
                  <label className="label">
                    <span className="label-text">Due date and time</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="input input-bordered w-64"
                    value={updateData.dueDate}
                    onChange={(e) => setUpdateData(prev => ({ ...prev, dueDate: e.target.value }))}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="card-actions justify-end mt-6 gap-3">
            <button
              className="btn btn-ghost"
              onClick={() => setShowUpdateModal(false)}
              disabled={updating}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleUpdateChallenge}
              disabled={updating}
            >
              {updating ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Updating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Update Challenge
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChallengeUpdateModal;
