// code is modified version of InventorySection (in same section)

import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import apiBazaar from '../API/apiBazaar';
import apiClassroom from '../API/apiClassroom';
import apiDiscount from '../API/apiDiscount';
import SwapModal from '../components/SwapModal';
import NullifyModal from '../components/NullifyModal';
import socket from '../utils/socket'; // Changed from '../API/socket' to '../utils/socket'
import { getEffectDescription, splitDescriptionEffect } from '../utils/itemHelpers';
import { resolveImageSrc } from '../utils/image';

// Section for viewing active discounts (percent and expiration)
const ActiveDiscountSection = ({ userId, classroomId }) => {
  const [discounts, setDiscounts] = useState([]);
  const [students, setStudents] = useState([]);
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [nullifyModalOpen, setNullifyModalOpen] = useState(false);

  //hoisted loader so activation and expiration of discounts can use it
  const load = useCallback(async () => {
    if (!userId || !classroomId) return;
    try {
        const res = await apiDiscount.get(`/classroom/${classroomId}/user/${userId}`);
        
        setDiscounts(res.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load discounts');
    }
  }, [userId, classroomId]);

  // Load discounts when userId and classroomId are available
  useEffect(() => {
    load();
  }, [userId, load]);



  // Socket listeners for real-time updates
  useEffect(() => {
    socket.on('discount_active', (data) => {
      if (data.userId === userId) {
        // Refresh discounts when discount/s are activated
        load();
      }
    });
    
    socket.on('discount_expired', (data) => {
      if (data.userId === userId) {
        // Refresh discounts when discount/s are expired
        load();
      }
    });
    
    return () => {
      socket.off('discount_active');
      socket.off('discount_expired');
    };
  }, [userId, load]);  

  return (
    <div className="mt-6 space-y-6">
      <h2 className="text-2xl font-bold text-success flex items-center gap-2">
        🎒 Active Discounts
      </h2>

      {discounts.length === 0 && (
        <p className="italic text-base-content/60">You don't have any active discounts.</p>
      )}

      {discounts.map((discount) => (
        <div
          key={discount._id}
          className="card bg-base-100 shadow-md border border-base-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4"
        >

          <div className="flex-1 space-y-1">
            <h4 className="text-lg font-semibold">Discount: {discount.discountPercentage}%</h4>
            <p className="text-green-600 font-semibold"> Expires: {discount.expiresAt}</p>
           </div>

        </div>
      ))}




 
    </div>
  );
};

export default ActiveDiscountSection;