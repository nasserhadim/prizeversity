import { useState, useEffect, useRef } from 'react';
import { Hammer, Plus, Trash2, Info, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'; // ADD ChevronDown, ChevronUp
import toast from 'react-hot-toast';
import apiBazaar from '../API/apiBazaar';
import { describeEffectFromForm, normalizeSwapOptions } from '../utils/itemHelpers'; // ADD import

// Will define the primary effect options by item category
const CATEGORY_OPTIONS = {
  Attack: [
    { label: 'Bit Splitter', value: 'halveBits' },
    { label: 'Bit Leech (drain %)', value: 'drainBits' },
    { label: 'Attribute Swapper', value: 'swapper' },
    { label: 'Nullifier (reset to default)', value: 'nullify'}
  ],
  Defend: [
    { label: 'Shield (block next attack)', value: 'shield' }
  ],
  Utility: [
    { label: 'Earnings Multiplier (2x)', value: 'doubleEarnings' },
    { label: 'Shop Discount (20%)', value: 'discountShop' }
  ],
  Passive: [], // No primary effects
  MysteryBox: [] // No primary effects, uses mysteryBoxConfig instead
};

// ADD: Mystery Box specific constants
const RARITY_OPTIONS = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const RARITY_SUGGESTED_RATES = {
  common: 40,
  uncommon: 30,
  rare: 20,
  epic: 8,
  legendary: 2
};
const PITY_RARITY_OPTIONS = ['uncommon', 'rare', 'epic', 'legendary'];

// helper: ensure URL has a scheme so browser won't treat it as invalid
const normalizeUrl = (url) => {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('http') || trimmed.startsWith('data:')) return trimmed;
  // assume https when user omitted scheme
  return `https://${trimmed}`;
};

