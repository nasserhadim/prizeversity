import { useState, useEffect } from 'react';
import { Settings, Zap } from 'lucide-react';
import { CHALLENGE_NAMES } from '../../../constants/challengeConstants';
import { configureChallenge, initiateChallenge } from '../../../API/apiChallenge';
import IndivTotalToggle from '../IndivTotalToggle';
import toast from 'react-hot-toast';

const ChallengeConfigModal = ({ 
  showConfigModal, 
  setShowConfigModal, 
  challengeConfig, 
  setChallengeConfig,
  configuring,
  setConfiguring,
  fetchChallengeData,
  classroomId,
  templates,
  handleLoadTemplate,
  handleDeleteTemplate,
  setShowSaveTemplateModal,
  setShowHintModal,
  setEditingHints
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const [activeChallengeIndex, setActiveChallengeIndex] = useState(0);
  const [challengePassword, setChallengePassword] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  
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
  
  const handleConfigureChallenge = async () => {
    try {
      setConfiguring(true);
      const settings = {
        rewardMode: challengeConfig.rewardMode,
        multiplierMode: challengeConfig.multiplierMode,
        luckMode: challengeConfig.luckMode,
        discountMode: challengeConfig.discountMode,
        shieldMode: challengeConfig.shieldMode,
        attackMode: challengeConfig.attackMode,
        difficulty: 'medium'
      };

      if (challengeConfig.rewardMode === 'individual') {
        settings.challengeBits = challengeConfig.challengeBits.map(bits => bits || 0);
      } else {
        settings.totalRewardBits = challengeConfig.totalRewardBits || 0;
        settings.challengeBits = challengeConfig.challengeBits.map((_, index) => 
          index === challengeConfig.challengeBits.length - 1 ? (challengeConfig.totalRewardBits || 0) : 0
        );
      }

      if (challengeConfig.multiplierMode === 'individual') {
        settings.challengeMultipliers = challengeConfig.challengeMultipliers.map(mult => mult || 1.0);
      } else {
        settings.totalMultiplier = challengeConfig.totalMultiplier || 1.0;
        settings.challengeMultipliers = challengeConfig.challengeMultipliers.map(() => 1.0);
      }

      if (challengeConfig.luckMode === 'individual') {
        settings.challengeLuck = challengeConfig.challengeLuck.map(luck => luck || 1.0);
      } else {
        settings.totalLuck = challengeConfig.totalLuck || 1.0;
        settings.challengeLuck = challengeConfig.challengeLuck.map(() => 1.0);
      }

      if (challengeConfig.discountMode === 'individual') {
        settings.challengeDiscounts = challengeConfig.challengeDiscounts.map(discount => discount || 0);
      } else {
        settings.totalDiscount = challengeConfig.totalDiscount || 0;
        settings.challengeDiscounts = challengeConfig.challengeDiscounts.map(() => 0);
      }

      if (challengeConfig.shieldMode === 'individual') {
        settings.challengeShields = challengeConfig.challengeShields.map(shield => shield || false);
      } else {
        settings.totalShield = challengeConfig.totalShield || false;
        settings.challengeShields = challengeConfig.challengeShields.map(() => false);
      }

      settings.challengeHintsEnabled = (challengeConfig.challengeHintsEnabled || []).map(Boolean);
      settings.challengeHints = challengeConfig.challengeHints || [[], [], [], [], [], [], []];
      settings.hintPenaltyPercent = Number.isFinite(challengeConfig.hintPenaltyPercent) ? challengeConfig.hintPenaltyPercent : 25;
      settings.maxHintsPerChallenge = Number.isFinite(challengeConfig.maxHintsPerChallenge) ? challengeConfig.maxHintsPerChallenge : 2;

      settings.dueDateEnabled = challengeConfig.dueDateEnabled || false;
      
      if (challengeConfig.dueDateEnabled && challengeConfig.dueDate) {
        const [datePart, timePart] = challengeConfig.dueDate.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);
        
        const localDate = new Date(year, month - 1, day, hours, minutes);
        const utcISOString = localDate.toISOString();
        settings.dueDate = utcISOString;
      } else {
        settings.dueDate = '';
      }

      await configureChallenge(classroomId, challengeConfig.title, settings);
      
      setShowPasswordPrompt(true);
    } catch (error) {
      console.error('Error configuring challenge:', error);
      toast.error(error.message || 'Failed to configure challenge');
    } finally {
      setConfiguring(false);
    }
  };

  const handleInitiateWithPassword = async () => {
    try {
      setConfiguring(true);
      const response = await initiateChallenge(classroomId, challengePassword);
      toast.success(response.message);
      setShowPasswordPrompt(false);
      setShowConfigModal(false);
      setChallengePassword('');
      await fetchChallengeData();
    } catch (error) {
      console.error('Error initiating challenge:', error);
      toast.error(error.message || 'Failed to initiate challenge');
    } finally {
      setConfiguring(false);
    }
  };

  if (!showConfigModal) return null;

  if (showPasswordPrompt) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="card bg-base-100 w-full max-w-md shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-warning">🔒 Challenge Authorization Required</h2>
            <p className="text-sm text-gray-600 mb-4">
              Please enter the challenge password to initiate the series.
            </p>
            <div className="form-control">
              <input
                type="password"
                placeholder="Enter challenge password"
                className="input input-bordered w-full"
                value={challengePassword}
                onChange={(e) => setChallengePassword(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && challengePassword.trim()) {
                    handleInitiateWithPassword();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="card-actions justify-end mt-4 gap-2">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowPasswordPrompt(false);
                  setChallengePassword('');
                }}
                disabled={configuring}
              >
                Cancel
              </button>
              <button
                className="btn btn-error"
                onClick={handleInitiateWithPassword}
                disabled={configuring || !challengePassword.trim()}
              >
                {configuring ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Launching...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Launch Challenge
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="card bg-base-100 w-full max-w-6xl my-8 shadow-xl">
        <div className="card-body p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-6 h-6 text-red-500" />
            <h2 className="text-2xl font-bold">Configure Challenge Series</h2>
          </div>

          <div className="bg-base-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Templates</h3>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => setShowSaveTemplateModal(true)}
              >
                Save Current Config
              </button>
            </div>
            
            {templates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {templates.map((template) => (
                  <div key={template._id} className="flex items-center justify-between bg-base-100 p-3 rounded">
                    <div>
                      <div className="font-medium">{template.name}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(template.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        className="btn btn-xs btn-ghost"
                        onClick={() => handleLoadTemplate(template, setChallengeConfig)}
                        title="Load template"
                      >
                        Load
                      </button>
                      <button
                        className="btn btn-xs btn-ghost text-error"
                        onClick={() => handleDeleteTemplate(template._id, template.name)}
                        title="Delete template"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-3">
                No saved templates. Configure your settings below and save them as a template.
              </div>
            )}
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="label">
                <span className="label-text font-semibold">Challenge Series Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={challengeConfig.title}
                onChange={(e) => setChallengeConfig(prev => ({ ...prev, title: e.target.value }))}
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
                        Ch {index + 1}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="bg-base-200 p-3 rounded-lg">
                  <h3 className="text-base font-semibold mb-3">
                    Challenge {activeChallengeIndex + 1}
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
                          checked={!!challengeConfig.challengeHintsEnabled[activeChallengeIndex]}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setChallengeConfig(prev => {
                              const arr = [...(prev.challengeHintsEnabled || [])];
                              while (arr.length <= activeChallengeIndex) arr.push(false);
                              arr[activeChallengeIndex] = checked;
                              return { ...prev, challengeHintsEnabled: arr };
                            });
                          }}
                        />
                        {challengeConfig.challengeHintsEnabled[activeChallengeIndex] && (
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
                            Configure ({(challengeConfig.challengeHints[activeChallengeIndex]?.length || 0)})
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-sm font-medium">Reward Bits</span>
                      </label>
                      <input
                        type="number"
                        className="input input-bordered input-sm w-full text-center"
                        value={challengeConfig.challengeBits[activeChallengeIndex] ?? 0}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const value = raw === '' ? 0 : parseInt(raw) || 0;
                          setChallengeConfig(prev => {
                            const newBits = [...prev.challengeBits];
                            while (newBits.length <= activeChallengeIndex) newBits.push(0);
                            newBits[activeChallengeIndex] = raw === '' ? '' : value;
                            const total = newBits.reduce((sum, bits) => sum + (typeof bits === 'number' ? bits : 0), 0);
                            return { ...prev, challengeBits: newBits, totalRewardBits: prev.rewardMode === 'individual' ? total : prev.totalRewardBits };
                          });
                        }}
                        min="0"
                        disabled={challengeConfig.rewardMode !== 'individual'}
                      />
                    </div>
                    
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-sm font-medium">Multiplier</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        className="input input-bordered input-sm w-full text-center"
                        value={challengeConfig.challengeMultipliers[activeChallengeIndex] ?? 1.0}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const value = raw === '' ? 1.0 : parseFloat(raw) || 1.0;
                          setChallengeConfig(prev => {
                            const newMults = [...prev.challengeMultipliers];
                            while (newMults.length <= activeChallengeIndex) newMults.push(1.0);
                            newMults[activeChallengeIndex] = raw === '' ? '' : value;
                            return { ...prev, challengeMultipliers: newMults };
                          });
                        }}
                        min="0"
                        disabled={challengeConfig.multiplierMode !== 'individual'}
                      />
                    </div>
                    
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-sm font-medium">Luck Factor</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        className="input input-bordered input-sm w-full text-center"
                        value={challengeConfig.challengeLuck[activeChallengeIndex] ?? 1.0}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const value = raw === '' ? 1.0 : parseFloat(raw) || 1.0;
                          setChallengeConfig(prev => {
                            const newLuck = [...prev.challengeLuck];
                            while (newLuck.length <= activeChallengeIndex) newLuck.push(1.0);
                            newLuck[activeChallengeIndex] = raw === '' ? '' : value;
                            return { ...prev, challengeLuck: newLuck };
                          });
                        }}
                        min="1.0"
                        disabled={challengeConfig.luckMode !== 'individual'}
                      />
                    </div>
                    
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-sm font-medium">Discount %</span>
                      </label>
                      <input
                        type="number"
                        className="input input-bordered input-sm w-full text-center"
                        value={challengeConfig.challengeDiscounts[activeChallengeIndex] ?? 0}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const value = raw === '' ? 0 : parseInt(raw) || 0;
                          setChallengeConfig(prev => {
                            const newDiscounts = [...prev.challengeDiscounts];
                            while (newDiscounts.length <= activeChallengeIndex) newDiscounts.push(0);
                            newDiscounts[activeChallengeIndex] = raw === '' ? '' : value;
                            return { ...prev, challengeDiscounts: newDiscounts };
                          });
                        }}
                        min="0"
                        max="100"
                        disabled={challengeConfig.discountMode !== 'individual'}
                      />
                    </div>
                    
                    <div className="form-control">
                      <label className="label justify-between py-1">
                        <span className="label-text text-sm font-medium">Shield</span>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-primary"
                          checked={!!challengeConfig.challengeShields[activeChallengeIndex]}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setChallengeConfig(prev => {
                              const newShields = [...prev.challengeShields];
                              while (newShields.length <= activeChallengeIndex) newShields.push(false);
                              newShields[activeChallengeIndex] = checked;
                              return { ...prev, challengeShields: newShields };
                            });
                          }}
                          disabled={challengeConfig.shieldMode !== 'individual'}
                        />
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="bg-base-200 p-3 rounded-lg">
                  <h3 className="text-base font-semibold mb-3">Global Settings</h3>
                  
                  <div className="space-y-4">
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-sm font-medium">Reward Mode</span>
                      </label>
                      <IndivTotalToggle
                        value={challengeConfig.rewardMode}
                        onChange={(mode) => setChallengeConfig(prev => ({ ...prev, rewardMode: mode }))}
                      />
                      {challengeConfig.rewardMode === 'total' && (
                        <div className="mt-2">
                          <label className="label py-1">
                            <span className="label-text text-xs">Total Reward Bits</span>
                          </label>
                          <input
                            type="number"
                            className="input input-bordered input-sm w-full text-center"
                            value={challengeConfig.totalRewardBits}
                            onChange={(e) => {
                              const value = e.target.value;
                              setChallengeConfig(prev => ({ 
                                ...prev, 
                                totalRewardBits: value === '' ? '' : parseInt(value) || 0 
                              }));
                            }}
                            min="0"
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-sm font-medium">Multiplier Mode</span>
                      </label>
                      <IndivTotalToggle
                        value={challengeConfig.multiplierMode}
                        onChange={(mode) => setChallengeConfig(prev => ({ ...prev, multiplierMode: mode }))}
                      />
                      {challengeConfig.multiplierMode === 'total' && (
                        <div className="mt-2">
                          <label className="label py-1">
                            <span className="label-text text-xs">Total Multiplier</span>
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            className="input input-bordered input-sm w-full text-center"
                            value={challengeConfig.totalMultiplier}
                            onChange={(e) => {
                              const value = e.target.value;
                              setChallengeConfig(prev => ({ 
                                ...prev, 
                                totalMultiplier: value === '' ? '' : parseFloat(value) || 1.0 
                              }));
                            }}
                            min="0"
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-sm font-medium">Luck Mode</span>
                      </label>
                      <IndivTotalToggle
                        value={challengeConfig.luckMode}
                        onChange={(mode) => setChallengeConfig(prev => ({ ...prev, luckMode: mode }))}
                      />
                      {challengeConfig.luckMode === 'total' && (
                        <div className="mt-2">
                          <label className="label py-1">
                            <span className="label-text text-xs">Total Luck Factor</span>
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            className="input input-bordered input-sm w-full text-center"
                            value={challengeConfig.totalLuck}
                            onChange={(e) => {
                              const value = e.target.value;
                              setChallengeConfig(prev => ({ 
                                ...prev, 
                                totalLuck: value === '' ? '' : parseFloat(value) || 1.0 
                              }));
                            }}
                            min="1.0"
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-sm font-medium">Discount Mode</span>
                      </label>
                      <IndivTotalToggle
                        value={challengeConfig.discountMode}
                        onChange={(mode) => setChallengeConfig(prev => ({ ...prev, discountMode: mode }))}
                      />
                      {challengeConfig.discountMode === 'total' && (
                        <div className="mt-2">
                          <label className="label py-1">
                            <span className="label-text text-xs">Total Discount %</span>
                          </label>
                          <input
                            type="number"
                            className="input input-bordered input-sm w-full text-center"
                            value={challengeConfig.totalDiscount}
                            onChange={(e) => {
                              const value = e.target.value;
                              setChallengeConfig(prev => ({ 
                                ...prev, 
                                totalDiscount: value === '' ? '' : parseInt(value) || 0 
                              }));
                            }}
                            min="0"
                            max="100"
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-sm font-medium">Shield Mode</span>
                      </label>
                      <IndivTotalToggle
                        value={challengeConfig.shieldMode}
                        onChange={(mode) => setChallengeConfig(prev => ({ ...prev, shieldMode: mode }))}
                      />
                      {challengeConfig.shieldMode === 'total' && (
                        <div className="mt-2 flex items-center justify-between">
                          <span className="label-text text-xs">Award Total Shield</span>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm checkbox-primary"
                            checked={!!challengeConfig.totalShield}
                            onChange={(e) => setChallengeConfig(prev => ({ 
                              ...prev, 
                              totalShield: e.target.checked 
                            }))}
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-sm font-medium">Hint Settings</span>
                      </label>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xs">Penalty:</span>
                          <input
                            type="number"
                            className="input input-bordered input-sm w-20 text-center"
                            value={challengeConfig.hintPenaltyPercent}
                            onChange={(e) => {
                              const v = parseInt(e.target.value);
                              setChallengeConfig(prev => ({ 
                                ...prev, 
                                hintPenaltyPercent: isNaN(v) ? 25 : Math.min(100, Math.max(0, v)) 
                              }));
                            }}
                            min="0"
                            max="100"
                          />
                          <span className="text-xs">%</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs">Max hints:</span>
                          <input
                            type="number"
                            className="input input-bordered input-sm w-20 text-center"
                            value={challengeConfig.maxHintsPerChallenge}
                            onChange={(e) => {
                              const v = parseInt(e.target.value);
                              setChallengeConfig(prev => ({ 
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
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
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
                            value={challengeConfig.hintPenaltyPercent}
                            onChange={(e) => {
                              const v = parseInt(e.target.value);
                              setChallengeConfig(prev => ({ ...prev, hintPenaltyPercent: isNaN(v) ? 25 : Math.min(100, Math.max(0, v)) }));
                            }}
                            min="0"
                            max="100"
                          />
                          <span className="text-xs">%</span>
                          <span className="text-xs text-gray-500">Max:</span>
                          <input
                            type="number"
                            className="input input-bordered input-sm w-18 sm:w-14 text-center touch-manipulation"
                            value={challengeConfig.maxHintsPerChallenge}
                            onChange={(e) => {
                              const v = parseInt(e.target.value);
                              setChallengeConfig(prev => ({ ...prev, maxHintsPerChallenge: isNaN(v) ? 2 : Math.max(0, v) }));
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
                              checked={!!challengeConfig.challengeHintsEnabled[index]}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setChallengeConfig(prev => {
                                  const arr = [...(prev.challengeHintsEnabled || [])];
                                  while (arr.length <= index) arr.push(false);
                                  arr[index] = checked;
                                  return { ...prev, challengeHintsEnabled: arr };
                                });
                              }}
                            />
                            {challengeConfig.challengeHintsEnabled[index] && (
                              <button
                                type="button"
                                className="btn btn-xs btn-outline btn-primary"
                                onClick={() => {
                                  setEditingHints({ challengeIndex: index, challengeName });
                                  setShowHintModal(true);
                                }}
                              >
                                {(challengeConfig.challengeHints[index]?.length || 0)} hints
                              </button>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="sticky left-0 bg-base-100 z-10">
                        <div className="flex items-center gap-3 flex-nowrap text-sm">
                          <span className="font-semibold inline-block w-36 shrink-0">Bits</span>
                          <IndivTotalToggle
                            value={challengeConfig.rewardMode}
                            onChange={(mode) => setChallengeConfig(prev => ({ ...prev, rewardMode: mode }))}
                          />
                          {challengeConfig.rewardMode === 'total' && (
                            <input
                              type="number"
                              className="input input-bordered input-sm w-24 sm:w-24 text-center touch-manipulation"
                              value={challengeConfig.totalRewardBits}
                              onChange={(e) => {
                                const value = e.target.value;
                                setChallengeConfig(prev => ({ ...prev, totalRewardBits: value === '' ? '' : parseInt(value) || 0 }));
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
                            value={challengeConfig.challengeBits[index] ?? 0}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const value = raw === '' ? 0 : parseInt(raw) || 0;
                              setChallengeConfig(prev => {
                                const newBits = [...prev.challengeBits];
                                while (newBits.length <= index) newBits.push(0);
                                newBits[index] = raw === '' ? '' : value;
                                const total = newBits.reduce((sum, bits) => sum + (typeof bits === 'number' ? bits : 0), 0);
                                return { ...prev, challengeBits: newBits, totalRewardBits: prev.rewardMode === 'individual' ? total : prev.totalRewardBits };
                              });
                            }}
                            min="0"
                            disabled={challengeConfig.rewardMode !== 'individual'}
                          />
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="sticky left-0 bg-base-100 z-10">
                        <div className="flex items-center gap-3 flex-nowrap text-sm">
                          <span className="font-semibold inline-block w-36 shrink-0">Multiplier</span>
                          <IndivTotalToggle
                            value={challengeConfig.multiplierMode}
                            onChange={(mode) => setChallengeConfig(prev => ({ ...prev, multiplierMode: mode }))}
                          />
                          {challengeConfig.multiplierMode === 'total' && (
                            <input
                              type="number"
                              step="0.1"
                              className="input input-bordered input-sm w-24 sm:w-24 text-center touch-manipulation"
                              value={challengeConfig.totalMultiplier}
                              onChange={(e) => {
                                const value = e.target.value;
                                setChallengeConfig(prev => ({ ...prev, totalMultiplier: value === '' ? '' : parseFloat(value) || 1.0 }));
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
                            value={challengeConfig.challengeMultipliers[index] ?? 1.0}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const value = raw === '' ? 1.0 : parseFloat(raw) || 1.0;
                              setChallengeConfig(prev => {
                                const newMults = [...prev.challengeMultipliers];
                                while (newMults.length <= index) newMults.push(1.0);
                                newMults[index] = raw === '' ? '' : value;
                                return { ...prev, challengeMultipliers: newMults };
                              });
                            }}
                            min="0"
                            disabled={challengeConfig.multiplierMode !== 'individual'}
                          />
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="sticky left-0 bg-base-100 z-10">
                        <div className="flex items-center gap-3 flex-nowrap text-sm">
                          <span className="font-semibold inline-block w-36 shrink-0">Luck</span>
                          <IndivTotalToggle
                            value={challengeConfig.luckMode}
                            onChange={(mode) => setChallengeConfig(prev => ({ ...prev, luckMode: mode }))}
                          />
                          {challengeConfig.luckMode === 'total' && (
                            <input
                              type="number"
                              step="0.1"
                              className="input input-bordered input-sm w-24 sm:w-24 text-center touch-manipulation"
                              value={challengeConfig.totalLuck}
                              onChange={(e) => {
                                const value = e.target.value;
                                setChallengeConfig(prev => ({ ...prev, totalLuck: value === '' ? '' : parseFloat(value) || 1.0 }));
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
                            value={challengeConfig.challengeLuck[index] ?? 1.0}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const value = raw === '' ? 1.0 : parseFloat(raw) || 1.0;
                              setChallengeConfig(prev => {
                                const newLuck = [...prev.challengeLuck];
                                while (newLuck.length <= index) newLuck.push(1.0);
                                newLuck[index] = raw === '' ? '' : value;
                                return { ...prev, challengeLuck: newLuck };
                              });
                            }}
                            min="1.0"
                            disabled={challengeConfig.luckMode !== 'individual'}
                          />
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="sticky left-0 bg-base-100 z-10">
                        <div className="flex items-center gap-3 flex-nowrap text-sm">
                          <span className="font-semibold inline-block w-36 shrink-0">Discount %</span>
                          <IndivTotalToggle
                            value={challengeConfig.discountMode}
                            onChange={(mode) => setChallengeConfig(prev => ({ ...prev, discountMode: mode }))}
                          />
                          {challengeConfig.discountMode === 'total' && (
                            <input
                              type="number"
                              className="input input-bordered input-sm w-24 sm:w-24 text-center touch-manipulation"
                              value={challengeConfig.totalDiscount}
                              onChange={(e) => {
                                const value = e.target.value;
                                setChallengeConfig(prev => ({ ...prev, totalDiscount: value === '' ? '' : parseInt(value) || 0 }));
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
                            value={challengeConfig.challengeDiscounts[index] ?? 0}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const value = raw === '' ? 0 : parseInt(raw) || 0;
                              setChallengeConfig(prev => {
                                const newDiscounts = [...prev.challengeDiscounts];
                                while (newDiscounts.length <= index) newDiscounts.push(0);
                                newDiscounts[index] = raw === '' ? '' : value;
                                return { ...prev, challengeDiscounts: newDiscounts };
                              });
                            }}
                            min="0"
                            max="100"
                            disabled={challengeConfig.discountMode !== 'individual'}
                          />
                        </td>
                      ))}
                    </tr>

                    <tr>
                      <td className="sticky left-0 bg-base-100 z-10">
                        <div className="flex items-center gap-3 flex-nowrap text-sm">
                          <span className="font-semibold inline-block w-36 shrink-0">Shield</span>
                          <IndivTotalToggle
                            value={challengeConfig.shieldMode}
                            onChange={(mode) => setChallengeConfig(prev => ({ ...prev, shieldMode: mode }))}
                          />
                          {challengeConfig.shieldMode === 'total' && (
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm checkbox-primary"
                              title="Award shield"
                              aria-label="Award shield"
                              checked={!!challengeConfig.totalShield}
                              onChange={(e) => setChallengeConfig(prev => ({ ...prev, totalShield: e.target.checked }))}
                            />
                          )}
                        </div>
                      </td>
                      {CHALLENGE_NAMES.map((_, index) => (
                        <td key={index} className="text-center">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm checkbox-primary"
                            checked={!!challengeConfig.challengeShields[index]}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setChallengeConfig(prev => {
                                const newShields = [...prev.challengeShields];
                                while (newShields.length <= index) newShields.push(false);
                                newShields[index] = checked;
                                return { ...prev, challengeShields: newShields };
                              });
                            }}
                            disabled={challengeConfig.shieldMode !== 'individual'}
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-base-200 p-4 rounded-lg">
            <h3 className="font-bold text-lg mb-4">📅 Due Dates & Retries</h3>
            
            <div className="divider">Due Date</div>
            <div className="form-control mb-4">
              <label className="label cursor-pointer justify-start gap-3">
                <input 
                  type="checkbox" 
                  className="checkbox"
                  checked={challengeConfig.dueDateEnabled}
                  onChange={(e) => setChallengeConfig(prev => ({ ...prev, dueDateEnabled: e.target.checked }))}
                />
                <span className="label-text font-semibold">Set due date for challenge series</span>
              </label>
            </div>
            
            {challengeConfig.dueDateEnabled && (
              <div className="ml-6 mb-4">
                <label className="label">
                  <span className="label-text">Due date and time</span>
                </label>
                <input
                  type="datetime-local"
                  className="input input-bordered w-full max-w-64"
                  value={challengeConfig.dueDate}
                  onChange={(e) => setChallengeConfig(prev => ({ ...prev, dueDate: e.target.value }))}
                  min={new Date().toISOString().slice(0, 16)}
                />
                <div className="text-sm text-gray-500 mt-1">Students must complete all challenges by this date and time</div>
              </div>
            )}
          </div>

          <div className="card-actions justify-end mt-6 gap-3">
            <button
              className="btn btn-ghost"
              onClick={() => setShowConfigModal(false)}
              disabled={configuring}
            >
              Cancel
            </button>
            <button
              className="btn btn-error"
              onClick={handleConfigureChallenge}
              disabled={configuring}
            >
              {configuring ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Configuring...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Configure & Launch Series
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChallengeConfigModal;