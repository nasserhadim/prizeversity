import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { Info } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import apiBazaar from '../API/apiBazaar.js'
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext.jsx';
import { resolveImageSrc } from '../utils/image';
import { splitDescriptionEffect, getEffectDescription } from '../utils/itemHelpers';
import MysteryBoxDetailsModal from './MysteryBoxDetailsModal';

const ITEM_PLACEHOLDER = '/images/item-placeholder.svg';

// CHANGED: accept classroom-scoped userLuck as a prop (do not read global passiveAttributes)
const ItemCard = ({
  item,
  onUse,
  showUseButton = true,
  classroomId,
  role,
  onEdit,
  onDelete,
  userLuck: userLuckProp = 1.0, // ADD
}) => {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [using, setUsing] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [wonItem, setWonItem] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const { addToCart } = useCart();
  const { user } = useAuth();

  // CHANGED: classroom-scoped luck comes from prop
  const userLuck = Number.isFinite(Number(userLuckProp)) ? Number(userLuckProp) : 1.0;

  const imgSrc = resolveImageSrc(item?.image);
  const { main, effect } = splitDescriptionEffect(item?.description || '');

  // The buy option is not included here
  const handleBuy = async () => {
    if (quantity < 1) return toast.error('Quantity must be at least 1');
    setLoading(true);
    try {
      await apiBazaar.post(
        `classroom/${classroomId}/bazaar/${item.bazaar}/items/${item._id}/buy`,
        { quantity: Number(quantity) }
      );
      toast.success('Item purchased!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUse = async () => {
    if (item.category === 'MysteryBox') {
      await handleOpenMysteryBox();
    } else {
      // Existing use logic for other items
      setUsing(true);
      try {
        await onUse(item._id);
      } catch (err) {
        console.error('Failed to use item:', err);
      } finally {
        setUsing(false);
      }
    }
  };

  const handleOpenMysteryBox = async () => {
    setUsing(true);
    try {
      const response = await axios.post(
        `/api/mystery-box-item/open/${item._id}`,
        { classroomId }
      );
      setWonItem(response.data.wonItem);
      setShowRewardModal(true);
      toast.success(`You won: ${response.data.wonItem.name}!`);
      onUse?.(item._id); // Refresh inventory
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to open mystery box');
    } finally {
      setUsing(false);
    }
  };

  // Calculating the discounted price if discount is active 
  // Adding the calculation of group multiplier
  const calculatePrice = () => {
    const basePrice = item.price;
    let finalPrice = basePrice;
    let discountApplied = false;
    let groupBonus = false;

    if (role === 'student' && user?.discountShop) {
      finalPrice = Math.floor(basePrice * 0.8);
      discountApplied = true;
    }

    if (user?.groups?.length > 0 && user?.groupMultiplier > 1) {
      finalPrice = Math.floor(finalPrice / user.groupMultiplier);
      groupBonus = true;
    }

    if (role === 'student' && (discountApplied || groupBonus)) {
      return (
        <>
          <span className="line-through text-gray-400 mr-2">{basePrice} ₿</span>
          <span className="text-green-600">{finalPrice} ₿</span>
          {discountApplied && <span className="text-xs text-green-600 ml-1">(20% off)</span>}
          {groupBonus && <span className="text-xs text-blue-600 ml-1">(+{Math.round((user.groupMultiplier-1)*100)}% group bonus)</span>}
        </>
      );
    }
    return `${finalPrice} ₿`;
  };

  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm hover:shadow-md transition">
      {/* Image */}
      <figure className="relative h-40 md:h-48 overflow-hidden bg-base-200">
        <img
          src={resolveImageSrc(item?.image)}
          alt={item.name}
          className="w-full h-full object-contain"
          sizes="(max-width: 768px) 100vw, 50vw"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = '/images/item-placeholder.svg';
          }}
        />
      </figure>

      <div className="card-actions justify-end pr-4 mt-3">
        {role === 'teacher' && (
          <div className="flex gap-2">
            <button
              className="btn btn-xs btn-outline"
              onClick={() => onEdit?.(item)}
              title="Edit"
            >
              Edit
            </button>
            <button
              className="btn btn-xs btn-error"
              onClick={() => onDelete?.(item)}
              title="Delete"
            >
              Delete
            </button>
          </div>
        )}
      </div>
 
       {/* Content - unchanged from original */}
       <div className="card-body space-y-2">
         <h3 className="card-title text-lg md:text-xl font-semibold wrap-any">
           {item.name}
         </h3>
        <p className="text-sm text-base-content/70 whitespace-pre-wrap wrap-any">
          {main || 'No description provided.'}
        </p>

        {effect && (
          <div className="text-sm text-base-content/60 mt-1">
            <strong>Effect:</strong> {effect}
          </div>
        )}

        {!effect && getEffectDescription(item) && (
          <div className="text-sm text-base-content/60 mt-1">
            <strong>Effect:</strong> {getEffectDescription(item)}
          </div>
        )}

        <p className="text-base-content font-bold text-base">
           {calculatePrice()}
         </p>

        {role === 'student' && (
          <button
            onClick={() => addToCart(item)}
            className="btn btn-success btn-sm w-full mt-2"
          >
            Add to Cart
          </button>
        )}
      </div>

      {item.category === 'MysteryBox' && (
        <div className="px-4 pb-4">
          <button
            type="button"
            className="btn btn-xs btn-outline w-full gap-1"
            onClick={() => setShowDetails(true)}
          >
            <Info size={14} /> Details
          </button>
        </div>
      )}

      {/* Add mystery box reward modal (similar to MysteryBoxCard) */}
      {showRewardModal && wonItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card bg-base-100 w-full max-w-md mx-4 shadow-xl">
            <div className="card-body items-center text-center">
              <h2 className="text-2xl font-bold text-success mb-4">🎉 You Won!</h2>
              
              <img
                src={resolveImageSrc(wonItem.image)}
                alt={wonItem.name}
                className="w-32 h-32 object-cover rounded-lg mb-4"
                onError={(e) => {
                  e.currentTarget.src = ITEM_PLACEHOLDER;
                }}
              />

              <h3 className="text-xl font-bold">{wonItem.name}</h3>

              <div className="badge badge-lg badge-outline capitalize mb-2">
                {wonItem.rarity}
              </div>

              {wonItem.description && (
                <p className="text-sm text-center opacity-70 whitespace-pre-line">
                  {wonItem.description}
                </p>
              )}

              <button
                className="btn btn-success w-full"
                onClick={() => {
                  setShowRewardModal(false);
                  setWonItem(null);
                }}
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

     {showDetails && item.category === 'MysteryBox' && (
       <MysteryBoxDetailsModal
         open={showDetails}
         onClose={() => setShowDetails(false)}
         box={item}
         userLuck={typeof userLuck !== 'undefined' ? userLuck : (stats?.luck ?? 1)} // ensure classroom‑scoped luck is passed
       />
     )}
    </div>
  );
};

export default ItemCard;
