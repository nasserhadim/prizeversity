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

const Checkout = () => {
  const { classroomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate(); // <-- add this so navigate(...) is defined

  // Use classroom-aware cart helpers
  const { getCart, getTotal, clearCart, removeFromCart, addToCart } = useCart();
  const cartItems = getCart(classroomId);

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
        stack: err.stack
      });
      // Show backend error message when available
      const msg = err.response?.data?.error || err.response?.data?.message || 'Checkout failed. Please try again.';
      toast.error(msg);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-base-200">
      <main className="flex-grow flex items-start justify-center p-6 pt-24 pb-12">
        <div className="w-full max-w-4xl mx-auto p-8 bg-base-100 rounded-2xl shadow-lg border border-base-300 min-h-[50vh]">
          <h2 className="text-2xl md:text-3xl font-bold mb-4 text-base-content text-center">Checkout</h2>

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
                                          onClick={() => removeFromCart(item._id)}
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
        </div>
      </main>

      <Footer />
    </div>
    );
};

export default Checkout;