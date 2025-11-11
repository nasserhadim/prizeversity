import React, { useState, useEffect, useRef } from 'react';
import { Hammer } from 'lucide-react';
import toast from 'react-hot-toast';
import apiBazaar from '../API/apiBazaar';
import { describeEffectFromForm } from '../utils/itemHelpers';

// Will define the primary effect options by item category
const CATEGORY_OPTIONS = {
  Attack: [
    { label: 'Bit Splitter', value: 'splitBits' },
    { label: 'Bit Leech (steal %)', value: 'stealBits' },
    { label: 'Attribute Swapper', value: 'swapper' },
    { label: 'Nullifier (reset to default)', value: 'nullify'}
  ],
  Defend: [
    { label: 'Shield (block next attack)', value: 'shield' }
  ],
  Utility: [
    { label: 'Earnings Multiplier (2x)', value: 'doubleEarnings' },
    { label: 'Shop Discount', value: 'discountShop' }
  ],
  Passive: [], // No primary effects for passive
  Mystery: [] 
};
const RARITY_OPTIONS = {
    Common: [{ weight: 40, luckWeight: 1}],
    Uncommon: [{ weight: 30, luckWeight: 2}],
    Rare: [{ weight: 20, luckWeight: 3}],
    Epic: [{ weight: 8, luckWeight: 4}],
    Legendary: [{ weight: 2, luckWeight: 5}],
    Custom: []
}

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
    primaryEffectValue: '', //changed this from 1 to ''
    primaryEffectDuration: '', //added this line
    secondaryEffects: [],
    swapOptions: [],
    duration: '', // added for discount duration
    prizeWeights: {} // added for the mystery box prize weights
  });
  const [loading, setLoading] = useState(false);
  const [effectPreview, setEffectPreview] = useState('');
  // Added: image source toggles and file handling
  const [imageSource, setImageSource] = useState('url');
  const [imageFile, setImageFile] = useState(null);
  const [imageUrlLocal, setImageUrlLocal] = useState('');
  const [allPrizes, setAllPrizes] = useState([]);// non mystery items
  const [selectedRewards, setSelectedRewards] = useState([]); // { itemId: { checked, weight } }
  const [showProbs, setShowProbs] = useState(false);
  const [studentLuck, setStudentLuck] = useState(1);
  const [useCustom, setUseCustom] = useState(false);
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const fileInputRef = useRef(null); // ADD: to clear native file input after submit
 
  // keep an auto-generated preview in sync with form, teachers can edit it before submit
  useEffect(() => {
    const gen = describeEffectFromForm(form);
    // only set when there's no manual edit yet, or regenerate on category/effect changes
    setEffectPreview(gen);
  }, [form.category, form.primaryEffect, form.primaryEffectValue, form.duration, form.prizeWeights, JSON.stringify(form.secondaryEffects), JSON.stringify(form.swapOptions)]);


  // loading non mystery items so teacher can pick them as prizes

  useEffect(() => {
    if (!classroomId || !bazaarId) return;
    (async () => {
      try {
        const res = await apiBazaar.get(`classroom/${classroomId}/bazaar/${bazaarId}/items?kind=standard`);
        // filters out owned items and mystery boxes
        const items = res.data.items || res.data;
        
        setAllPrizes(items.filter(item => !item.owner && item.kind !== "mystery_box"));
      } catch (err) {
        console.error('Failed to load prizes for mystery box:', err);
      }
    })();
  }, [classroomId, bazaarId]);

        
  // Reset form to initial state
  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      price: '',
      image: '',
      category: '',
      primaryEffect: '',
      primaryEffectValue: '', //changed this from 1 to ''
      primaryEffectDuration: '', //added this line
      secondaryEffects: [],
      swapOptions: [],
      duration: '', // added for discount duration
      prizeWeights: {}, // added for the mystery box prize weights
    });
    // reset image controls too
    setImageSource('url');
    setImageFile(null);
    setImageUrlLocal('');
    setSelectedRewards([]);
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
        primaryEffectValue: '',
        primaryEffectDuration: '', //added this line
        secondaryEffects: [],
        swapOptions: [],
        duration: '', // added for discount duration
        prizeWeights: {} // added for the mystery box prize weights
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

  // when selecting primary effect, set sensible defaults for certain effects
  const handlePrimaryEffectSelect = (e) => {
    const value = e.target.value;
    setForm(prev => ({
      ...prev,
      primaryEffect: value,
      // the default discount to 20% so preview shows meaningful text
      ...(value === 'discountShop' ? { primaryEffectValue: prev.primaryEffectValue} : {})
    }));
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
      ]
    };
    const effectsForCategory = allEffects[form.category] || [];
    return effectsForCategory.filter(
      effect => !form.secondaryEffects.some(se => se.effectType === effect.value)
    );
  };


  // following functions: adds, updates, removes possible prizes
  const addPrize = () => {
    if (selectedRewards.length >= allPrizes.length) return;
    const w = (useCustom ? 10 : 40);
    const l = (useCustom ? 1 : 2);
    const s = (useCustom ? "Custom" : "Common");
    setSelectedRewards(prev => [
        ...prev,
        {itemId: "", weight: w, luckWeight: l, rarity: s}
    ]);
  };

  const updatePrize = (spot, part, change) => {
    setSelectedRewards(prev => {
        const copy = [...prev];
        copy[spot] = {...copy[spot], [part]: change};
        if (part === "weight" || part === "luckWeight")
        {
             copy[spot] = {...copy[spot], rarity: "Custom"};
        }
        return copy;
    });
  };

  const updateRarity = (spot, rarityS) => {
    const r = RARITY_OPTIONS[rarityS][0];
    setSelectedRewards(prev => {
        const copy = [...prev];
        copy[spot] = {...copy[spot], weight: r.weight, luckWeight: r.luckWeight, rarity: rarityS};
        return copy;
    });
  };

  const removePrize = (index) => {
    setSelectedRewards(prev => {
      const prizes = [...prev];
      prizes.splice(index, 1);
      return prizes;
    });
  };