const CreateItem = ({ bazaarId, classroomId, onAdd }) => {
  // Initialize form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    image: '',
    category: '',
    primaryEffect: '',
    primaryEffectValue: 1,
    secondaryEffects: [],
    swapOptions: [],
    // ADD: Mystery Box fields
    luckMultiplier: 1.5,
    pityEnabled: false,
    guaranteedItemAfter: 10,
    pityMinimumRarity: 'rare',
    maxOpensPerStudent: null
  });
  
  const [itemPool, setItemPool] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [effectPreview, setEffectPreview] = useState('');
  const [imageSource, setImageSource] = useState('file');
  const [imageFile, setImageFile] = useState(null);
  const [imageUrlLocal, setImageUrlLocal] = useState('');
  const [showLuckPreview, setShowLuckPreview] = useState(false);
  const [showLuckExplanation, setShowLuckExplanation] = useState(false);
  const [previewLuck, setPreviewLuck] = useState(3.0); // NEW: teacher-adjustable preview luck
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const fileInputRef = useRef(null); // ADD: to clear native file input after submit
 
  // keep an auto-generated preview in sync with form, teachers can edit it before submit
  useEffect(() => {
    const gen = describeEffectFromForm({ ...form, swapOptions: normalizeSwapOptions(form.swapOptions) });
    setEffectPreview(gen);
  }, [form.category, form.primaryEffect, form.primaryEffectValue, JSON.stringify(form.secondaryEffects), JSON.stringify(form.swapOptions)]);

  // Fetch available items for mystery box pool (exclude mystery boxes themselves)
  useEffect(() => {
    if (form.category === 'MysteryBox') {
      fetchAvailableItems();
    }
  }, [form.category, bazaarId]);

  const fetchAvailableItems = async () => {
    try {
      const res = await apiBazaar.get(`classroom/${classroomId}/bazaar`);
      // Filter out mystery box items from pool selection
      const items = res.data.bazaar?.items?.filter(item => item.category !== 'MysteryBox') || [];
      setAvailableItems(items);
    } catch (err) {
      console.error('Failed to fetch items:', err);
    }
  };

  // ADD: Mystery Box item pool management
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

  const isItemAlreadyAdded = (itemId, currentIndex) => {
    return itemPool.some((poolItem, idx) => 
      idx !== currentIndex && poolItem.itemId === itemId && itemId !== ''
    );
  };

  const getAvailableItemsForSlot = (currentIndex) => {
    const usedItemIds = itemPool
      .map((p, idx) => idx !== currentIndex ? p.itemId : null)
      .filter(Boolean);
    
    return availableItems.filter(item => !usedItemIds.includes(item._id));
  };

  // Calculate total drop chance and luck preview for mystery box
  const totalDropChance = itemPool.reduce((sum, item) => sum + Number(item.baseDropChance || 0), 0);
  const isValidTotal = Math.abs(totalDropChance - 100) < 0.01;

  // Coerced numeric multiplier for safe display/calcs
  const luckMultiplierNum = Number(form.luckMultiplier || 1);

  const calculateLuckPreview = (exampleLuck = previewLuck) => { // MOD: accept dynamic luck
    if (itemPool.length === 0) return [];
    const rarityOrder = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
    const luckBonus = (exampleLuck - 1) * luckMultiplierNum; // use numeric
    return itemPool.map(poolItem => {
      const rarityMultiplier = rarityOrder[poolItem.rarity] / 5;
      const luckAdjustment = luckBonus * rarityMultiplier * 10;
      const adjustedChance = Math.min(poolItem.baseDropChance + luckAdjustment, 100);
      return {
        ...poolItem,
        baseDrop: poolItem.baseDropChance,
        luckyDrop: adjustedChance,
        boost: adjustedChance - poolItem.baseDropChance,
        rarityMultiplier
      };
    });
  };

  // Reset form to initial state
  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      price: '',
      image: '',
      category: '',
      primaryEffect: '',
      primaryEffectValue: 1,
      secondaryEffects: [],
      swapOptions: [],
      luckMultiplier: 1.5,
      pityEnabled: false,
      guaranteedItemAfter: 10,
      pityMinimumRarity: 'rare',
      maxOpensPerStudent: null
    });
    setItemPool([]);
    // reset image controls too
    setImageSource('url');
    setImageFile(null);
    setImageUrlLocal('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle input changes and reset dependent fields when category changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'category' ? {
        primaryEffect: '',
        primaryEffectValue: 1,
        secondaryEffects: [],
        swapOptions: []
      } : {})
    }));
  };

  // Add a new secondary effect if under the limit of 3
  const addSecondaryEffect = () => {
    if (form.secondaryEffects.length >= 3) return;
    setForm(prev => ({
      ...prev,
      secondaryEffects: [...prev.secondaryEffects, { effectType: '', value: 1 }]
    }));
  };

  // Update a specific secondary effect at an index
  const updateSecondaryEffect = (index, field, value) => {
    setForm(prev => {
      const newEffects = [...prev.secondaryEffects];
      newEffects[index] = { ...newEffects[index], [field]: value };
      return { ...prev, secondaryEffects: newEffects };
    });
  };

  // Remove a secondary effect at the given index
  const removeSecondaryEffect = (index) => {
    setForm(prev => {
      const newEffects = [...prev.secondaryEffects];
      newEffects.splice(index, 1);
      return { ...prev, secondaryEffects: newEffects };
    });
  };

  // Toggle selected swap option in the swapOptions array
  const toggleSwapOption = (option) => {
    setForm(prev => {
      const newOptions = prev.swapOptions.includes(option)
        ? prev.swapOptions.filter(o => o !== option)
        : [...prev.swapOptions, option];
      return { ...prev, swapOptions: newOptions };
    });
  };

  // Determine available secondary effects for the selected category
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
      ],
      Utility: [
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

  // Validate and submit form to backend
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation for Mystery Box
    if (form.category === 'MysteryBox') {
      if (itemPool.length === 0) {
        toast.error('Add at least one item to the mystery box pool');
        return;
      }

      // Check for duplicates
      const itemIds = itemPool.map(p => p.itemId);
      const uniqueItemIds = new Set(itemIds);
      if (itemIds.length !== uniqueItemIds.size) {
        toast.error('Each item can only be added once. Please remove duplicates.');
        return;
      }

      if (!isValidTotal) {
        toast.error(`Drop chances must sum to 100% (currently ${totalDropChance.toFixed(1)}%)`);
        return;
      }
    }

    // Validate swap/nullify options
    if ((form.primaryEffect === 'swapper' || form.primaryEffect === 'nullify') && form.swapOptions.length === 0) {
      toast.error('Please select at least one attribute option');
      return;
    }

    setLoading(true);
    try {
      // Build payload based on category
      let payload;
      
      if (form.category === 'MysteryBox') {
        payload = {
          name: form.name.trim(),
          description: form.description?.trim(),
          price: Number(form.price),
          image: (imageSource === 'url' ? normalizeUrl(imageUrlLocal) : form.image).trim(),
          category: 'MysteryBox',
          bazaar: bazaarId,
          mysteryBoxConfig: {
            luckMultiplier: Number(form.luckMultiplier),
            pityEnabled: form.pityEnabled,
            guaranteedItemAfter: Number(form.guaranteedItemAfter),
            pityMinimumRarity: form.pityMinimumRarity,
            maxOpensPerStudent: form.maxOpensPerStudent ? Number(form.maxOpensPerStudent) : null,
            itemPool: itemPool.map(p => ({
              item: p.itemId,  // This should be the selected item's ID
              rarity: p.rarity,
              baseDropChance: Number(p.baseDropChance)
            }))
          }
        };
        
        // ADD: Log to debug
        console.log('[CreateItem] Sending payload:', JSON.stringify(payload, null, 2));
      } else {
        // Existing logic for other categories
        const cleanedEffect = describeEffectFromForm(form)?.trim();
        const combinedDescription = `${form.description?.trim() || ''}${cleanedEffect ? `\n\nEffect: ${cleanedEffect}` : ''}`.trim();

        payload = {
          name: form.name.trim(),
          description: combinedDescription,
          price: Number(form.price),
          image: (imageSource === 'url' ? normalizeUrl(imageUrlLocal) : form.image).trim(),
          category: form.category,
          primaryEffect: form.category !== 'Passive' ? form.primaryEffect : undefined,
          primaryEffectValue: form.category !== 'Passive' ? Number(form.primaryEffectValue) : undefined,
          secondaryEffects: form.secondaryEffects
            .filter(effect => effect.effectType)
            .map(effect => ({
              effectType: effect.effectType,
              value: Number(effect.value)
            })),
          // store swapOptions as simple canonical strings (['bits','multiplier','luck'])
          swapOptions: Array.isArray(form.swapOptions) ? form.swapOptions.filter(Boolean) : [],
          bazaar: bazaarId
        };
      }

      // Handle file upload vs JSON
      if (imageSource === 'file' && imageFile) {
        if (imageFile.size > MAX_IMAGE_BYTES) {
          throw new Error('Image too large');
        }
        const fd = new FormData();
        Object.keys(payload).forEach(key => {
          if (key === 'mysteryBoxConfig') {
            fd.append(key, JSON.stringify(payload[key]));
          } else if (key === 'secondaryEffects' || key === 'swapOptions') {
            fd.append(key, JSON.stringify(payload[key]));
          } else {
            fd.append(key, payload[key]);
          }
        });
        fd.append('image', imageFile);

        const res = await apiBazaar.post(
          `classroom/${classroomId}/bazaar/${bazaarId}/items`,
          fd,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        toast.success('Item created successfully!');
        onAdd?.(res.data.item || res.data);
        resetForm();
      } else {
        // ADD: Log before sending
        console.log('[CreateItem] About to POST:', payload);
        
        const res = await apiBazaar.post(
          `classroom/${classroomId}/bazaar/${bazaarId}/items`,
          payload
        );
        toast.success('Item created successfully!');
        onAdd?.(res.data.item || res.data);
        resetForm();
      }
    } catch (err) {
      console.error('Item creation failed:', err);
      toast.error(err.response?.data?.error || 'Failed to create item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="card bg-base-100 border border-base-200 shadow-md rounded-2xl p-6 space-y-4"
    >
      <h3 className="text-2xl font-bold text-success flex items-center gap-2">
        <Hammer />
        Add New Item
      </h3>
 
       {/* Basic fields (name, description, price, image) */}
       <div className="form-control">
         <label className="label">
           <span className="label-text font-medium">
             Item Name <span className='text-error'>*</span>
           </span>
         </label>
         <input
           name="name"
           placeholder="Enter item name"
           className="input input-bordered w-full"
           value={form.name}
           onChange={handleChange}
           required
         />
       </div>
 
       <div className="form-control">
         <label className="label">
           <span className="label-text font-medium">Description</span>
         </label>
         <textarea
           name="description"
           placeholder="Write a short description"
           className="textarea textarea-bordered w-full min-h-[100px] resize-none"
           value={form.description}
           onChange={handleChange}
         />
       </div>
 
       <div className="form-control">
         <label className="label">
           <span className="label-text font-medium">
             Price <span className='text-error'>*</span>
           </span>
         </label>
         <input
           name="price"
           type="number"
           placeholder="Enter price"
           className="input input-bordered w-full"
           value={form.price}
           onChange={handleChange}
           required
           min="1"
         />
       </div>
 
       <div className="form-control">
         <label className="label">
           <span className="label-text font-medium">Image</span>
         </label>
         <div className="flex items-center gap-2 mb-2">
           <div className="inline-flex rounded-full bg-gray-200 p-1">
             <button
               type="button"
               onClick={() => setImageSource('file')}
               className={`px-3 py-1 rounded-full ${imageSource === 'file' ? 'bg-white shadow' : 'text-gray-600'}`}
             >
               Upload
             </button>
             <button
               type="button"
               onClick={() => setImageSource('url')}
               className={`ml-1 px-3 py-1 rounded-full ${imageSource === 'url' ? 'bg-white shadow' : 'text-gray-600'}`}
             >
               URL
             </button>
           </div>
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
             <p className="text-xs text-gray-500">Allowed: jpg, png, webp, gif. Max: 5 MB.</p>
           </>
         ) : (
           <input
             type="url"
             placeholder="https://example.com/item.jpg"
             className="input input-bordered w-full"
             value={imageUrlLocal}
             onChange={(e) => setImageUrlLocal(e.target.value)}
           />
         )}
       </div>
 
       {/* Category Selection */}
       <div className="form-control">
         <label className="label">
           <span className="label-text font-medium">
             Category <span className='text-error'>*</span>
           </span>
         </label>
         <select
           name="category"
           className="select select-bordered w-full"
           value={form.category}
           onChange={handleChange}
           required
         >
           <option value="" disabled>Select category</option>
           {Object.keys(CATEGORY_OPTIONS).map(cat => (
             <option key={cat} value={cat}>{cat}</option>
           ))}
         </select>
       </div>
 
       {/* Primary Effect (for non-passive AND non-mysterybox categories) */}
       {form.category && form.category !== 'Passive' && form.category !== 'MysteryBox' && (
         <div className="space-y-4">
           <div className="form-control overflow-visible">
             <label className="label">
               <span className="label-text font-medium">
                 Primary Effect <span className='text-error'>*</span>
               </span>
             </label>
             <select
               name="primaryEffect"
               className="select select-bordered w-full"
               value={form.primaryEffect}
               onChange={handleChange}
               required
             >
               <option value="" disabled>Select effect</option>
               { (CATEGORY_OPTIONS[form.category] || []).length > 1 && (
                 <option value="none">None (use secondary effects only)</option>
               )}
               { (CATEGORY_OPTIONS[form.category] || []).map(effect => (
                 <option key={effect.value} value={effect.value}>
                   {effect.label}
                 </option>
               ))}
             </select>
           </div>
 
           {/* Drain Bits Percentage Input */}
           {form.primaryEffect === 'drainBits' && (
             <div className="form-control">
               <label className="label">
                 <span className="label-text font-medium">Drain Percentage</span>
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

           {/* Bit Splitter Percentage Input - NEW */}
           {form.primaryEffect === 'halveBits' && (
             <div className="form-control">
               <label className="label">
                 <span className="label-text font-medium">Split Percentage</span>
               </label>
               <div className="join">
                 <input
                   type="number"
                   className="input input-bordered join-item w-full"
                   value={form.primaryEffectValue || 50}
                   onChange={(e) => setForm(prev => ({
                     ...prev,
                     primaryEffectValue: Math.min(100, Math.max(1, e.target.value))
                   }))}
                   min="1"
                   max="100"
                 />
                 <span className="join-item bg-base-200 px-4 flex items-center">%</span>
               </div>
               <label className="label">
                 <span className="label-text-alt">Percentage of target's bits to remove (default: 50%)</span>
               </label>
             </div>
           )}
 
           {/* Swap Options - ADD THIS SECTION */}
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
 
           {/* Nullify Options - ADD THIS SECTION */}
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
 
       {/* Secondary Effects (for Attack and Passive, NOT MysteryBox) */}
       {(form.category === 'Attack' || form.category === 'Passive' || form.category === 'Utility') && (
         <div className="form-control space-y-2">
           <label className="label">
             <span className="label-text font-medium">Secondary Effects</span>
             <span className="label-text-alt">
               {form.secondaryEffects.length}/3 selected
             </span>
           </label>
 
           {/* Display selected secondary effects */}
           {form.secondaryEffects.map((effect, index) => (
             <div key={index} className="flex flex-col sm:flex-row items-center gap-2">
               <select
                 className="select select-bordered flex-1"
                 value={effect.effectType}
                 onChange={(e) => updateSecondaryEffect(index, 'effectType', e.target.value)}
                 required
               >
                 <option value="" disabled>
                   Select effect
                 </option>
                 {availableSecondaryEffects().concat(
                   { label: effect.effectType, value: effect.effectType }
                 ).map(opt => (
                   <option key={opt.value} value={opt.value}>
                     {opt.label}
                   </option>
                 ))}
               </select>
               <input
                 type="number"
                 className="input input-bordered w-full sm:w-20"
                 value={effect.value}
                 onChange={(e) => updateSecondaryEffect(index, 'value', e.target.value)}
                 min="1"
                 max="10"
               />
               <button
                 type="button"
                 className="btn btn-circle btn-sm btn-error"
                 onClick={() => removeSecondaryEffect(index)}
               >
                 ×
               </button>
             </div>
           ))}
 
           {/* Add Secondary Effect button */}
           {form.secondaryEffects.length < 3 && availableSecondaryEffects().length > 0 && (
             <button
               type="button"
               className="btn btn-sm btn-outline btn-success"
               onClick={addSecondaryEffect}
             >
               <Plus size={16} />
               Add Secondary Effect
             </button>
           )}
         </div>
       )}
 
       {/* Effect Preview (only for non-MysteryBox categories) */}
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
 
       {/* Mystery Box Configuration */}
       {form.category === 'MysteryBox' && (
         <div className="space-y-4 border-t pt-4">
           {/* Luck Factor */}
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
               onChange={(e) => setForm({ ...form, luckMultiplier: e.target.value })}
             />
             <label className="label">
               <span className="label-text-alt text-xs opacity-70">
                 {form.luckMultiplier <= 1.0 && '🎲 Luck barely matters'}
                 {form.luckMultiplier > 1.0 && form.luckMultiplier <= 2.0 && '⚖️ Balanced luck impact'}
                 {form.luckMultiplier > 2.0 && '🍀 High luck advantage'}
               </span>
             </label>
           </div>

           {/* ADD: COLLAPSIBLE EXPLANATION */}
           <div className="collapse bg-info/10 border border-info/30 rounded-lg"> {/* REMOVED: collapse-arrow */}
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

                   {/* Why subtract 1? */}
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
                       ⚡ <strong>Higher weight = more luck boost.</strong> Legendary items get the full luck bonus, while common items get only 20% of it.
                     </p>
                   </div>
                   
                   <div className="space-y-4 mt-3">
                     {/* Complete Example */}
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

                       {/* Step 2: Apply Luck */}
                       <div className="bg-base-200 p-3 rounded mb-3">
                         <p className="text-xs font-semibold mb-2">
                           Step 2: Apply Luck (Student with ×3.0 luck, multiplier = {form.luckMultiplier})
                         </p>
                         
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
                           Problem: Total is 190.0%, not 100%!
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
                     className="tooltip tooltip-bottom" 
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
 
           {/* Pity Configuration */}
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
                     onChange={(e) => setForm({ ...form, guaranteedItemAfter: e.target.value })}
                   />
                 </div>
 
                 <div className="form-control">
                   <label className="label">
                     <span className="label-text font-medium">Minimum Guaranteed Rarity</span>
                   </label>
                   <select
                     name="pityMinimumRarity"
                     className="select select-bordered"
                     value={form.pityMinimumRarity}
                     onChange={(e) => setForm({ ...form, pityMinimumRarity: e.target.value })}
                   >
                     {PITY_RARITY_OPTIONS.map(rarity => (
                       <option key={rarity} value={rarity}>
                         {rarity === 'legendary' 
                           ? 'Legendary' 
                           : `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} or better`}
                       </option>
                     ))}
                   </select>
                 </div>
               </div>
 
               <div className="alert alert-success">
                 <Info size={16} />
                 <div className="text-xs">
                   After <strong>{form.guaranteedItemAfter}</strong> opens without a{' '}
                   <strong className="capitalize">{form.pityMinimumRarity}</strong>
                   {form.pityMinimumRarity === 'legendary' ? '' : '+'} item, 
                   next open guarantees{' '}
                   {form.pityMinimumRarity === 'legendary' 
                     ? <strong className="capitalize">{form.pityMinimumRarity}</strong>
                     : <>at least <strong className="capitalize">{form.pityMinimumRarity}</strong> tier</>
                   }.
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
                   className="tooltip tooltip-bottom" 
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
               onChange={(e) => setForm({ ...form, maxOpensPerStudent: e.target.value })}
             />
           </div>
 
           {/* Item Pool */}
           <div className="form-control">
             <label className="label">
               <span className="label-text font-medium flex items-center gap-2">
                 Item Pool
                 <div className="tooltip tooltip-bottom" data-tip="Drop chances must total 100%. Rarity auto-suggests rates but you can customize.">
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
                   <div className="flex flex-col items-end gap-1">
                     <span className={`badge badge-lg ${isValidTotal ? 'badge-success' : 'badge-warning'}`}>
                       {totalDropChance.toFixed(1)}%
                     </span>
                     <span className="text-xs opacity-70">
                       Current total
                     </span>
                   </div>
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
 
             <div className="text-xs text-gray-500 mt-2 flex items-start gap-1">
               <Info size={14} className="mt-0.5 flex-shrink-0" />
               <span>
                 Each item can only be added once. Rarity auto-suggests drop rates, but you can customize them. 
                 Higher luck stats increase chances for rarer items.
               </span>
             </div>
           </div>
 
           {/* Luck Preview (similar to CreateMysteryBox) */}
           {itemPool.length > 0 && (
             <div className="collapse collapse-arrow bg-base-100 border border-base-300">
               <input 
                 type="checkbox" 
                 checked={showLuckPreview}
                 onChange={() => setShowLuckPreview(!showLuckPreview)}
               />
               <div className="collapse-title text-sm font-medium flex items-center gap-2">
                 <Info size={16} />
                 Preview Luck Impact (Example Luck ×{previewLuck.toFixed(1)})
               </div>
               <div className="collapse-content">
                 {/* NEW: adjustable luck input */}
                 <div className="flex items-center gap-2 mb-3">
                   <label className="text-xs font-medium">
                     Preview Student Luck:
                   </label>
                   <input
                     type="number"
                     step="0.1"
                     min="1.0"
                     className="input input-bordered input-xs w-24"
                     value={previewLuck}
                     onChange={(e) => {
                       const v = parseFloat(e.target.value);
                       setPreviewLuck(Number.isFinite(v) ? Math.max(1, v) : 3.0);
                     }}
                   />
                   <span className="text-xs opacity-70">
                     Luck Bonus = ({previewLuck.toFixed(1)} − 1) × {luckMultiplierNum.toFixed(1)} = {(((previewLuck - 1) * luckMultiplierNum)).toFixed(2)}
                   </span>
                 </div>

                 <div className="overflow-x-auto mt-2">
                   <table className="table table-xs">
                     <thead>
                       <tr>
                         <th>Item</th>
                         <th>Rarity</th>
                         <th>Base %</th>
                         <th>With Luck % (pre‑norm)</th>
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
                               <span className="badge badge-xs badge-outline capitalize">
                                 {item.rarity}
                               </span>
                             </td>
                             <td className="text-xs">{item.baseDrop.toFixed(1)}%</td>
                             <td className="text-xs font-bold">{item.luckyDrop.toFixed(1)}%</td>
                             <td className="text-xs">
                               {Math.abs(item.boost) > 0.05 ? (
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

                 {/* NEW: Math Breakdown (Steps 1–3) */}
                 {(() => {
                   const preview = calculateLuckPreview();
                   if (!preview.length) return null;

                   // Group by rarity
                   const rarityWeights = { common: 0.2, uncommon: 0.4, rare: 0.6, epic: 0.8, legendary: 1.0 };
                   const groups = {};
                   preview.forEach(p => {
                     groups[p.rarity] = groups[p.rarity] || { count: 0, baseTotal: 0, preNormTotal: 0, weight: rarityWeights[p.rarity] };
                     groups[p.rarity].count += 1;
                     groups[p.rarity].baseTotal += p.baseDrop;
                     groups[p.rarity].preNormTotal += p.luckyDrop;
                   });
                   const baseTotal = Object.values(groups).reduce((s,g)=>s+g.baseTotal,0);
                   const preNormTotal = Object.values(groups).reduce((s,g)=>s+g.preNormTotal,0) || 1;

                   // Normalize per rarity
                   Object.values(groups).forEach(g => {
                     g.normPct = (g.preNormTotal / preNormTotal) * 100;
                   });

                   const luckBonus = (previewLuck - 1) * form.luckMultiplier;

                   return (
                     <div className="text-xs mt-4 space-y-3">
                       {/* Step 1 */}
                       <div className="bg-base-200 rounded p-2">
                         <div className="font-semibold mb-1">Step 1: Base Drop Rates (No Luck applied yet)</div>
                         {Object.entries(groups).map(([r,g]) => (
                           <div key={r} className="flex justify-between">
                             <span className="capitalize">• {r}{g.count>1?` ×${g.count}`:''}</span>
                             <span className="font-mono">{g.baseTotal.toFixed(1)}%</span>
                           </div>
                         ))}
                         <div className="flex justify-between font-bold border-t border-base-300 pt-1 mt-1">
                           <span>TOTAL</span>
                           <span className="font-mono">{baseTotal.toFixed(1)}%</span>
                         </div>
                       </div>

                       {/* Step 2 */}
                       <div className="bg-info/10 rounded p-2 border border-info/30">
                         <div className="font-semibold mb-1">
                           Step 2: Apply Luck (Preview luck ×{previewLuck.toFixed(1)}, multiplier ×{luckMultiplierNum.toFixed(1)})
                         </div>
                         <div className="bg-base-100 p-2 rounded mb-2">
                           Luck bonus = ({previewLuck.toFixed(1)} − 1) × {luckMultiplierNum.toFixed(1)} = <span className="font-mono">{((previewLuck - 1) * luckMultiplierNum).toFixed(2)}</span>
                         </div>
                         {Object.entries(groups).map(([r,g]) => {
                           const formula = `${g.baseTotal.toFixed(1)} + (${luckBonus.toFixed(2)} × ${g.weight.toFixed(1)} × 10 × ${g.count})`;
                           return (
                             <div key={r} className="flex justify-between">
                               <span className="capitalize">• {r}: {formula}</span>
                               <span className="font-mono">{g.preNormTotal.toFixed(1)}%</span>
                             </div>
                           );
                         })}
                         <div className="flex justify-between font-bold border-t border-info/30 pt-1 mt-1">
                           <span>TOTAL (before normalization)</span>
                           <span className="font-mono text-error">{preNormTotal.toFixed(1)}%</span>
                         </div>
                       </div>

                       {/* Step 3 */}
                       <div className="bg-success/10 rounded p-2 border border-success/30">
                         <div className="font-semibold mb-1">Step 3: Normalize (Scale to 100%)</div>
                         <div className="mb-1">Divide each by {preNormTotal.toFixed(1)}% and ×100:</div>
                         {Object.entries(groups).map(([r,g]) => (
                           <div key={r} className="flex justify-between">
                             <span className="capitalize">• {r}</span>
                             <span className="font-mono">{g.normPct.toFixed(1)}%</span>
                           </div>
                         ))}
                         <div className="flex justify-between font-bold border-t-2 border-success pt-1 mt-1">
                           <span>FINAL TOTAL</span>
                           <span className="font-mono">100.0%</span>
                         </div>
                       </div>

                       <div className="bg-base-200 p-2 rounded">
                         Luck bonus ({luckBonus.toFixed(2)}) × weight (0.2→1.0) ×10 applied per item, clamped, then normalized. Higher rarity items get a larger share.
                       </div>
                     </div>
                   );
                 })()}
                 <div className="text-xs text-gray-500 mt-3">
                   💡 Luck shifts probability from common → rare+ items; after adjustment values are normalized back to 100%.
                 </div>
               </div>
             </div>
           )}
         </div>
       )}
 
       <button
         className="btn btn-success w-full mt-2"
         disabled={loading}
         type="submit"
       >
         {loading ? (
           <>
             <span className="loading loading-spinner"></span>
             Adding...
           </>
         ) : (
           'Add Item'
         )}
       </button>
     </form>
   );
 };
 
 export default CreateItem;