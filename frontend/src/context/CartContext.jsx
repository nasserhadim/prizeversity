import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import socket from '../utils/socket'; // ensure socket is initialized connexts tabs

const CartContext = createContext();

function getClassroomFromPath(pathname) {
  const m = pathname.match(/^\/classroom\/([^\/]+)/);
  return m ? m[1] : 'global';
}

export const CartProvider = ({ children }) => {
  const location = useLocation();
  const currentClassroomFromPath = getClassroomFromPath(location.pathname);

  // carts is an object keyed by classroomId -> array of items
  const [carts, setCarts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pv:carts') || '{}');
    } catch (e) {
      return {};
    }
  });

  useEffect(() => { //register c
    try {
      localStorage.setItem('pv:carts', JSON.stringify(carts));
    } catch (e) {
      console.error('Failed to persist carts', e);
    }
  }, [carts]);

  const resolveId = (classroomId) => classroomId || currentClassroomFromPath || 'global';

  const getCart = (classroomId = null) => {
    const id = resolveId(classroomId);
    return carts[id] || [];
  };

  const getTotal = (classroomId = null) => {
    return getCart(classroomId).reduce((s, it) => s + (Number(it.price) || 0), 0);
  };

  const getCount = (classroomId = null) => getCart(classroomId).length;

  const addToCart = (item, classroomId = null) => {
    const id = resolveId(classroomId);
    // attach a small stable entry id per cart entry so duplicate product ids don't collide as React keys
    const entry = { ...item, _entryId: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}` };
    setCarts(prev => ({ ...prev, [id]: [...(prev[id] || []), entry] }));
  };

  // remove by index (component should pass index) for predictable behaviour
  const removeFromCart = (index, classroomId = null) => {
    const id = resolveId(classroomId);
    setCarts(prev => {
      const arr = [...(prev[id] || [])];
      if (typeof index === 'number' && index >= 0 && index < arr.length) {
        arr.splice(index, 1);
      }
      return { ...prev, [id]: arr };
    });
  };

  const clearCart = (classroomId = null) => {
    const id = resolveId(classroomId);
    setCarts(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  useEffect(() => {
    // Listen for server-side bazaar item deletions so we can cleanse carts
    const handleItemDeleted = ({ itemId }) => {
      if (!itemId) return; //removes item fro everyclassroom cart, stuent cant chck out items that no longer exist
      setCarts(prev => {
        const copy = { ...prev };
        for (const key of Object.keys(copy)) {
          copy[key] = (copy[key] || []).filter(entry => {
            const entryId = entry._id || entry.id || entry._entryId; //
            return entryId && String(entryId) !== String(itemId);
          });
        }
        return copy;
      });
    };
 
    const handleItemUpdated = ({ item }) => { 
      if (!item || !item._id) return;
      setCarts(prev => {
        const copy = { ...prev };
        for (const key of Object.keys(copy)) {
          copy[key] = (copy[key] || []).map(entry => {
            if (String(entry._id || entry.id) === String(item._id)) {
              // Replace / merge fields so cart reflects new price/name/etc
              return { ...entry, ...item };
            }
            return entry;
          });
        }
        return copy;
      });
    };
 
    socket.on('bazaar_item_deleted', handleItemDeleted); // when an item is deleted from the bazaar, remove it from all carts
    socket.on('bazaar_item_updated', handleItemUpdated); // when an item is updated in the bazaar, update it in all carts
 
    return () => {
      socket.off('bazaar_item_deleted', handleItemDeleted);
      socket.off('bazaar_item_updated', handleItemUpdated);
    };
  }, []);
 
  // New helper: remove specific item ids from a classroom's cart(s)
  const removeItemsById = (ids = [], classroomId = null) => {
    if (!Array.isArray(ids)) ids = [ids];
    const id = resolveId(classroomId);
    setCarts(prev => {
      const copy = { ...prev };
      for (const cid of Object.keys(copy)) {
        copy[cid] = (copy[cid] || []).filter(entry => {
          const entryId = entry._id || entry.id;
          return !ids.some(rid => String(rid) === String(entryId));
        });
      }
      return copy;
    });
  };
 

  const context = {
    // classroom-aware helpers
    getCart,         // function: getCart(classroomId?)
    cartItems: getCart(), // convenience: current path's cart
    getTotal,        // function: getTotal(classroomId?)
    getCount,        // function: getCount(classroomId?)
    addToCart,       // function: addToCart(item, classroomId?)
    removeFromCart,  // function: removeFromCart(index, classroomId?)
    removeItemsById, // function: removeItemsById([itemId1, itemId2], classroomId?)
    clearCart,       // function: clearCart(classroomId?)
    // raw state if needed
    _allCarts: carts
  };

  return <CartContext.Provider value={context}>{children}</CartContext.Provider>;
};

export const useCart = () => useContext(CartContext);