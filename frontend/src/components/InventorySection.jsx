import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import apiBazaar from '../API/apiBazaar';
import apiClassroom from '../API/apiClassroom';
import apiItem from '../API/apiItem.js';
import axios from 'axios'; // ADD: for mystery box API call
import { ImageOff } from 'lucide-react';
import SwapModal from '../components/SwapModal';
import NullifyModal from '../components/NullifyModal';
import socket from '../utils/socket'; // Changed from '../API/socket' to '../utils/socket'
import { getEffectDescription, splitDescriptionEffect, normalizeSwapOptions } from '../utils/itemHelpers'; // ADD import
import { resolveImageSrc } from '../utils/image';

// Inventory section for using, managing, and interacting with items
const InventorySection = ({ userId, classroomId }) => {
  const [items, setItems] = useState([]);
  const [students, setStudents] = useState([]);
  const [targets, setTargets] = useState({});
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [nullifyModalOpen, setNullifyModalOpen] = useState(false);
  
  // ADD: Mystery box reward modal state
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [wonItem, setWonItem] = useState(null);

  // NEW: Search and sort states
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('addedDesc'); // addedDesc|addedAsc|name|category|activeFirst|activatedDesc
  const [confirmRemove, setConfirmRemove] = useState(null); // item object
  const [confirmClear, setConfirmClear] = useState(false);

  // HOIST: load so socket handlers can call it
  const load = async () => {
    try {
      const [invRes, studentRes] = await Promise.all([
        apiBazaar.get(`/inventory/${userId}?classroomId=${classroomId}`),
        apiClassroom.get(`/${classroomId}/students`)
      ]);
      const activeItems = (invRes.data.items || []).filter(item => {
        if (item.category === 'MysteryBox') return item.usesRemaining !== 0;
        return true;
      });
      setItems(activeItems);
      setStudents(studentRes.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load inventory or student list');
    }
  };

  // Load inventory and student list
  useEffect(() => {
    if (userId && classroomId) load();
  }, [userId, classroomId]);

  // Socket listeners for real-time updates
  useEffect(() => {
    socket.on('inventory_update', (data) => {
      if (data.userId === userId) {
        // Refresh inventory when items are used/received
        load();
      }
    });
    
    socket.on('item_used', (data) => {
      if (data.targetUserId === userId || data.userId === userId) {
        // Refresh when items affect this user
        load();
      }
    });
    
    return () => {
      socket.off('inventory_update');
      socket.off('item_used');
    };
  }, [userId]);

  // When a swap attribute is selected in the modal
  const handleSwapSelection = async (swapAttribute) => {
    setSwapModalOpen(false);
    try {
      const response = await apiItem.post(`/attack/use/${currentItem._id}`, {
        targetUserId: selectedTarget,
        swapAttribute,
        classroomId,              // <- ensure classroomId is sent
      });
      
      toast.success(response.data.message || 'Swap successful!');
      
      // Refresh inventory
      const invRes = await apiBazaar.get(`/inventory/${userId}?classroomId=${classroomId}`); // Add classroomId query param
      setItems(invRes.data.items);
    } catch (err) {
      console.error('Swap failed:', err);
      toast.error(err.response?.data?.error || 'Failed to perform swap');
    }
  };

  // Handles using any item based on category and effect
  const handleUse = async (item) => {
    const targetUserId = targets[item._id] || null;

    try {
      let endpoint = '';
      let data = {};

      switch(item.category) {
        case 'Attack':
          if (!targetUserId) {
            toast.error('Please select a target');
            return;
          }

          // DEBUG: log item shape right before modal open
          console.log('[InventorySection] handleUse item BEFORE modal:', {
            id: item._id,
            primaryEffect: item.primaryEffect,
            swapOptionsRaw: item.swapOptions,
            swapOptionsType: typeof item.swapOptions,
            classroomId
          });

          // For swapper items, show modal instead of immediate use
          if (item.primaryEffect === 'swapper') {
            setCurrentItem(item);
            setSelectedTarget(targetUserId);
            setSwapModalOpen(true);
            return;
          }

          // For nullify items, show nullify modal
          if (item.primaryEffect === 'nullify') {
            setCurrentItem(item);
            setSelectedTarget(targetUserId);
            setNullifyModalOpen(true);
            return;
          }
          
          // Default attack usage
          endpoint = `/attack/use/${item._id}`;
          data = { targetUserId, classroomId };
          break;
          
        case 'Defend':
          endpoint = `/defend/activate/${item._id}`;
          break;
          
        case 'Utility':
          endpoint = `/utility/use/${item._id}`;
          break;
          
        case 'Passive':
          endpoint = `/passive/equip/${item._id}`;
          break;

        // ADD: MysteryBox handler
        case 'MysteryBox':
          await handleOpenMysteryBox(item);
          return; // Exit early since we handle everything in the function
          
        default:
          toast.error('Invalid item category');
          return;
      }

      // Execute item usage (for non-MysteryBox items)
      const response = await apiItem.post(endpoint, { 
        ...(data || {}), 
        classroomId 
      });
      toast.success(response.data.message || 'Item used successfully!');
      
      // Refresh inventory
      const invRes = await apiBazaar.get(`/inventory/${userId}?classroomId=${classroomId}`);
      setItems(invRes.data.items);
      
    } catch (err) {
      console.error('Item use error:', err);
      toast.error(err.response?.data?.error || 'Failed to use item');
    }
  };

  // ADD: Mystery Box opening handler
  const handleOpenMysteryBox = async (item) => {
    try {
      const response = await axios.post(
        `/api/mystery-box-item/open/${item._id}`,
        { classroomId }
      );

      // Show reward modal
      setWonItem(response.data.wonItem);
      setShowRewardModal(true);
      
      toast.success(`You won: ${response.data.wonItem.name}!`);

      // Refresh inventory
      const invRes = await apiBazaar.get(`/inventory/${userId}?classroomId=${classroomId}`);
      setItems(invRes.data.items);
    } catch (err) {
      console.error('Mystery box open error:', err);
      toast.error(err.response?.data?.error || 'Failed to open mystery box');
    }
  };

  // Get full name of target user
  const getTargetName = (targetId) => {
    const target = students.find(s => s._id === targetId);
    return target ? `${target.firstName} ${target.lastName}` : 'Target';
  };

  // When a nullify attribute is selected in the modal
  const handleNullifySelection = async (nullifyAttribute) => {
    setNullifyModalOpen(false);
    try {
      const res = await apiItem.post(`/attack/use/${currentItem._id}`, {
        targetUserId: selectedTarget,
        nullifyAttribute,
        classroomId,              // <- ensure classroomId is sent
      });
      
      toast.success(res.data.message || 'Nullify successful!');
      
      // Refresh inventory
      const invRes = await apiBazaar.get(`/inventory/${userId}?classroomId=${classroomId}`); // Add classroomId query param
      setItems(invRes.data.items);
    } catch (err) {
      console.error('Nullify failed:', err);
      toast.error(err.response?.data?.error || 'Failed to perform nullify');
      
      // For debugging in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Error details:', err.response?.data);
      }
    }
  };

  // Helper to get button styling based on category
  const getButtonStyle = (category, isActive) => {
    if (isActive) return 'btn-disabled';
    
    const styles = {
      MysteryBox: 'btn-warning hover:btn-warning/80 animate-pulse',
      Attack: 'btn-error hover:btn-error/80 hover:scale-105 transition-transform',
      Defend: 'btn-info hover:btn-info/80 hover:shadow-lg hover:shadow-info/50 transition-all',
      Passive: 'btn-success hover:btn-success/80 hover:brightness-110 transition-all',
      Utility: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 hover:scale-105 transition-transform'
    };
    
    return styles[category] || 'btn-success';
  };

  // Helper to get button text
  const getButtonText = (item) => {
    if (item.active) return 'Active';
    
    const texts = {
      MysteryBox: '🎁 Open Mystery Box',
      Attack: '⚔️ Use Attack',
      Defend: '🛡️ Activate Shield',
      Passive: '✨ Equip Passive',
      Utility: '🔮 Use Utility'
    };
    
    return texts[item.category] || 'Use Item';
  };

  const removeItem = async (item) => {
    try {
      await apiBazaar.delete(`/inventory/${item._id}?classroomId=${classroomId}`);
      toast.success('Item removed');
      // Refresh
      const invRes = await apiBazaar.get(`/inventory/${userId}?classroomId=${classroomId}`);
      setItems(invRes.data.items);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to remove item');
    }
  };

  const clearAll = async () => {
    try {
      await apiBazaar.delete(`/inventory/user/${userId}/clear?classroomId=${classroomId}`);
      toast.success('Inventory cleared');
      setItems([]);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to clear inventory');
    }
  };

  // FIX: parameter order (item first, term second) + guard
  const deepMatches = (item, term) => {
    const q = typeof term === 'string' ? term.trim().toLowerCase() : '';
    if (!q) return true;
    const parts = [
      item.name || '',
      item.description || '',
      item.category || '',
      item.primaryEffect || '',
      item.active ? 'active' : 'inactive',
      item.activatedAt ? 'activated' : ''
    ];
    (item.secondaryEffects || []).forEach(se => {
      parts.push(se.effectType || '');
      parts.push(String(se.value || ''));
    });
    return parts.some(p => p.toLowerCase().includes(q));
  };

  const sortedFiltered = items
    .filter(i => deepMatches(i, search)) // FIX: correct argument order
    .sort((a, b) => {
      switch (sortKey) {
        case 'addedAsc': return new Date(a.createdAt) - new Date(b.createdAt);
        case 'addedDesc': return new Date(b.createdAt) - new Date(a.createdAt);
        case 'name': return a.name.localeCompare(b.name);
        case 'category': return a.category.localeCompare(b.category);
        case 'activeFirst': return (b.active === true) - (a.active === true);
        case 'activatedDesc': return new Date(b.activatedAt || 0) - new Date(a.activatedAt || 0);
        default: return 0;
      }
    });

  // NEW: compute allowed options only once for the current item (defensive parse)
  const computedAllowed = currentItem ? normalizeSwapOptions(currentItem.swapOptions || currentItem.swapOptions?.toString?.() || []) : [];
  const allowedOptionsForItem = (Array.isArray(computedAllowed) && computedAllowed.length)
    ? computedAllowed
    : (currentItem && (currentItem.primaryEffect === 'swapper' || currentItem.primaryEffect === 'nullify') ? [] : ['bits', 'multiplier', 'luck']);

  // DEV debug - inspect shapes when opening modal
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && currentItem) {
      console.debug('[InventorySection] currentItem.swapOptions', currentItem.swapOptions, 'computedAllowed', computedAllowed, 'allowedOptionsForItem', allowedOptionsForItem);
    }
  }, [currentItem, JSON.stringify(currentItem?.swapOptions || [])]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-success flex items-center gap-2">
        🎒 My Inventory ({sortedFiltered.length}/{items.length})
      </h2>
      {/* Optional small badge */}
      <div className="mb-2 text-xs text-base-content/60">
        Showing {sortedFiltered.length} of {items.length} items
      </div>
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <input
          type="search"
          placeholder="Deep search items..."
          className="input input-bordered flex-1"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="select select-bordered"
          value={sortKey}
          onChange={e => setSortKey(e.target.value)}
        >
          <option value="addedDesc">Added: Newest</option>
            <option value="addedAsc">Added: Oldest</option>
            <option value="activatedDesc">Activated: Newest</option>
            <option value="name">Name</option>
            <option value="category">Category</option>
            <option value="activeFirst">Active first</option>
        </select>
        {sortedFiltered.length > 0 && (
          <button
            className="btn btn-outline btn-error"
            onClick={() => setConfirmClear(true)}
          >
            Clear Inventory
          </button>
        )}
      </div>

      {sortedFiltered.length === 0 && (
        <p className="italic text-base-content/60">
          {items.length === 0 ? 'You don’t own any items yet.' : 'No items match your search.'}
        </p>
      )}

      {sortedFiltered.map(item => (
        <div key={item._id} className="card bg-base-100 shadow-md border border-base-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4">
          <div className="w-24 h-24 bg-base-200 rounded-lg overflow-hidden flex items-center justify-center border">
            <img
              src={resolveImageSrc(item.image)}
              alt={item.name}
              className="object-cover w-full h-full"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/images/item-placeholder.svg';
              }}
            />
          </div>

          <div className="flex-1 space-y-1">
            <h4 className="text-lg font-semibold wrap-any">{item.name}</h4>
            {(() => {
              const { main, effect } = splitDescriptionEffect(item.description || '');
              return (
                <>
                  <p className="text-sm text-base-content/70 whitespace-pre-wrap wrap-any">{main}</p>
                  {effect && (
                    <div className="text-sm text-base-content/60 mt-1">
                      <strong>Effect:</strong> {effect}
                    </div>
                  )}
                  {!effect && getEffectDescription(item) && (
                    <div className="text-sm text-base-content/60 mt-1">
                      <strong>Effect:</strong> {getEffectDescription(item)}
                    </div>
                  )}
                </>
              );
            })()}
             {item.active && (
               <p className="text-green-600 font-semibold">🛡 Active</p>
             )}
            {/* NEW: timestamps */}
            <div className="text-xs text-base-content/60 space-y-0.5">
              {item.createdAt && (
                <div>
                  <strong>Added:</strong> {new Date(item.createdAt).toLocaleString()}
                </div>
              )}
              {item.activatedAt && (
                <div>
                  <strong>Activated:</strong> {new Date(item.activatedAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 md:w-1/3">
            {item.category === 'Attack' && (
              <select
                className="select select-bordered w-full"
                onChange={(e) =>
                  setTargets((prev) => ({ ...prev, [item._id]: e.target.value }))
                }
                value={targets[item._id] || ''}
              >
                <option value="">Select a student to target</option>
                {students
                  .filter((s) => s._id !== userId)
                  .map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.firstName} {s.lastName}
                    </option>
                  ))}
              </select>
            )}

            <button
              className={`btn btn-sm w-full ${getButtonStyle(item.category, item.active)}`}
              onClick={() => handleUse(item)}
              disabled={item.active}
            >
              {getButtonText(item)}
            </button>
            <button
              className="btn btn-sm btn-outline btn-error"
              onClick={() => setConfirmRemove(item)}
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      {/* Remove confirmation */}
      {confirmRemove && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Remove Item</h3>
            <p className="py-4">
              Remove "{confirmRemove.name}" from your inventory? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn btn-sm" onClick={() => setConfirmRemove(null)}>Cancel</button>
              <button
                className="btn btn-sm btn-error"
                onClick={async () => {
                  await removeItem(confirmRemove);
                  setConfirmRemove(null);
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear confirmation */}
      {confirmClear && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Clear Inventory</h3>
            <p className="py-4">
              Remove all matching items ({sortedFiltered.length}) from inventory?
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn btn-sm" onClick={() => setConfirmClear(false)}>Cancel</button>
              <button
                className="btn btn-sm btn-error"
                onClick={async () => {
                  await clearAll();
                  setConfirmClear(false);
                }}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      <SwapModal
        isOpen={swapModalOpen}
        onClose={() => setSwapModalOpen(false)}
        onSelect={handleSwapSelection}
        targetName={getTargetName(selectedTarget)}
        allowedOptions={allowedOptionsForItem}
      />

      <NullifyModal
        isOpen={nullifyModalOpen}
        onClose={() => setNullifyModalOpen(false)}
        onConfirm={handleNullifySelection}
        targetName={selectedTarget ? getTargetName(selectedTarget) : ''}
        allowedOptions={allowedOptionsForItem}
      />

      {/* ADD: Mystery Box Reward Modal */}
      {showRewardModal && wonItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-base-100 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-2xl font-bold text-center text-warning">
              🎉 Ta-da! 🎉
            </h3>
            
            <div className="text-center">
              <p className="text-lg mb-2">You won:</p>
              <p className="text-3xl font-bold text-success">{wonItem.name}</p>
              
              {wonItem.rarity && (
                <span className={`badge badge-lg mt-2 ${
                  wonItem.rarity === 'legendary' ? 'badge-warning' :
                  wonItem.rarity === 'epic' ? 'badge-secondary' :
                  wonItem.rarity === 'rare' ? 'badge-primary' :
                  wonItem.rarity === 'uncommon' ? 'badge-accent' :
                  'badge-ghost'
                }`}>
                  {wonItem.rarity}
                </span>
              )}
            </div>

            {wonItem.description && (
              <p className="text-sm text-center opacity-70 whitespace-pre-line">
                {wonItem.description}
              </p>
            )}

            <img
              src={resolveImageSrc(wonItem.image)}
              alt={wonItem.name}
              className="w-32 h-32 object-cover rounded-lg mx-auto"
              onError={(e) => {
                e.currentTarget.src = '/images/item-placeholder.svg';
              }}
            />

            <button
              className="btn btn-success w-full"
              onClick={() => {
                setShowRewardModal(false);
                setWonItem(null);
              }}
            >
              Proceed
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventorySection;