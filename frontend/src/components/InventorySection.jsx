import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import apiBazaar from '../API/apiBazaar';
import apiClassroom from '../API/apiClassroom';
import apiItem from '../API/apiItem.js';
import { ImageOff } from 'lucide-react';
import SwapModal from '../components/SwapModal';
import NullifyModal from '../components/NullifyModal';
import socket from '../utils/socket'; // Changed from '../API/socket' to '../utils/socket'
import { getEffectDescription, splitDescriptionEffect } from '../utils/itemHelpers';
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

  // Load inventory and student list when userId and classroomId are available
  useEffect(() => {
    const load = async () => {
      try {
        const [invRes, studentRes] = await Promise.all([
          apiBazaar.get(`/inventory/${userId}?classroomId=${classroomId}`), // Add classroomId query param
          apiClassroom.get(`/${classroomId}/students`)
        ]);
        setItems(invRes.data.items);
        setStudents(studentRes.data);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load inventory or student list');
      }
    };
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
          data = { targetUserId };
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
          
        default:
          toast.error('Invalid item category');
          return;
      }

      // Execute item usage
      const response = await apiItem.post(endpoint, { 
        ...(data || {}), 
        classroomId 
      });
      toast.success(response.data.message || 'Item used successfully!');
      
      // Refresh inventory
      const invRes = await apiBazaar.get(`/inventory/${userId}?classroomId=${classroomId}`); // Add classroomId query param
      setItems(invRes.data.items);
      
    } catch (err) {
      console.error('Item use error:', err);
      toast.error(err.response?.data?.error || 'Failed to use item');
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

  return (
    <div className="mt-6 space-y-6">
      <h2 className="text-2xl font-bold text-success flex items-center gap-2">
        🎒 My Inventory
      </h2>

      {items.length === 0 && (
        <p className="italic text-base-content/60">You don't own any items yet.</p>
      )}

      {items.map((item) => (
        <div
          key={item._id}
          className="card bg-base-100 shadow-md border border-base-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4"
        >
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
            <h4 className="text-lg font-semibold">{item.name}</h4>
            {(() => {
              const { main, effect } = splitDescriptionEffect(item.description || '');
              return (
                <>
                  <p className="text-sm text-base-content/70 whitespace-pre-wrap">{main}</p>
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
              className="btn btn-success btn-sm w-full"
              onClick={() => handleUse(item)}
              disabled={item.active}
            >
              {item.active ? 'Active' : 'Use Item'}
            </button>
          </div>
        </div>
      ))}

      <SwapModal
        isOpen={swapModalOpen}
        onClose={() => setSwapModalOpen(false)}
        onSelect={handleSwapSelection}
        targetName={getTargetName(selectedTarget)}
      />

      <NullifyModal
      isOpen={nullifyModalOpen}
      onClose={() => setNullifyModalOpen(false)}
      onSelect={handleNullifySelection}
      targetName={getTargetName(selectedTarget)}
    />
    </div>
  );
};

export default InventorySection;