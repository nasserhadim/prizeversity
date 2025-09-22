import { useState } from 'react';
import toast from 'react-hot-toast';
import { Image as ImageIcon, Pencil, Trash2 } from 'lucide-react';
import axios from 'axios'
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext.jsx';
import { resolveImageSrc } from '../utils/image';
import { splitDescriptionEffect, getEffectDescription } from '../utils/itemHelpers';

// local axios instance for Bazaar-related calls
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// ItemCard component with buy option removed and discount logic added
const ItemCard = ({ item, role, classroomId, onUpdated, onDeleted }) => {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const { addToCart } = useCart();
  const { user } = useAuth();

  const imgSrc = resolveImageSrc(item?.image);


  //adding local UI for edit and form 
  //edit UI
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: item.name || '',
    description: item.description || '',
    price: item.price || 0,
    stock: item.stock || 0,
    image: item.image || '',
  });


  //adding handlers:
  const handleChange = (e) => {
    const { name, value } = e.target;
    const numeric = ['price', 'stock'];
    setForm((f) => ({ ...f, [name]: numeric.includes(name) ? Number(value) : value }));
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put(
        `/items/${item._id}`, // assuming this is the correct endpoint for updating an item in the bazaar
        form
      );
      const updated = data.item ?? data; // support either shape
      onUpdated?.(updated);
      toast.success('Item updated');
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.error || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!window.confirm('Delete this item? This cannot be undone.')) return;
    try {
      await api.delete(`/items/${item._id}`); // assuming this is the correct endpoint for deleting an item in the bazaar
      onDeleted?.(item._id);
      toast.success('Item deleted');
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.error || 'Failed to delete');
    }
  };



  // The buy option is not included here
  const handleBuy = async () => {
    if (quantity < 1) return toast.error('Quantity must be at least 1');
    setLoading(true);
    try {
      //purchase ednpoitns for studentd 
      //uses classroomid, bazaar id, itemid to ensure purahse is from right bazaar 
      //didnt change anything, but confirmed it works. 
      await api.post(
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

         {role === 'teacher' && (
          //teachers can edit or delete items inside the bazaar
  <div className="flex gap-2 mt-2">
    <button className="btn btn-sm btn-outline" onClick={() => setOpen(true)}>
      <Pencil className="w-4 h-4" />
      Edit
    </button>
    <button className="btn btn-sm btn-error" onClick={confirmDelete}>
      <Trash2 className="w-4 h-4" />
      Delete
    </button>
  </div>
)}
        
{/* Edit Modal */}
{open && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="card w-full max-w-md bg-base-100 shadow-xl">
      <div className="card-body gap-4">
        <h3 className="text-xl font-bold">Edit Item</h3>
        <form onSubmit={submitEdit} className="space-y-3">
          <label className="form-control">
            <span className="label-text">Name</span>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="input input-bordered"
              required
            />
          </label>

          <label className="form-control">
            <span className="label-text">Description</span>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              className="textarea textarea-bordered"
              rows={3}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="form-control">
              <span className="label-text">Price</span>
              <input
                type="number"
                step="0.01"
                name="price"
                value={form.price}
                onChange={handleChange}
                className="input input-bordered"
                required
              />
            </label>
            <label className="form-control">
              <span className="label-text">Stock</span>
              <input
                type="number"
                name="stock"
                value={form.stock}
                onChange={handleChange}
                className="input input-bordered"
                min={0}
              />
            </label>
          </div>

          <label className="form-control">
            <span className="label-text">Image URL</span>
            <input
              name="image"
              value={form.image}
              onChange={handleChange}
              className="input input-bordered"
              placeholder="/uploads/xyz.jpg or https://…"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={`btn btn-success ${saving ? 'btn-disabled' : ''}`}>
              {saving ? <span className="loading loading-spinner loading-sm" /> : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
)}

        {role === 'student' && ( //stdeunts can see add to cart button instead of edit/delete 
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
