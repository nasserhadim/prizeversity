import React, { useEffect, useState } from 'react';
import { X, Info } from 'lucide-react';
import apiBazaar from '../API/apiBazaar';

const RARITY_WEIGHTS = { common: 0.2, uncommon: 0.4, rare: 0.6, epic: 0.8, legendary: 1.0 };

export default function MysteryBoxDetailsModal({ open, onClose, box, userLuck }) {
  const [populatedBox, setPopulatedBox] = useState(box);
  const [rates, setRates] = useState([]);
  const [previewLuck, setPreviewLuck] = useState(Number(userLuck || 1)); // NEW: preview luck state
  const [sliderMax, setSliderMax] = useState(10); // NEW: dynamic slider max

  // Reset preview luck when modal opens or userLuck changes
  useEffect(() => {
    if (open) {
      setPreviewLuck(Number(userLuck || 1));
      // Reset slider max, but ensure it accommodates the user's actual luck
      setSliderMax(Math.max(10, Math.ceil(Number(userLuck || 1))));
    }
  }, [open, userLuck]);

  useEffect(() => {
    if (!open) return;
    // Fetch populated box if itemPool items are not objects
    const needsPopulate = populatedBox?.mysteryBoxConfig?.itemPool?.some(p => typeof p.item === 'string');
    if (needsPopulate) {
      (async () => {
        try {
          const res = await apiBazaar.get(`/mystery-box/${box._id}`);
          setPopulatedBox(res.data.item);
        } catch (e) {
          console.error('Failed to populate mystery box:', e);
        }
      })();
    }
  }, [open, box, populatedBox]);

  // CHANGED: compute rates based on previewLuck instead of userLuck
  useEffect(() => {
    console.log('[MysteryBoxDetailsModal] received userLuck prop:', userLuck, 'previewLuck:', previewLuck);
    if (!populatedBox?.mysteryBoxConfig?.itemPool) return;

    // NEW: don't compute/display rates when pool entries are still raw ids
    const needsPopulate = populatedBox.mysteryBoxConfig.itemPool.some(p => typeof p.item === 'string');
    if (needsPopulate) return;

    const luckMultiplier = populatedBox.mysteryBoxConfig.luckMultiplier || 1.5;
    const rawLuck = Number(previewLuck || 1); // CHANGED: use previewLuck
    const luckBonus = (rawLuck - 1) * luckMultiplier; // matches backend
    const pool = populatedBox.mysteryBoxConfig.itemPool;

    // Compute adjusted rates (match backend: + luckBonus * weight * 10, clamp per item, then normalize)
    const adjusted = pool.map(entry => {
      const base = Number(entry.baseDropChance || 0);
      const rarity = entry.rarity || 'common';
      const w = RARITY_WEIGHTS[rarity] || 0;
      const luckAdj = luckBonus * w * 10;
      const preNorm = Math.min(base + luckAdj, 100);
      return { entry, base, rarity, weight: w, preNorm };
    });
    const totalPreNorm = adjusted.reduce((s, r) => s + r.preNorm, 0) || 1;

    const final = adjusted.map(r => {
      const pct = (r.preNorm / totalPreNorm) * 100;
      const itemPrice = r.entry.item?.price;
      return {
        name: r.entry.item?.name || '(item)',
        price: itemPrice,
        rarity: r.rarity,
        basePct: r.base.toFixed(2),
        userPct: pct.toFixed(2),
        changePct: (pct - r.base).toFixed(2)
      };
    });
    setRates(final);
  }, [populatedBox, previewLuck]); // CHANGED: depend on previewLuck

  if (!open || !populatedBox) return null;

  const cfg = populatedBox.mysteryBoxConfig;
  const luckMultiplier = cfg.luckMultiplier || 1.5;
  const rawLuck = Number(previewLuck || 1); // CHANGED: use previewLuck for display
  const actualUserLuck = Number(userLuck || 1); // Keep actual luck for reference
  const luckBonus = (rawLuck - 1) * luckMultiplier;
  const pityEnabled = cfg.pityEnabled;

  // NEW: build rarity-grouped math breakdown (Steps 1–3) using previewLuck
  const pool = cfg.itemPool || [];
  const rarityKeys = ['common','uncommon','rare','epic','legendary'];
  const byRarity = rarityKeys.reduce((acc, r) => {
    acc[r] = { items: [], baseTotal: 0, count: 0, weight: RARITY_WEIGHTS[r] || 0, preNormTotal: 0, normTotal: 0 };
    return acc;
  }, {});
  // per-item preNorm (same as above)
  const perItem = pool.map(entry => {
    const base = Number(entry.baseDropChance || 0);
    const rarity = entry.rarity || 'common';
    const w = RARITY_WEIGHTS[rarity] || 0;
    const preNorm = Math.min(base + (luckBonus * w * 10), 100);
    return { rarity, base, preNorm, weight: w };
  });
  // aggregate
  perItem.forEach(i => {
    const g = byRarity[i.rarity];
    g.items.push(i);
    g.baseTotal += i.base;
    g.preNormTotal += i.preNorm;
    g.count += 1;
  });
  const baseGrandTotal = Object.values(byRarity).reduce((s, g) => s + g.baseTotal, 0);
  const preNormGrandTotal = Object.values(byRarity).reduce((s, g) => s + g.preNormTotal, 0) || 1;
  rarityKeys.forEach(r => {
    const g = byRarity[r];
    g.normTotal = (g.preNormTotal / preNormGrandTotal) * 100;
  });

  // Helper to check if preview differs from actual
  const isPreviewingDifferentLuck = Math.abs(previewLuck - actualUserLuck) > 0.01;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-base-100 text-base-content w-full max-w-xl rounded-xl shadow-lg p-4 space-y-4 border border-base-300">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold">{populatedBox.name} Details</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="p-2 rounded bg-base-200">
            <div className="font-semibold">Price:</div>
            <div>{populatedBox.price} ₿</div>
          </div>
          <div className="p-2 rounded bg-base-200 relative">
            <div className="font-semibold flex items-center gap-1">
              Luck Factor:
              <span
                className="tooltip tooltip-top cursor-help"
                data-tip="Luck Factor/Multiplier applied to (Luck - 1). Higher values amplify the luck bonus distributed toward rarer items."
              >
                <Info size={14} className="text-info" />
              </span>
            </div>
            <div>{luckMultiplier.toFixed(2)}×</div>
          </div>
          <div className="p-2 rounded bg-base-200">
            <div className="font-semibold">Your Luck:</div>
            <div>{actualUserLuck.toFixed(1)}×</div>
          </div>
          <div className="p-2 rounded bg-base-200 relative">
            <div className="font-semibold flex items-center gap-1">
              Pity System:
              <span
                className="tooltip tooltip-top cursor-help"
                data-tip={pityEnabled
                  ? `Guarantees at least ${cfg.pityMinimumRarity} after ${cfg.guaranteedItemAfter} consecutive opens below that rarity.`
                  : 'Disabled: outcomes rely solely on weighted luck-adjusted probabilities.'}
              >
                <Info size={14} className="text-info" />
              </span>
            </div>
            <div>{pityEnabled ? 'Enabled' : 'Disabled'}</div>
          </div>
        </div>

        {pityEnabled && (
          <div className="border rounded p-3 bg-warning/5 text-sm">
            <div className="font-semibold mb-1">🎁 Pity Guarantee Details:</div>
            <p>
              If you don't get a <span className="font-bold">{cfg.pityMinimumRarity}</span> or better item within{' '}
              <span className="font-bold">{cfg.guaranteedItemAfter}</span> opens, your next attempt will guarantee one!
            </p>
          </div>
        )}

        <div className="collapse collapse-arrow border rounded">
          <input type="checkbox" defaultChecked />
          <div className="collapse-title text-sm font-semibold flex items-center gap-2">
            <Info size={16} /> Your Personalized Drop Rates
          </div>
          <div className="collapse-content space-y-3">
            {/* NEW: Preview Luck Slider */}
            <div className="bg-base-200 border border-base-300 rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  🔮 Preview Luck:
                  <span
                    className="tooltip tooltip-top cursor-help"
                    data-tip="Adjust this slider to see how different luck values would affect your drop rates. Your actual luck is shown above."
                  >
                    <Info size={14} className="text-info" />
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    className="input input-bordered input-xs w-20"
                    value={previewLuck}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v) && v >= 0.1) {
                        setPreviewLuck(v);
                        // Dynamically expand slider max if user types a higher value
                        if (v > sliderMax) {
                          setSliderMax(Math.ceil(v));
                        }
                      } else {
                        setPreviewLuck(actualUserLuck);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => setPreviewLuck(actualUserLuck)}
                    disabled={!isPreviewingDifferentLuck}
                  >
                    Reset
                  </button>
                </div>
              </div>
              <input
                type="range"
                min="0.1"
                max={sliderMax}
                step="0.1"
                className="range range-sm range-primary"
                value={previewLuck}
                onChange={(e) => setPreviewLuck(parseFloat(e.target.value))}
              />
              <div className="flex justify-between text-xs text-base-content/60">
                <span>0.1× (Very Unlucky)</span>
                <span>1.0× (Neutral)</span>
                <span>{sliderMax}× (Very Lucky)</span>
              </div>
              {isPreviewingDifferentLuck && (
                <div className="alert alert-warning py-2 text-xs">
                  <span>⚠️ Previewing with {previewLuck.toFixed(1)}× luck (your actual luck is {actualUserLuck.toFixed(1)}×)</span>
                </div>
              )}
            </div>

            <div className="alert alert-info py-2 text-xs">
              {isPreviewingDifferentLuck ? 'Preview' : 'Your'} luck ({rawLuck.toFixed(1)}×) with luck factor/multiplier {luckMultiplier.toFixed(1)}× gives a luck bonus {luckBonus.toFixed(2)}.
            </div>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="table table-xs">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Rarity</th>
                    <th>Base Drop Rate %</th>
                    <th>{isPreviewingDifferentLuck ? 'Preview' : 'Your'} Drop Rate %</th>
                    <th>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map(r => (
                    <tr key={r.name + r.rarity}>
                      <td>
                        {r.name}
                        {r.price != null && (
                          <span className="text-base-content/60 ml-1">({r.price} ₿)</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge badge-sm ${
                          r.rarity === 'legendary' ? 'badge-warning' :
                          r.rarity === 'epic' ? 'badge-secondary' :
                          r.rarity === 'rare' ? 'badge-accent' :
                          r.rarity === 'uncommon' ? 'badge-info' : 'badge-neutral'
                        }`}>{r.rarity}</span>
                      </td>
                      <td>{r.basePct}%</td>
                      <td>{r.userPct}%</td>
                      <td className={parseFloat(r.changePct) > 0 ? 'text-success' : (parseFloat(r.changePct) < 0 ? 'text-error' : '')}>
                        {parseFloat(r.changePct) > 0 ? '+' : ''}{r.changePct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* NEW: Math breakdown (Steps 1–3) */}
            <div className="divider my-2"></div>
            <div className="text-xs space-y-2">
              {/* Step 1 */}
              <div className="bg-base-200 border border-base-300 rounded p-2">
                <div className="font-semibold mb-1">Step 1: Base Drop Rates (No Luck applied yet)</div>
                {rarityKeys.filter(r => byRarity[r].count > 0).map(r => (
                  <div key={r} className="flex justify-between">
                    <span className="capitalize">• {r}{byRarity[r].count > 1 ? ` ×${byRarity[r].count}` : ''}</span>
                    <span className="font-mono">{byRarity[r].baseTotal.toFixed(1)}%</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold border-t border-base-300 pt-1 mt-1">
                  <span>TOTAL</span>
                  <span className="font-mono">{baseGrandTotal.toFixed(1)}%</span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-info/10 border border-info/30 rounded p-2">
                <div className="font-semibold mb-1">
                  Step 2: Apply Luck ({isPreviewingDifferentLuck ? 'Preview' : 'Your'} ×{rawLuck.toFixed(1)} luck stat and the mystery box luck factor/multiplier x{luckMultiplier.toFixed(1)})
                </div>
                <div className="bg-base-100 p-2 rounded mb-2">
                  Why (luck − 1)? Luck 1.0 is neutral. Luck bonus = ({rawLuck.toFixed(1)} − 1) × {luckMultiplier.toFixed(1)} = <span className="font-mono">{luckBonus.toFixed(2)}</span>
                </div>
                {rarityKeys.filter(r => byRarity[r].count > 0).map(r => {
                  const g = byRarity[r];
                  const weight = g.weight; // 0.2, 0.4, ... 1.0
                  // show the "× count" since luck adjustment is applied per item of this rarity
                  const formulaRight = `${g.baseTotal.toFixed(1)} + (${luckBonus.toFixed(2)} × ${weight.toFixed(1)} × 10 × ${g.count})`;
                  return (
                    <div key={r} className="flex justify-between items-center">
                      <span className="capitalize">• {r}{g.count > 1 ? ` ×${g.count}` : ''}: {formulaRight}</span>
                      <span className="font-mono">{g.preNormTotal.toFixed(1)}%</span>
                    </div>
                  );
                })}
                <div className="flex justify-between font-bold border-t border-info/30 pt-1 mt-1">
                  <span>TOTAL (before normalization)</span>
                  <span className="font-mono text-error">{preNormGrandTotal.toFixed(1)}%</span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-success/10 border border-success/30 rounded p-2">
                <div className="font-semibold mb-1">Step 3: Normalize (Scale Down to 100%)</div>
                <div className="mb-1">Divide each by total ({preNormGrandTotal.toFixed(1)}%) and multiply by 100:</div>
                {rarityKeys.filter(r => byRarity[r].count > 0).map(r => (
                  <div key={r} className="flex justify-between">
                    <span className="capitalize">• {r}</span>
                    <span className="font-mono">{byRarity[r].normTotal.toFixed(1)}%</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold border-t-2 border-success pt-1 mt-1">
                  <span>FINAL TOTAL</span>
                  <span className="font-mono">100.0%</span>
                </div>
              </div>
            </div>

            <div className="text-xs bg-base-200 p-2 rounded">
              <strong>How it works:</strong> Luck bonus {`(${luckBonus.toFixed(2)})`} is multiplied by each rarity weight (common=1/5=0.2, uncommon=2/5=0.4, rare=3/5=0.6, epic=4/5=0.8, legendary=5/5=1.0), scaled by 10, added per item, clamped to 100, then all adjusted values are normalized back to 100%. Higher rarity items receive a proportionally larger share of the luck bonus; for example, a legendary item gets five times the luck bonus of a common item.
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button className="btn btn-primary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}