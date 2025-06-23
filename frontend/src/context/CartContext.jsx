import React, { createContext, useState, useContext } from 'react';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
    const [cartItems, setCartItems] = useState([]);

    const addToCart = (item) => {
        const existingItem = cartItems.find(i => i._id === item._id);
        if (existingItem) return;
        setCartItems([...cartItems, item]);
    };

    const removeFromCart = (id) => {
        setCartItems(cartItems.filter(item => item._id !== id));
    };

    const clearCart = () => {
        setCartItems([]);
    };

    const getTotal = () => {
        return cartItems.reduce((total, item) => total + item.price, 0);
    };

    return (
        <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, clearCart, getTotal }}>
            {children}
        </CartContext.Provider>
    );
};
