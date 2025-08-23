import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiBazaar from '../API/apiBazaar';
import { useEffect, useState } from 'react';
import socket from '../utils/socket.js';
import { Image as ImageIcon } from 'lucide-react'; // added for image fallback
import { getEffectDescription } from '../utils/itemHelpers';
import toast from 'react-hot-toast'
import Footer from '../components/Footer';

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
                toast.error('Your cart is empty');
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
        <div className="max-w-xl mx-auto mt-12 p-6 bg-base-100 rounded-xl shadow-lg border border-base-300">
            <h2 className="text-2xl font-bold mb-4 text-base-content">Checkout</h2>

            {user?.discountShop && (
                <div className="bg-success/10 text-success p-3 rounded mb-4 text-sm">
                    🎉 20% discount applied to all items!
                </div>
            )}

            {cartItems.length === 0 ? (
                <p className="text-base-content/70">Your cart is empty.</p>
            ) : (
                <>
                    <ul className="space-y-4">
                        {cartItems.map(item => (
                            <li key={item._id} className="flex items-start gap-4">
                                {/* Thumbnail */}
                                <div className="w-16 h-16 bg-base-200 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                                    {item.image ? (
                                        <img
                                            src={item.image}
                                            alt={item.name}
                                            className="object-cover w-full h-full"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <ImageIcon className="w-8 h-8 text-base-content/50" />
                                    )}
                                </div>

                                {/* Name + Description */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className="block font-medium text-base-content truncate">{item.name}</span>
                                        <button
                                            onClick={() => removeFromCart(item._id)}
                                            className="text-error text-sm ml-4"
                                            title="Remove item"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <p className="text-sm text-base-content/70 mt-1 line-clamp-2">
                                        {item.description || 'No description provided.'}
                                    </p>
                                    {/* Avoid duplicate: skip auto-effect if description already contains Effect: */}
                                    {!/Effect\s*:/i.test(item.description || '') && getEffectDescription(item) && (
                                        <div className="text-sm text-base-content/60 mt-1">
                                            Effect: {getEffectDescription(item)}
                                        </div>
                                    )}
                                </div>

                                {/* Price */}
                                <div className="ml-4 text-right flex-shrink-0">
                                    {hasDiscount ? (
                                        <>
                                            <div className="text-xs line-through text-base-content/50">{item.price} ₿</div>
                                            <div className="text-success font-semibold">{calculatePrice(item.price)} ₿</div>
                                        </>
                                    ) : (
                                        <div className="text-base-content font-semibold">{item.price} ₿</div>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-4 text-right font-semibold text-success">
                        Balance: {balance} ₿
                    </div>

                    <div className="mt-4 text-right font-semibold">
                        <div className="text-lg text-base-content">
                            Total: {calculateTotal()} ₿
                        </div>
                        {user?.discountShop && (
                            <div className="text-sm text-success">
                                You saved {Math.floor(getTotal() * 0.2)} ₿!
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleCheckout}
                        className="btn btn-success w-full mt-6"
                    >
                        Confirm Purchase
                    </button>
                </>
            )}
            <Footer />
        </div>
    );
};

export default Checkout;