import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';

const CartDropdown = () => {
    const { cartItems, getTotal, removeFromCart } = useCart();

    return (
        <div className="fixed top-20 right-4 bg-white border shadow-lg w-80 z-[9999] p-4 rounded text-black">
            <h3 className="text-lg font-bold mb-2">Your Cart</h3>
            {cartItems.length === 0 ? (
                <p className="text-sm text-gray-500">Cart is empty</p>
            ) : (
                <ul className="space-y-2">
                    {cartItems.map(item => (
                        <li key={item._id} className="flex justify-between items-center">
                            <span>{item.name}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">{item.price} bits</span>
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
                        Total: {getTotal()} bits
                    </div>
                    <Link to="/checkout">
                        <button className="mt-2 w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600">
                            Go to Checkout
                        </button>
                    </Link>
                </>
            )}
        </div>
    );
};

export default CartDropdown;