import React, { useState, useEffect } from 'react';
import { Edit3, Save } from 'lucide-react';
import { CHALLENGE_NAMES } from '../../../constants/challengeConstants';
import { updateChallenge } from '../../../API/apiChallenge';
import IndivTotalToggle from '../IndivTotalToggle';
import toast from 'react-hot-toast';

const ChallengeUpdateModal = ({ 
  showUpdateModal, 
  setShowUpdateModal, 
  challengeData,
  fetchChallengeData,
  classroomId,
  setShowHintModal,
  setEditingHints
}) => {
  const [updating, setUpdating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeChallengeIndex, setActiveChallengeIndex] = useState(0);
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
    challengeHintsEnabled: [false, false, false, false, false, false, false],
    challengeHints: [[], [], [], [], [], [], []],
    hintPenaltyPercent: 25,
    maxHintsPerChallenge: 2,
    dueDateEnabled: false,
    dueDate: ''
  });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

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
        challengeHintsEnabled: challengeData.settings?.challengeHintsEnabled || [false, false, false, false, false, false, false],
        challengeHints: challengeData.settings?.challengeHints || [[], [], [], [], [], [], []],
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

  if (!showUpdateModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="card bg-base-100 w-full max-w-6xl my-4 sm:my-8 shadow-xl">
        <div className="card-body p-3 sm:p-5 lg:p-6">
          <div className="flex items-center gap-3 mb-4">
            <Edit3 className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl sm:text-2xl font-bold">Update Challenge Series</h2>
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

            <div className="divider">Configuration Map</div>

            {isMobile ? (
              <div className="space-y-4">
                <div className="overflow-x-auto mb-3">
                  <div className="flex gap-1.5 justify-start w-max min-w-full px-1">
                    {CHALLENGE_NAMES.map((name, index) => (
                      <button
                        key={index}
                        className={`btn btn-xs ${activeChallengeIndex === index ? 'btn-primary' : 'btn-outline'} min-w-[60px]`}
                        onClick={() => setActiveChallengeIndex(index)}
                      >
                        CH {index + 1}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="bg-base-200 p-3 rounded-lg">
                  <h3 className="text-base font-semibold mb-3">
                    CH {activeChallengeIndex + 1}
                    <div className="text-xs font-normal text-gray-600 mt-0.5">
                      {CHALLENGE_NAMES[activeChallengeIndex]}
                    </div>
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-sm font-medium">Hints Enabled</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-primary"
                          checked={!!updateData.challengeHintsEnabled[activeChallengeIndex]}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setUpdateData(prev => {
                              const arr = [...(prev.challengeHintsEnabled || [])];
                              while (arr.length <= activeChallengeIndex) arr.push(false);
                              arr[activeChallengeIndex] = checked;
                              return { ...prev, challengeHintsEnabled: arr };
                            });
                          }}
                        />
                        {updateData.challengeHintsEnabled[activeChallengeIndex] && (
                          <button
                            type="button"
                            className="btn btn-xs btn-outline btn-primary"
                            onClick={() => {
                              setEditingHints({ 
                                challengeIndex: activeChallengeIndex, 
                                challengeName: CHALLENGE_NAMES[activeChallengeIndex] 
                              });
                              setShowHintModal(true);
                            }}
                          >
                            Configure ({(updateData.challengeHints[activeChallengeIndex]?.length || 0)})
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-sm font-medium">Reward ₿its</span>
                      </label>
                      <div className="flex gap-2 items-center">
                        <div className={`flex-1 ${updateData.rewardMode === 'individual' ? '' : 'opacity-50'}`}>
                          <input
                            type="number"
                            className="input input-bordered input-sm w-full text-center"
                            value={updateData.challengeBits[activeChallengeIndex] ?? 0}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const value = raw === '' ? 0 : parseInt(raw) || 0;
                              setUpdateData(prev => {
                                const newBits = [...prev.challengeBits];
                                while (newBits.length <= activeChallengeIndex) newBits.push(0);
                                newBits[activeChallengeIndex] = raw === '' ? '' : value;
                                const total = newBits.reduce((sum, bits) => sum + (typeof bits === 'number' ? bits : 0), 0);
                                return { ...prev, challengeBits: newBits, totalRewardBits: prev.rewardMode === 'individual' ? total : prev.totalRewardBits };
                              });
                            }}
                            min="0"
                            disabled={updateData.rewardMode !== 'individual'}
                          />
                        </div>
                      </div>
                      <div className="mt-2">
                        <IndivTotalToggle
                          value={updateData.rewardMode}
                          onChange={(mode) => setUpdateData(prev => ({ ...prev, rewardMode: mode }))}
                        />
                      </div>
                      {updateData.rewardMode === 'total' && (
                        <div className="mt-2">
                          <label className="label py-1">
                            <span className="label-text text-xs">Total Reward ₿its</span>
                          </label>
                          <input
                            type="number"
                            className="input input-bordered input-sm w-full text-center"
                            value={updateData.totalRewardBits}
                            onChange={(e) => {
                              const value = e.target.value;
                              setUpdateData(prev => ({ ...prev, totalRewardBits: value === '' ? '' : parseInt(value) || 0 }));
                            }}
                            min="0"
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-sm font-medium">Multiplier</span>
                      </label>
                      <div className="flex gap-2 items-center">
                        <div className={`flex-1 ${updateData.multiplierMode === 'individual' ? '' : 'opacity-50'}`}>
                          <input
                            type="number"
                            step="0.1"
                            className="input input-bordered input-sm w-full text-center"
                            value={updateData.challengeMultipliers[activeChallengeIndex] ?? 1.0}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const value = raw === '' ? 1.0 : parseFloat(raw) || 1.0;
                              setUpdateData(prev => {
                                const newMults = [...prev.challengeMultipliers];
                                while (newMults.length <= activeChallengeIndex) newMults.push(1.0);
                                newMults[activeChallengeIndex] = raw === '' ? '' : value;
                                return { ...prev, challengeMultipliers: newMults };
                              });
                            }}
                            min="0"
                            disabled={updateData.multiplierMode !== 'individual'}
                          />
                        </div>
                      </div>
                      <div className="mt-2">
                        <IndivTotalToggle
                          value={updateData.multiplierMode}
                          onChange={(mode) => setUpdateData(prev => ({ ...prev, multiplierMode: mode }))}
                        />
                      </div>
                      {updateData.multiplierMode === 'total' && (
                        <div className="mt-2">
                          <label className="label py-1">
                            <span className="label-text text-xs">Total Multiplier</span>
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            className="input input-bordered input-sm w-full text-center"
                            value={updateData.totalMultiplier}
                            onChange={(e) => {
                              const value = e.target.value;
                              setUpdateData(prev => ({ ...prev, totalMultiplier: value === '' ? '' : parseFloat(value) || 1.0 }));
                            }}
                            min="0"
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-sm font-medium">Luck Factor</span>
                      </label>
                      <div className="flex gap-2 items-center">
                        <div className={`flex-1 ${updateData.luckMode === 'individual' ? '' : 'opacity-50'}`}>
                          <input
                            type="number"
                            step="0.1"
                            className="input input-bordered input-sm w-full text-center"
                            value={updateData.challengeLuck[activeChallengeIndex] ?? 1.0}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const value = raw === '' ? 1.0 : parseFloat(raw) || 1.0;
                              setUpdateData(prev => {
                                const newLuck = [...prev.challengeLuck];
                                while (newLuck.length <= activeChallengeIndex) newLuck.push(1.0);
                                newLuck[activeChallengeIndex] = raw === '' ? '' : value;
                                return { ...prev, challengeLuck: newLuck };
                              });
                            }}
                            min="1.0"
                            disabled={updateData.luckMode !== 'individual'}
                          />
                        </div>
                      </div>
                      <div className="mt-2">
                        <IndivTotalToggle
                          value={updateData.luckMode}
                          onChange={(mode) => setUpdateData(prev => ({ ...prev, luckMode: mode }))}
                        />
                      </div>
                      {updateData.luckMode === 'total' && (
                        <div className="mt-2">
                          <label className="label py-1">
                            <span className="label-text text-xs">Total Luck Factor</span>
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            className="input input-bordered input-sm w-full text-center"
                            value={updateData.totalLuck}
                            onChange={(e) => {
                              const value = e.target.value;
                              setUpdateData(prev => ({ ...prev, totalLuck: value === '' ? '' : parseFloat(value) || 1.0 }));
                            }}
                            min="1.0"
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-sm font-medium">Discount %</span>
                      </label>
                      <div className="flex gap-2 items-center">
                        <div className={`flex-1 ${updateData.discountMode === 'individual' ? '' : 'opacity-50'}`}>
                          <input
                            type="number"
                            className="input input-bordered input-sm w-full text-center"
                            value={updateData.challengeDiscounts[activeChallengeIndex] ?? 0}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const value = raw === '' ? 0 : parseInt(raw) || 0;
                              setUpdateData(prev => {
                                const newDiscounts = [...prev.challengeDiscounts];
                                while (newDiscounts.length <= activeChallengeIndex) newDiscounts.push(0);
                                newDiscounts[activeChallengeIndex] = raw === '' ? '' : value;
                                return { ...prev, challengeDiscounts: newDiscounts };
                              });
                            }}
                            min="0"
                            max="100"
                            disabled={updateData.discountMode !== 'individual'}
                          />
                        </div>
                      </div>
                      <div className="mt-2">
                        <IndivTotalToggle
                          value={updateData.discountMode}
                          onChange={(mode) => setUpdateData(prev => ({ ...prev, discountMode: mode }))}
                        />
                      </div>
                      {updateData.discountMode === 'total' && (
                        <div className="mt-2">
                          <label className="label py-1">
                            <span className="label-text text-xs">Total Discount %</span>
                          </label>
                          <input
                            type="number"
                            className="input input-bordered input-sm w-full text-center"
                            value={updateData.totalDiscount}
                            onChange={(e) => {
                              const value = e.target.value;
                              setUpdateData(prev => ({ ...prev, totalDiscount: value === '' ? '' : parseInt(value) || 0 }));
                            }}
                            min="0"
                            max="100"
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="form-control">
                      <label className="label justify-between py-1">
                        <span className="label-text text-sm font-medium">Shield</span>
                        <div className={`${updateData.shieldMode === 'individual' ? '' : 'opacity-50'}`}>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm checkbox-primary"
                            checked={!!updateData.challengeShields[activeChallengeIndex]}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setUpdateData(prev => {
                                const newShields = [...prev.challengeShields];
                                while (newShields.length <= activeChallengeIndex) newShields.push(false);
                                newShields[activeChallengeIndex] = checked;
                                return { ...prev, challengeShields: newShields };
                              });
                            }}
                            disabled={updateData.shieldMode !== 'individual'}
                          />
                        </div>
                      </label>
                      <div className="mt-2">
                        <IndivTotalToggle
                          value={updateData.shieldMode}
                          onChange={(mode) => setUpdateData(prev => ({ ...prev, shieldMode: mode }))}
                        />
                      </div>
                      {updateData.shieldMode === 'total' && (
                        <div className="mt-2 flex items-center justify-between">
                          <span className="label-text text-xs">Award Total Shield</span>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm checkbox-primary"
                            checked={!!updateData.totalShield}
                            onChange={(e) => setUpdateData(prev => ({ ...prev, totalShield: e.target.checked }))}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="bg-base-200 p-3 rounded-lg">
                  <h3 className="text-base font-semibold mb-3">Hint Settings</h3>
                  <div className="space-y-3">
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-sm font-medium">Penalty %</span>
                      </label>
                      <input
                        type="number"
                        className="input input-bordered input-sm w-full text-center"
                        value={updateData.hintPenaltyPercent}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          setUpdateData(prev => ({ 
                            ...prev, 
                            hintPenaltyPercent: isNaN(v) ? 25 : Math.min(100, Math.max(0, v)) 
                          }));
                        }}
                        min="0"
                        max="100"
                      />
                    </div>
                    
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-sm font-medium">Max Hints</span>
                      </label>
                      <input
                        type="number"
                        className="input input-bordered input-sm w-full text-center"
                        value={updateData.maxHintsPerChallenge}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          setUpdateData(prev => ({ 
                            ...prev, 
                            maxHintsPerChallenge: isNaN(v) ? 2 : Math.max(0, v) 
                          }));
                        }}
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto overflow-y-visible touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
                <table className="table table-compact w-full min-w-[1000px]">
                  <thead>
                    <tr className="sticky top-0 bg-base-100 z-20">
                      <th className="w-60 text-xs uppercase tracking-wide text-gray-500">Setting</th>
                      {CHALLENGE_NAMES.map((name, index) => (
                        <th key={index} className="text-center align-bottom min-w-[100px]">
                          <div className="text-[11px] uppercase tracking-wide text-gray-500">Ch {index + 1}</div>
                          <div className="text-xs font-medium text-gray-700 truncate max-w-[9rem]">{name}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="sticky left-0 bg-base-100 z-10">
                        <div className="flex items-center gap-3 flex-nowrap text-sm">
                          <span className="font-semibold inline-block w-36 shrink-0">Hints</span>
                          <span className="text-xs text-gray-500">Penalty:</span>
                          <input
                            type="number"
                            className="input input-bordered input-sm w-20 sm:w-16 text-center touch-manipulation"
                            value={updateData.hintPenaltyPercent}
                            onChange={(e) => {
                              const v = parseInt(e.target.value);
                              setUpdateData(prev => ({ ...prev, hintPenaltyPercent: isNaN(v) ? 25 : Math.min(100, Math.max(0, v)) }));
                            }}
                            min="0"
                            max="100"
                          />
                          <span className="text-xs">%</span>
                          <span className="text-xs text-gray-500">Max:</span>
                          <input
                            type="number"
                            className="input input-bordered input-sm w-18 sm:w-14 text-center touch-manipulation"
                            value={updateData.maxHintsPerChallenge}
                            onChange={(e) => {
                              const v = parseInt(e.target.value);
                              setUpdateData(prev => ({ ...prev, maxHintsPerChallenge: isNaN(v) ? 2 : Math.max(0, v) }));
                            }}
                            min="0"
                          />
                        </div>
                      </td>
                      {CHALLENGE_NAMES.map((challengeName, index) => (
                        <td key={index} className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm checkbox-primary"
                              checked={!!updateData.challengeHintsEnabled[index]}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setUpdateData(prev => {
                                  const arr = [...(prev.challengeHintsEnabled || [])];
                                  while (arr.length <= index) arr.push(false);
                                  arr[index] = checked;
                                  return { ...prev, challengeHintsEnabled: arr };
                                });
                              }}
                            />
                            {updateData.challengeHintsEnabled[index] && (
                              <button
                                type="button"
                                className="btn btn-xs btn-outline btn-primary min-h-[24px] h-6"
                                onClick={() => {
                                  setEditingHints({ challengeIndex: index, challengeName: CHALLENGE_NAMES[index] });
                                  setShowHintModal(true);
                                }}
                              >
                                {(updateData.challengeHints[index]?.length || 0)} hints
                              </button>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="sticky left-0 bg-base-100 z-10">
                        <div className="flex items-center gap-3 flex-nowrap text-sm">
                          <span className="font-semibold inline-block w-36 shrink-0">₿its</span>
                          <IndivTotalToggle
                            value={updateData.rewardMode}
                            onChange={(mode) => setUpdateData(prev => ({ ...prev, rewardMode: mode }))}
                          />
                          {updateData.rewardMode === 'total' && (
                            <input
                              type="number"
                              className="input input-bordered input-sm w-24 sm:w-24 text-center touch-manipulation"
                              value={updateData.totalRewardBits}
                              onChange={(e) => {
                                const value = e.target.value;
                                setUpdateData(prev => ({ ...prev, totalRewardBits: value === '' ? '' : parseInt(value) || 0 }));
                              }}
                              min="0"
                              placeholder="Total"
                            />
                          )}
                        </div>
                      </td>
                      {CHALLENGE_NAMES.map((_, index) => (
                        <td key={index} className="text-center">
                          <input
                            type="number"
                            className="input input-bordered input-sm w-20 sm:w-20 text-center touch-manipulation"
                            value={updateData.challengeBits[index] ?? 0}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const value = raw === '' ? 0 : parseInt(raw) || 0;
                              setUpdateData(prev => {
                                const newBits = [...prev.challengeBits];
                                while (newBits.length <= index) newBits.push(0);
                                newBits[index] = raw === '' ? '' : value;
                                const total = newBits.reduce((sum, bits) => sum + (typeof bits === 'number' ? bits : 0), 0);
                                return { ...prev, challengeBits: newBits, totalRewardBits: prev.rewardMode === 'individual' ? total : prev.totalRewardBits };
                              });
                            }}
                            min="0"
                            disabled={updateData.rewardMode !== 'individual'}
                          />
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="sticky left-0 bg-base-100 z-10">
                        <div className="flex items-center gap-3 flex-nowrap text-sm">
                          <span className="font-semibold inline-block w-36 shrink-0">Multiplier</span>
                          <IndivTotalToggle
                            value={updateData.multiplierMode}
                            onChange={(mode) => setUpdateData(prev => ({ ...prev, multiplierMode: mode }))}
                          />
                          {updateData.multiplierMode === 'total' && (
                            <input
                              type="number"
                              step="0.1"
                              className="input input-bordered input-sm w-24 sm:w-24 text-center touch-manipulation"
                              value={updateData.totalMultiplier}
                              onChange={(e) => {
                                const value = e.target.value;
                                setUpdateData(prev => ({ ...prev, totalMultiplier: value === '' ? '' : parseFloat(value) || 1.0 }));
                              }}
                              min="0"
                              placeholder="Total"
                            />
                          )}
                        </div>
                      </td>
                      {CHALLENGE_NAMES.map((_, index) => (
                        <td key={index} className="text-center">
                          <input
                            type="number"
                            step="0.1"
                            className="input input-bordered input-sm w-20 sm:w-20 text-center touch-manipulation"
                            value={updateData.challengeMultipliers[index] ?? 1.0}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const value = raw === '' ? 1.0 : parseFloat(raw) || 1.0;
                              setUpdateData(prev => {
                                const newMults = [...prev.challengeMultipliers];
                                while (newMults.length <= index) newMults.push(1.0);
                                newMults[index] = raw === '' ? '' : value;
                                return { ...prev, challengeMultipliers: newMults };
                              });
                            }}
                            min="0"
                            disabled={updateData.multiplierMode !== 'individual'}
                          />
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="sticky left-0 bg-base-100 z-10">
                        <div className="flex items-center gap-3 flex-nowrap text-sm">
                          <span className="font-semibold inline-block w-36 shrink-0">Luck</span>
                          <IndivTotalToggle
                            value={updateData.luckMode}
                            onChange={(mode) => setUpdateData(prev => ({ ...prev, luckMode: mode }))}
                          />
                          {updateData.luckMode === 'total' && (
                            <input
                              type="number"
                              step="0.1"
                              className="input input-bordered input-sm w-24 sm:w-24 text-center touch-manipulation"
                              value={updateData.totalLuck}
                              onChange={(e) => {
                                const value = e.target.value;
                                setUpdateData(prev => ({ ...prev, totalLuck: value === '' ? '' : parseFloat(value) || 1.0 }));
                              }}
                              min="1.0"
                              placeholder="Total"
                            />
                          )}
                        </div>
                      </td>
                      {CHALLENGE_NAMES.map((_, index) => (
                        <td key={index} className="text-center">
                          <input
                            type="number"
                            step="0.1"
                            className="input input-bordered input-sm w-20 sm:w-20 text-center touch-manipulation"
                            value={updateData.challengeLuck[index] ?? 1.0}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const value = raw === '' ? 1.0 : parseFloat(raw) || 1.0;
                              setUpdateData(prev => {
                                const newLuck = [...prev.challengeLuck];
                                while (newLuck.length <= index) newLuck.push(1.0);
                                newLuck[index] = raw === '' ? '' : value;
                                return { ...prev, challengeLuck: newLuck };
                              });
                            }}
                            min="1.0"
                            disabled={updateData.luckMode !== 'individual'}
                          />
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="sticky left-0 bg-base-100 z-10">
                        <div className="flex items-center gap-3 flex-nowrap text-sm">
                          <span className="font-semibold inline-block w-36 shrink-0">Discount %</span>
                          <IndivTotalToggle
                            value={updateData.discountMode}
                            onChange={(mode) => setUpdateData(prev => ({ ...prev, discountMode: mode }))}
                          />
                          {updateData.discountMode === 'total' && (
                            <input
                              type="number"
                              className="input input-bordered input-sm w-24 sm:w-24 text-center touch-manipulation"
                              value={updateData.totalDiscount}
                              onChange={(e) => {
                                const value = e.target.value;
                                setUpdateData(prev => ({ ...prev, totalDiscount: value === '' ? '' : parseInt(value) || 0 }));
                              }}
                              min="0"
                              max="100"
                              placeholder="Total"
                            />
                          )}
                        </div>
                      </td>
                      {CHALLENGE_NAMES.map((_, index) => (
                        <td key={index} className="text-center">
                          <input
                            type="number"
                            className="input input-bordered input-sm w-20 sm:w-20 text-center touch-manipulation"
                            value={updateData.challengeDiscounts[index] ?? 0}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const value = raw === '' ? 0 : parseInt(raw) || 0;
                              setUpdateData(prev => {
                                const newDiscounts = [...prev.challengeDiscounts];
                                while (newDiscounts.length <= index) newDiscounts.push(0);
                                newDiscounts[index] = raw === '' ? '' : value;
                                return { ...prev, challengeDiscounts: newDiscounts };
                              });
                            }}
                            min="0"
                            max="100"
                            disabled={updateData.discountMode !== 'individual'}
                          />
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="sticky left-0 bg-base-100 z-10">
                        <div className="flex items-center gap-3 flex-nowrap text-sm">
                          <span className="font-semibold inline-block w-36 shrink-0">Shield</span>
                          <IndivTotalToggle
                            value={updateData.shieldMode}
                            onChange={(mode) => setUpdateData(prev => ({ ...prev, shieldMode: mode }))}
                          />
                          {updateData.shieldMode === 'total' && (
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm checkbox-primary"
                              title="Award shield"
                              aria-label="Award shield"
                              checked={!!updateData.totalShield}
                              onChange={(e) => setUpdateData(prev => ({ ...prev, totalShield: e.target.checked }))}
                            />
                          )}
                        </div>
                      </td>
                      {CHALLENGE_NAMES.map((_, index) => (
                        <td key={index} className="text-center">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm checkbox-primary"
                            checked={!!updateData.challengeShields[index]}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setUpdateData(prev => {
                                const newShields = [...prev.challengeShields];
                                while (newShields.length <= index) newShields.push(false);
                                newShields[index] = checked;
                                return { ...prev, challengeShields: newShields };
                              });
                            }}
                            disabled={updateData.shieldMode !== 'individual'}
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-base-200 p-4 rounded-lg mt-6">
            <h3 className="font-bold text-lg mb-4">📅 Due Dates & Retries</h3>
            
            <div className="divider">Due Date</div>
            <div className="form-control mb-4">
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
              <div className="mb-4">
                <label className="label">
                  <span className="label-text">Due date and time</span>
                </label>
                <input
                  type="datetime-local"
                  className="input input-bordered w-full"
                  value={updateData.dueDate}
                  onChange={(e) => setUpdateData(prev => ({ ...prev, dueDate: e.target.value }))}
                  min={new Date().toISOString().slice(0, 16)}
                />
                <div className="text-sm text-gray-500 mt-1">Students must complete all challenges by this date and time</div>
              </div>
            )}
          </div>

          <div className="card-actions flex-col sm:flex-row justify-end mt-6 gap-3">
            <button
              className="btn btn-ghost w-full sm:w-auto"
              onClick={() => setShowUpdateModal(false)}
              disabled={updating}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary w-full sm:w-auto"
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
