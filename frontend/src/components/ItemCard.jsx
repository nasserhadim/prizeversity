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
import { data } from 'react-router';
import apiDiscount from '../API/apiDiscount';

const ItemCard = ({ 
  item, 
  role, 
  classroomId, 
  teacherId, 
  onUpdated, 
  onDeleted, 
  bazaarIdProp, }) => {
  const [confirmDelete, setConfirmDelete] = useState(false); // controls delete confirmation
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const { addToCart } = useCart();
  const { user } = useAuth();
  const [open, setOpen] = useState(false); // controls visibility 
  const [saving, setSaving] = useState(false); // shows spinner when saving
  const [form, setForm] = useState({ //setting form to update values/items inside
  
  name: item.name || '',  //hodling in values when editing. 
  description: item.description || '',
  price: item.price || 0,  
});
const [editOpen, setEditOpen] = useState(false); // controls edit modal visibility, edit item to open or close

const [discounts, setDiscounts] = useState([]);

const handleChange = (e) => {
  const { name, value } = e.target;   //get input name and value
  setForm(f => ({ ...f, [name]: value }));   //changing updated values when editing
};

const submitEdit = async (e) => {  //preventing the page to reload when submitting the form
  e.preventDefault();
  setSaving(true);  //diables the save button 
  try {
    // build FormData, needed for text and file upload
    const formData = new FormData(); 
    formData.append("name", form.name);
    formData.append("description", form.description);
    formData.append("price", form.price);

    // only include image if the teacher provided one
    if (form.image instanceof File) {
      formData.append("image", form.image); //if its a  brand new file 
    } else if (form.image) {
      formData.append("image", form.image); // in case it's still a URL string
    }

    //validating backend to uodate the item
    const { data } = await apiBazaar.patch(
      `/classroom/${classroomId}/bazaar/${bazaarId}/items/${item._id}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } } //required for file upload
    );
  
    //extract updated item from response
    const updated = data.item ?? data;
    onUpdated?.(updated);  // trouble with item uodating automatically, this updates parent immediately, UI wise. 
    toast.success("Item updated"); //shows it was successfully updated!
    setEditOpen(false); // close the edit modal
  } catch (err) {
    //log the error for debugging for the coder.
    console.error("EDIT ERR:", err.response?.data || err.message); //show the error message to user
    toast.error(err?.response?.data?.error || "Failed to update");
  } finally {
    //stops/ reenables the save button
    setSaving(false);
  }
};




  const bazaarId = item?.bazaar?._id ||  item?.bazaar || bazaarIdProp; // Handle populated or unpopulated bazaar field 

  // Edit handler
const handleEdit = async () => { // Teacher-only edit function bazaar ID
  const bazaarId = item?.bazaar?._id || item?.bazaar || bazaarIdProp;
  //validaite required IDs
  if (!classroomId) return toast.error('Missing classroomId');
  if (!bazaarId)    return toast.error('Missing bazaarId');
  if (!item?._id)   return toast.error('Missing item id');

  const newName = window.prompt('New name:', item.name ?? ''); //asking techer for new name
  if (newName === null) return; // cancelled

  const newPriceStr = window.prompt('New price (number):', String(item.price ?? 0)); //asking teacher for new price
  if (newPriceStr === null) return; // cancelled
  const newPrice = Number(newPriceStr);
  if (Number.isNaN(newPrice)) return toast.error('Price must be a number'); //validate price is a number

  const newDesc = window.prompt('New description:', item.description ?? ''); //asking teacher for new description
  if (newDesc === null) return; // cancelled

  // send only changed fields
  const payload = {}; //avoids to send unchanged fields.  
  if (newName !== item.name) payload.name = newName;
  if (newPrice !== item.price) payload.price = newPrice;
  if ((newDesc ?? '') !== (item.description ?? '')) payload.description = newDesc;

  if (Object.keys(payload).length === 0) {
    toast('No changes to save');
    return;
  }

  const url = `/classroom/${classroomId}/bazaar/${bazaarId}/items/${item._id}`;
  try {
    const { data } = await apiBazaar.patch(url, payload);  // teacher-only PATCH
    const updated = data.item ?? data;
    onUpdated?.(updated);                                   // update UI immediately
    toast.success('Item updated');
  } catch (err) {
    toast.error(err?.response?.data?.error || 'Failed to update');
  }
};


  // Delete handler for Teacher
const confirmDeleteItem = async () => {
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
  const resp = await apiBazaar.delete(url); // send DELETE request
  console.log('DELETE OK:', resp?.status, resp?.data); // debug: confirm server response

  onDeleted?.(item._id); // tell parent to remove this item from the list immediately
  toast.success('Item deleted'); // show success
} catch (err) {
  const status = err?.response?.status; // HTTP code
  const data = err?.response?.data;     // JSON payload
  console.error('DELETE ERR:', status, data); // debug: log error

  // Show a readable error
  toast.error(data?.error || 'Failed to delete'); // toast fallback
}
};

  const imgSrc = resolveImageSrc(item?.image);
  // The buy option is not included here

  // testing if teacher can edit item by adding new values and sending ony the changed values to backend aslo confirms before to delete button item. 
  
  
  // const handleBuy = async () => {
  //   if (quantity < 1) return toast.error('Quantity must be at least 1');
  //   setLoading(true);
  //   try {
  //     await apiBazaar.post(
  //       `classroom/${classroomId}/bazaar/${item.bazaar}/items/${item._id}/buy`,
  //       { quantity: Number(quantity) }
  //     );

  //     toast.success('Item purchased!');
  //   } catch (err) {
  //     toast.error(err.response?.data?.error || 'Purchase failed');
  //   } finally {
  //     setLoading(false);
  //   }
  // };
const handleBuy = async () => {
  if (quantity < 1) return toast.error('Quantity must be at least 1');
  setLoading(true);
  try {
    const { data } = await apiBazaar.post(
      `classroom/${classroomId}/bazaar/${item.bazaar}/items/${item._id}/buy`,
      { quantity: Number(quantity) }
    );

    // backend should return updated item
    const updated = data.item ?? data;
     onUpdated?.(updated);

    toast.success('Item purchased!');
  } catch (err) {
    toast.error(err.response?.data?.error || 'Purchase failed');
  } finally {
    setLoading(false);
  }
};

//
const getDiscounts = async () => {
    try {
        const res = await apiDiscount.get(`/classroom/${classroom._id}/user/${user._id}`);
        const data = await res.json();
        setDiscounts(data || []);
        setDiscountPercent();
        } catch (err) {
            console.error("Failed to load discounts:", err);
        }
};
const totalDiscount = () => {
        return discounts.reduce((total, discount) => 100 - ((100 - total) * (100 - discount.percent) / 100));
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
          //we were using regular window pop up. 
          <div className="flex gap-2 mt-2">
            <button className="btn btn-sm btn-outline" onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4" /> Edit
            </button>

            <button
              className="btn btn-sm btn-error"
              onClick={() => setConfirmDelete(true)}
            >
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
      {editOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="card w-full max-w-md bg-base-100 shadow-xl rounded-2xl">
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

          <label className="form-control">
            <span className="label-text">Price</span>
            <input
              type="number"
              name="price"
              value={form.price}
              onChange={handleChange}
              className="input input-bordered"
              required
            />
          </label>

          <label className="form-control">
            <span className="label-text">Image</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                setForm(f => ({ ...f, image: file }));
              }}
            />

          </label>
  

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`btn btn-success ${saving ? 'btn-disabled' : ''}`}
            >
              {saving ? <span className="loading loading-spinner loading-sm" /> : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
)}
{confirmDelete && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-base-100 p-6 rounded-xl shadow-lg w-[90%] max-w-sm">
      <h2 className="text-lg font-semibold mb-4 text-center">Delete Item</h2>
      <p className="text-sm text-center text-gray-600">
        Are you sure you want to delete <strong>{item.name}</strong>? <br />
        This action cannot be undone.
      </p>
      <div className="mt-6 flex justify-center gap-4">
        <button
          className="btn btn-sm"
          onClick={() => setConfirmDelete(false)}
        >
          Cancel
        </button>
        <button
          className="btn btn-sm btn-error"
          onClick={() => {
            confirmDeleteItem(); // call the delete function
            setConfirmDelete(false);
          }}
        >
          Yes, Delete
        </button>
      </div>
    </div>
  </div>
)}


    </div>
  );
};

export default ItemCard;
