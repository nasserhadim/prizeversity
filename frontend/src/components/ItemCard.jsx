import { useState, useEffect } from 'react';
import { Pencil, Trash2, Lock, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import apiBazaar from '../API/apiBazaar.js';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext.jsx';
import { resolveImageSrc } from '../utils/image';
import {
  splitDescriptionEffect,
  getEffectDescription,
  describeEffectFromForm,
} from '../utils/itemHelpers';
import { data } from 'react-router';
import apiDiscount from '../API/apiDiscount';
import { getBadges } from '../API/apiBadges';

// Same category options as CreateItem
const CATEGORY_OPTIONS = {
  Attack: [
    { label: 'Bit Splitter', value: 'splitBits' },
    { label: 'Bit Leech (steal %)', value: 'stealBits' },
    { label: 'Attribute Swapper', value: 'swapper' },
    { label: 'Nullifier (reset to default)', value: 'nullify' },
  ],
  Defend: [{ label: 'Shield (block next attack)', value: 'shield' }],
  Utility: [
    { label: 'Earnings Multiplier (2x)', value: 'doubleEarnings' },
    { label: 'Shop Discount', value: 'discountShop' },
  ],
  Passive: [],
  'Mystery Box': [],
};

// Same rarity options / weights as CreateItem
const RARITY_OPTIONS = {
  Common: [{ weight: 40000, luckWeight: 1000 }],
  Uncommon: [{ weight: 30000, luckWeight: 2000 }],
  Rare: [{ weight: 20000, luckWeight: 3000 }],
  Epic: [{ weight: 8000, luckWeight: 4000 }],
  Legendary: [{ weight: 2000, luckWeight: 5000 }],
};

// Map luckWeight → rarity label
const LUCK_TO_RARITY = {
  1000: 'Common',
  2000: 'Uncommon',
  3000: 'Rare',
  4000: 'Epic',
  5000: 'Legendary',
};

// 🔹 Helper to normalize any id / ObjectId-like value to a string
const normalizeId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (value._id || value.id) return String(value._id || value.id);
    if (typeof value.toString === 'function') return String(value.toString());
  }
  return String(value);
};

const ItemCard = ({
  item,
  role,
  classroomId,
  teacherId,
  onUpdated,
  onDeleted,
  bazaarIdProp,
}) => {
  // derive initial required badge id (handles populated vs id)
  const initialRequiredBadgeId =
    item?.requiredBadge && typeof item.requiredBadge === 'object'
      ? item.requiredBadge._id
      : item?.requiredBadge || '';

  const [confirmDelete, setConfirmDelete] = useState(false); // delete confirm modal
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const { addToCart } = useCart();
  const { user } = useAuth();

  const [open, setOpen] = useState(false); // (kept from your version, currently unused)
  const [saving, setSaving] = useState(false); // shows spinner when saving
  const [editOpen, setEditOpen] = useState(false); // edit modal visibility

  const [discounts, setDiscounts] = useState([]);
  const [discountPercent, setDiscountPercent] = useState(0);

  const [mysteryStats, setMysteryStats] = useState([]);
  const [showStats, setShowStats] = useState(false);
  const [itemNames, setItemNames] = useState([]);
  const [imageSource, setImageSource] = useState('url');
  const [badgeOptions, setBadgeOptions] = useState([]);

  // For mystery box editing
  const [allPrizes, setAllPrizes] = useState([]); // all eligible standard items
  const [selectedRewards, setSelectedRewards] = useState([]); // teacher-selected rewards

  // 🔹 NORMALIZE CATEGORY for existing items:
  // If item.category is missing but kind === 'mystery_box', treat as "Mystery Box"
  const normalizedCategory =
    item?.category?.name ||
    item?.category ||
    (item?.kind === 'mystery_box' ? 'Mystery Box' : '');

  // What we actually show in the read-only input
  const categoryLabel =
    normalizedCategory ||
    (item.kind === 'mystery_box' ? 'Mystery Box' : 'Uncategorized');

  // Central flag: treat this item as a Mystery Box for editing if
  // either the normalized category says so OR the kind is "mystery_box"
  const isMysteryCategory =
    normalizedCategory === 'Mystery Box' || item.kind === 'mystery_box';

  // ----- EDIT FORM: mirror CreateItem fields -----
  const [form, setForm] = useState(() => {
    const { main } = splitDescriptionEffect(item.description || '');
    return {
      name: item.name || '',
      description: main || '',
      price: item.price || 0,
      image: item.image || '',
      category: normalizedCategory,
      primaryEffect: item.primaryEffect || '',
      primaryEffectValue:
        item.primaryEffectValue !== undefined ? item.primaryEffectValue : '',
      primaryEffectDuration:
        item.primaryEffectDuration !== undefined
          ? item.primaryEffectDuration
          : '',
      secondaryEffects: item.secondaryEffects || [],
      swapOptions: item.swapOptions || [],
      duration: item.duration !== undefined ? item.duration : '',
      prizeWeights: {},
      luckFactor: item.luckFactor !== undefined ? item.luckFactor : '',
      requiredBadge: initialRequiredBadgeId,
    };
  });

  // Editable effect text (for "Effect: ...")
  const [effectPreview, setEffectPreview] = useState(() => {
    const { effect } = splitDescriptionEffect(item.description || '');
    return effect || getEffectDescription(item) || '';
  });

  // Re-sync form when the item prop changes
  useEffect(() => {
    const { main, effect } = splitDescriptionEffect(item.description || '');
    const normalizedCategoryInner =
      item?.category?.name ||
      item?.category ||
      (item?.kind === 'mystery_box' ? 'Mystery Box' : '');

    setForm((prev) => ({
      ...prev,
      name: item.name || '',
      description: main || '',
      price: item.price || 0,
      image: item.image || '',
      category: normalizedCategoryInner,
      primaryEffect: item.primaryEffect || '',
      primaryEffectValue:
        item.primaryEffectValue !== undefined ? item.primaryEffectValue : '',
      primaryEffectDuration:
        item.primaryEffectDuration !== undefined
          ? item.primaryEffectDuration
          : '',
      secondaryEffects: item.secondaryEffects || [],
      swapOptions: item.swapOptions || [],
      duration: item.duration !== undefined ? item.duration : '',
      luckFactor: item.luckFactor !== undefined ? item.luckFactor : '',
      requiredBadge: initialRequiredBadgeId,
    }));
    setEffectPreview(effect || getEffectDescription(item) || '');
  }, [item, initialRequiredBadgeId]);

  // Keep auto-generated effect preview in sync with form (like CreateItem)
  useEffect(() => {
    const gen = describeEffectFromForm(form);
    setEffectPreview(gen);
  }, [
    form.category,
    form.primaryEffect,
    form.primaryEffectValue,
    form.duration,
    JSON.stringify(form.secondaryEffects),
    JSON.stringify(form.swapOptions),
  ]);

  // Initialize selectedRewards from existing metadata for mystery boxes
  useEffect(() => {
    if (item.kind !== 'mystery_box') return;
    if (!item?.metadata?.rewards) return;

    setSelectedRewards(
      (item.metadata.rewards || []).map((r) => ({
        itemId: normalizeId(r.itemId), // 🔹 normalized
        weight: r.weight,
        luckWeight: r.luckWeight,
        rarity: LUCK_TO_RARITY[r.luckWeight] || '',
        probability: null, // they can override with a % in edit UI
      }))
    );
  }, [item]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  // ----- Secondary effects helpers (same as CreateItem) -----
  const addSecondaryEffect = () => {
    if (form.secondaryEffects.length >= 3) return;
    setForm((prev) => ({
      ...prev,
      secondaryEffects: [
        ...prev.secondaryEffects,
        { effectType: '', value: 1 },
      ],
    }));
  };

  const updateSecondaryEffect = (index, field, value) => {
    setForm((prev) => {
      const newEffects = [...prev.secondaryEffects];
      newEffects[index] = { ...newEffects[index], [field]: value };
      return { ...prev, secondaryEffects: newEffects };
    });
  };

  const removeSecondaryEffect = (index) => {
    setForm((prev) => {
      const newEffects = [...prev.secondaryEffects];
      newEffects.splice(index, 1);
      return { ...prev, secondaryEffects: newEffects };
    });
  };

  const toggleSwapOption = (option) => {
    setForm((prev) => {
      const newOptions = prev.swapOptions.includes(option)
        ? prev.swapOptions.filter((o) => o !== option)
        : [...prev.swapOptions, option];
      return { ...prev, swapOptions: newOptions };
    });
  };

  const availableSecondaryEffects = () => {
    if (!form.category) return [];

    const allEffects = {
      Attack: [
        { label: 'Attack Luck (-1 luck)', value: 'attackLuck' },
        { label: 'Attack Multiplier (-1x)', value: 'attackMultiplier' },
        {
          label: 'Attack Group Multiplier (-1x)',
          value: 'attackGroupMultiplier',
        },
      ],
      Passive: [
        { label: 'Grants Luck (+1 luck)', value: 'grantsLuck' },
        { label: 'Grants Multiplier (+1x)', value: 'grantsMultiplier' },
        {
          label: 'Grants Group Multiplier (+1x)',
          value: 'grantsGroupMultiplier',
        },
      ],
    };

    const effectsForCategory = allEffects[form.category] || [];
    return effectsForCategory.filter(
      (effect) =>
        !form.secondaryEffects.some((se) => se.effectType === effect.value)
    );
  };

  // ----- Mystery Box edit helpers (match CreateItem logic) -----
  const addPrize = () => {
    if (!allPrizes.length) return;
    if (selectedRewards.length >= allPrizes.length) return;
    setSelectedRewards((prev) => [
      ...prev,
      {
        itemId: '',
        weight: 40000,
        luckWeight: 1000,
        rarity: 'Common',
        probability: null,
      },
    ]);
  };

  const updatePrize = (spot, newItemId) => {
    setSelectedRewards((prev) => {
      const copy = [...prev];
      copy[spot] = { ...copy[spot], itemId: normalizeId(newItemId) };
      return copy;
    });
  };

  const updateProb = (spot, prob) => {
    setSelectedRewards((prev) => {
      const copy = [...prev];
      copy[spot] = {
        ...copy[spot],
        probability: prob === '' ? '' : Number(prob),
      };
      return copy;
    });
  };

  const updateRarity = (spot, rarityS) => {
    const cfg = RARITY_OPTIONS[rarityS]?.[0];
    if (!cfg) return;
    setSelectedRewards((prev) => {
      const copy = [...prev];
      copy[spot] = {
        ...copy[spot],
        weight: cfg.weight,
        luckWeight: cfg.luckWeight,
        rarity: rarityS,
        probability: null,
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

  // avoid selecting same item twice
  const notAdded = (current) => {
    const currentId = normalizeId(current);
    const usedItems = selectedRewards
      .map((p) => normalizeId(p.itemId))
      .filter((id) => id && id !== currentId);

    return allPrizes.filter(
      (p) => !usedItems.includes(normalizeId(p._id))
    );
  };

  function itemProbBase(reward) {
    const itemW = Number(reward.weight) || 0;
    const allW = selectedRewards.reduce(
      (total, r) => total + (Number(r.weight) || 0),
      0
    );
    if (!allW) return 0;
    const prob = Math.round((10000 * itemW) / allW) / 100;
    return prob;
  }

  function totalProb() {
    const { percents, weights, totalW } = selectedRewards.reduce(
      (totals, r) => {
        const w = Number(r.weight) || 0;
        totals.totalW += w;
        if (
          r.probability !== null &&
          r.probability !== '' &&
          r.probability !== undefined
        ) {
          totals.percents += Number(r.probability) || 0;
        } else {
          totals.weights += w;
        }
        return totals;
      },
      { percents: 0, weights: 0, totalW: 0 }
    );
    if (!totalW) return 0;
    const wp = (weights / totalW) * 100;
    return percents + wp || 100;
  }

  function haltMystery() {
    if (!isMysteryCategory) return false;
    const total = Number(totalProb().toFixed(2));
    return total <= 99.99 || total >= 100.01;
  }

  const buildRewardsPayload = () => {
    if (!isMysteryCategory) return [];
    const totalW = selectedRewards.reduce(
      (total, r) => total + (Number(r.weight) || 0),
      0
    );
    if (!totalW) return [];

    return selectedRewards
      .filter((r) => r.itemId)
      .map((r) => {
        const rewardItemId = normalizeId(r.itemId);
        const itemDoc = allPrizes.find(
          (p) => normalizeId(p._id) === rewardItemId
        );

        let weight = Number(r.weight) || 2000;
        if (
          r.probability !== null &&
          r.probability !== '' &&
          r.probability !== undefined
        ) {
          weight = Number((Number(r.probability) * totalW) / 100);
        }
        return {
          itemId: rewardItemId,
          itemName: itemDoc ? itemDoc.name : '',
          weight,
          luckWeight: Number(r.luckWeight) || 0,
        };
      });
  };

  // ----- Discounts + Badges -----
  useEffect(() => {
    if (user?._id && classroomId) {
      getDiscounts();
    }
  }, [user?._id, classroomId]);

  useEffect(() => {
    if (!classroomId) return;
    (async () => {
      try {
        const res = await getBadges(classroomId);
        const data = res?.data || res;
        setBadgeOptions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load badges for item edit:', err);
      }
    })();
  }, [classroomId]);

      const submitEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const bazaarId =
        item?.bazaar?._id || item?.bazaar || bazaarIdProp;

      if (!classroomId) throw new Error('Missing classroomId');
      if (!bazaarId) throw new Error('Missing bazaarId');
      if (!item?._id) throw new Error('Missing item id');

      // rebuild description like CreateItem (description + Effect:)
      const cleanedEffect = (effectPreview || '').trim();
      const combinedDescription = `${form.description?.trim() || ''}${
        cleanedEffect ? `\n\nEffect: ${cleanedEffect}` : ''
      }`.trim();

      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('description', combinedDescription);
      formData.append('price', form.price);
      formData.append('requiredBadge', form.requiredBadge || '');

      if (form.category) {
        formData.append('category', form.category);
      }

      // primary effect + value
      // ✅ do NOT send primaryEffect for any Mystery Box
      if (!isMysteryCategory && form.category && form.category !== 'Passive') {
        formData.append('primaryEffect', form.primaryEffect || '');
        if (form.primaryEffectValue !== '') {
          formData.append('primaryEffectValue', form.primaryEffectValue);
        }
      }

      // secondary effects
      formData.append(
        'secondaryEffects',
        JSON.stringify(form.secondaryEffects || [])
      );

      // swapper
      if (form.primaryEffect === 'swapper') {
        formData.append('swapOptions', JSON.stringify(form.swapOptions || []));
      }

      // discount duration
      if (form.primaryEffect === 'discountShop' && form.duration !== '') {
        formData.append('duration', form.duration);
      }

      // 🔹 mystery box: luckFactor + rewards
      let rewardsPayload = [];
      let luck = 0;

      if (isMysteryCategory) {
        rewardsPayload = buildRewardsPayload();

        luck =
          form.luckFactor === '' || form.luckFactor == null
            ? 0
            : Number(form.luckFactor);

        // same pattern as other simple fields (like category)
        formData.append('luckFactor', luck);
        formData.append('rewards', JSON.stringify(rewardsPayload));
      }

      // image
      if (form.image instanceof File) {
        formData.append('image', form.image);
      } else if (typeof form.image === 'string' && form.image.trim()) {
        formData.append('image', form.image.trim());
      }

      const { data } = await apiBazaar.patch(
        `/classroom/${classroomId}/bazaar/${bazaarId}/items/${item._id}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      // make sure the item we hand back to parent includes the latest rewards,
      // same idea as how we normalize category on the front-end
      const updated = { ...(data.item ?? data) };

      if (isMysteryCategory) {
        updated.luckFactor = luck;
        updated.metadata = {
          ...(updated.metadata || {}),
          rewards: rewardsPayload,
        };
      }

      onUpdated?.(updated);
      toast.success('Item updated');
      setEditOpen(false);
    } catch (err) {
      console.error('EDIT ERR:', err.response?.data || err.message);
      toast.error(err?.response?.data?.error || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };


  const bazaarId =
    item?.bazaar?._id || item?.bazaar || bazaarIdProp;

  // Old prompt-based edit (kept, but not used by Edit button)
  const handleEdit = async () => {
    const bazaarIdInner = item?.bazaar?._id || item?.bazaar || bazaarIdProp;
    if (!classroomId) return toast.error('Missing classroomId');
    if (!bazaarIdInner) return toast.error('Missing bazaarId');
    if (!item?._id) return toast.error('Missing item id');

    const newName = window.prompt('New name:', item.name ?? '');
    if (newName === null) return;

    const newPriceStr = window.prompt(
      'New price (number):',
      String(item.price ?? 0)
    );
    if (newPriceStr === null) return;
    const newPrice = Number(newPriceStr);
    if (Number.isNaN(newPrice)) return toast.error('Price must be a number');

    const newDesc = window.prompt('New description:', item.description ?? '');
    if (newDesc === null) return;

    const payload = {};
    if (newName !== item.name) payload.name = newName;
    if (newPrice !== item.price) payload.price = newPrice;
    if ((newDesc ?? '') !== (item.description ?? ''))
      payload.description = newDesc;

    if (Object.keys(payload).length === 0) {
      toast('No changes to save');
      return;
    }

    const url = `/classroom/${classroomId}/bazaar/${bazaarIdInner}/items/${item._id}`;
    try {
      const { data } = await apiBazaar.patch(url, payload);
      const updated = data.item ?? data;
      onUpdated?.(updated);
      toast.success('Item updated');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to update');
    }
  };

  // Delete handler for Teacher
  const confirmDeleteItem = async () => {
    if (!classroomId) return toast.error('Missing classroomId');
    if (!bazaarId) return toast.error('Missing bazaarId');
    if (!item?._id) return toast.error('Missing item id');

    const url = `classroom/${classroomId}/bazaar/${bazaarId}/items/${item._id}`;
    console.log('DELETE →', `/api/bazaar/${url}`, {
      classroomId,
      bazaarId,
      itemId: item._id,
    });

    try {
      const resp = await apiBazaar.delete(url);
      console.log('DELETE OK:', resp?.status, resp?.data);

      onDeleted?.(item._id);
      toast.success('Item deleted');
    } catch (err) {
      const status = err?.response?.status;
      const dataErr = err?.response?.data;
      console.error('DELETE ERR:', status, dataErr);
      toast.error(dataErr?.error || 'Failed to delete');
    }
  };

  const imgSrc = resolveImageSrc(item?.image);

  // Determine if item is badge/level locked for this student
  const classroomData = user?.classroomBalances?.find(
    (cb) => String(cb.classroom) === String(classroomId)
  );

  // Normalize earned badges to plain IDs
  const earnedBadges =
    classroomData?.badges
      ?.map((b) => {
        const badge = b?.badge;
        if (!badge) return null;
        if (typeof badge === 'object') {
          return String(badge._id || badge.id);
        }
        return String(badge);
      })
      .filter(Boolean) || [];

  // Normalize requiredBadge to a plain ID
  const requiredBadgeId =
    item?.requiredBadge && typeof item.requiredBadge === 'object'
      ? String(item.requiredBadge._id || item.requiredBadge.id)
      : item?.requiredBadge
      ? String(item.requiredBadge)
      : '';

  const hasRequiredBadge =
    !requiredBadgeId || earnedBadges.includes(requiredBadgeId);

  const requiredLevel = item.requiredLevel ?? 0;

  const studentLevel =
    classroomData?.level ??
    classroomData?.xpLevel ??
    classroomData?.stats?.level ??
    0;

  const meetsLevel = studentLevel >= requiredLevel;

  const isLocked =
    role === 'student' &&
    ((requiredLevel > 0 && !meetsLevel) ||
      (requiredBadgeId && !hasRequiredBadge));

  const lockTooltip = (() => {
    const reasons = [];
    if (requiredLevel > 0 && !meetsLevel) {
      reasons.push(
        `Level ${requiredLevel}+ required (you are level ${studentLevel || 0})`
      );
    }
    if (requiredBadgeId && !hasRequiredBadge) {
      reasons.push(`Requires Badge: ${item.requiredBadgeName || 'Unknown Badge'}`);
    }
    if (!reasons.length) {
      return 'You meet the requirements';
    }
    return reasons.join(' • ');
  })();

  const handleBuy = async () => {
    if (quantity < 1) return toast.error('Quantity must be at least 1');
    setLoading(true);
    try {
      const { data } = await apiBazaar.post(
        `classroom/${classroomId}/bazaar/${item.bazaar}/items/${item._id}/buy`,
        { quantity: Number(quantity) }
      );

      const updated = data.item ?? data;
      onUpdated?.(updated);

      toast.success('Item purchased!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  const getDiscounts = async () => {
    try {
      const res = await apiDiscount.get(
        `/classroom/${classroomId}/user/${user._id}`
      );
      const discountData = res.data || [];

      setDiscounts(discountData);

      let percent = 0;
      if (discountData.length) {
        const combined = discountData.reduce(
          (acc, d) => acc * (1 - (d.discountPercent || 0) / 100),
          1
        );
        const percentRaw = (1 - combined) * 100;
        percent = Number(percentRaw.toFixed(2));
      }
      setDiscountPercent(percent);
    } catch (err) {
      console.error('Failed to load discounts:', err);
    }
  };

  // discounted price calculation
  const calculatePrice = () => {
    const basePrice = item.price;
    let finalPrice = basePrice;
    let discountApplied = false;
    let groupBonus = false;
    if (role === 'student' && discountPercent > 0) {
      finalPrice = Math.ceil(basePrice * (1 - discountPercent / 100));
      discountApplied = true;
    }
    if (user?.groups?.length > 0 && user?.groupMultiplier > 1) {
      finalPrice = Math.floor(finalPrice / user.groupMultiplier);
      groupBonus = true;
    }

    if (role === 'student' && (discountApplied || groupBonus)) {
      return (
        <>
          <span className="line-through text-gray-400 mr-2">
            {basePrice} ₿
          </span>
          <span className="text-green-600">{finalPrice} ₿</span>
          {discountApplied && (
            <span className="text-xs text-green-600 ml-1">
              {Math.round(discountPercent)}% off
            </span>
          )}
          {groupBonus && (
            <span className="text-xs text-blue-600 ml-1">
              (+{Math.round((user.groupMultiplier - 1) * 100)}% group bonus)
            </span>
          )}
        </>
      );
    }
    return `${finalPrice} ₿`;
  };

  // load prizes for mystery boxes (for stats + editing)
  useEffect(() => {
    if (!classroomId || !bazaarId || item.kind !== 'mystery_box') return;

    (async () => {
      try {
        const res = await apiBazaar.get(
          `classroom/${classroomId}/bazaar/${bazaarId}/items?kind=standard`
        );
        const items = res.data.items || res.data || [];

        // 1) Start from everything returned for this bazaar
        // 2) Remove:
        //    - any Mystery Box items
        //    - the mystery box we are currently editing
        const filtered = items.filter((it) => {
          const id = normalizeId(it?._id);
          if (!id) return false;

          const categoryName =
            it?.category?.name || it?.category || '';
          const isMystery =
            categoryName === 'Mystery Box' || it.kind === 'mystery_box';

          const isCurrentBox = id === normalizeId(item._id);

          return !isMystery && !isCurrentBox;
        });

        // 3) De-dupe by _id, so the same item (same DB doc) only appears once
        const unique = [];
        const seen = new Set();
        for (const it of filtered) {
          const key = normalizeId(it._id);
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push(it);
        }

        setItemNames(unique);
        setAllPrizes(unique);
      } catch (err) {
        console.error('Failed to load prizes for mystery box:', err);
      }
    })();
  }, [classroomId, bazaarId, item.kind, item._id]);

  function itemWeight(reward) {
    return (
      reward.weight +
      reward.luckWeight *
        (user.passiveAttributes.luck - 1) *
        item.luckFactor
    );
  }

  // display stats of mystery box
  const displayStats = () => {
    if (!item?.metadata?.rewards) return;

    const rewards = item.metadata.rewards;

    const baseWeights = rewards.reduce((b, r) => b + r.weight, 0);
    const luckWeights =
      rewards.reduce((b, r) => b + r.luckWeight, 0) *
      (user.passiveAttributes.luck - 1) *
      item.luckFactor;
    const totalW = baseWeights + luckWeights;
    const rarityMap =
    {
        1000: "Common",
        2000: "Uncommon",
        3000: "Rare",
        4000: "Epic",
        5000: "Legendary"
    };
    const stats = rewards.map((r) => {
      const weight = itemWeight(r);
      const rarity = LUCK_TO_RARITY[r.luckWeight] || 'Unknown';
      const yourProb = (weight / totalW) * 100;
      const baseProb = (r.weight / baseWeights) * 100;
      const changeProb = yourProb - baseProb;
      return {
        name: r.itemName,
        prob: yourProb.toFixed(2),
        rarity,
        yourProb,
        baseProb,
        changeProb,
      };
    });

    setMysteryStats(stats);
    setShowStats(true);
  };

  const { main, effect } = splitDescriptionEffect(item.description || '');

  return (
    <div className="card bg-base-100 shadow-md border border-base-200 hover:shadow-lg transition duration-200 rounded-2xl overflow-hidden">
      {/* IMAGE */}
      <figure className="relative h-40 sm:h-48 md:h-52 bg-base-100 rounded-t-2xl overflow-hidden">
        <img
          src={imgSrc}
          alt={item.name || 'Item'}
          className="w-full h-full object-fill"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = '/images/item-placeholder.svg';
          }}
        />
      </figure>

      <div className="card-body px-4 py-3">
        {/* Title + description + effect */}
        <div className="space-y-1">
          <h3 className="card-title text-lg md:text-xl font-semibold">
            {item.name}
          </h3>

          <p className="text-sm text-base-content/70 whitespace-pre-wrap">
            {main || 'No description provided.'}
          </p>

          {effect && (
            <div className="text-sm text-base-content/60">
              <strong>Effect:</strong> {effect}
            </div>
          )}

          {!effect && getEffectDescription(item) && (
            <div className="text-sm text-base-content/60">
              <strong>Effect:</strong> {getEffectDescription(item)}
            </div>
          )}
        </div>

        {/* Price + teacher buttons */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-base-content font-bold text-base">
            <span>{calculatePrice()}</span>

            {(item.requiredBadge || requiredLevel > 0) && (
              <div className="flex items-center gap-1">
                {/* Lock with hover tooltip */}
                <div className="tooltip tooltip-right" data-tip={lockTooltip}>
                  <span
                    className={`flex items-center gap-1 text-xs ${
                      isLocked ? 'text-error' : 'text-success'
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    {isLocked ? 'Locked' : 'Unlocked'}
                  </span>
                </div>

                {/* Info button (tap-friendly) */}
                <button
                  type="button"
                  onClick={() => toast(lockTooltip)}
                  className="
                    inline-flex items-center justify-center
                    w-6 h-6 rounded-full
                    border border-base-300
                    text-base-content/70
                    text-[10px]
                    hover:bg-base-200
                    focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-base-300
                  "
                  aria-label={lockTooltip}
                >
                  <Info className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {role === 'teacher' && user?._id === teacherId && (
            <div className="flex gap-2">
              <button
                className="btn btn-xs md:btn-sm btn-outline"
                onClick={() => setEditOpen(true)}
              >
                Edit
              </button>
              <button
                className="btn btn-xs md:btn-sm btn-error"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Student Add to Cart */}
        {role === 'student' && (
          <button
            onClick={() => {
              if (isLocked) {
                toast.error(lockTooltip);
                return;
              }
              addToCart(item);
            }}
            disabled={isLocked}
            className={`btn btn-sm w-full mt-2 ${
              isLocked
                ? 'bg-error/20 border border-error text-error font-semibold cursor-not-allowed'
                : 'btn-success'
            }`}
          >
            {isLocked ? 'Locked' : 'Add to Cart'}
          </button>
        )}

        {/* Mystery box view details */}
        {item.kind === 'mystery_box' && (
          <button
            className="
              btn btn-sm w-full mt-2
              btn-outline btn-success
              border-success text-success
              hover:bg-success hover:text-white
            "
            onClick={displayStats}
          >
            View Details
          </button>
        )}
      </div>

      {/* EDIT MODAL */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card w-[95%] max-w-md max-h-[90vh] bg-base-100 shadow-xl rounded-2xl">
            {/* make the inside scroll instead of the whole screen */}
            <div className="card-body gap-3 overflow-y-auto">
              <h3 className="text-xl font-bold sticky top-0 pb-2 bg-base-100 z-10">
                Edit Item
              </h3>

              <form onSubmit={submitEdit} className="space-y-3 pb-2">
                {/* Basic fields */}
                <label className="form-control">
                  <span className="label-text">Item Name</span>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className="input input-bordered"
                    required
                  />
                </label>

                <label className="form-control">
                  <span className="label-text">Description</span>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    className="textarea textarea-bordered"
                    rows={3}
                  />
                </label>

                <label className="form-control">
                  <span className="label-text">Price</span>
                  <input
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={handleChange}
                    className="input input-bordered"
                    required
                    min="1"
                  />
                </label>

                {/* Category (read-only) */}
                <label className="form-control">
                  <span className="label-text">Category</span>
                  <input
                    type="text"
                    value={categoryLabel}
                    disabled
                    readOnly
                    className="input input-bordered bg-base-200 text-base-content/70 cursor-not-allowed"
                  />
                  <span className="label-text-alt text-xs text-base-content/60">
                    Category can only be selected when creating an item.
                  </span>
                </label>

                {/* Required Badge selector (under Category) */}
                <label className="form-control">
                  <span className="label-text">Required Badge (optional)</span>
                  <select
                    name="requiredBadge"
                    value={form.requiredBadge || ''}
                    onChange={handleChange}
                    className="select select-bordered"
                  >
                    <option value="">None</option>
                    {badgeOptions.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <span className="label-text-alt text-xs text-base-content/60">
                    Students must earn this badge before they can buy this item.
                  </span>
                </label>

                {/* PRIMARY EFFECT (non-passive, non-mystery) */}
                {!isMysteryCategory &&
                  form.category &&
                  form.category !== 'Passive' && (
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
                          required
                        >
                          <option value="" disabled>
                            Select effect
                          </option>
                          {CATEGORY_OPTIONS[form.category]?.map((effectOpt) => (
                            <option
                              key={effectOpt.value}
                              value={effectOpt.value}
                            >
                              {effectOpt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Steal Bits % */}
                      {form.primaryEffect === 'stealBits' && (
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-medium">
                              Steal Percentage
                            </span>
                          </label>
                          <div className="join">
                            <input
                              type="number"
                              className="input input-bordered join-item w-full"
                              value={form.primaryEffectValue}
                              onChange={(e) =>
                                setForm((prev) => {
                                  const raw = e.target.value;
                                  if (raw === '') {
                                    return {
                                      ...prev,
                                      primaryEffectValue: '',
                                    };
                                  }
                                  const num = Number(raw);
                                  const clamped = Math.min(
                                    100,
                                    Math.max(1, Number.isNaN(num) ? 0 : num)
                                  );
                                  return {
                                    ...prev,
                                    primaryEffectValue: clamped,
                                  };
                                })
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

                      {/* Bit Split */}
                      {form.primaryEffect === 'splitBits' && (
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-medium">
                              Applied Split
                            </span>
                          </label>
                          <div className="join">
                            <input
                              type="number"
                              className="input input-bordered join-item w-full"
                              value={form.primaryEffectValue}
                              onChange={(e) =>
                                setForm((prev) => ({
                                  ...prev,
                                  primaryEffectValue: e.target.value,
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

                      {/* Discount Shop */}
                      {form.primaryEffect === 'discountShop' && (
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-medium">
                              Applied Discount
                            </span>
                          </label>
                          <div className="join">
                            <input
                              type="number"
                              className="input input-bordered join-item w-full"
                              value={form.primaryEffectValue}
                              onChange={(e) =>
                                setForm((prev) => {
                                  const raw = e.target.value;
                                  if (raw === '') {
                                    return {
                                      ...prev,
                                      primaryEffectValue: '',
                                    };
                                  }
                                  const num = Number(raw);
                                  const clamped = Math.min(
                                    100,
                                    Math.max(1, Number.isNaN(num) ? 0 : num)
                                  );
                                  return {
                                    ...prev,
                                    primaryEffectValue: clamped,
                                  };
                                })
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
                              value={form.duration}
                              onChange={(e) =>
                                setForm((prev) => {
                                  const raw = e.target.value;
                                  if (raw === '') {
                                    return { ...prev, duration: '' };
                                  }
                                  const num = Number(raw);
                                  const clamped = Math.min(
                                    8760,
                                    Math.max(1, Number.isNaN(num) ? 0 : num)
                                  );
                                  return { ...prev, duration: clamped };
                                })
                              }
                              min="1"
                              max="8760"
                            />
                            <span className="join-item bg-base-200 px-4 flex items-center" />
                          </div>
                        </div>
                      )}

                      {/* Swapper */}
                      {form.primaryEffect === 'swapper' && (
                        <div className="form-control">
                          <label className="label">
                            <span className="label-text font-medium">
                              Swap Options
                            </span>
                          </label>
                          <div className="space-y-2">
                            {['bits', 'multiplier', 'luck'].map((option) => (
                              <div
                                key={option}
                                className="flex items-center gap-2"
                              >
                                <input
                                  type="checkbox"
                                  id={`swap-${option}-${item._id}`}
                                  className="checkbox checkbox-sm"
                                  checked={form.swapOptions.includes(option)}
                                  onChange={() => toggleSwapOption(option)}
                                />
                                <label
                                  htmlFor={`swap-${option}-${item._id}`}
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

                {/* Secondary Effects (Attack & Passive) */}
                {(form.category === 'Attack' || form.category === 'Passive') && (
                  <div className="form-control space-y-2">
                    <label className="label">
                      <span className="label-text font-medium">
                        Secondary Effects
                      </span>
                      <span className="label-text-alt">
                        {form.secondaryEffects.length}/3 selected
                      </span>
                    </label>

                    {form.secondaryEffects.map((effectObj, index) => (
                      <div
                        key={index}
                        className="flex flex-col sm:flex-row items-center gap-2"
                      >
                        <select
                          className="select select-bordered flex-1"
                          value={effectObj.effectType}
                          onChange={(e) =>
                            updateSecondaryEffect(
                              index,
                              'effectType',
                              e.target.value
                            )
                          }
                          required
                        >
                          <option value="" disabled>
                            Select effect
                          </option>
                          {availableSecondaryEffects()
                            .concat(
                              effectObj.effectType
                                ? {
                                    label: effectObj.effectType,
                                    value: effectObj.effectType,
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
                          value={effectObj.value}
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

                {/* Mystery Box prize pool (edit) */}
                {isMysteryCategory && (
                  <div className="form-control space-y-3">
                    <label className="label">
                      <span className="label-text font-medium">
                        Mystery Box Settings
                      </span>
                      {!!allPrizes.length && (
                        <span className="label-text-alt">
                          {selectedRewards.length}/{allPrizes.length} prizes
                          selected
                        </span>
                      )}
                    </label>

                    <div className="flex items-center gap-2">
                      <span className="label-text font-medium">
                        Luck Factor
                      </span>
                      <input
                        type="number"
                        min="0"
                        className="input input-bordered w-24"
                        value={form.luckFactor === '' ? '' : form.luckFactor}
                        onChange={(e) =>
                          setForm((prev) => {
                            const raw = e.target.value;
                            if (raw === '') {
                              return { ...prev, luckFactor: '' };
                            }
                            const num = Number(raw);
                            return {
                              ...prev,
                              luckFactor: Number.isNaN(num) ? 0 : num,
                            };
                          })
                        }
                      />
                    </div>

                    {selectedRewards.length > 0 && (
                      <>
                        <div className="flex items-center gap-3 px-1 text-sm">
                          <span className="flex-1">Item</span>
                          <span className="w-24 text-center">Rarity</span>
                          <span className="w-24 text-left">
                            % (Total: {totalProb().toFixed(2)})
                          </span>
                        </div>

                        {selectedRewards.map((reward, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <select
                              className="select select-bordered flex-1"
                              value={normalizeId(reward.itemId)} // 🔹 normalized
                              onChange={(e) =>
                                updatePrize(idx, e.target.value)
                              }
                              required
                            >
                              <option value="" disabled>
                                Select item
                              </option>
                              {notAdded(reward.itemId).map((p) => (
                                <option
                                  key={normalizeId(p._id)}
                                  value={normalizeId(p._id)}
                                >
                                  {p.name}
                                </option>
                              ))}
                            </select>

                            <select
                              className="select select-bordered w-28"
                              value={reward.rarity || ''}
                              onChange={(e) =>
                                updateRarity(idx, e.target.value)
                              }
                              required
                            >
                              <option value="" disabled>
                                Rarity
                              </option>
                              {Object.keys(RARITY_OPTIONS).map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>

                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              className="input input-bordered w-24"
                              value={
                                reward.probability === '' ||
                                reward.probability === null ||
                                reward.probability === undefined
                                  ? ''
                                  : reward.probability
                              }
                              placeholder={itemProbBase(reward).toFixed(2)}
                              onChange={(e) => updateProb(idx, e.target.value)}
                            />

                            <button
                              type="button"
                              className="btn btn-circle btn-sm btn-error"
                              onClick={() => removePrize(idx)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </>
                    )}

                    {selectedRewards.length < allPrizes.length && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline w-full mt-2"
                        onClick={addPrize}
                        disabled={!allPrizes.length}
                      >
                        + Add Item
                      </button>
                    )}

                    {isMysteryCategory && selectedRewards.length > 0 && (
                      <p className="text-xs mt-1 text-base-content/70">
                        Total probability must equal 100%. Currently:{' '}
                        <span
                          className={
                            haltMystery()
                              ? 'text-error font-semibold'
                              : 'text-success font-semibold'
                          }
                        >
                          {totalProb().toFixed(2)}%
                        </span>
                      </p>
                    )}

                    {allPrizes.length === 0 && (
                      <p className="text-xs text-base-content/60">
                        No standard items available to use as prizes in this
                        classroom bazaar.
                      </p>
                    )}
                  </div>
                )}

                {/* Image upload/URL (same style as before) */}
                <div className="form-control max-w-xs">
                  <label className="label">
                    <span className="label-text">Image</span>
                  </label>

                  <div className="inline-flex w-fit rounded-full bg-gray-200 p-1">
                    <button
                      type="button"
                      onClick={() => setImageSource('file')}
                      className={`px-3 py-1 rounded-full text-sm transition ${
                        imageSource === 'file'
                          ? 'bg-white shadow text-gray-900'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageSource('url')}
                      className={`ml-1 px-3 py-1 rounded-full text-sm transition ${
                        imageSource === 'url'
                          ? 'bg-white shadow text-gray-900'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Use image URL
                    </button>
                  </div>

                  {imageSource === 'file' ? (
                    <>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          setForm((f) => ({ ...f, image: file }));
                        }}
                        className="file-input file-input-bordered max-w-xs mt-3"
                      />
                      <p className="text-xs text-gray-500">
                        Allowed: jpg, png, webp, gif. Max: 5 MB.
                      </p>
                    </>
                  ) : (
                    <input
                      type="text"
                      placeholder="https://..."
                      className="input input-bordered mt-3 max-w-xs"
                      value={typeof form.image === 'string' ? form.image : ''}
                      onChange={(e) => {
                        const url = e.target.value;
                        setForm((f) => ({ ...f, image: url }));
                      }}
                    />
                  )}
                </div>

                {/* Auto-generated Effect (editable) */}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">
                      Auto-generated Effect (editable)
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() =>
                        setEffectPreview(describeEffectFromForm(form))
                      }
                      title="Regenerate"
                    >
                      Regenerate
                    </button>
                  </label>
                  <textarea
                    className="textarea textarea-bordered w-full min-h-[80px] resize-none"
                    value={effectPreview}
                    onChange={(e) => setEffectPreview(e.target.value)}
                    placeholder='Effect preview will appear here (auto-generated from selected effects). You can edit this before saving.'
                  />
                  <p className="text-xs text-base-content/60 mt-1">
                    This text will be stored in the item description as
                    &quot;Effect: ...&quot;.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setEditOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`btn btn-success ${
                      saving ? 'btn-disabled' : ''
                    }`}
                    disabled={saving || (isMysteryCategory && haltMystery())}
                  >
                    {saving ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      'Save'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-base-100 p-6 rounded-xl shadow-lg w-[90%] max-w-sm">
            <h2 className="text-lg font-semibold mb-4 text-center">
              Delete Item
            </h2>
            <p className="text-sm text-center text-gray-600">
              Are you sure you want to delete <strong>{item.name}</strong>?{' '}
              <br />
              This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <button
                className="btn btn-sm"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-sm btn-error"
                onClick={() => {
                  confirmDeleteItem();
                  setConfirmDelete(false);
                }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MYSTERY STATS MODAL */}
      {showStats && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-base-100 text-base-content dark:bg-neutral dark:text-neutral-content p-6 rounded-2xl shadow-lg w-[95%] max-w-lg">
            <h2 className="text-lg font-semibold mb-2">Mystery Box Stats</h2>
            {user?.passiveAttributes?.luck != null &&
            item?.luckFactor != null ? (
              <>
                <h3 className="mt-4 mb-2 text-sm font-semibold">
                  Your Personalized drop rates
                </h3>
                <div className="text-xs mb-2 text-base-content/80 dark:text-neutral-content/80">
                  Your luck ({user.passiveAttributes.luck.toFixed(1)}x) with
                  luck factor ({item.luckFactor.toFixed(1)}x) = (
                  {(
                    (user.passiveAttributes.luck - 1) * item.luckFactor
                  ).toFixed(1)}
                  x)
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold border-b border-base-300 dark:border-neutral-content/30 pb-1 mb-1">
                  <span className="flex-1">Item</span>
                  <span className="flex-1 text-center">Rarity</span>
                  <span className="w-16 text-left">Base %</span>
                  <span className="w-16 text-left">Your %</span>
                  <span className="w-16 text-left">Change</span>
                </div>

                {mysteryStats.map((reward, spot) => (
                  <div
                    key={spot}
                    className="flex items-center gap-3 text-xs py-1 rounded even:bg-base-200/40 dark:even:bg-neutral-focus/40"
                  >
                    <span className="flex-1">{reward.name}</span>
                    <span className="flex-1 text-center">
                      {reward.rarity}
                    </span>
                    <span className="w-16 text-left">
                      {reward.baseProb != null
                        ? reward.baseProb.toFixed(2)
                        : '0.00'}
                      %
                    </span>
                    <span className="w-16 text-left">
                      {reward.yourProb != null
                        ? reward.yourProb.toFixed(2)
                        : reward.prob}
                      %
                    </span>
                    <span className="w-16 text-left">
                      {reward.changeProb != null
                        ? reward.changeProb.toFixed(2)
                        : '0.00'}
                      %
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <p className="mt-4 text-sm text-base-content/70 dark:text-neutral-content/70">
                Personalized stats are not available for this box.
              </p>
            )}

            <button
              className="btn btn-sm btn-success mt-4"
              onClick={() => setShowStats(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemCard;
