import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

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

  useEffect(() => {
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
    // NEW: toast feedback
    const name = item?.name ? `"${item.name}"` : 'item';
    toast.success(`Item ${name} added to cart!`);
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

  // NEW: clear all carts (useful on account deletion / logout)
  const clearAllCarts = () => {
    try {
      setCarts({});
      localStorage.removeItem('pv:carts');
    } catch (e) {
      console.error('Failed to clear all carts', e);
    }
  };

  const context = {
    // classroom-aware helpers
    getCart,         // function: getCart(classroomId?)
    cartItems: getCart(), // convenience: current path's cart
    getTotal,        // function: getTotal(classroomId?)
    getCount,        // function: getCount(classroomId?)
    addToCart,       // function: addToCart(item, classroomId?)
    removeFromCart,  // function: removeFromCart(index, classroomId?)
    clearCart,       // function: clearCart(classroomId?)
    clearAllCarts,   // NEW: clear all carts across classrooms
    // raw state if needed
    _allCarts: carts
  };

  return <CartContext.Provider value={context}>{children}</CartContext.Provider>;
};

export const useCart = () => useContext(CartContext);