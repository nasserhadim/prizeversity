import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import socket from '../utils/socket.js'; 

const CartDropdown = () => {
    const { cartItems, getTotal, removeFromCart } = useCart();
    const { user } = useAuth();
    const [hasDiscount, setHasDiscount] = useState(user?.discountShop || false);

    useEffect(() => {
        setHasDiscount(user?.discountShop || false);

        // Listen for discount expiration
        const handleDiscountExpired  = () => {
            setHasDiscount(false);
        };

        socket.on('discount_expired', handleDiscountExpired);

        return () => {
            socket.off('discount_expired', handleDiscountExpired);
        };
    }, [user]);

    // Calculating the discuonted price (only if discount is active)
    const calculatePrice = (price) => {
        return user?.discountShop ? Math.floor(price * 0.8) : price;
    };

    // Calculating the total with discount
    const calculateTotal = () => {
        const subtotal = cartItems.reduce((sum, item) => sum + item.price, 0);
        return user?.discountShop ? Math.floor(subtotal * 0.8) : subtotal;
    }

    return (
        <div className="fixed top-20 right-4 bg-base-100 border border-base-300 shadow-lg w-80 z-[9999] p-4 rounded text-base-content">
            <h3 className="text-lg font-bold mb-2">Your Cart</h3>
            {hasDiscount && (
                <div className='text-xs text-green-600 mb-2'>
                    20% discount applied (expires soon)
                </div>
            )}
            {user?.discountShop && (
                <div className="text-xs text-green-600 mb-2">20% discount applied!</div>
            )}
            {cartItems.length === 0 ? (
                <p className="text-sm text-base-content/60">Cart is empty</p>
            ) : (
                <ul className="space-y-2">
                    {cartItems.map(item => (
                        <li key={item._id} className="flex justify-between items-center">
                            <span>{item.name}</span>
                            <div className="flex items-center gap-2">
                                {user?.discountShop ? (
                                    <span className="flex flex-col items-end">
                                        <span className="text-xs line-through text-base-content/60">Ƀ{item.price}</span>
                                        <span className="text-sm text-green-600">Ƀ{Math.floor(item.price * 0.8)}</span>
                                    </span>
                                ) : (
                                    <span className="text-sm text-base-content/80">Ƀ{item.price}</span>
                                )}
                                <button
                                    className="text-red-500 text-xs"
                                    onClick={() => removeFromCart(item._id)}
                                >
                                    ✕
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            {cartItems.length > 0 && (
                <>
                    <div className="mt-3 text-right font-semibold">
                        Total: Ƀ{getTotal()}
                        {user?.discountShop && (
                            <span className="block text-xs text-green-600">
                                You saved Ƀ{Math.floor(getTotal() * 0.2)}!
                            </span>
                        )}
                    </div>
                    <div className="mt-2">
                        <Link to="/checkout">
                            <button className="mt-2 w-full btn btn-success">Go to Checkout</button>
                        </Link>
                    </div>
                </>
            )}
        </div>
    );
};

export default CartDropdown;