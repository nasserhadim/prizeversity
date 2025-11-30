import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { TrendingUp, Info } from 'lucide-react'; // <-- ADD Info

const XPSettings = ({ classroomId }) => {
  const [settings, setSettings] = useState({
    enabled: true,
    bitsEarned: 1,
    bitsSpent: 0.5,
    statIncrease: 10,
    dailyCheckIn: 5,
    challengeCompletion: 20,
    mysteryBox: 3,
    groupJoin: 15,
    levelingFormula: 'exponential',
    baseXPForLevel2: 100,
    bitsXPBasis: 'final'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, [classroomId]);

  const fetchSettings = async () => {
    try {
      const res = await axios.get(
        `/api/xp/classroom/${classroomId}/settings`,
        { withCredentials: true }
      );
      setSettings(prev => ({ ...prev, ...res.data, bitsXPBasis: res.data?.bitsXPBasis || 'final' }));
    } catch (err) {
      toast.error('Failed to load XP settings');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    
    try {
      await axios.patch(
        `/api/xp/classroom/${classroomId}/settings`,
        settings,
        { withCredentials: true }
      );
      toast.success('XP settings updated successfully');
    } catch (err) {
      toast.error('Failed to update XP settings');
    }
  };

  if (loading) {
    return <div className="text-center">Loading XP settings...</div>;
  }

  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body">
        <h2 className="card-title flex items-center gap-2">
          <TrendingUp className="w-6 h-6" />
          XP & Leveling Settings
        </h2>

        <form onSubmit={handleUpdate} className="space-y-4">
          {/* Enable/Disable XP System */}
          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-4">
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={settings?.enabled ?? true}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              />
              <span className="label-text">Enable XP System</span>
            </label>
          </div>

          {settings?.enabled && (
            <>
              {/* Leveling Formula */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Leveling Formula</span>
                </label>
                <select
                  className="select select-bordered"
                  value={settings?.levelingFormula || 'exponential'}
                  onChange={(e) => setSettings({ ...settings, levelingFormula: e.target.value })}
                >
                  <option value="exponential">Exponential (Recommended)</option>
                  <option value="linear">Linear</option>
                  <option value="logarithmic">Logarithmic</option>
                </select>
                <label className="label">
                  <span className="label-text-alt text-gray-600">
                    {settings?.levelingFormula === 'exponential' && 'Each level requires 1.5x more XP'}
                    {settings?.levelingFormula === 'linear' && 'Each level requires same amount of XP'}
                    {settings?.levelingFormula === 'logarithmic' && 'Later levels require progressively less XP'}
                  </span>
                </label>
              </div>

              {/* Base XP for Level 2 */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Base XP for Level 2</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered"
                  value={settings?.baseXPForLevel2 || 100}
                  onChange={(e) => setSettings({ ...settings, baseXPForLevel2: parseInt(e.target.value) })}
                  min={10}
                />
                <label className="label">
                  <span className="label-text-alt text-gray-600">
                    Recommended: 100 XP
                  </span>
                </label>
              </div>

              {/* XP Gain Rates */}
              <div className="divider">XP Gain Rates</div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <div className="flex items-center gap-2">
                      <span className="label-text">Bits Earned</span>
                      <span
                        className="tooltip tooltip-bottom"
                        data-tip="Includes bits from teacher/admin balance adjustments (including group adjustments), challenges (if configured), attacks (swap/drain), and feedback rewards (if enabled). Some bit awards may yield more XP depending on multipliers and the 'bits→XP basis' setting."
                      >
                        <Info className="w-4 h-4 text-base-content/60" />
                      </span>
                    </div>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    value={settings?.bitsEarned ?? 1}
                    onChange={(e) => setSettings({ ...settings, bitsEarned: parseFloat(e.target.value) })}
                    min={0}
                    step={0.1}
                  />
                  <label className="label">
                    <span className="label-text-alt">XP per bit earned</span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label">
                    <div className="flex items-center gap-2">
                      <span className="label-text">Bits Spent</span>
                      <span
                        className="tooltip tooltip-bottom"
                        data-tip="Awarded for intentional spending actions (e.g., Bazaar purchases). Does NOT include wallet transfers, siphons/attacks, or teacher/admin debits (i.e. negative balance adjustments)."
                      >
                        <Info className="w-4 h-4 text-base-content/60" />
                      </span>
                    </div>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    value={settings?.bitsSpent ?? 0.5}
                    onChange={(e) => setSettings({ ...settings, bitsSpent: parseFloat(e.target.value) })}
                    min={0}
                    step={0.1}
                  />
                  <label className="label">
                    <span className="label-text-alt">XP per bit spent</span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label">
                    <div className="flex items-center gap-2">
                      <span className="label-text">Stat Increase</span>
                      <span
                        className="tooltip tooltip-bottom"
                        data-tip="Applies when stats are increased (e.g., passive Bazaar item effects, challenge stat boosts, or manual adjustments). XP is awarded per stat changed as configured."
                      >
                        <Info className="w-4 h-4 text-base-content/60" />
                      </span>
                    </div>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    value={settings?.statIncrease ?? 10}
                    onChange={(e) => setSettings({ ...settings, statIncrease: parseInt(e.target.value) })}
                    min={0}
                  />
                  <label className="label">
                    <span className="label-text-alt">XP per stat boost</span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label">
                    <div className="flex items-center gap-2">
                      <span className="label-text">Daily Check-in</span>
                      <span
                        className="tooltip tooltip-bottom"
                        data-tip="XP awarded for daily classroom visits/check‑ins."
                      >
                        <Info className="w-4 h-4 text-base-content/60" />
                      </span>
                    </div>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    value={settings?.dailyCheckIn ?? 5}
                    onChange={(e) => setSettings({ ...settings, dailyCheckIn: parseInt(e.target.value) })}
                    min={0}
                  />
                  <label className="label">
                    <span className="label-text-alt">XP per daily visit</span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label">
                    <div className="flex items-center gap-2">
                      <span className="label-text">Challenge Completion</span>
                      <span
                        className="tooltip tooltip-bottom"
                        data-tip="XP for completing challenges (separate from stat‑increase XP granted by some challenges)."
                      >
                        <Info className="w-4 h-4 text-base-content/60" />
                      </span>
                    </div>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    value={settings?.challengeCompletion ?? 20}
                    onChange={(e) => setSettings({ ...settings, challengeCompletion: parseInt(e.target.value) })}
                    min={0}
                  />
                  <label className="label">
                    <span className="label-text-alt">XP per challenge</span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label">
                    <div className="flex items-center gap-2">
                      <span className="label-text">Mystery Box Use</span>
                      <span
                        className="tooltip tooltip-bottom"
                        data-tip="XP awarded when opening mystery boxes (per configured rate)."
                      >
                        <Info className="w-4 h-4 text-base-content/60" />
                      </span>
                    </div>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    value={settings?.mysteryBox ?? 3}
                    onChange={(e) => setSettings({ ...settings, mysteryBox: parseInt(e.target.value) })}
                    min={0}
                  />
                  <label className="label">
                    <span className="label-text-alt">XP per mystery box</span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label">
                    <div className="flex items-center gap-2">
                      <span className="label-text">Feedback Submission</span>
                      <span
                        className="tooltip tooltip-bottom"
                        data-tip="XP for submitting classroom feedback. This is not dependent on the feedback submission reward (i.e. bits award) setting."
                      >
                        <Info className="w-4 h-4 text-base-content/60" />
                      </span>
                    </div>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    value={settings?.feedbackSubmission ?? 0}
                    onChange={(e) => setSettings({ ...settings, feedbackSubmission: parseFloat(e.target.value) })}
                    min={0}
                  />
                  <label className="label">
                    <span className="label-text-alt">XP awarded for submitting feedback</span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label">
                    <div className="flex items-center gap-2">
                      <span className="label-text">Group Join</span>
                      <span
                        className="tooltip tooltip-bottom"
                        data-tip="One-time XP awarded when a student joins a group per GroupSet."
                      >
                        <Info className="w-4 h-4 text-base-content/60" />
                      </span>
                    </div>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    value={settings?.groupJoin ?? 15}
                    onChange={(e) => setSettings({ ...settings, groupJoin: parseInt(e.target.value) })}
                    min={0}
                  />
                  <label className="label">
                    <span className="label-text-alt">XP for joining group (one-time)</span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">XP from Bits Basis</span>
                    <span className="label-text-alt">How to count bits for XP</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={settings.bitsXPBasis}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, bitsXPBasis: e.target.value }))
                    }
                  >
                    <option value="final">Final (after multipliers)</option>
                    <option value="base">Base (before multipliers)</option>
                  </select>
                  <div className="label">
                    <span className="label-text-alt">
                      Final = current behavior. Base ignores group/personal multipliers when converting bits → XP.
                    </span>
                  </div>
                </div>
              </div>

              <div className="alert alert-info">
                <div>
                  <strong>Recommended Balance:</strong>
                  <ul className="list-disc list-inside text-sm mt-2">
                    <li>Keep earning bits as the primary XP source</li>
                    <li>Reward active participation (challenges, check-ins)</li>
                    <li>Avoid making XP gains too easy or too grindy</li>
                  </ul>
                </div>
              </div>
            </>
          )}

          <div className="card-actions justify-end">
            <button type="submit" className="btn btn-primary">
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default XPSettings;