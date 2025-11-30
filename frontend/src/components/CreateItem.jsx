import React, { useState, useEffect, useRef } from 'react';
import { Hammer } from 'lucide-react';
import toast from 'react-hot-toast';
import apiBazaar from '../API/apiBazaar';
import { describeEffectFromForm } from '../utils/itemHelpers';
import { getBadges } from '../API/apiBadges';

// Will define the primary effect options by item category
const CATEGORY_OPTIONS = {
  Attack: [
    { label: 'Bit Splitter', value: 'splitBits' },
    { label: 'Bit Leech (steal %)', value: 'stealBits' },
    { label: 'Attribute Swapper', value: 'swapper' },
    { label: 'Nullifier (reset to default)', value: 'nullify' }
  ],
  Defend: [
    { label: 'Shield (block next attack)', value: 'shield' }
  ],
  Utility: [
    { label: 'Earnings Multiplier (2x)', value: 'doubleEarnings' },
    { label: 'Shop Discount', value: 'discountShop' }
  ],
  Passive: [], // No primary effects for passive
  'Mystery Box': []
};

const RARITY_OPTIONS = {
  Common: [{ weight: 40000, luckWeight: 1000 }],
  Uncommon: [{ weight: 30000, luckWeight: 2000 }],
  Rare: [{ weight: 20000, luckWeight: 3000 }],
  Epic: [{ weight: 8000, luckWeight: 4000 }],
  Legendary: [{ weight: 2000, luckWeight: 5000 }]
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
    primaryEffectValue: '',
    primaryEffectDuration: '',
    secondaryEffects: [],
    swapOptions: [],
    duration: '',
    prizeWeights: {},
    luckFactor: '',
    requiredBadge: ''
  });

  const [loading, setLoading] = useState(false);
  const [effectPreview, setEffectPreview] = useState('');

  // image source toggles and file handling
  const [imageSource, setImageSource] = useState('url');
  const [imageFile, setImageFile] = useState(null);
  const [imageUrlLocal, setImageUrlLocal] = useState('');

  // Mystery box related
  const [allPrizes, setAllPrizes] = useState([]);
  const [selectedRewards, setSelectedRewards] = useState([]);
  const [showWork, setShowWork] = useState(false);
  const [showLuck, setShowLuck] = useState(false);
  const [studentLuck, setStudentLuck] = useState(3);

  const [badges, setBadges] = useState([]);
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const fileInputRef = useRef(null);

  // keep an auto-generated preview in sync with form
  useEffect(() => {
    const gen = describeEffectFromForm(form);
    setEffectPreview(gen);
  }, [
    form.category,
    form.primaryEffect,
    form.primaryEffectValue,
    form.duration,
    form.prizeWeights,
    JSON.stringify(form.secondaryEffects),
    JSON.stringify(form.swapOptions)
  ]);

  // load non-mystery items so teacher can pick them as prizes
  useEffect(() => {
    if (!classroomId || !bazaarId) return;
    (async () => {
      try {
        const res = await apiBazaar.get(
          `classroom/${classroomId}/bazaar/${bazaarId}/items?kind=standard`
        );
        const items = res.data.items || res.data;
        setAllPrizes(items.filter((item) => !item.owner && item.kind !== 'mystery_box'));
      } catch (err) {
        console.error('Failed to load prizes for mystery box:', err);
      }
    })();
  }, [classroomId, bazaarId]);

  // fetch badges for the item creation dropdown
  useEffect(() => {
    if (!classroomId) return;
    (async () => {
      try {
        const res = await getBadges(classroomId);
        const data = res.data?.badges || res.data || [];
        setBadges(data);
      } catch (err) {
        console.error('Failed to load badges:', err);
      }
    })();
  }, [classroomId]);

  // Reset form to initial state
  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      price: '',
      image: '',
      category: '',
      primaryEffect: '',
      primaryEffectValue: '',
      primaryEffectDuration: '',
      secondaryEffects: [],
      swapOptions: [],
      duration: '',
      prizeWeights: {},
      luckFactor: '',
      requiredBadge: ''
    });
    setImageSource('url');
    setImageFile(null);
    setImageUrlLocal('');
    setSelectedRewards([]);
    setShowWork(false);
    setShowLuck(false);
    setStudentLuck(3);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle input changes and reset dependent fields when category changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'category'
        ? {
            primaryEffect: '',
            primaryEffectValue: '',
            primaryEffectDuration: '',
            secondaryEffects: [],
            swapOptions: [],
            duration: '',
            prizeWeights: {},
            luckFactor: ''
          }
        : {})
    }));
  };

  // when selecting primary effect, set sensible defaults for certain effects
  const handlePrimaryEffectSelect = (e) => {
    const value = e.target.value;
    setForm((prev) => ({
      ...prev,
      primaryEffect: value,
      ...(value === 'discountShop'
        ? { primaryEffectValue: prev.primaryEffectValue }
        : {})
    }));
  };

  // Add a new secondary effect if under the limit of 3
  const addSecondaryEffect = () => {
    if (form.secondaryEffects.length >= 3) return;
    setForm((prev) => ({
      ...prev,
      secondaryEffects: [...prev.secondaryEffects, { effectType: '', value: 1 }]
    }));
  };

  // Update a specific secondary effect at an index
  const updateSecondaryEffect = (index, field, value) => {
    setForm((prev) => {
      const newEffects = [...prev.secondaryEffects];
      newEffects[index] = { ...newEffects[index], [field]: value };
      return { ...prev, secondaryEffects: newEffects };
    });
  };

  // Remove a secondary effect at the given index
  const removeSecondaryEffect = (index) => {
    setForm((prev) => {
      const newEffects = [...prev.secondaryEffects];
      newEffects.splice(index, 1);
      return { ...prev, secondaryEffects: newEffects };
    });
  };

  // Toggle selected swap option in the swapOptions array
  const toggleSwapOption = (option) => {
    setForm((prev) => {
      const newOptions = prev.swapOptions.includes(option)
        ? prev.swapOptions.filter((o) => o !== option)
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
      (effect) => !form.secondaryEffects.some((se) => se.effectType === effect.value)
    );
  };

  // following functions: adds, updates, removes possible prizes
  const addPrize = () => {
    if (selectedRewards.length >= allPrizes.length) return;
    setSelectedRewards((prev) => [
      ...prev,
      { itemId: '', weight: 40000, luckWeight: 1000, rarity: 'Common' }
    ]);
  };

  const updatePrize = (spot, change) => {
    setSelectedRewards((prev) => {
      const copy = [...prev];
      copy[spot] = { ...copy[spot], itemId: change };
      return copy;
    });
  };

  const updateProb = (spot, prob) => {
    setSelectedRewards((prev) => {
      const copy = [...prev];
      copy[spot] = { ...copy[spot], probability: Number(prob) };
      return copy;
    });
  };

  const updateRarity = (spot, rarityS) => {
    const r = RARITY_OPTIONS[rarityS][0];
    setSelectedRewards((prev) => {
      const copy = [...prev];
      copy[spot] = {
        ...copy[spot],
        weight: r.weight,
        luckWeight: r.luckWeight,
        rarity: rarityS,
        probability: null
      };
      return copy;
    });
  };

  const removePrize = (index) => {
    setSelectedRewards((prev) => {
      const prizes = [...prev];
      prizes.splice(index, 1);
      return prizes;
    });
  };

  // filters out added prizes from selectable items
  const notAdded = (current) => {
    const usedItems = selectedRewards.map((p) => p.itemId).filter((id) => id !== current);
    return allPrizes.filter((item) => !usedItems.includes(item._id));
  };

  function itemProbBase(item) {
    const itemW = item.weight;
    const allW = selectedRewards.reduce(
      (total, oItem) => total + oItem.weight,
      0
    );
    const prob = Math.round(10000 * itemW / allW) / 100;
    return prob;
  }

  function totalProb() {
    const { percents, weights, totalW } = selectedRewards.reduce(
      (totals, oItem) => {
        totals.totalW += Number(oItem.weight) || 0;
        oItem.probability != null
          ? (totals.percents += Number(oItem.probability) || 0)
          : (totals.weights += Number(oItem.weight) || 0);

        return totals;
      },
      { percents: 0, weights: 0, totalW: 0 }
    );
    const wp = (weights / totalW) * 100;
    return percents + wp || 100;
  }

  // if the item isn't a mystery box - or the totalProb is either too low or too high, return false
  function haltMystery() {
    return (
      form.category === 'Mystery Box' &&
      (totalProb().toFixed(2) <= 99.99 || totalProb().toFixed(2) >= 100.01)
    );
  }

  // helper will return the teacher award selection into JSON structure
  const buildRewardsPayload = () => {
    if (form.category !== 'Mystery Box') return [];
    const totalW = selectedRewards.reduce(
      (total, oItem) => total + oItem.weight,
      0
    );
    return selectedRewards
      .filter((r) => r.itemId)
      .map((r) => {
        const i = allPrizes.find((p) => p._id === r.itemId);
        let weight = Number(r.weight) || 2000;
        if (r.probability != null) {
          weight = Number((r.probability * totalW) / 100);
        }
        return {
          itemId: r.itemId,
          itemName: i ? i.name : '',
          weight,
          luckWeight: Number(r.luckWeight) || 0
        };
      });
  };

  // Validate and submit form to backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (haltMystery()) {
        throw new Error("Mystery box item percentages don't add up to 100%.");
      }

      const cleanedEffect = (effectPreview || '').trim();
      const combinedDescription = `${form.description?.trim() || ''}${
        cleanedEffect ? `\n\nEffect: ${cleanedEffect}` : ''
      }`.trim();

      if (imageSource === 'file' && imageFile) {
        if (imageFile.size > MAX_IMAGE_BYTES) {
          throw new Error('Image too large');
        }
        const fd = new FormData();
        fd.append('name', form.name.trim());
        fd.append('description', combinedDescription);
        fd.append('price', Number(form.price));
        fd.append('category', form.category);
        fd.append(
          'primaryEffect',
          form.category !== 'Passive' ? form.primaryEffect : ''
        );
        fd.append(
          'primaryEffectValue',
          form.category !== 'Passive' ? Number(form.primaryEffectValue) : ''
        );
        fd.append('secondaryEffects', JSON.stringify(form.secondaryEffects || []));
        fd.append('swapOptions', JSON.stringify(form.swapOptions || []));
        fd.append('duration', Number(form.duration));
        fd.append('requiredBadge', form.requiredBadge || '');
        fd.append('bazaar', bazaarId);
        fd.append('image', imageFile);
        fd.append('rewards', JSON.stringify(buildRewardsPayload()));
        fd.append('luckFactor', Number(form.luckFactor));

        const res = await apiBazaar.post(
          `classroom/${classroomId}/bazaar/${bazaarId}/items`,
          fd,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        toast.success('Item created successfully!');
        onAdd?.(res.data.item || res.data);
        resetForm();
      } else {
        const payload = {
          name: form.name.trim(),
          description: combinedDescription,
          price: Number(form.price),
          image: (imageSource === 'url'
            ? normalizeUrl(imageUrlLocal)
            : form.image
          ).trim(),
          category: form.category,
          primaryEffect:
            form.category !== 'Passive' ? form.primaryEffect : undefined,
          primaryEffectValue:
            form.category !== 'Passive'
              ? Number(form.primaryEffectValue)
              : undefined,
          secondaryEffects: (form.secondaryEffects || [])
            .filter((effect) => effect.effectType)
            .map((effect) => ({
              effectType: effect.effectType,
              value: Number(effect.value)
            })),
          swapOptions: form.primaryEffect === 'swapper' ? form.swapOptions : undefined,
          duration:
            form.primaryEffect === 'discountShop'
              ? Number(form.duration)
              : undefined,
          requiredBadge: form.requiredBadge || null,
          bazaar: bazaarId,
          rewards: buildRewardsPayload(),
          luckFactor: Number(form.luckFactor)
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

    // displays the effect of luck
    const displayLuck = () => {
        if (selectedRewards.length <= 0) return (
            <div>No items selected</div>
        );
        const {luckWeights, baseW} = selectedRewards.reduce(
            (totals, oItem) => {
                totals.baseW += Number(oItem.weight) || 0;
                (totals.luckWeights += Number(oItem.luckWeight) || 0);
                return totals;
            }, {luckWeights: 0, baseW: 0}
        )
        
        let luckEffect = (studentLuck-1) * Number(form.luckFactor || 0);
        if (luckEffect < 0) luckEffect = 0;
        const luckW = luckWeights * luckEffect;
        const totalW = baseW + luckW;

        // maps each selected item
        return selectedRewards.map((reward, spot) => {
            const item = allPrizes.find(p => p._id === reward.itemId);
            const name = item?.name ?? "Un-selected";
            const rarity = item?.rarity ?? "Common";
            let weight = Number(reward.weight) || 40000;
            if (reward.probability != null)
            {
                weight = Number(reward.probability * baseW / 100);
            }
            const luckWeight = (Number(reward.luckWeight) || 2000) * luckEffect;
            
            const probability = (weight + luckWeight) * 100 / totalW;
            const baseProb = weight * 100 / totalW;
            const changeProb = probability - baseProb;
            
            
            return (
                <div key={spot} className="flex items-center gap-3 px-1 text-sm">
                    <span className="flex-1">{name}</span>
                    <span className="flex-1 text-center">{rarity}</span>
                    <span className="w-16 text-left"> {baseProb.toFixed(2)}%</span>  
                    <span className="w-16 text-left"> {probability.toFixed(2)}%</span>
                    <span className="w-16 text-left"> {changeProb.toFixed(2)}%</span>
                </div>
            )


        })
    }
    const displayWork = () => {
        const basePart = [
            { rarity: "Common", percent: 40, mult: 0.2, colorFinal: "#E3C62B", colorChange: "#FF2632", },
            { rarity: "Uncommon", percent: 30, mult: 0.4, colorFinal: "#E3C62B", colorChange: "#FF2632" },
            { rarity: "Rare", percent: 20, mult: 0.6, colorFinal: "", colorChange: "" },
            { rarity: "Epic", percent: 8, mult: 0.8, colorFinal: "#09D63E", colorChange: "#09D63E" },
            { rarity: "Legendary", percent: 2, mult: 1.0, colorFinal: "#0E9931", colorChange: "#0E9931", bold: true },
        ]
        return (
            <div className="mt-4 p-4 border border-base-300 rounded-lg space-y-3 z-0">
                <h3 className="text-2xl font-bold text-success flex items-center gap-2">
                    How luck factor works
                </h3>
                <p>Students with higher <b>luck stats</b> get <b>improved chances</b> for rarer items. The luck factor multiplier controls how much their luck affects the probability distribution.</p>
                <div className="flex card card-compact p-4 border bg-green-600 bg-opacity-20 gap-2 bg-base-100">
                    <p className="text-yellow-400"><b> ⚠️ Why do we subtract 1 from luck?</b></p>
                    <p><b>Baseline Luck is 1.0×</b> (neutral - no bonus). If a student has <b>luck ×3.0</b>, we only want to apply the <i>bonus</i> part (3.0 - 1.0 = <b>2.0</b>).</p>
                </div>
                <ol>
                    <li>Luck = 1.0 &rarr; Bonus = (1.0 - 1.0) = <b>0.0</b> (no advantage)</li>
                    <li>Luck = 2.0 &rarr; Bonus = (2.0 - 1.0) = <b>1.0</b> (modest boost)</li>
                    <li>Luck = 3.0 &rarr; Bonus = (3.0 - 1.0) = <b>2.0</b> (strong boost)</li>
                </ol>
                <div className="flex card card-compact p-4 border bg-green-600 bg-opacity-20 gap-2">
                    <p>This ensures that <b>luck = 1.0 means "neutral"</b> (standard drop rates), and only <b>values above 1.0</b> provide an advantage.</p>
                </div>
                <div className="flex card card-compact p-4 border bg-green-600 bg-opacity-20 gap-2">
                    <p>📊<b> Rarity Weights (How Much Luck Affects Each Tier)</b></p>
                </div>
                <div className="flex card card-compact p-4 border bg-green-600 bg-opacity-20 gap-2">
                    <div className="flex gap-2 items-center">
                        <span className="flex-1">
                            <b>Common</b>
                            <p>Rank: 1</p>
                            <p className="text-yellow-600">1 ÷ 5 = 0.2</p>
                        </span>
                        <span className="flex-1">
                            <b>Uncommon</b>
                            <p>Rank: 2</p>
                            <p className="text-yellow-600">2 ÷ 5 = 0.4</p>
                        </span>
                        <span className="flex-1">
                            <b>Rare</b>
                            <p>Rank: 3</p>
                            <p className="text-yellow-600">3 ÷ 5 = 0.6</p>
                        </span>
                        <span className="flex-1">
                            <b>Epic</b>
                            <p>Rank: 4</p>
                            <p className="text-yellow-600">4 ÷ 5 = 0.8</p>
                        </span>
                        <span className="flex-1">
                            <b>Legendary</b>
                            <p>Rank: 5</p>
                            <p className="text-yellow-600">5 ÷ 5 = 1.0</p>
                        </span>
                    </div>
                    <p>⚡ <b>Higher weight = more luck boost.</b> Legendary items get the full luck bonus, while common items get only 20%.</p>   
                </div>
                <p className="text-blue-400">📊<b> Complete Example: 5-Item Mystery Box</b></p>
                <div className="flex card card-compact p-4 border bg-green-600 bg-opacity-20 gap-2">
                    <p><b>Step 1: Base Drop Rates (No Luck)</b></p>
                        <ul className="w-80">
                        {basePart.map((r) => (
                            <li key={r.rarity} className="flex">
                                <span className="flex-1">{r.rarity}</span>
                                <span className="flex">{(r.percent).toFixed(1)}%</span>
                            </li>
                        ))}
                        </ul>
                        <ul className="w-80">
                            <li className="flex">
                                <span className="flex-1"><b>TOTAL:</b></span>
                                <span className="flex text-green-700"><b>100.0%</b></span>
                            </li>
                        </ul>
                </div>
                <div className="flex card card-compact p-4 border bg-green-600 bg-opacity-20 gap-2">
                    <p><b>Step 2:  Apply Luck (Student with ×3.0 luck, luck factor multiplier = 1.5)</b></p>
                    <p><b className="text-blue-400">Why (3.0 - 1)?</b> Luck 1.0 is neutral (no bonus). Student with luck ×3.0 has <b>2.0 bonus points</b> to distribute.</p>
                    <p>Luck bonus = <b className="text-orange-400">(3.0 - 1)</b> × 1.5 = <b>3.0</b></p>
                    <ul className="w-80">
                        {basePart.map((r) => (
                            <li key={r.rarity} className="flex">
                                <span className="flex-1">{r.rarity}: {r.percent}% + (3.0 * <b>{r.mult}</b> * 10)</span>
                                <span className="flex">{(r.percent + (r.mult * 30)).toFixed(1)}%</span>
                            </li>
                        ))}
                    </ul>
                    <ul className="w-80">
                        <li className="flex">
                            <span className="flex-1"><b>TOTAL (before normalization):</b></span>
                            <span className="flex"><b>190.0%</b></span>
                        </li>
                    </ul>
                </div>
                <div className="flex card card-compact p-4 border bg-blue-400 bg-opacity-20 gap-2">
                    <b className="text-blue-400">Where do 0.2, 0.4, 0.6, 0.8, 1.0 come from?</b>
                    <p>These are the <b>rarity weights</b> shown above (Common=1/5, Uncommon=2/5, etc.). They ensure legendary items get the full luck bonus while common items get only <i>20%</i> of it.</p>
                </div>
                <div className="flex card card-compact p-4 border bg-red-400 bg-opacity-20 gap-2">
                    <b className="text-red-700">Problem: Total is 190%, not 100%!</b>
                    <p>These are the <b>rarity weights</b> shown above (Common=1/5, Uncommon=2/5, etc.). They ensure legendary items get the full luck bonus while common items get only <i>20%</i> of it.</p>
                </div>
                <div className="flex card card-compact p-4 border bg-green-600 bg-opacity-20 gap-2">
                    <p><b>Step 3:  Normalize (Scale Down to 100%)</b></p>
                    <p> We divide each by the total (190%), and multiply by 100%</p>
                    <ul className="w-80">
                        {basePart.map((r) => (
                            <li key={r.rarity} className="flex">
                                <span className="flex-1">{r.rarity}: ({(r.percent + (30 * r.mult)).toFixed(1)} ÷ 190) * 100</span>
                                <span className="flex">≈{((r.percent + (r.mult * 30)) / 190 * 100).toFixed(1)}%</span>
                            </li>
                        ))}
                    </ul>
                    <ul className="w-80">
                        <li className="flex">
                            <span className="flex-1"><b>FINAL TOTAL:</b></span>
                            <span className="flex"><b>100.0%</b></span>
                        </li>
                    </ul>
                </div>
                <b>📈 Before vs After Comparison</b>
                <ul className="w-full">
                    <li className="flex">
                        <b className="flex-1">Item</b>
                        <b className="flex-1">Base %</b>
                        <b className="flex-1">Final %</b>
                        <b className="flex-1">Change</b>
                    </li>
                </ul>
                <ul className="w-full">
                    {basePart.map((r) => (
                        <li key={r.rarity} className="flex">
                            <span className="flex-1" style={{ fontWeight: r.bold ? 'bold' : 'normal' }}>{r.rarity}</span>
                            <span className="flex-1" style={{ fontWeight: r.bold ? 'bold' : 'normal' }}>{(r.percent).toFixed(1)}%</span>
                            <span className="flex-1" style={{color: r.colorFinal, fontWeight: r.bold ? 'bold' : 'normal'}}>{((r.percent + (r.mult * 30)) / 190 * 100).toFixed(1)}%</span>
                            <span className="flex-1" style={{color: r.colorChange, fontWeight: r.bold ? 'bold' : 'normal'}}>{(((r.percent + (r.mult * 30)) / 190 * 100) - r.percent).toFixed(1)}%</span>
                        </li>
                    ))}
                </ul>
                <p></p>
                <b className="text-green-700">✓ Legendary is now 8.4× more likely (16.8% vs 2%)!</b>
                <div className="flex card card-compact p-4 border bg-green-600 bg-opacity-20 gap-2">
                    <p><b className="text-blue-400">Key Takeaway:</b> Luck <i>redistributes</i> probability from common items toward rare+ items.
                    All rates are then <b>normalized</b> (proportionally scaled) back to 100% so the system remains mathematically valid.
                    This ensures lucky students get significantly better odds on rare+ items without breaking the probability model</p>
                </div>

                <div className="flex items-center justify-center">
                    <button
                        className="btn"
                        onClick={() => {
                            setShowWork(false);
                        }}
                        >
                        Close
                    </button>
                </div>
            </div>
        )
    }
 
   return (
    <>
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
              Item Name <span className="text-error">*</span>
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
              Price <span className="text-error">*</span>
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
                onClick={() => setImageSource('url')}
                className={`px-3 py-1 rounded-full text-sm ${
                  imageSource === 'url'
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                URL
              </button>
              <button
                type="button"
                onClick={() => setImageSource('file')}
                className={`ml-1 px-3 py-1 rounded-full text-sm ${
                  imageSource === 'file'
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Upload
              </button>
            </div>
          </div>

          {imageSource === 'file' ? (
            <>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                ref={fileInputRef}
                onChange={(e) => setImageFile(e.target.files[0])}
                className="file-input file-input-bordered w-full max-w-xs"
              />
              <p className="text-xs text-gray-500">
                Allowed: jpg, png, webp, gif. Max: 5 MB.
              </p>
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
              Category <span className="text-error">*</span>
            </span>
          </label>
          <select
            name="category"
            className="select select-bordered w-full"
            value={form.category}
            onChange={handleChange}
            required
          >
            <option value="" disabled>
              Select category
            </option>
            {Object.keys(CATEGORY_OPTIONS).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Required Badge Selection */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Required Badge (optional)</span>
          </label>
          <select
            name="requiredBadge"
            className="select select-bordered w-full"
            value={form.requiredBadge}
            onChange={handleChange}
          >
            <option value="">No badge required</option>
            {badges.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Primary Effect (for non-passive categories and mystery box) */}
        {form.category && !['Passive', 'Mystery Box'].includes(form.category) && (
          <div className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">
                  Primary Effect <span className="text-error">*</span>
                </span>
              </label>
              <select
                name="primaryEffect"
                className="select select-bordered w-full"
                value={form.primaryEffect}
                onChange={handleChange}
                onBlur={handlePrimaryEffectSelect}
                required
              >
                <option value="" disabled>
                  Select effect
                </option>
                {CATEGORY_OPTIONS[form.category].map((effect) => (
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
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        primaryEffectValue: Math.min(
                          100,
                          Math.max(1, e.target.value)
                        )
                      }))
                    }
                    min="1"
                    max="100"
                  />
                  <span className="join-item bg-base-200 px-4 flex items-center">
                    %
                  </span>
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
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        primaryEffectValue: e.target.value
                      }))
                    }
                    placeholder="example: 1/2 for half"
                  />
                  <span className="join-item bg-base-200 px-4 flex items-center">
                    bits
                  </span>
                </div>
              </div>
            )}

            {/* Discount Shop Inputs */}
            {form.primaryEffect === 'discountShop' && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Applied Discount</span>
                </label>
                <div className="join">
                  <input
                    type="number"
                    className="input input-bordered join-item w-full"
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        primaryEffectValue: Math.min(
                          100,
                          Math.max(1, e.target.value)
                        )
                      }))
                    }
                    min="1"
                    max="100"
                  />
                  <span className="join-item bg-base-200 px-4 flex items-center">
                    %
                  </span>
                </div>
                <label className="label">
                  <span className="label-text font-medium">
                    Discount Duration (hours)
                  </span>
                </label>
                <div className="join">
                  <input
                    type="number"
                    className="input input-bordered join-item w-full"
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        duration: Math.min(
                          8760,
                          Math.max(1, e.target.value)
                        )
                      }))
                    }
                    min="1"
                    max="8760"
                  />
                  <span className="join-item bg-base-200 px-4 flex items-center" />
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
                  {['bits', 'multiplier', 'luck'].map((option) => (
                    <div key={option} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`swap-${option}`}
                        className="checkbox checkbox-sm"
                        checked={form.swapOptions.includes(option)}
                        onChange={() => toggleSwapOption(option)}
                      />
                      <label
                        htmlFor={`swap-${option}`}
                        className="capitalize"
                      >
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Secondary Effects */}
        {(form.category === 'Attack' || form.category === 'Passive') && (
          <div className="form-control space-y-2">
            <label className="label">
              <span className="label-text font-medium">Secondary Effects</span>
              <span className="label-text-alt">
                {form.secondaryEffects.length}/3 selected
              </span>
            </label>

            {form.secondaryEffects.map((effect, index) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row items-center gap-2"
              >
                <select
                  className="select select-bordered flex-1"
                  value={effect.effectType}
                  onChange={(e) =>
                    updateSecondaryEffect(index, 'effectType', e.target.value)
                  }
                  required
                >
                  <option value="" disabled>
                    Select effect
                  </option>
                  {availableSecondaryEffects()
                    .concat(
                      effect.effectType
                        ? {
                            label: effect.effectType,
                            value: effect.effectType
                          }
                        : []
                    )
                    .map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  className="input input-bordered w-full sm:w-20"
                  value={effect.value}
                  onChange={(e) =>
                    updateSecondaryEffect(index, 'value', e.target.value)
                  }
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

            {form.secondaryEffects.length < 3 &&
              availableSecondaryEffects().length > 0 && (
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

        {/* Mystery Box */}
        {form.category === 'Mystery Box' && (
          <div className="form-control space-y-2">
            <label className="label">
              <span className="label-text font-medium">Item Pool</span>
              <div className="flex gap-2">
                <button
                  className="btn btn-sm"
                  type="button"
                  onClick={() => setShowWork((prev) => !prev)}
                >
                  {showWork ? 'Hide how it works' : 'How it works'}
                </button>
              </div>
              {allPrizes.length > 0 && (
                <span className="label-text-alt">
                  {selectedRewards.length}/{allPrizes.length} selected
                </span>
              )}
            </label>

            {/* INLINE "How it works" dropdown */}
            {showWork && displayWork()}

            <div className="flex items-center gap-2 mb-2 mt-2">
              <span className="label-text font-medium">Luck Factor</span>
              <span className="p-1" />
              <input
                type="number"
                min="0"
                className="input input-bordered w-20"
                value={form.luckFactor || 0}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    luckFactor: Number(e.target.value)
                  }))
                }
              />
            </div>

            {selectedRewards.length > 0 && (
              <div className="flex items-center gap-3 px-1 text-sm">
                <span className="flex-1">Item</span>
                <span className="flex-1">
                Total %: {totalProb().toFixed(2)}
                </span>
              <div className="flex items-center gap-2">
                  <span className="w-80 text-center">Rarity</span>
                  <span className="w-8 text-left">%</span>
                  <span className="w-8 text-center" />
             </div>
            </div>
          )}

          {selectedRewards.map((reward, spot) => (
            <div key={spot} className="flex items-center gap-3">
            {/* Item dropdown */}
               <select
                  className="select select-bordered flex-1"
                  value={reward.itemId}
                  onChange={(e) => updatePrize(spot, e.target.value)}
                  required
              >
           <option value="" disabled>
             Select item
          </option>
            {notAdded(reward.itemId).map((item) => (
            <option key={item._id} value={item._id}>
            {item.name}
          </option>
       ))}
    </select>

    <select
      name="rarity"
      className="select select-bordered w-40"
      value={reward.rarity}
      onChange={(e) => updateRarity(spot, e.target.value)}
      required
    >
      <option value="" disabled>
        Select rarity
      </option>
      {Object.keys(RARITY_OPTIONS).map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>

    <input
      type="number"
      className="input input-bordered"
      min="0"
      max="100"
      step="0.01"
      value={
        reward.probability ??
        itemProbBase(selectedRewards[spot]).toFixed(2)
      }
      onChange={(e) => updateProb(spot, e.target.value)}
    />

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
                + Add Item
              </button>
            )}

            {/* BUTTON TO TOGGLE INLINE LUCK PREVIEW */}
            <div className="flex justify-center gap-4 mt-4">
              <button
                className="btn btn-sm"
                type="button"
                disabled={haltMystery()}
                onClick={() => setShowLuck((prev) => !prev)}
              >
                {showLuck ? 'Hide luck preview' : 'Preview Luck Stat effect'}
              </button>
            </div>

            {/* INLINE LUCK PREVIEW DROPDOWN */}
            {showLuck && (
              <div className="mt-3 border border-base-300 rounded-lg p-3 bg-base-100 space-y-3">
                <h3 className="text-xl font-bold text-success flex items-center gap-2">
                  Preview Luck stat effect
                </h3>
                <label className="label">
                  <span className="label-text font-medium">
                    Set Student Luck <span className="text-error">*</span>
                  </span>
                </label>
                <input
                  type="number"
                  className="input input-bordered mb-2 w-32"
                  value={studentLuck}
                  onChange={(e) => setStudentLuck(e.target.value)}
                  min="1"
                />

                {selectedRewards.length > 0 && (
                  <div className="flex items-center gap-2 px-1 text-sm mb-1">
                    <span className="flex-1">Item</span>
                    <span className="flex-1 text-center">Rarity</span>
                    <span className="w-16 text-left">Base %</span>
                    <span className="w-16 text-left">Your %</span>
                    <span className="w-16 text-left">Change</span>
                  </div>
                )}

                {displayLuck()}
              </div>
            )}

            {Object.keys(selectedRewards).length === 0 &&
              allPrizes.length > 0 && (
                <div className="text-sm text-gray-500">
                  Select items above to assign prize chances.
                </div>
              )}

            {Object.keys(selectedRewards).length >= allPrizes.length &&
              allPrizes.length > 0 && (
                <div className="text-sm text-gray-500">
                  You've selected all items
                </div>
              )}

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
            <span className="label-text font-medium">
              Auto-generated Effect (editable)
            </span>
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
            placeholder='Effect preview will appear here (auto-generated from selected effects). You can edit this before submitting.'
          />
          <p className="text-xs text-base-content/60 mt-1">
            This text will be appended to the item description as "Effect:
            ...".
          </p>
        </div>

        <button
          className="btn btn-success w-full mt-2"
          disabled={loading || haltMystery()}
          type="submit"
        >
          {loading ? (
            <>
              <span className="loading loading-spinner" />
              Adding...
            </>
          ) : (
            'Add Item'
          )}
        </button>
      </form>
    </>
  );
};

export default CreateItem;
