import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import socket from '../utils/socket.js'; 
import ConfirmModal from './ConfirmModal';

function getClassroomFromPath(pathname) {
  const m = pathname.match(/^\/classroom\/([^\/]+)/);
  return m ? m[1] : null;
}

const CartDropdown = (props) => {
    const location = useLocation();
    const classroomId = getClassroomFromPath(location.pathname);
    const { getTotal, removeFromCart, getCart, clearCart } = useCart();
    const { user } = useAuth();
    const [hasDiscount, setHasDiscount] = useState(user?.discountShop || false);
    const [confirmClearOpen, setConfirmClearOpen] = useState(false);

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

    // use classroom-scoped cart
    const cartItems = getCart(classroomId);

    return (
      <div className="fixed top-20 right-4 bg-base-100 border border-base-300 shadow-lg w-80 z-[9999] rounded text-base-content
                  flex flex-col max-h-[80vh] overflow-hidden">
        <div className="p-3 border-b border-base-300 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Your Cart</h3>
            {hasDiscount && <div className="text-xs text-green-600 mt-1">20% discount applied (expires soon)</div>}
            {user?.discountShop && <div className="text-xs text-green-600 mt-1">20% discount applied!</div>}
          </div>
          {cartItems.length > 0 && (
            <button
              className="btn btn-ghost btn-xs text-error"
              onClick={() => setConfirmClearOpen(true)}
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 pt-2">
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
                    <button className="text-red-500 text-xs" onClick={() => removeFromCart(idx, classroomId)}>✕</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="p-4 border-t border-base-300 bg-base-100">
            <div className="text-right font-semibold">
              Total: Ƀ{getTotal(classroomId)}
              {user?.discountShop && (
                <span className="block text-xs text-green-600">
                  You saved Ƀ{Math.floor(getTotal(classroomId) * 0.2)}!
                </span>
              )}
            </div>
            <div className="mt-2">
              <Link
                to={classroomId ? `/classroom/${classroomId}/checkout` : '/checkout'}
                onClick={props?.onClose || (() => {})}
              >
                <button className="w-full btn btn-success">Go to Checkout</button>
              </Link>
            </div>
          </div>
        )}
        <ConfirmModal
          isOpen={confirmClearOpen}
          title="Clear cart"
          message="Remove all items from your cart?"
          confirmText="Clear"
          cancelText="Cancel"
          confirmButtonClass="btn-error"
          onClose={() => setConfirmClearOpen(false)}
          onConfirm={() => {
            clearCart(classroomId);
            setConfirmClearOpen(false);
          }}
        />
      </div>
     );
 };

export default CartDropdown;