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
  Passive: [] // No primary effects for passive
};

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
    swapOptions: []
  });
  const [loading, setLoading] = useState(false);
  const [effectPreview, setEffectPreview] = useState('');
  // Added: image source toggles and file handling
  const [imageSource, setImageSource] = useState('url');
  const [imageFile, setImageFile] = useState(null);
  const [imageUrlLocal, setImageUrlLocal] = useState('');
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const fileInputRef = useRef(null); // ADD: to clear native file input after submit
 
  // keep an auto-generated preview in sync with form, teachers can edit it before submit
  useEffect(() => {
    const gen = describeEffectFromForm(form);
    // only set when there's no manual edit yet, or regenerate on category/effect changes
    setEffectPreview(gen);
  }, [form.category, form.primaryEffect, form.primaryEffectValue, JSON.stringify(form.secondaryEffects), JSON.stringify(form.swapOptions)]);

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
      swapOptions: []
    });
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
        primaryEffectValue: '',
        primaryEffectDuration: '', //added this line
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
        fd.append('bazaar', bazaarId);
        fd.append('image', imageFile);

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
          bazaar: bazaarId
        };

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
 
       {/* Primary Effect (for non-passive categories) */}
       {form.category && form.category !== 'Passive' && (
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