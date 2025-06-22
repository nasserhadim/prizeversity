import { useCart } from '../context/CartContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiBazaar from '../API/apiBazaar';
import { useEffect, useState } from 'react';

const Checkout = () => {
    const { cartItems, getTotal, clearCart, removeFromCart } = useCart();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [balance, setBalance] = useState(0);

    useEffect(() => {
        const fetchBalance = async () => {
            try {
                const response = await apiBazaar.get(`/user/${user._id}/balance`);
                setBalance(response.data.balance);
            } catch (err) {
                console.error('Failed to fetch balance:', err);
            }
        };

        if (user?._id) {
            fetchBalance();
        }
    }, [user]);

    const handleCheckout = async () => {
        try {
            const response = await apiBazaar.post('/checkout', {
                userId: user._id,
                items: cartItems
            });

            if (response.status === 200) {
                const newBalance = user.balance - getTotal();
                user.balance = newBalance;
                clearCart();
                alert('Purchase complete!');
                navigate(-1);
            }
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.error || 'Checkout failed');
        }
    };

    return (
        <div className="max-w-xl mx-auto mt-12 p-6 bg-white rounded shadow">
            <h2 className="text-2xl font-bold mb-4">Checkout</h2>

            {cartItems.length === 0 ? (
                <p>Your cart is empty.</p>
            ) : (
                <>
                    <ul className="space-y-2">
                        {cartItems.map(item => (
                            <li key={item._id} className="flex justify-between items-center">
                                <div>
                                    <span className="block font-medium">{item.name}</span>
                                    <span className="text-sm text-gray-500">{item.price} bits</span>
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
                        Total: {getTotal()} bits
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