// filters out added prizes from selectable items
  const notAdded = (current) => {
    const usedItems = selectedRewards.map(p => p.itemId).filter(id => id !== current);
    return allPrizes.filter(item  => !usedItems.includes(item._id));
  };

    //
    function itemProb(item) {
        const itemW = (item.weight + item.luckWeight * (studentLuck-1));

        const allW = selectedRewards.reduce((total, oItem) => total + (oItem.weight + oItem.luckWeight * (studentLuck-1)), 0);
        const prob = Math.round(10000 *itemW / allW) / 100;
        return prob;
    }



  //helper will retun the teacher award selection into jason structure 

  const buildRewardsPayload = () => {
    if (form.category !== 'Mystery') return [];
    return selectedRewards
        .filter(r => r.itemId)
        .map(r => ({
            itemId: r.itemId,
            weight: Number(r.weight) || 10,
            luckWeight: Number(r.luckWeight) || 0
        }));
  };

  


  // Validate and submit form to backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // build effect summary and append to description so teachers don't have to type it
      // use the editable preview (teachers may have tweaked wording)
      const cleanedEffect = (effectPreview || '').trim();
      const combinedDescription = `${form.description?.trim() || ''}${cleanedEffect ? `\n\nEffect: ${cleanedEffect}` : ''}`.trim();
      // If user chose file upload and selected a file, send multipart form
      if (imageSource === 'file' && imageFile) {
        if (imageFile.size > MAX_IMAGE_BYTES) {
          throw new Error('Image too large');
        }
        const fd = new FormData();
        fd.append('name', form.name.trim());
        fd.append('description', combinedDescription);
        fd.append('price', Number(form.price));
        fd.append('category', form.category);
        fd.append('primaryEffect', form.category !== 'Passive' ? form.primaryEffect : '');
        fd.append('primaryEffectValue', form.category !== 'Passive' ? Number(form.primaryEffectValue) : '');
        fd.append('secondaryEffects', JSON.stringify(form.secondaryEffects || []));
        fd.append('swapOptions', JSON.stringify(form.swapOptions || []));
        fd.append('duration', Number(form.duration));
        fd.append('bazaar', bazaarId);
        fd.append('image', imageFile);
        fd.append('rewards', JSON.stringify(buildRewardsPayload()));


        const res = await apiBazaar.post(
          `classroom/${classroomId}/bazaar/${bazaarId}/items`,
          fd,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        toast.success('Item created successfully!');
        onAdd?.(res.data.item || res.data);
        // reset whole form including file input
        resetForm();
       } else {
        // JSON path: use image URL (from segmented control) or existing form.image
        const payload = {
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
          swapOptions: form.primaryEffect === 'swapper' ? form.swapOptions : undefined,
          duration: form.primaryEffect === 'discountShop' ? Number(form.duration) : undefined,
          bazaar: bazaarId,
          rewards: buildRewardsPayload()
        };
        console.log(payload);
        const res = await apiBazaar.post(
          `classroom/${classroomId}/bazaar/${bazaarId}/items`,
          payload
        );
        toast.success('Item created successfully!');
        onAdd?.(res.data.item || res.data);
        resetForm();
       }
     } catch (err) {
       // Log and notify error
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
             <button type="button" onClick={() => setImageSource('url')} className={`px-3 py-1 rounded-full text-sm ${imageSource === 'url' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}>URL</button>
             <button type="button" onClick={() => setImageSource('file')} className={`ml-1 px-3 py-1 rounded-full text-sm ${imageSource === 'file' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}>Upload</button>
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
 
       {/* Primary Effect (for non-passive categories and mystery box) */}
       {form.category && !['Passive', 'Mystery'].includes(form.category) && (
         <div className="space-y-4">
           <div className="form-control">
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
               {CATEGORY_OPTIONS[form.category].map(effect => (
                 <option key={effect.value} value={effect.value}>
                   {effect.label}
                 </option>
               ))}
             </select>
           </div>
 
           {/* Steal Bits Percentage Input */}
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

            {/* Bit Split amount Input */}
           {form.primaryEffect === 'splitBits' && (
             <div className="form-control">
               <label className="label">
                 <span className="label-text font-medium">Applied Split</span>
               </label>
               <div className="join">
                 <input
                   type="number"
                   className="input input-bordered join-item w-full"
                   //value={form.primaryEffectValue}
                   onChange={(e) => setForm(prev => ({
                     ...prev,
                     primaryEffectValue: e.target.value
                   }))}
                   placeholder="example: 1/2 for half"
                 />
                 <span className="join-item bg-base-200 px-4 flex items-center">bits</span>
               </div>
             </div>
           )} 

          {/* Option to specify the discount amount the instructor wants*/}
           {form.primaryEffect === 'discountShop' && (
             <div className="form-control">
               <label className="label">
                 <span className="label-text font-medium">Applied Discount</span>
               </label>
               <div className="join">
                 <input
                   type="number"
                   className="input input-bordered join-item w-full"
                   //value={form.primaryEffectValue}
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
                 <span className="label-text font-medium">Discount Duration (hours)</span>
               </label>
               <div className="join">
                 <input
                   type="number"
                   className="input input-bordered join-item w-full"
                   // modified to get duration to update
                   //value={form.duration}
                   onChange={(e) => setForm(prev => ({
                     ...prev,
                     duration: Math.min(8760, Math.max(1, e.target.value))
                   }))}
                   min="1"
                   max="8760"
                 />
                 <span className="join-item bg-base-200 px-4 flex items-center"></span>
               </div>
             </div>
           )} 
 
           {/* Swapper Options */}
           {form.primaryEffect === 'swapper' && (
             <div className="form-control">
               <label className="label">
                 <span className="label-text font-medium">Swap Options</span>
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
             </div>
           )}
         </div>
       )}
 
       {/* Secondary Effects (for Attack and Passive) */}
       {(form.category === 'Attack' || form.category === 'Passive') && (
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
               className="btn btn-sm btn-outline w-full"
               onClick={addSecondaryEffect}
             >
               + Add Secondary Effect
             </button>
           )}
 
           {form.secondaryEffects.length >= 3 && (
             <div className="text-sm text-gray-500">
               You've reached the maximum of 3 secondary effects
             </div>
           )}
         </div>
       )}


       {/* Mystery box */}
       {(form.category === 'Mystery') && (
            <div className="form-control space-y-2">
                <label className="label">
                    <span className="label-text font-medium">Item Pool</span>
                    {(allPrizes.length > 0) && (
                        <span className="label-text-alt">
                            {selectedRewards.length}/{allPrizes.length} selected
                        </span>
                    )}
                </label>
                <div className="flex items-center gap-2 mb-2">
                    <span className="label-text font-medium">Probabilities</span>
                    <div className="inline-flex rounded-full bg-gray-200 p-1">
                        
                        <button type="button" onClick={() => setShowProbs(true)} className={`px-3 py-1 rounded-full text-sm ${showProbs === true ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}>Show</button>
                        <button type="button" onClick={() => setShowProbs(false)} className={`ml-1 px-3 py-1 rounded-full text-sm ${showProbs === false ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}>Hide</button>
                    </div>
                </div>
                {showProbs && (
                    <div className="flex items-center gap-2 mb-2">
                        <span className="label-text font-medium">
                            Student luck <span className='label-text font-medium'></span>
                        </span>
                        <span className="p-1"></span>
                    
                    <input
                        type="number"
                        min="1"
                        className="input input-bordered w-20"
                        value={studentLuck}
                            onChange={(e) => setStudentLuck( Number(e.target.value))}
                        />
                    </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                    <span className="label-text font-medium">Set weights</span>
                    <div className="inline-flex rounded-full bg-gray-200 p-1">
                        
                        <button type="button" onClick={() => setUseCustom(true)} className={`px-3 py-1 rounded-full text-sm ${useCustom === true ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}>Use Advanced</button>
                        <button type="button" onClick={() => setUseCustom(false)} className={`ml-1 px-3 py-1 rounded-full text-sm ${useCustom === false ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}>Use Preset</button>
                    </div>
                </div>
                
                {/* Headers - so the user knows what the boxes represent */}
                {selectedRewards.length > 0 && (
                <div className="flex items-center gap-3 px-1 text-sm">
                    <span className="flex-1">Item</span>
                    <div className="flex items-center gap-2">
                            {showProbs && (
                                <span className="w-8 text-left">%</span>
                            )}
                            {useCustom && (
                                <>
                                    <span className="w-20 text-center">Luck Weight</span>
                                    <span className="w-20 text-center">Base Weight</span>
                                </>
                            )}
                            {!useCustom && (
                                <span className="w-40 text-center">Rarity</span>
                            )}
                            
                            <span className="w-8 text-center"></span>
                    </div>
                </div>
                )}
                    
                
                {/* Shows selected items */}
                {selectedRewards.map((reward, spot) => (
                    <div key = {spot} className="flex items-center gap-3">

                        <select
                            className="select select-bordered flex-1"
                            value = {reward.itemId}
                            onChange={(e) => updatePrize(spot, "itemId", e.target.value)}
                            required
                            >
                        <option value="" disabled>Select item</option>
                        {notAdded(reward.itemId).map(item => (
                            <option key={item._id} value={item._id}>
                                {item.name}
                            </option>
                        ))}
                        </select>

                        {/* Probability */}
                        {showProbs && (
                            <label className="w-10"> {itemProb(selectedRewards[spot]).toFixed(2)}</label>
                        )}


                        
                        {useCustom && (
                            <>
                            {/* Luck weight */}
                            <input
                                type="number"
                                min="0"
                                className="input input-bordered w-20"
                                value={reward.luckWeight}
                                onChange={(e) => updatePrize(spot, "luckWeight", Number(e.target.value))}
                                />

                            {/* Base weight */}
                            <input
                                type="number"
                                min="0"
                                className="input input-bordered w-20"
                                value={reward.weight}
                                onChange={(e) => updatePrize(spot, "weight", Number(e.target.value))}
                                />
                            </>
                        )}
                        {!useCustom && (
                            <>
                                {/* Rarity */}
                                <select
                                    name="rarity"
                                    className="select select-bordered w-40"
                                    value={reward.rarity}
                                    onChange={(e) => updateRarity(spot, e.target.value)}
                                    required
                                    >
                                    <option value="" disabled>Select rarity</option>
                                    {Object.keys(RARITY_OPTIONS).map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </>

                        )}

                        {/* Remove button: */}
                        <button
                            type="button"
                            className="btn btn-circle btn-sm btn-error"
                            onClick={() => removePrize(spot)}
                            >
                            ×
                        </button>
                    </div>
                ))}
                

                {selectedRewards.length < allPrizes.length && (
                    <button
                        type="button"
                        className="btn btn-sm btn-outline w-full"
                        onClick={addPrize}
                        >
                        + Add Reward
                    </button>
                )}
            
           
                {/* No items selected prompt */}
                {Object.keys(selectedRewards).length === 0 && allPrizes.length > 0 && (
                    <div className="text-sm text-gray-500">
                        Select items above to assign prize chances.
                    </div>
                )}
                {/* App items selected */}
                {Object.keys(selectedRewards).length >= allPrizes.length && allPrizes.length > 0 && (
                    <div className="text-sm text-gray-500">
                        You've selected all items
                    </div>
                )}

                {/* No items in bazaar */}
                {allPrizes.length === 0 && (
                    <div className="text-sm text-gray-500">
                        No items created - create items to be added to the mystery box
                    </div>
                )}
            </div>
       )}
 
       {/* Auto-generated Effect Preview */}
       <div className="form-control">
         <label className="label">
           <span className="label-text font-medium">Auto-generated Effect (editable)</span>
           <button
             type="button"
             className="btn btn-ghost btn-xs"
             onClick={() => setEffectPreview(describeEffectFromForm(form))}
             title="Regenerate"
           >
             Regenerate
           </button>
         </label>
         <textarea
           className="textarea textarea-bordered w-full min-h-[80px] resize-none"
           value={effectPreview}
           onChange={(e) => setEffectPreview(e.target.value)}
           placeholder="Effect preview will appear here (auto-generated from selected effects). You can edit this before submitting."
         />
         <p className="text-xs text-base-content/60 mt-1">This text will be appended to the item description as "Effect: ...".</p>
       </div>
 
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