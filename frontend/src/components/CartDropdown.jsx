import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import socket from '../utils/socket.js';
import apiDiscount from '../API/apiDiscount';

function getClassroomFromPath(pathname) {
  const m = pathname.match(/^\/classroom\/([^\/]+)/);
  return m ? m[1] : null;
}

const CartDropdown = (props) => {
    const location = useLocation();
    const classroomId = getClassroomFromPath(location.pathname);
    const { getTotal, removeFromCart, getCart } = useCart();
    const { user } = useAuth();
    const [hasDiscount, setHasDiscount] = useState(user?.discountShop || false);
    const [discounts, setDiscounts] = useState([]);


    useEffect(() => {

        socket.on('discount_expired', handleDiscountExpired);

        return () => {
            socket.off('discount_expired', handleDiscountExpired);
        };
        // new functionality to get discounts from specific collection
        async function getDiscounts() {
            try {
                const res = await apiDiscount.get(`/classroom/${classroom._id}/user/${user._id}`);
                const data = await res.json();
                setDiscounts(data || []);
                setDiscountPercent();
            } catch (err) {
                console.error("Failed to load discounts:", err);
            }
        };
    }, [user]);

    // this is calculating the discuonted price (but only if discount is active)
    // determines discount through iterating through discounts
    const totalDiscount = () => {
        return discounts.reduce((total, discount) => 100 - ((100 - total) * (100 - discount.percent) / 100));
    };
    const calculatePrice = (price) => {
    const pct = totalDiscount();
    return pct > 0 ? Math.floor(price * (1 - pct / 100)) : price;
};

{Number(totalDiscount()) > 0 && (
  <div className="text-xs text-green-600 mb-2">
    {Number(totalDiscount())}% discount applied! {/* changed this so it isnt hard coded to 20%  instead it has the users input
                                                    changed again to use new discount system*/}
  </div>
)}
    // use classroom-scoped cart
    const cartItems = getCart(classroomId);

    return (
        <div className="fixed top-20 right-4 bg-base-100 border border-base-300 shadow-lg w-80 z-[9999] p-4 rounded text-base-content">
            <h3 className="text-lg font-bold mb-2">Your Cart</h3>
            {Number(totalDiscount()) > 0 && (
                <div className='text-xs text-green-600 mb-2'>
                    {Number(totalDiscount())}% discount applied to all items! (expires soon)
                </div>
            )}
            {Number(totalDiscount()) > 0 && (
                <div className="text-xs text-green-600 mb-2">{Number(totalDiscount())}% discount applied to all items!</div>
            )}
            {cartItems.length === 0 ? (
                <p className="text-sm text-base-content/60">Cart is empty</p>
            ) : (
                <ul className="space-y-2">
                    {cartItems.map((item, idx) => (
                        <li key={item._entryId || `${item._id}-${idx}`} className="flex justify-between items-center">
                            <span>{item.name}</span>
                            <div className="flex items-center gap-2">
                                {user?.discountShop ? (
                                    <span className="flex flex-col items-end">
                                        <span className="text-xs line-through text-base-content/60">Ƀ{item.price}</span>
                                        <span className="text-sm text-green-600">Ƀ{calculatePrice(item.price)}</span>
                                    </span>
                                ) : (
                                    <span className="text-sm text-base-content/80">Ƀ{item.price}</span>
                                )}
                                <button
                                    className="text-red-500 text-xs"
                                    onClick={() => removeFromCart(idx, classroomId)}
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
                        Total: Ƀ{getTotal(classroomId)}
                        {true && (
                            <span className="block text-xs text-green-600">
                                You saved Ƀ{Math.floor(getTotal(classroomId) * totalDiscount())}!
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