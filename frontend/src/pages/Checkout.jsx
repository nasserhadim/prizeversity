import { useCart } from '../context/CartContext';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiBazaar from '../API/apiBazaar';
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import socket from '../utils/socket.js';
import { Image as ImageIcon } from 'lucide-react'; // added for image fallback
import { resolveImageSrc } from '../utils/image';
import { getEffectDescription, splitDescriptionEffect } from '../utils/itemHelpers';
import Footer from '../components/Footer';
import apiClassroom from '../API/apiClassroom';
import ConfirmModal from '../components/ConfirmModal';

const Checkout = () => {
  const { classroomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate(); // <-- add this so navigate(...) is defined

  // Use classroom-aware cart helpers
  const { getCart, getTotal, clearCart, removeFromCart, addToCart } = useCart();
  const cartItems = getCart(classroomId);

  const [balance, setBalance] = useState(0);
  const [hasDiscount, setHasDiscount] = useState(user?.discountShop || false);
  const [classroom, setClassroom] = useState(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

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
      const params = classroomId ? `?classroomId=${classroomId}` : '';
      const response = await apiBazaar.get(`/user/${user._id}/balance${params}`);
      setBalance(response.data.balance);
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    }
  };

  useEffect(() => {
    if (user?._id) {
      fetchBalance();
    }
  }, [user, classroomId]);

  // Fetch classroom name for header when viewing a classroom checkout
  useEffect(() => {
    if (!classroomId) {
      setClassroom(null);
      return;
    }
    let mounted = true;
    apiClassroom.get(`/${classroomId}`)
      .then(r => {
        if (mounted) setClassroom(r.data);
      })
      .catch(err => {
        console.error('Failed to fetch classroom for checkout:', err);
      });
    return () => { mounted = false; };
  }, [classroomId]);

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
      if (cartItems.length === 0) {
        toast.error('Your cart is empty');
        return;
      }

      const checkoutItems = cartItems.map(item => {
        const id = item._id || item.id || item._id?.toString();
        return {
          _id: id,
          id: id,
          name: item.name,
          price: Number(user?.discountShop ? Math.floor(item.price * 0.8) : item.price) || 0,
          category: item.category,
          primaryEffect: item.primaryEffect,
          secondaryEffects: item.secondaryEffects,
          image: item.image
        };
      });

      const response = await apiBazaar.post('/checkout', {
        userId: user._id,
        items: checkoutItems,
        classroomId // ensure backend gets classroom context
      });

      if (response.status === 200) {
        await fetchBalance();
        // clear only this classroom's cart
        clearCart(classroomId);
        toast.success('Purchase complete!');
        navigate(-1);
      }
    } catch (err) {
      console.error("Checkout error:", {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });

      // Handle siphon-specific errors
      if (err.response?.data?.siphonActive) {
        toast.error(`Cannot checkout: ${err.response.data.error}`);
      } else {
        // NEW: show detailed missing/wrong items info, keep cart so user can remove entries
        const msg = err.response?.data?.details
          ? `${err.response.data.error}\n${err.response.data.details}`
          : (err.response?.data?.error || 'Checkout failed');
        toast.error(msg);
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-base-200">
      <main className="flex-grow flex items-start justify-center p-6 pt-24 pb-12">
        <div className="w-full max-w-4xl mx-auto p-8 bg-base-100 rounded-2xl shadow-lg border border-base-300 min-h-[50vh]">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-base-content text-center">
            {classroom?.name
              ? `${classroom.name}${classroom.code ? ` (${classroom.code})` : ''} Checkout`
              : 'Checkout'}
          </h2>

          {/* Row with Clear cart */}
          <div className="flex items-center justify-end mb-2">
            {cartItems.length > 0 && (
              <button
                className="btn btn-ghost btn-sm text-error"
                onClick={() => setConfirmClearOpen(true)}
              >
                Clear cart
              </button>
            )}
          </div>

          {user?.discountShop && (
              <div className="bg-success/10 text-success p-3 rounded mb-4 text-sm">
                  🎉 20% discount applied to all items!
              </div>
          )}

          {cartItems.length === 0 ? (
              <p className="text-base-content/70 text-center">Your cart is empty.</p>
          ) : (
              <>
                  <ul className="space-y-4">
                      {cartItems.map((item, idx) => (
                          <li key={item._entryId || `${item._id}-${idx}`} className="flex items-start gap-4">
                              {/* Thumbnail */}
                              <div className="w-16 h-16 bg-base-200 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                                  <img
                                      src={resolveImageSrc(item.image)}
                                      alt={item.name}
                                      className="object-cover w-full h-full"
                                      loading="lazy"
                                      onError={(e) => {
                                        e.currentTarget.onerror = null;
                                        e.currentTarget.src = '/images/item-placeholder.svg';
                                      }}
                                  />
                              </div>

                              {/* Name + Description */}
                              <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                      <span className="block font-medium text-base-content truncate">{item.name}</span>
                                      <button
                                          onClick={() => removeFromCart(/* was item._id */ idx, classroomId)}
                                          className="text-error text-sm ml-4"
                                          title="Remove item"
                                      >
                                          ✕
                                      </button>
                                  </div>
                                  {(() => {
                                    const { main, effect } = splitDescriptionEffect(item.description || '');
                                    return (
                                      <>
                                        <p className="text-sm text-base-content/70 mt-1 line-clamp-2 whitespace-pre-wrap">
                                          {main || 'No description provided.'}
                                        </p>

                                        {/* If the description already contained an Effect: line, render it below indented */}
                                        {effect && (
                                          <div className="text-sm text-base-content/60 mt-1">
                                            <strong>Effect:</strong> {effect}
                                          </div>
                                        )}

                                        {/* If no Effect: in description, show auto-generated effect (if available) */}
                                        {!effect && getEffectDescription(item) && (
                                          <div className="text-sm text-base-content/60 mt-1">
                                            <strong>Effect:</strong> {getEffectDescription(item)}
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                              </div>

                              {/* Price */}
                              <div className="ml-4 text-right flex-shrink-0">
                                  {user?.discountShop ? (
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
                      {user?.discountShop && getTotal(classroomId) > calculateTotal() && (
                          <div className="text-sm text-success">
                              You saved {getTotal(classroomId) - calculateTotal()} ₿!
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
      </main>

      <Footer />
    </div>
    );
};

export default Checkout;