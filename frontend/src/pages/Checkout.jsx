import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiBazaar from '../API/apiBazaar';
import { useEffect, useState } from 'react';
import socket from '../utils/socket.js';
import toast from 'react-hot-toast'

const Checkout = () => {
    const { cartItems, getTotal, clearCart, removeFromCart } = useCart();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [balance, setBalance] = useState(0);
    const [hasDiscount, setHasDiscount] = useState(user?.discountShop || false);

    useEffect(() => {
        setHasDiscount(user?.discountShop || false);

        // Listen for discount expiration
        const handleDiscountExpired = () => {
            setHasDiscount(false);
        };

        socket.on('discount_expired', handleDiscountExpired);

        return () => {
            socket.off('discount_expired', handleDiscountExpired);
        };
    }, [user]);

    const fetchBalance = async () => {
        try {
            const response = await apiBazaar.get(`/user/${user._id}/balance`);
            setBalance(response.data.balance);
        } catch (err) {
            console.error('Failed to fetch balance:', err);
        }
    };

    useEffect(() => {
        if (user?._id) {
            fetchBalance();
        }
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

    const handleCheckout = async () => {
        try {
            // Validate cart
            if (cartItems.length === 0) {
                alert('Your cart is empty');
                return;
            }

            // Prepare items with discounted prices if applicable
            const checkoutItems = cartItems.map(item => ({
                _id: item._id,
                name: item.name,
                price: user?.discountShop ? Math.floor(item.price * 0.8) : item.price,
                // Include all necessary item properties
                category: item.category,
                primaryEffect: item.primaryEffect,
                secondaryEffects: item.secondaryEffects
            }));

            console.log("Sending checkout request:", {
                userId: user._id,
                items: checkoutItems
            });

            const response = await apiBazaar.post('/checkout', {
                userId: user._id,
                items: checkoutItems
            });

            if (response.status === 200) {
                await fetchBalance();
                clearCart();
                toast.success('Purchase complete!');
                navigate(-1);
            }
        } catch (err) {
            console.error("Checkout error:", {
                message: err.message,
                response: err.response?.data,
                stack: err.stack
            });

            toast.error(
                err.response?.data?.error ||
                err.response?.data?.message ||
                'Checkout failed. Please try again.'
            );
        }
    };

    return (
        <div className="max-w-xl mx-auto mt-12 p-6 bg-white rounded shadow">
            <h2 className="text-2xl font-bold mb-4">Checkout</h2>

            {user?.discountShop && (
                <div className="bg-green-100 text-green-800 p-3 rounded mb-4 text-sm">
                    🎉 20% discount applied to all items!
                </div>
            )}

            {cartItems.length === 0 ? (
                <p>Your cart is empty.</p>
            ) : (
                <>
                    <ul className="space-y-2">
                        {cartItems.map(item => (
                            <li key={item._id} className="flex justify-between items-center">
                                <div>
                                    <span className="block font-medium">{item.name}</span>
                                    {user?.discountShop ? (
                                        <span className="text-sm text-gray-500">
                                            <span className="line-through mr-2">{item.price} bits</span>
                                            <span className="text-green-600">{calculatePrice(item.price)} bits</span>
                                        </span>
                                    ) : (
                                        <span className="text-sm text-gray-500">{item.price} bits</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => removeFromCart(item._id)}
                                    className="text-red-500 text-sm ml-4"
                                    title="Remove item"
                                >
                                    ✕
                                </button>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-4 text-right font-semibold text-green-600">
                        Bit Balance: {balance} bits
                    </div>

                    <div className="mt-4 text-right font-semibold">
                        <div className="text-lg">
                            Total: {calculateTotal()} bits
                        </div>
                        {user?.discountShop && (
                            <div className="text-sm text-green-600">
                                You saved {Math.floor(getTotal() * 0.2)} bits!
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleCheckout}
                        className="mt-6 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                    >
                        Confirm Purchase
                    </button>
                </>
            )}
        </div>
    );
};

export default Checkout;