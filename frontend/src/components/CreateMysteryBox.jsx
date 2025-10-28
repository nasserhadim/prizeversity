import { useState, useEffect } from 'react';
import { Package, Plus, Trash2, Info, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import apiBazaar from '../API/apiBazaar';
import { createMysteryBox } from '../API/apiMysteryBox';

const RARITY_OPTIONS = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const RARITY_SUGGESTED_RATES = {
  common: 40,
  uncommon: 30,
  rare: 20,
  epic: 8,
  legendary: 2
};

const PITY_RARITY_OPTIONS = ['uncommon', 'rare', 'epic', 'legendary'];

const CreateMysteryBox = ({ classroomId, bazaarId, onCreated }) => {
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: 50,
    image: '',
    pityEnabled: false,
    guaranteedItemAfter: 10,
    pityMinimumRarity: 'rare',
    luckMultiplier: 1.5,
    maxOpensPerStudent: null
  });

  const [availableItems, setAvailableItems] = useState([]);
  const [itemPool, setItemPool] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showLuckPreview, setShowLuckPreview] = useState(false);
  const [showLuckExplanation, setShowLuckExplanation] = useState(false); // ADD

  useEffect(() => {
    fetchBazaarItems();
  }, [bazaarId]);

  const fetchBazaarItems = async () => {
    try {
      const res = await apiBazaar.get(`classroom/${classroomId}/bazaar`);
      setAvailableItems(res.data.bazaar?.items || []);
    } catch (err) {
      console.error('Failed to fetch items:', err);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const addItemToPool = () => {
    setItemPool([...itemPool, { itemId: '', rarity: 'common', baseDropChance: 10 }]);
  };

  const updatePoolItem = (index, field, value) => {
    const updated = [...itemPool];
    updated[index][field] = value;
    
    // Auto-suggest drop rate when rarity changes
    if (field === 'rarity') {
      updated[index].baseDropChance = RARITY_SUGGESTED_RATES[value] || 10;
    }
    
    setItemPool(updated);
  };

  const removePoolItem = (index) => {
    setItemPool(itemPool.filter((_, i) => i !== index));
  };

  // ADD: Check if item is already in pool
  const isItemAlreadyAdded = (itemId, currentIndex) => {
    return itemPool.some((poolItem, idx) => 
      idx !== currentIndex && poolItem.itemId === itemId && itemId !== ''
    );
  };

  // ADD: Get items still available for selection
  const getAvailableItemsForSlot = (currentIndex) => {
    const usedItemIds = itemPool
      .map((p, idx) => idx !== currentIndex ? p.itemId : null)
      .filter(Boolean);
    
    return availableItems.filter(item => !usedItemIds.includes(item._id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (itemPool.length === 0) {
      toast.error('Add at least one item to the pool');
      return;
    }

    // Check for duplicates
    const itemIds = itemPool.map(p => p.itemId);
    const uniqueItemIds = new Set(itemIds);
    if (itemIds.length !== uniqueItemIds.size) {
      toast.error('Each item can only be added once. Please remove duplicates.');
      return;
    }

    const totalChance = itemPool.reduce((sum, item) => sum + Number(item.baseDropChance), 0);
    if (Math.abs(totalChance - 100) > 0.01) {
      toast.error(`Drop chances must sum to 100% (currently ${totalChance.toFixed(1)}%)`);
      return;
    }

    setLoading(true);
    try {
      await createMysteryBox(classroomId, bazaarId, { ...form, itemPool });
      toast.success('Mystery box created!');
      onCreated?.();
      // Reset form
      setForm({
        name: '',
        description: '',
        price: 50,
        image: '',
        pityEnabled: false,
        guaranteedItemAfter: 10,
        pityMinimumRarity: 'rare',
        luckMultiplier: 1.5,
        maxOpensPerStudent: null
      });
      setItemPool([]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create mystery box');
    } finally {
      setLoading(false);
    }
  };

  // Calculate total drop chance
  const totalDropChance = itemPool.reduce((sum, item) => sum + Number(item.baseDropChance || 0), 0);
  const isValidTotal = Math.abs(totalDropChance - 100) < 0.01;

  // Calculate example luck adjustments
  const calculateLuckPreview = () => {
    if (itemPool.length === 0) return [];
    
    const rarityOrder = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
    const exampleLuck = 3.0; // Example student with 3x luck
    const luckBonus = (exampleLuck - 1) * form.luckMultiplier;

    return itemPool.map(poolItem => {
      const rarityMultiplier = rarityOrder[poolItem.rarity] / 5;
      const luckAdjustment = luckBonus * rarityMultiplier * 10;
      const adjustedChance = Math.min(poolItem.baseDropChance + luckAdjustment, 100);
      
      return {
        ...poolItem,
        baseDrop: poolItem.baseDropChance,
        luckyDrop: adjustedChance,
        boost: adjustedChance - poolItem.baseDropChance
      };
    });
  };

  return (
    <div className="card bg-base-200 shadow-md">
      <div className="card-body">
        <h3 className="card-title text-success flex items-center gap-2">
          <Package />
          Create Mystery Box
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Box Name</span>
            </label>
            <input
              type="text"
              name="name"
              placeholder="Golden Mystery Box"
              className="input input-bordered"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          {/* UPDATED DESCRIPTION FIELD */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Description</span>
              <span className="label-text-alt text-xs opacity-70">
                Line breaks preserved
              </span>
            </label>
            <textarea
              name="description"
              placeholder="Contains rare and epic items!&#10;&#10;Open to find amazing loot!"
              className="textarea textarea-bordered whitespace-pre-wrap resize-y min-h-[100px]"
              value={form.description}
              onChange={handleChange}
              rows={4}
            />
            <label className="label">
              <span className="label-text-alt text-xs opacity-60">
                Tip: Press Enter for new lines
              </span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Price (Ƀ)</span>
              </label>
              <input
                type="number"
                name="price"
                min="1"
                className="input input-bordered"
                value={form.price}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium flex items-center gap-2">
                  Luck Factor
                  <div 
                    className="tooltip tooltip-right" 
                    data-tip="Controls how much student luck stat boosts their chances for rare+ items"
                  >
                    <Info size={16} className="text-info cursor-help" />
                  </div>
                </span>
              </label>
              <input
                type="number"
                name="luckMultiplier"
                step="0.1"
                min="0.5"
                max="5.0"
                className="input input-bordered"
                value={form.luckMultiplier}
                onChange={handleChange}
              />
              
              <label className="label">
                <span className="label-text-alt text-xs opacity-70">
                  {form.luckMultiplier <= 1.0 && '🎲 Luck barely matters'}
                  {form.luckMultiplier > 1.0 && form.luckMultiplier <= 2.0 && '⚖️ Balanced luck impact'}
                  {form.luckMultiplier > 2.0 && '🍀 High luck advantage'}
                </span>
              </label>
            </div>
          </div>

          {/* COLLAPSIBLE EXPLANATION */}
          <div className="collapse collapse-arrow bg-info/10 border border-info/30 rounded-lg">
            <input 
              type="checkbox" 
              checked={showLuckExplanation}
              onChange={() => setShowLuckExplanation(!showLuckExplanation)}
            />
            <div className="collapse-title text-sm font-medium flex items-center gap-2">
              <Info size={16} className="text-info" />
              <span className="text-base-content">💡 How Luck Factor Works</span>
              {showLuckExplanation ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
            
            {showLuckExplanation && (
              <div className="collapse-content pt-0">
                <div className="text-sm space-y-3">
                  <p className="text-base-content/90">
                    Students with higher <strong>luck stats</strong> get <strong>improved chances</strong> for rarer items. 
                    The multiplier controls how much their luck affects the probability distribution.
                  </p>

                  {/* ADD: Why subtract 1? */}
                  <div className="bg-warning/10 border border-warning/30 p-3 rounded-lg">
                    <p className="text-xs font-semibold mb-2 text-warning">⚠️ Why do we subtract 1 from luck?</p>
                    <div className="text-xs text-base-content/80 space-y-2">
                      <p>
                        <strong>Baseline luck is 1.0</strong> (neutral - no bonus). If a student has <strong>luck ×3.0</strong>, 
                        we only want to apply the <em>bonus</em> part (3.0 - 1.0 = <strong>2.0</strong>).
                      </p>
                      <div className="bg-base-100 p-2 rounded mt-2">
                        <p className="font-mono text-xs">
                          • Luck = 1.0 → Bonus = (1.0 - 1) = <strong>0</strong> (no advantage)
                        </p>
                        <p className="font-mono text-xs">
                          • Luck = 2.0 → Bonus = (2.0 - 1) = <strong>1.0</strong> (modest boost)
                        </p>
                        <p className="font-mono text-xs">
                          • Luck = 3.0 → Bonus = (3.0 - 1) = <strong>2.0</strong> (strong boost)
                        </p>
                      </div>
                      <p className="mt-2">
                        This ensures that <strong>luck = 1.0 means "neutral"</strong> (standard drop rates), 
                        and only values <strong>above 1.0</strong> provide an advantage.
                      </p>
                    </div>
                  </div>

                  {/* Rarity Weight Explanation */}
                  <div className="bg-base-200 p-3 rounded-lg border border-base-300">
                    <p className="text-xs font-semibold mb-2">📊 Rarity Weights (How Much Luck Affects Each Tier)</p>
                    <div className="grid grid-cols-5 gap-2 text-xs">
                      <div className="text-center">
                        <div className="font-semibold text-base-content/70">Common</div>
                        <div className="text-base-content/60">Rank: 1</div>
                        <div className="font-mono text-warning">1÷5 = 0.2</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-base-content/70">Uncommon</div>
                        <div className="text-base-content/60">Rank: 2</div>
                        <div className="font-mono text-warning">2÷5 = 0.4</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-base-content/70">Rare</div>
                        <div className="text-base-content/60">Rank: 3</div>
                        <div className="font-mono text-warning">3÷5 = 0.6</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-base-content/70">Epic</div>
                        <div className="text-base-content/60">Rank: 4</div>
                        <div className="font-mono text-warning">4÷5 = 0.8</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-base-content/70">Legendary</div>
                        <div className="text-base-content/60">Rank: 5</div>
                        <div className="font-mono text-warning">5÷5 = 1.0</div>
                      </div>
                    </div>
                    <p className="text-xs text-base-content/70 mt-2">
                      ⚡ <strong>Higher weight = more luck boost.</strong> Legendary items get the full luck bonus, while common items get only 20%.
                    </p>
                  </div>
                  
                  <div className="space-y-4 mt-3">
                    {/* Complete Example with All Items */}
                    <div className="bg-base-100 p-4 rounded-lg border-2 border-info">
                      <p className="text-sm font-bold mb-3 text-info">📊 Complete Example: 5-Item Mystery Box</p>
                      
                      {/* Step 1: Base Rates */}
                      <div className="bg-base-200 p-3 rounded mb-3">
                        <p className="text-xs font-semibold mb-2">Step 1: Base Drop Rates (No Luck)</p>
                        <div className="space-y-1 text-xs text-base-content/80">
                          <div className="flex justify-between">
                            <span>• Common (40%)</span>
                            <span className="font-mono">40.0%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>• Uncommon (30%)</span>
                            <span className="font-mono">30.0%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>• Rare (20%)</span>
                            <span className="font-mono">20.0%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>• Epic (8%)</span>
                            <span className="font-mono">8.0%</span>
                          </div>
                          <div className="flex justify-between border-t border-base-300 pt-1 mt-1">
                            <span>• Legendary (2%)</span>
                            <span className="font-mono">2.0%</span>
                          </div>
                          <div className="flex justify-between font-bold border-t-2 border-base-300 pt-1 mt-1">
                            <span>TOTAL</span>
                            <span className="font-mono text-success">100.0%</span>
                          </div>
                        </div>
                      </div>

                      {/* Step 2: Apply Luck Adjustments */}
                      <div className="bg-base-200 p-3 rounded mb-3">
                        <p className="text-xs font-semibold mb-2">
                          Step 2: Apply Luck (Student with ×3.0 luck, multiplier = {form.luckMultiplier})
                        </p>
                        
                        {/* UPDATED: Explain the subtraction */}
                        <div className="bg-info/10 border-l-4 border-info p-2 mb-2">
                          <p className="text-xs text-base-content/80">
                            <strong className="text-info">Why (3.0 - 1)?</strong> Luck 1.0 is neutral (no bonus). 
                            Student with luck ×3.0 has <strong>2.0 bonus points</strong> to distribute.
                          </p>
                        </div>
                        
                        <p className="text-xs text-base-content/70 mb-2">
                          Luck bonus = <strong className="text-warning">(3.0 - 1)</strong> × {form.luckMultiplier} = <strong>{((3 - 1) * form.luckMultiplier).toFixed(1)}</strong>
                        </p>
                        <div className="space-y-1 text-xs text-base-content/80">
                          <div className="flex justify-between items-center">
                            <span>• Common: 40% + ({((3 - 1) * form.luckMultiplier).toFixed(1)} × <strong>0.2</strong> × 10)</span>
                            <span className="font-mono text-warning">46.0%</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>• Uncommon: 30% + ({((3 - 1) * form.luckMultiplier).toFixed(1)} × <strong>0.4</strong> × 10)</span>
                            <span className="font-mono text-warning">42.0%</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>• Rare: 20% + ({((3 - 1) * form.luckMultiplier).toFixed(1)} × <strong>0.6</strong> × 10)</span>
                            <span className="font-mono text-warning">38.0%</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>• Epic: 8% + ({((3 - 1) * form.luckMultiplier).toFixed(1)} × <strong>0.8</strong> × 10)</span>
                            <span className="font-mono text-warning">32.0%</span>
                          </div>
                          <div className="flex justify-between items-center border-t border-base-300 pt-1 mt-1">
                            <span>• Legendary: 2% + ({((3 - 1) * form.luckMultiplier).toFixed(1)} × <strong>1.0</strong> × 10)</span>
                            <span className="font-mono text-warning">32.0%</span>
                          </div>
                          <div className="flex justify-between font-bold border-t-2 border-base-300 pt-1 mt-1">
                            <span>TOTAL (before normalization)</span>
                            <span className="font-mono text-error">190.0%</span>
                          </div>
                        </div>
                        <div className="bg-info/10 border border-info/30 rounded p-2 mt-2">
                          <p className="text-xs text-info font-semibold mb-1">Where do 0.2, 0.4, 0.6, 0.8, 1.0 come from?</p>
                          <p className="text-xs text-base-content/80">
                            These are the <strong>rarity weights</strong> shown above (Common=1/5, Uncommon=2/5, etc.). 
                            They ensure legendary items get the <em>full</em> luck bonus while common items get only <em>20%</em> of it.
                          </p>
                        </div>
                        <p className="text-xs text-error mt-2 flex items-center gap-1">
                          <AlertCircle size={12} />
                          Problem: Total is {(46 + 42 + 38 + 32 + 32).toFixed(1)}%, not 100%!
                        </p>
                      </div>

                      {/* Step 3: Normalization */}
                      <div className="bg-success/10 border border-success/30 p-3 rounded">
                        <p className="text-xs font-semibold mb-2 text-success">
                          Step 3: Normalize (Scale Down to 100%)
                        </p>
                        <p className="text-xs text-base-content/80 mb-2">
                          Divide each by total (190.0%) and multiply by 100:
                        </p>
                        <div className="space-y-1 text-xs text-base-content/80">
                          <div className="flex justify-between items-center">
                            <span>• Common: (46.0 ÷ 190.0) × 100</span>
                            <span className="font-mono text-success">≈24.2%</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>• Uncommon: (42.0 ÷ 190.0) × 100</span>
                            <span className="font-mono text-success">≈22.1%</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>• Rare: (38.0 ÷ 190.0) × 100</span>
                            <span className="font-mono text-success">≈20.0%</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>• Epic: (32.0 ÷ 190.0) × 100</span>
                            <span className="font-mono text-success">≈16.8%</span>
                          </div>
                          <div className="flex justify-between items-center border-t border-success/30 pt-1 mt-1">
                            <span>• Legendary: (32.0 ÷ 190.0) × 100</span>
                            <span className="font-mono text-success">≈16.8%</span>
                          </div>
                          <div className="flex justify-between font-bold border-t-2 border-success pt-1 mt-1">
                            <span>FINAL TOTAL</span>
                            <span className="font-mono text-success">100.0%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Comparison Table */}
                    <div className="bg-base-100 p-3 rounded-lg border border-base-300">
                      <p className="text-xs font-semibold mb-2">📈 Before vs After Comparison</p>
                      <div className="overflow-x-auto">
                        <table className="table table-xs w-full">
                          <thead>
                            <tr>
                              <th>Item</th>
                              <th>Base %</th>
                              <th>Final %</th>
                              <th>Change</th>
                            </tr>
                          </thead>
                          <tbody className="text-xs">
                            <tr>
                              <td>Common</td>
                              <td>40.0%</td>
                              <td className="text-warning">24.2%</td>
                              <td className="text-error">-15.8%</td>
                            </tr>
                            <tr>
                              <td>Uncommon</td>
                              <td>30.0%</td>
                              <td className="text-warning">22.1%</td>
                              <td className="text-error">-7.9%</td>
                            </tr>
                            <tr>
                              <td>Rare</td>
                              <td>20.0%</td>
                              <td>20.0%</td>
                              <td className="text-gray-400">±0.0%</td>
                            </tr>
                            <tr>
                              <td>Epic</td>
                              <td>8.0%</td>
                              <td className="text-success">16.8%</td>
                              <td className="text-success">+8.8%</td>
                            </tr>
                            <tr className="border-t-2">
                              <td className="font-bold">Legendary</td>
                              <td className="font-bold">2.0%</td>
                              <td className="font-bold text-success">16.8%</td>
                              <td className="font-bold text-success">+14.8%</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-success mt-2 font-semibold">
                        ✓ Legendary is now <strong>8.4× more likely</strong> (16.8% vs 2%)!
                      </p>
                    </div>

                    {/* Key Point */}
                    <div className="bg-base-200 p-3 rounded-lg border-l-4 border-info">
                      <p className="text-xs text-base-content/80">
                        <strong className="text-info">Key Takeaway:</strong> Luck <em>redistributes</em> probability from common items toward rare+ items. 
                        All rates are then <strong>normalized</strong> (proportionally scaled) back to 100% so the system remains mathematically valid. 
                        This ensures lucky students get significantly better odds on rare+ items without breaking the probability model.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ADD: Optional advanced settings section */}
          <div className="divider text-sm opacity-70">Advanced Settings</div>

          {/* Pity System Toggle */}
          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                className="toggle toggle-success"
                checked={form.pityEnabled}
                onChange={(e) => setForm({ ...form, pityEnabled: e.target.checked })}
              />
              <div className="flex flex-col">
                <span className="label-text font-medium flex items-center gap-2">
                  Enable Pity System
                  <div 
                    className="tooltip tooltip-right" 
                    data-tip="Guarantees a high-rarity item after X unsuccessful attempts"
                  >
                    <Info size={16} className="text-info cursor-help" />
                  </div>
                </span>
                <span className="label-text-alt text-xs opacity-70">
                  {form.pityEnabled 
                    ? 'Students guaranteed good drop after bad luck' 
                    : 'Drops are purely luck-based'}
                </span>
              </div>
            </label>
          </div>

          {/* Pity Configuration (only show if enabled) */}
          {form.pityEnabled && (
            <div className="bg-base-100 border border-success rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 text-success">
                <Info size={16} />
                <span className="text-sm font-semibold">Pity System Settings</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Opens Until Guaranteed</span>
                  </label>
                  <input
                    type="number"
                    name="guaranteedItemAfter"
                    min="1"
                    max="50"
                    className="input input-bordered"
                    value={form.guaranteedItemAfter}
                    onChange={handleChange}
                  />
                  <label className="label">
                    <span className="label-text-alt text-xs">How many bad-luck opens trigger pity</span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Minimum Guaranteed Rarity</span>
                  </label>
                  <select
                    name="pityMinimumRarity"
                    className="select select-bordered"
                    value={form.pityMinimumRarity}
                    onChange={handleChange}
                  >
                    {PITY_RARITY_OPTIONS.map(rarity => (
                      <option key={rarity} value={rarity}>
                        {rarity.charAt(0).toUpperCase() + rarity.slice(1)} or better
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="alert alert-success">
                <Info size={16} />
                <div className="text-xs">
                  After <strong>{form.guaranteedItemAfter}</strong> opens without a 
                  <strong className="capitalize"> {form.pityMinimumRarity}</strong>+ item, 
                  next open guarantees at least <strong className="capitalize">{form.pityMinimumRarity}</strong> tier.
                </div>
              </div>
            </div>
          )}

          {/* Max Opens */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium flex items-center gap-2">
                Max Opens Per Student
                <div 
                  className="tooltip tooltip-right" 
                  data-tip="Limit how many times each student can open this box"
                >
                  <Info size={16} className="text-info cursor-help" />
                </div>
              </span>
            </label>
            <input
              type="number"
              name="maxOpensPerStudent"
              min="1"
              placeholder="Unlimited"
              className="input input-bordered"
              value={form.maxOpensPerStudent || ''}
              onChange={handleChange}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium flex items-center gap-2">
                Item Pool
                <div className="tooltip tooltip-right" data-tip="Drop chances must total 100%. Rarity auto-suggests rates but you can customize.">
                  <Info size={16} className="text-info cursor-help" />
                </div>
              </span>
              <button
                type="button"
                className="btn btn-xs btn-success"
                onClick={addItemToPool}
              >
                <Plus size={14} />
                Add Item
              </button>
            </label>

            {/* Total drop chance display */}
            {itemPool.length > 0 && (
              <div className={`alert ${isValidTotal ? 'alert-success' : 'alert-warning'} mb-2`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-2">
                  <span className="text-sm flex items-center gap-2">
                    {isValidTotal ? (
                      <>✓ Total drop chance valid</>
                    ) : (
                      <>
                        <AlertCircle size={16} />
                        Total must equal 100%
                      </>
                    )}
                  </span>
                  <span className={`badge badge-lg ${isValidTotal ? 'badge-success' : 'badge-warning'}`}>
                    {totalDropChance.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {itemPool.map((poolItem, index) => {
                const availableForThisSlot = getAvailableItemsForSlot(index);
                const isDuplicate = poolItem.itemId && isItemAlreadyAdded(poolItem.itemId, index);
                
                return (
                  <div 
                    key={index} 
                    className={`flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-base-100 p-3 rounded-lg ${
                      isDuplicate ? 'border-2 border-error' : ''
                    }`}
                  >
                    <div className="flex-1">
                      <select
                        className={`select select-bordered select-sm w-full ${isDuplicate ? 'select-error' : ''}`}
                        value={poolItem.itemId}
                        onChange={(e) => updatePoolItem(index, 'itemId', e.target.value)}
                        required
                      >
                        <option value="">Select item...</option>
                        {availableForThisSlot.map((item) => (
                          <option key={item._id} value={item._id}>
                            {item.name} ({item.price}₿)
                          </option>
                        ))}
                        {/* Show currently selected item even if it's a duplicate */}
                        {poolItem.itemId && !availableForThisSlot.find(i => i._id === poolItem.itemId) && (
                          <option value={poolItem.itemId} disabled>
                            {availableItems.find(i => i._id === poolItem.itemId)?.name} (Duplicate)
                          </option>
                        )}
                      </select>
                      {isDuplicate && (
                        <span className="text-error text-xs mt-1 flex items-center gap-1">
                          <AlertCircle size={12} />
                          This item is already in the pool
                        </span>
                      )}
                    </div>

                  <div className="flex gap-2 items-center">
                    <select
                      className="select select-bordered select-sm flex-1 sm:flex-none sm:w-32"
                      value={poolItem.rarity}
                      onChange={(e) => updatePoolItem(index, 'rarity', e.target.value)}
                      title="Rarity affects visual styling and suggests drop rates"
                    >
                      {RARITY_OPTIONS.map((rarity) => (
                        <option key={rarity} value={rarity}>
                          {rarity}
                        </option>
                      ))}
                    </select>

                      <div className="flex items-center gap-1 flex-1 sm:flex-none">
                        <input
                          type="number"
                          placeholder="Drop %"
                          className="input input-bordered input-sm w-full sm:w-20"
                          value={poolItem.baseDropChance}
                          onChange={(e) => updatePoolItem(index, 'baseDropChance', Number(e.target.value))}
                          min="0"
                          max="100"
                          step="0.1"
                          required
                        />
                        <span className="text-xs opacity-70">%</span>
                      </div>

                      <button
                        type="button"
                        className="btn btn-sm btn-error"
                        onClick={() => removePoolItem(index)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Helper text */}
            <div className="text-xs text-gray-500 mt-2 flex items-start gap-1">
              <Info size={14} className="mt-0.5 flex-shrink-0" />
              <span>
                Each item can only be added once. Rarity auto-suggests drop rates, but you can customize them. 
                Higher luck stats increase chances for rarer items.
              </span>
            </div>
          </div>

          {/* Luck Preview Toggle */}
          {itemPool.length > 0 && (
            <div className="collapse collapse-arrow bg-base-100 border border-base-300">
              <input 
                type="checkbox" 
                checked={showLuckPreview}
                onChange={() => setShowLuckPreview(!showLuckPreview)}
              />
              <div className="collapse-title text-sm font-medium flex items-center gap-2">
                <Info size={16} />
                Preview Luck Impact (Example: Student with ×3.0 Luck)
              </div>
              <div className="collapse-content">
                <div className="overflow-x-auto mt-2">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Rarity</th>
                        <th>Base Drop</th>
                        <th>With Luck</th>
                        <th>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculateLuckPreview().map((item, idx) => {
                        const selectedItem = availableItems.find(i => i._id === item.itemId);
                        const changeDirection = item.boost > 0 ? '+' : '';
                        return (
                          <tr key={idx}>
                            <td className="text-xs">{selectedItem?.name || 'Unknown'}</td>
                            <td>
                              <span className={`badge badge-xs badge-outline capitalize`}>
                                {item.rarity}
                              </span>
                            </td>
                            <td className="text-xs">{item.baseDrop.toFixed(1)}%</td>
                            <td className="text-xs font-bold">{item.luckyDrop.toFixed(1)}%</td>
                            <td className="text-xs">
                              {Math.abs(item.boost) > 0.1 ? (
                                <span className={item.boost > 0 ? 'text-success' : 'text-warning'}>
                                  {changeDirection}{item.boost.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  💡 Luck <strong>shifts probability</strong> from common → rare+ items. 
                  Multiplier {form.luckMultiplier} means luck ×3.0 = {((3 - 1) * form.luckMultiplier).toFixed(1)} bonus points 
                  distributed proportionally by rarity.
                </div>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-success w-full" 
            disabled={loading || !isValidTotal || itemPool.some((p, i) => isItemAlreadyAdded(p.itemId, i))}
          >
            {loading ? 'Creating...' : 'Create Mystery Box'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateMysteryBox;