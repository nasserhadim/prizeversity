import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import apiBazaar from '../API/apiBazaar.js'
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext.jsx';
import { resolveImageSrc } from '../utils/image';
import { splitDescriptionEffect, getEffectDescription } from '../utils/itemHelpers';

const ItemCard = ({ 
  item, 
  role, 
  classroomId, 
  teacherId, 
  onUpdated, 
  onDeleted, 
  bazaarIdProp, }) => {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const { addToCart } = useCart();
  const { user } = useAuth();
  
  const bazaarId = item?.bazaar?._id ||  item?.bazaar || bazaarIdProp; // Handle populated or unpopulated bazaar field 


  // Delete handler for Teacher
const confirmDelete = async () => {
  // Ask user for confirmation
  if (!window.confirm('Delete this item? This cannot be undone.')) return; // if cancel, stop here

  // Validate required IDs exist
  if (!classroomId) return toast.error('Missing classroomId'); // show error if classroomId missing
  if (!bazaarId)    return toast.error('Missing bazaarId');    // show error if bazaarId missing
  if (!item?._id)   return toast.error('Missing item id');     // show error if item id missing

  // Build DELETE URL (this matches backend route)
  const url = `/classroom/${classroomId}/bazaar/${bazaarId}/items/${item._id}`; // final API path

  // Debug log so we can check what IDs/URL are being used
  console.log('DELETE →', `/api/bazaar${url}`, { classroomId, bazaarId, itemId: item._id }); // helpful debug info

  try {
    // Call backend to delete item
    const resp = await apiBazaar.delete(url); // send DELETE request

    // Debug log to verify response
    console.log('DELETE OK:', resp?.status, resp?.data); // logs status and data on success

    // Update parent UI so item disappears
    onDeleted?.(item._id); // call parent handler if provided
    toast.success('Item deleted'); // show success message
  } catch (err) {
    // If error, log exact details
    const status = err?.response?.status; // HTTP status code
    const data = err?.response?.data;     // server response JSON
    console.error('DELETE ERR:', status, data); // log error info

    // Default error fallback
    toast.error(data?.error || 'Failed to delete'); // show error
  }
};

  const imgSrc = resolveImageSrc(item?.image);
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

  // this is calculating the the discounted price if discount is active 
  // this will be adding the calculation of group multiplier
  const calculatePrice = () => {
    const basePrice = item.price;
    let finalPrice = basePrice;
    let discountApplied = false;
    let groupBonus = false;

    if (role === 'student' && Number(user?.discountPercent) > 0) {
    const pct = Number(user.discountPercent);
    finalPrice = Math.floor(basePrice * (1 - pct / 100));
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
          {discountApplied && <span className="text-xs text-green-600 ml-1">{Number(user.discountPercent)}% off</span>}
          {groupBonus && <span className="text-xs text-blue-600 ml-1">(+{Math.round((user.groupMultiplier-1)*100)}% group bonus)</span>}
        </>
      );
    }
    return `${finalPrice} ₿`;
  };


  const { main, effect } = splitDescriptionEffect(item.description || '');

  return (
    <div className="card bg-base-100 shadow-md border border-base-200 hover:shadow-lg transition duration-200 rounded-2xl overflow-hidden">
      {/* Image */}
      <figure className="relative h-40 sm:h-48 md:h-52 bg-base-200 flex items-center justify-center">
        <img
          src={imgSrc}
          alt={item.name || 'Item'}
          className="w-full h-full object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
          onError={(e) => {
            // swap to placeholder if image fails to load
            e.currentTarget.onerror = null;
            e.currentTarget.src = '/images/item-placeholder.svg';
          }}
        />
      </figure>
 
       {/* Content - unchanged from original */}
       <div className="card-body space-y-2">
         <h3 className="card-title text-lg md:text-xl font-semibold">
           {item.name}
         </h3>
        <p className="text-sm text-base-content/70 whitespace-pre-wrap">
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

        {role === 'teacher' && user?._id === teacherId && (
          // Only the teacher who owns this classroom sees Edit/Delete
          <div className="flex gap-2 mt-2">
            <button className="btn btn-sm btn-outline" onClick={() => setOpen(true)}> 
              <Pencil className="w-4 h-4" /> Edit
            </button>
            <button className="btn btn-sm btn-error" onClick={confirmDelete}>
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        )}
        {role === 'student' && (
          <button
            onClick={() => addToCart(item)}
            className="btn btn-success btn-sm w-full mt-2"
          >
            Add to Cart
          </button>
        )}
      </div>
    </div>
  );
};

export default ItemCard;
