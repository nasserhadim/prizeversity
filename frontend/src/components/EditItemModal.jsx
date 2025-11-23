import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import apiBazaar from '../API/apiBazaar';
import { Hammer, Plus, Trash2, Info, AlertCircle } from 'lucide-react';
import { describeEffectFromForm, normalizeSwapOptions } from '../utils/itemHelpers';

const CATEGORY_OPTIONS = {
  Attack: [
    { label: 'Bit Splitter (halve bits)', value: 'halveBits' },
    { label: 'Bit Leech (steal %)', value: 'stealBits' },
    { label: 'Attribute Swapper', value: 'swapper' },
    { label: 'Nullifier (reset to default)', value: 'nullify' }
  ],
  Defend: [{ label: 'Shield (block next attack)', value: 'shield' }],
  Utility: [
    { label: 'Earnings Multiplier (2x)', value: 'doubleEarnings' },
    { label: 'Shop Discount (20%)', value: 'discountShop' }
  ],
  Passive: [],
  MysteryBox: []
};

const RARITY_OPTIONS = ['common','uncommon','rare','epic','legendary'];
const RARITY_SUGGESTED_RATES = { common: 40, uncommon: 30, rare: 20, epic: 8, legendary: 2 };
const PITY_RARITY_OPTIONS = ['uncommon','rare','epic','legendary'];

