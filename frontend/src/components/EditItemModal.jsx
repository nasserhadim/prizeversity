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

      const effectText = describeEffectFromForm({
        ...item,
        description: desc,
        swapOptions: normalizedSwapOptions
      }) || '';
      setEffectPreview(effectText);
    }
  }, [item]);

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

      payload.secondaryEffects = JSON.stringify(payload.secondaryEffects);
      payload.swapOptions = JSON.stringify(payload.swapOptions);

      let res;
      if (imageSource === 'file' && imageFile) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
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

          {/* MysteryBox note */}
          {form.category === 'MysteryBox' && (
            <div className="alert alert-info text-sm">
              Editing advanced Mystery Box configuration not yet supported in this modal.
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