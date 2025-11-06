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
  const [expirations, setExpirations] = useState({});

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

  // creates expiration string
  const determineExpiration = (expires) => {
    let timeLeftInDHMS = [];
    let timeLeft = Math.abs(new Date(expires) - Date.now()) / 1000;
    let days = Math.floor(timeLeft / 86400);
    timeLeft -= days * 86400;
    let hours = Math.floor(timeLeft / 3600);
    timeLeft -= hours * 3600;
    let minutes = Math.floor(timeLeft / 60);
    timeLeft -= minutes * 60;

    // sets output
    let addHours = (hours > 0);
    let addMin = (minutes > 0);
    // days
    if (days > 0)
    {
        timeLeftInDHMS.push(`${days} day${days > 1 ? "s" : ""}`); 
        addHours = true;
        addMin = true;
    }
    // hours
    if (addHours)
    {
        timeLeftInDHMS.push(`${hours} hour${hours > 1 ? "s" : ""}`);
        addMin = true;
    }
    if (addMin)
    {
        timeLeftInDHMS.push(`${minutes} min${minutes > 1 ? "s" : ""}`);
        addMin = true;
    }
    timeLeftInDHMS.push(`${Math.floor(timeLeft)} sec`);
        return timeLeftInDHMS.join(", ");
  }

  // determines expirations every second
  useEffect(() => {
  const interval = setInterval(() => {
    setExpirations(() => {
      const updated = {};
      discounts.forEach((d) => {
        updated[d._id] = determineExpiration(d.expiresAt);
      });
      return updated;
    });
  }, 1000);

  return () => clearInterval(interval);
}, [discounts]);

  return (
    <div className="mt-6 space-y-6">
      <h2 className="text-2xl font-bold text-success flex items-center gap-2">
        Active Discounts
      </h2>

      {discounts.length === 0 && (
        <p className="italic text-base-content/60">You don't have any active discounts.</p>
      )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {discounts.map((discount) => (
                <div
                    key={discount._id}
                    className="card bg-base-100 shadow-md border border-base-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4"
                >

                    <div className="flex-1 space-y-1">
                        <h4 className="text-lg font-semibold">Discount: {discount.discountPercent}%</h4>
                        <p className="text-green-600 font-semibold"> Expires: {expirations[discount._id] || "Loading..."}</p>
                    </div>

                </div>
            ))}
      </div>
    </div>
  );
};

export default ActiveDiscountSection;