const EditItemModal = ({ open, onClose, item, classroomId, bazaarId, onUpdated }) => {
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [imageSource, setImageSource] = useState('url');
  const [imageFile, setImageFile] = useState(null);
  const [imageUrlLocal, setImageUrlLocal] = useState('');
  const [effectPreview, setEffectPreview] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: 0,
    image: '',
    category: '',
    primaryEffect: '',
    primaryEffectValue: 1,
    secondaryEffects: [],
    swapOptions: []
  });

  // Mystery box editable subset (allows changing luck/pity settings)
  const [mysteryConfig, setMysteryConfig] = useState({
    luckMultiplier: 1.5,
    pityEnabled: false,
    guaranteedItemAfter: 10,
    pityMinimumRarity: 'rare',
    maxOpensPerStudent: null,
    itemPool: [] // local pool representation: [{ itemId, rarity, baseDropChance }]
  });

  // pool / available items & preview UI state
  const [availableItems, setAvailableItems] = useState([]);
  const [showLuckPreview, setShowLuckPreview] = useState(false);
  const [showLuckExplanation, setShowLuckExplanation] = useState(false);
  const [previewLuck, setPreviewLuck] = useState(3.0);

  useEffect(() => {
    if (item) {
      const desc = item.description?.split('\n\nEffect:')[0] || '';
      const normalizedSwapOptions = normalizeSwapOptions(item.swapOptions || []);

      setForm({
        name: item.name || '',
        description: desc,
        price: item.price || 0,
        image: item.image || '',
        category: item.category || '',
        primaryEffect: item.primaryEffect || '',
        primaryEffectValue: item.primaryEffectValue || 1,
        secondaryEffects: item.secondaryEffects || [],
        swapOptions: normalizedSwapOptions
      });

      // Only set the URL input if it is a valid absolute URL, otherwise leave blank so browser won't complain
      setImageUrlLocal(
        item.image && (item.image.startsWith('http') || item.image.startsWith('data:'))
          ? item.image
          : ''
      );

      // Populate mystery box config when editing a MysteryBox
      setMysteryConfig(prev => ({
        ...prev,
        luckMultiplier: item.mysteryBoxConfig?.luckMultiplier ?? 1.5,
        pityEnabled: !!item.mysteryBoxConfig?.pityEnabled,
        guaranteedItemAfter: item.mysteryBoxConfig?.guaranteedItemAfter ?? 10,
        pityMinimumRarity: item.mysteryBoxConfig?.pityMinimumRarity ?? 'rare',
        maxOpensPerStudent: item.mysteryBoxConfig?.maxOpensPerStudent ?? null,
        itemPool: (item.mysteryBoxConfig?.itemPool || []).map(p => ({
          itemId: (p.item && (p.item._id || p.item)) || '',
          rarity: p.rarity || 'common',
          baseDropChance: Number(p.baseDropChance || 0)
        }))
      }));

      const effectText = describeEffectFromForm({
        ...item,
        description: desc,
        swapOptions: normalizedSwapOptions
      }) || '';
      setEffectPreview(effectText);
    }
  }, [item]);

  // Fetch available items for pool when dialog opens and when category is MysteryBox
  useEffect(() => {
    if (!open) return;
    if (form.category === 'MysteryBox') {
      (async () => {
        try {
          const res = await apiBazaar.get(`classroom/${classroomId}/bazaar`);
          const items = res.data.bazaar?.items?.filter(i => i.category !== 'MysteryBox') || [];
          setAvailableItems(items);
        } catch (e) {
          console.error('Failed to fetch items for pool:', e);
        }
      })();
    }
  }, [open, classroomId, form.category]);

  // Update effect preview when form changes
  useEffect(() => {
    if (form.category) {
      const formNormalized = { ...form, swapOptions: normalizeSwapOptions(form.swapOptions) };
      const effectText = describeEffectFromForm(formNormalized) || '';
      setEffectPreview(effectText);
    }
  }, [form.primaryEffect, form.primaryEffectValue, form.secondaryEffects, JSON.stringify(form.swapOptions), form.category]);

  if (!open || !item) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const availableSecondaryEffects = () => {
    if (!form.category) return [];
    
    const allEffects = {
      Attack: [
        { label: 'Attack Luck (-1 luck)', value: 'attackLuck' },
        { label: 'Attack Multiplier (-1x)', value: 'attackMultiplier' },
        { label: 'Attack Group Multiplier (-1x)', value: 'attackGroupMultiplier' }
      ],
      Passive: [
        { label: 'Grants Luck (+1 luck)', value: 'grantsLuck' },
        { label: 'Grants Multiplier (+1x)', value: 'grantsMultiplier' },
        { label: 'Grants Group Multiplier (+1x)', value: 'grantsGroupMultiplier' }
      ]
    };
    
    const effectsForCategory = allEffects[form.category] || [];
    return effectsForCategory.filter(
      effect => !form.secondaryEffects.some(se => se.effectType === effect.value)
    );
  };

  const updateSecondaryEffect = (idx, field, value) => {
    setForm(prev => {
      const copy = [...prev.secondaryEffects];
      copy[idx] = { ...copy[idx], [field]: value };
      return { ...prev, secondaryEffects: copy };
    });
  };

  const addSecondaryEffect = () => {
    if (form.secondaryEffects.length >= 3) return;
    setForm(prev => ({
      ...prev,
      secondaryEffects: [...prev.secondaryEffects, { effectType: '', value: 1 }]
    }));
  };

  const removeSecondaryEffect = (idx) => {
    setForm(prev => {
      const copy = [...prev.secondaryEffects];
      copy.splice(idx, 1);
      return { ...prev, secondaryEffects: copy };
    });
  };

  const toggleSwapOption = (option) => {
    setForm(prev => {
      const newOptions = prev.swapOptions.includes(option)
        ? prev.swapOptions.filter(o => o !== option)
        : [...prev.swapOptions, option];
      return { ...prev, swapOptions: newOptions };
    });
  };

  // ------------------ Mystery box pool helpers ------------------
  const addItemToPool = () => {
    setMysteryConfig(prev => ({
      ...prev,
      itemPool: [...(prev.itemPool || []), { itemId: '', rarity: 'common', baseDropChance: 10 }]
    }));
  };

  const removePoolItem = (index) => {
    setMysteryConfig(prev => ({ ...prev, itemPool: prev.itemPool.filter((_, i) => i !== index) }));
  };

  const updatePoolItem = (index, field, value) => {
    setMysteryConfig(prev => {
      const updated = [...(prev.itemPool || [])];
      updated[index] = { ...updated[index], [field]: value };
      // auto-suggest base rate on rarity change
      if (field === 'rarity') {
        updated[index].baseDropChance = RARITY_SUGGESTED_RATES[value] || updated[index].baseDropChance;
      }
      return { ...prev, itemPool: updated };
    });
  };

  const isItemAlreadyAdded = (itemId, currentIndex) => {
    return (mysteryConfig.itemPool || []).some((p, idx) => idx !== currentIndex && p.itemId === itemId && itemId !== '');
  };

  const getAvailableItemsForSlot = (currentIndex) => {
    const usedItemIds = (mysteryConfig.itemPool || [])
      .map((p, idx) => idx !== currentIndex ? p.itemId : null)
      .filter(Boolean);
    return availableItems.filter(i => !usedItemIds.includes(i._id));
  };

  const totalDropChance = (mysteryConfig.itemPool || []).reduce((s, p) => s + Number(p.baseDropChance || 0), 0);
  const isValidTotal = Math.abs(totalDropChance - 100) < 0.01;

  const calculateLuckPreview = (exampleLuck = previewLuck) => {
    const pool = mysteryConfig.itemPool || [];
    if (!pool.length) return [];
    const rarityOrder = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
    const luckMultiplierNum = Number(mysteryConfig.luckMultiplier || 1.5);
    const luckBonus = (exampleLuck - 1) * luckMultiplierNum;
    return pool.map(poolItem => {
      const rarityMultiplier = rarityOrder[poolItem.rarity] / 5;
      const luckAdjustment = luckBonus * rarityMultiplier * 10;
      const adjustedChance = Math.min(Number(poolItem.baseDropChance || 0) + luckAdjustment, 100);
      return {
        ...poolItem,
        baseDrop: Number(poolItem.baseDropChance || 0),
        luckyDrop: adjustedChance,
        boost: adjustedChance - Number(poolItem.baseDropChance || 0),
        rarityMultiplier
      };
    });
  };
  // ------------------ end pool helpers ------------------

  const normalizeUrl = (url) => {
    if (!url) return '';
    const t = url.trim();
    if (t.startsWith('http') || t.startsWith('data:')) return t;
    return `https://${t}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!form.name.trim()) return toast.error('Name required');
    if (!form.price || form.price < 0) return toast.error('Price invalid');
    
    // Validate swap/nullify options
    if ((form.primaryEffect === 'swapper' || form.primaryEffect === 'nullify') && form.swapOptions.length === 0) {
      toast.error('Please select at least one attribute option');
      return;
    }

    // If MysteryBox, validate pool
    if (form.category === 'MysteryBox') {
      if (!mysteryConfig.itemPool || mysteryConfig.itemPool.length === 0) {
        toast.error('Add at least one item to the mystery box pool');
        return;
      }
      // duplicates
      const ids = mysteryConfig.itemPool.map(p => p.itemId);
      if (new Set(ids).size !== ids.length) {
        toast.error('Each item can only be added once. Please remove duplicates.');
        return;
      }
      // total chance
      if (!isValidTotal) {
        toast.error(`Drop chances must sum to 100% (currently ${totalDropChance.toFixed(1)}%)`);
        return;
      }
    }

    setLoading(true);
    try {
      const cleanedEffect = effectPreview?.trim();
      const combinedDescription = `${form.description?.trim() || ''}${cleanedEffect ? `\n\nEffect: ${cleanedEffect}` : ''}`.trim();

      const payload = {
        name: form.name.trim(),
        description: combinedDescription,
        price: Number(form.price),
        image: (imageSource === 'url' ? normalizeUrl(imageUrlLocal) : form.image).trim(),
        category: form.category,
        primaryEffect: form.category !== 'Passive' && form.category !== 'MysteryBox' ? form.primaryEffect : undefined,
        primaryEffectValue: form.category !== 'Passive' && form.category !== 'MysteryBox' ? Number(form.primaryEffectValue) : undefined,
        secondaryEffects: form.secondaryEffects
          .filter(effect => effect.effectType)
          .map(effect => ({
            effectType: effect.effectType,
            value: Number(effect.value)
          })),
        swapOptions: form.swapOptions
      };

      // If editing a MysteryBox include full mysteryBoxConfig
      if (form.category === 'MysteryBox') {
        payload.mysteryBoxConfig = {
          luckMultiplier: Number(mysteryConfig.luckMultiplier),
          pityEnabled: !!mysteryConfig.pityEnabled,
          guaranteedItemAfter: Number(mysteryConfig.guaranteedItemAfter),
          pityMinimumRarity: mysteryConfig.pityMinimumRarity,
          maxOpensPerStudent: mysteryConfig.maxOpensPerStudent ? Number(mysteryConfig.maxOpensPerStudent) : null,
          itemPool: (mysteryConfig.itemPool || []).map(p => ({
            item: p.itemId,
            rarity: p.rarity,
            baseDropChance: Number(p.baseDropChance)
          }))
        };
      }

      // Prepare payload for FormData when uploading image (backend expects JSON strings for arrays/config)
      let res;
      if (payload.secondaryEffects) payload.secondaryEffects = JSON.stringify(payload.secondaryEffects);
      if (payload.swapOptions) payload.swapOptions = JSON.stringify(payload.swapOptions);
      if (payload.mysteryBoxConfig) payload.mysteryBoxConfig = JSON.stringify(payload.mysteryBoxConfig);

      if (imageSource === 'file' && imageFile) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
        if (payload.mysteryBoxConfig) fd.set('mysteryBoxConfig', payload.mysteryBoxConfig);
        fd.append('image', imageFile);
        res = await apiBazaar.put(
          `/classroom/${classroomId}/bazaar/${bazaarId}/items/${item._id}`,
          fd
        );
      } else {
        res = await apiBazaar.put(
          `/classroom/${classroomId}/bazaar/${bazaarId}/items/${item._id}`,
          payload
        );
      }

      toast.success('Item updated');
      onUpdated && onUpdated(res.data.item);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="card bg-base-100 w-full max-w-3xl shadow-xl border border-base-300 mt-6 mb-10"
      >
        <div className="card-body space-y-5">
          <h3 className="text-2xl font-bold flex items-center gap-2">
            <Hammer /> Edit Item
          </h3>

          {/* Name */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Item Name</span>
            </label>
            <input
              name="name"
              className="input input-bordered w-full"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          {/* Description */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Description</span>
            </label>
            <textarea
              name="description"
              className="textarea textarea-bordered w-full min-h-[100px]"
              value={form.description}
              onChange={handleChange}
              placeholder="Short description"
            />
          </div>

          {/* Price */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Price</span>
            </label>
            <input
              name="price"
              type="number"
              min="0"
              className="input input-bordered w-full"
              value={form.price}
              onChange={handleChange}
              required
            />
          </div>

          {/* Image source toggle */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Image</span>
            </label>
            <div className="inline-flex rounded-full bg-gray-200 p-1 mb-2">
              <button
                type="button"
                onClick={() => setImageSource('url')}
                className={`px-3 py-1 rounded-full text-sm ${imageSource === 'url' ? 'bg-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
              >URL</button>
              <button
                type="button"
                onClick={() => setImageSource('file')}
                className={`px-3 py-1 rounded-full text-sm ml-1 ${imageSource === 'file' ? 'bg-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}
              >Upload</button>
            </div>

            {imageSource === 'file' ? (
              <>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  ref={fileInputRef}
                  onChange={e => setImageFile(e.target.files[0])}
                  className="file-input file-input-bordered w-full max-w-xs"
                />
                {imageFile && (
                  <div className="text-xs mt-1">
                    Selected: {imageFile.name}{' '}
                    <button
                      type="button"
                      className="link text-error"
                      onClick={() => {
                        setImageFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      remove
                    </button>
                  </div>
                )}
              </>
            ) : (
              <input
                type="url"
                className="input input-bordered w-full"
                placeholder="https://example.com/item.jpg"
                value={imageUrlLocal}
                onChange={e => setImageUrlLocal(e.target.value)}
              />
            )}
          </div>

          {/* Category (display only) */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Category</span>
              <span className="label-text-alt text-xs">
                (Changing category not supported here)
              </span>
            </label>
            <input
              disabled
              className="input input-bordered w-full"
              value={form.category}
            />
          </div>

          {/* Primary effect (not for Passive/MysteryBox) */}
          {form.category && form.category !== 'Passive' && form.category !== 'MysteryBox' && (
            <div className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Primary Effect</span>
                </label>
                <select
                  name="primaryEffect"
                  className="select select-bordered w-full"
                  value={form.primaryEffect}
                  onChange={handleChange}
                  required
                >
                  <option value="" disabled>Select effect</option>
                  <option value="none">None (no primary effect — use secondary effects only)</option>
                  {CATEGORY_OPTIONS[form.category].map(effect => (
                    <option key={effect.value} value={effect.value}>
                      {effect.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Steal Bits Percentage */}
              {form.primaryEffect === 'stealBits' && (
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Steal Percentage</span>
                  </label>
                  <div className="join">
                    <input
                      type="number"
                      className="input input-bordered join-item w-full"
                      value={form.primaryEffectValue}
                      onChange={(e) => setForm(prev => ({
                        ...prev,
                        primaryEffectValue: Math.min(100, Math.max(1, e.target.value))
                      }))}
                      min="1"
                      max="100"
                    />
                    <span className="join-item bg-base-200 px-4 flex items-center">%</span>
                  </div>
                </div>
              )}

              {/* Swapper Options */}
              {form.primaryEffect === 'swapper' && (
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">
                      Swap Options <span className="text-error">*</span>
                    </span>
                  </label>
                  <div className="space-y-2">
                    {['bits', 'multiplier', 'luck'].map(option => (
                      <div key={option} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`swap-${option}`}
                          className="checkbox checkbox-sm"
                          checked={form.swapOptions.includes(option)}
                          onChange={() => toggleSwapOption(option)}
                        />
                        <label htmlFor={`swap-${option}`} className="capitalize">
                          {option}
                        </label>
                      </div>
                    ))}
                  </div>
                  {form.swapOptions.length === 0 && (
                    <p className="text-xs text-error mt-1">Select at least one attribute to swap</p>
                  )}
                </div>
              )}

              {/* Nullify Options */}
              {form.primaryEffect === 'nullify' && (
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">
                      Nullify Options <span className="text-error">*</span>
                    </span>
                  </label>
                  <div className="space-y-2">
                    {['bits', 'multiplier', 'luck'].map(option => (
                      <div key={option} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`nullify-${option}`}
                          className="checkbox checkbox-sm"
                          checked={form.swapOptions.includes(option)}
                          onChange={() => toggleSwapOption(option)}
                        />
                        <label htmlFor={`nullify-${option}`} className="capitalize">
                          {option}
                        </label>
                      </div>
                    ))}
                  </div>
                  {form.swapOptions.length === 0 && (
                    <p className="text-xs text-error mt-1">Select at least one attribute to nullify</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Secondary Effects (Attack & Passive only) */}
          {(form.category === 'Attack' || form.category === 'Passive') && (
            <div className="space-y-3">
              <label className="label">
                <span className="label-text font-medium">Secondary Effects</span>
                <span className="label-text-alt text-xs">
                  {form.secondaryEffects.length}/3 selected
                </span>
              </label>
              {form.secondaryEffects.map((se, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    className="select select-bordered flex-1"
                    value={se.effectType}
                    onChange={e => updateSecondaryEffect(idx, 'effectType', e.target.value)}
                    required
                  >
                    <option value="" disabled>Select effect</option>
                    {availableSecondaryEffects().concat(
                      se.effectType ? [{ label: se.effectType, value: se.effectType }] : []
                    ).map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="input input-bordered w-20"
                    value={se.value}
                    onChange={e => updateSecondaryEffect(idx, 'value', e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-circle btn-xs btn-error"
                    onClick={() => removeSecondaryEffect(idx)}
                  >×</button>
                </div>
              ))}

              {form.secondaryEffects.length < 3 && availableSecondaryEffects().length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline btn-success"
                  onClick={addSecondaryEffect}
                >
                  <Plus size={14}/> Add Secondary Effect
                </button>
              )}
            </div>
          )}

          {/* Effect Preview (all categories except MysteryBox) */}
          {form.category && form.category !== 'MysteryBox' && (
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Auto-generated Effect (editable)</span>
              </label>
              <textarea
                className="textarea textarea-bordered h-24"
                value={effectPreview}
                onChange={(e) => setEffectPreview(e.target.value)}
                placeholder="Effect preview will appear here (auto-generated from selected effects). You can edit this before submitting."
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-base-content/60">This text will be appended to the item description as "Effect: ...".</p>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => setEffectPreview(describeEffectFromForm(form))}
                  title="Regenerate effect description from current form values"
                >
                  Regenerate
                </button>
              </div>
            </div>
          )}

          {/* NOTE: removed duplicated short MysteryBox panel here.
              Keep the full "MysteryBox full editor" below which includes
              luck/pity settings + item pool UI. */}

          {/* MysteryBox full editor */}
          {form.category === 'MysteryBox' && (
            <div className="space-y-4 border-t pt-4">
              {/* Luck + Pity settings */}
              <div className="space-y-3 border rounded p-3 bg-base-100">
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-control">
                    <label className="label"><span className="label-text">Luck Multiplier</span></label>
                    <input
                      type="number"
                      className="input input-bordered"
                      min="0"
                      step="0.1"
                      value={mysteryConfig.luckMultiplier}
                      onChange={e => setMysteryConfig(prev => ({ ...prev, luckMultiplier: Number(e.target.value) }))}
                    />
                  </div>

                  <div className="form-control">
                    <label className="label cursor-pointer justify-start gap-4">
                      <input
                        type="checkbox"
                        className="toggle toggle-primary"
                        checked={mysteryConfig.pityEnabled}
                        onChange={e => setMysteryConfig(prev => ({ ...prev, pityEnabled: e.target.checked }))}
                      />
                      <span className="label-text">Enable Pity System</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Pity configuration (only when enabled) */}
                  {mysteryConfig.pityEnabled ? (
                    <>
                      <div className="form-control">
                        <label className="label"><span className="label-text">Guaranteed After</span></label>
                        <input
                          type="number"
                          min="1"
                          className="input input-bordered"
                          value={mysteryConfig.guaranteedItemAfter}
                          onChange={e => setMysteryConfig(prev => ({ ...prev, guaranteedItemAfter: Number(e.target.value) }))}
                        />
                        <label className="label"><span className="label-text-alt text-xs">consecutive bad opens</span></label>
                      </div>

                      <div className="form-control">
                        <label className="label"><span className="label-text">Pity Minimum Rarity</span></label>
                        <select
                          className="select select-bordered"
                          value={mysteryConfig.pityMinimumRarity}
                          onChange={e => setMysteryConfig(prev => ({ ...prev, pityMinimumRarity: e.target.value }))}
                        >
                          {PITY_RARITY_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-base-content/60">Pity system is disabled — enable it to configure guarantees.</div>
                  )}

                  {/* Max Opens / Student is independent of pity */}
                  <div className="form-control">
                    <label className="label"><span className="label-text">Max Opens / Student</span></label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Unlimited"
                      className="input input-bordered"
                      value={mysteryConfig.maxOpensPerStudent || ''}
                      onChange={e => setMysteryConfig(prev => ({ ...prev, maxOpensPerStudent: e.target.value ? Number(e.target.value) : null }))}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">You can edit the item pool below plus luck/pity settings.</p>
              </div>

              {/* Item Pool editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="label">
                    <span className="label-text font-medium">Item Pool</span>
                    <span className="label-text-alt text-xs">Each item only once; drop % must total 100%</span>
                  </label>
                  <button type="button" className="btn btn-xs btn-success" onClick={addItemToPool}><Plus size={12}/> Add Item</button>
                </div>

                {mysteryConfig.itemPool && mysteryConfig.itemPool.length > 0 && (
                  <>
                    <div className="alert mb-2">
                      <div className="flex-1">
                        <div className={`badge ${isValidTotal ? 'badge-success' : 'badge-warning'}`}>{totalDropChance.toFixed(1)}%</div>
                        <div className="text-xs ml-2">{isValidTotal ? 'Total drop chance valid' : 'Total must equal 100%'}</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {mysteryConfig.itemPool.map((poolItem, idx) => {
                        const availableForThisSlot = getAvailableItemsForSlot(idx);
                        const isDuplicate = poolItem.itemId && isItemAlreadyAdded(poolItem.itemId, idx);
                        return (
                          <div key={idx} className={`flex flex-col sm:flex-row gap-2 items-stretch bg-base-100 p-2 rounded ${isDuplicate ? 'border-2 border-error' : ''}`}>
                            <select
                              className={`select select-bordered w-full sm:flex-1 ${isDuplicate ? 'select-error' : ''}`}
                              value={poolItem.itemId}
                              onChange={(e) => updatePoolItem(idx, 'itemId', e.target.value)}
                              required
                            >
                              <option value="">Select item...</option>
                              {availableForThisSlot.map(i => (
                                <option key={i._id} value={i._id}>{i.name} ({i.price}₿)</option>
                              ))}
                              {poolItem.itemId && !availableForThisSlot.find(i => i._id === poolItem.itemId) && (
                                <option value={poolItem.itemId} disabled>
                                  {availableItems.find(i => i._id === poolItem.itemId)?.name || '(removed)'} (Duplicate)
                                </option>
                              )}
                            </select>

                            <div className="flex gap-2 items-center sm:items-stretch sm:flex-none mt-2 sm:mt-0">
                              <select
                                className="select select-bordered w-36"
                                value={poolItem.rarity}
                                onChange={(e) => updatePoolItem(idx, 'rarity', e.target.value)}
                              >
                                {RARITY_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>

                              <input
                                type="number"
                                placeholder="Drop %"
                                className="input input-bordered input-sm w-full sm:w-24"
                                value={poolItem.baseDropChance}
                                onChange={(e) => updatePoolItem(idx, 'baseDropChance', Number(e.target.value))}
                                min="0"
                                max="100"
                                step="0.1"
                                required
                              />

                              <button type="button" className="btn btn-sm btn-error self-start sm:self-center" onClick={() => removePoolItem(idx)}><Trash2 size={14}/></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Luck preview collapse */}
                {mysteryConfig.itemPool && mysteryConfig.itemPool.length > 0 && (
                  <div className="collapse collapse-arrow bg-base-100 border border-base-300 rounded">
                    <input type="checkbox" checked={showLuckPreview} onChange={() => setShowLuckPreview(prev => !prev)} />
                    <div className="collapse-title text-sm font-medium flex items-center gap-2">
                      <Info size={16} /> Preview Luck Impact (Example Luck ×{previewLuck.toFixed(1)})
                    </div>
                    {showLuckPreview && (
                      <div className="collapse-content pt-0">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-xs font-medium">Preview Student Luck:</label>
                          <input type="number" step="0.1" min="1.0" className="input input-bordered input-xs w-24" value={previewLuck} onChange={(e)=>{const v=parseFloat(e.target.value); setPreviewLuck(Number.isFinite(v)?Math.max(1,v):3.0)}} />
                          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowLuckExplanation(prev => !prev)}>{showLuckExplanation ? 'Hide explanation' : 'How luck factor works'}</button>
                        </div>

                        {showLuckExplanation && (
                          <div className="bg-info/10 border border-info/30 rounded p-3 text-xs mb-2">
                            <p className="mb-1"><strong>Why subtract 1?</strong> Baseline luck is 1.0 (neutral). Bonus = (luck − 1) × luckMultiplier.</p>
                            <p className="mb-0">Each rarity receives a weight: common=0.2 … legendary=1.0. Luck bonus × weight × 10 added per item, clamped, then normalized back to 100%.</p>
                          </div>
                        )}

                        <div className="overflow-x-auto">
                          <table className="table table-xs w-full">
                            <thead>
                              <tr>
                                <th>Item</th>
                                <th>Rarity</th>
                                <th>Base %</th>
                                <th>Your %</th>
                                <th>Change</th>
                              </tr>
                            </thead>
                            <tbody>
                              {calculateLuckPreview().map((p, i) => {
                                const selected = availableItems.find(a => a._id === p.itemId) || {};
                                const changeSign = p.boost > 0 ? '+' : '';
                                return (
                                  <tr key={i}>
                                    <td className="text-xs">{selected.name || '(item)'}</td>
                                    <td><span className="badge badge-xs capitalize">{p.rarity}</span></td>
                                    <td className="text-xs">{p.baseDrop.toFixed(1)}%</td>
                                    <td className="text-xs font-bold">{p.luckyDrop.toFixed(1)}%</td>
                                    <td className="text-xs">{Math.abs(p.boost) > 0.05 ? <span className={p.boost>0 ? 'text-success':'text-warning'}>{changeSign}{p.boost.toFixed(1)}%</span> : <span className="text-gray-400">—</span>}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn"
              disabled={loading}
              onClick={() => onClose()}
            >Cancel</button>
            <button
              type="submit"
              className="btn btn-success"
              disabled={loading}
            >
              {loading ? <span className="loading loading-spinner loading-xs" /> : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EditItemModal;