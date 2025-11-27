import { useState, useEffect } from 'react';
import { Pencil, Trash2, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import apiBazaar from '../API/apiBazaar.js';
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
    image: item.image || ''   
  });

  const [editOpen, setEditOpen] = useState(false); // controls edit modal visibility, edit item to open or close

  const [discounts, setDiscounts] = useState([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [mysteryStats, setMysteryStats] = useState([]);
  const [showStats, setShowStats] = useState(false);
  const [itemNames, setItemNames] = useState([]);
  const [imageSource, setImageSource] = useState('url');

  const handleChange = (e) => {
    const { name, value } = e.target;   //get input name and value
    setForm(f => ({ ...f, [name]: value }));   //changing updated values when editing
  };

  // added to automatically get discounts
  useEffect(() => {
    if (user?._id && classroomId) {
      getDiscounts();
    }
    //console.log("Discounts loaded:", discounts);
  }, [user?._id, classroomId]);

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
    // Validate required IDs exist
    if (!classroomId) return toast.error('Missing classroomId'); // show error if classroomId missing
    if (!bazaarId)    return toast.error('Missing bazaarId');    // show error if bazaarId missing
    if (!item?._id)   return toast.error('Missing item id');     // show error if item id missing

    // Build DELETE URL (this matches backend route)
    const url = `classroom/${classroomId}/bazaar/${bazaarId}/items/${item._id}`; // final API path

    // Debug log so we can check what IDs/URL are being used
    console.log('DELETE →', `/api/bazaar/${url}`, { classroomId, bazaarId, itemId: item._id }); // helpful debug info

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

  // Determine if item is badge-locked for this student
  const classroomData = user?.classroomBalances?.find(
    cb => String(cb.classroom) === String(classroomId)
  );

  const earnedBadges =
    classroomData?.badges?.map(b => String(b.badge)) || [];

  const hasRequiredBadge =
    !item.requiredBadge || earnedBadges.includes(String(item.requiredBadge));

  const isLocked =
    role === 'student' && item.requiredBadge && !hasRequiredBadge;

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

  const getDiscounts = async () => {
    try {
      const res = await apiDiscount.get(`/classroom/${classroomId}/user/${user._id}`);
      const discountData = res.data || [];
      
      setDiscounts(discountData);

      let percent = 0;
      if (discountData.length)
      {
        const combined = discountData.reduce(
          (acc, d) => acc * (1 - (d.discountPercent || 0) / 100), 1
        );
        const percentRaw = (1 - combined) * 100;
        percent = Number(percentRaw.toFixed(2));
      }
      setDiscountPercent(percent);

      //console.log("Discount applied: ", percent)
    } catch (err) {
      console.error("Failed to load discounts:", err);
    }
  };

  // this is calculating the the discounted price if discount is active 
  // this will be adding the calculation of group multiplier
  const calculatePrice = () => {
    const basePrice = item.price;
    let finalPrice = basePrice;
    let discountApplied = false;
    let groupBonus = false;
    if (role === 'student' && discountPercent > 0) {
      finalPrice = Math.ceil(basePrice * (1 - discountPercent / 100));
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
          {discountApplied && (
            <span className="text-xs text-green-600 ml-1">
              {Math.round(discountPercent)}% off
            </span>)}
          {groupBonus && <span className="text-xs text-blue-600 ml-1">(+{Math.round((user.groupMultiplier-1)*100)}% group bonus)</span>}
        </>
      );
    }
    return `${finalPrice} ₿`;
  };

  // for getting the names of the items for the mystery box
  useEffect(() => {
    if (!classroomId || !bazaarId || item.kind !== "mystery_box") return;
    (async () => {
      try {
        const res = await apiBazaar.get(`classroom/${classroomId}/bazaar/${bazaarId}/items?kind=standard`);
        // filters out owned items and mystery boxes
        const items = res.data.items || res.data;
        
        setItemNames(items.filter(i => !i.owner && i.kind !== "mystery_box"));
      } catch (err) {
        console.error('Failed to load prizes for mystery box:', err);
      }
    })();
  }, [classroomId, bazaarId]);
  // function to help with displaying probabilities
  function itemWeight(reward) {
    return reward.weight + (reward.luckWeight * (user.passiveAttributes.luck - 1) * item.luckFactor);
  }

  // display stats of mystery box
  const displayStats = () => {
    if (!item?.metadata?.rewards) return;

    const rewards = item.metadata.rewards;

    const baseWeights = rewards.reduce((b, r) => b + r.weight, 0);
    const luckWeights = (rewards.reduce((b, r) => b + r.luckWeight, 0) * (user.passiveAttributes.luck - 1) * item.luckFactor);
    const totalW = baseWeights + luckWeights;
    const rarityMap =
    {
        1000: "Common",
        2000: "Uncommon",
        3000: "Rare",
        4000: "Epic",
        5000: "Legendary"
    };
    const stats = rewards.map(r => {
        const weight = itemWeight(r);
        const name = itemNames.find(i => i._id === r._id);

        const rarity = rarityMap[r.luckWeight];
        return {
            name: r.itemName,
            prob: (weight / totalW * 100).toFixed(2),
            rarity: rarity
        }
    })

    setMysteryStats(stats);
    setShowStats(true);
  }

  const { main, effect } = splitDescriptionEffect(item.description || '');

  const categoryLabel =
    item?.category?.name ||
    item?.category ||      
    'Uncategorized';

  return (
    <div className="card bg-base-100 shadow-md border border-base-200 hover:shadow-lg transition duration-200 rounded-2xl overflow-hidden">

      <figure className="relative h-40 sm:h-48 md:h-52 bg-base-100 rounded-t-2xl overflow-hidden">
        <img
          src={imgSrc}
          alt={item.name || 'Item'}
          className="w-full h-full object-fill"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = '/images/item-placeholder.svg';
          }}
        />
      </figure>

      <div className="card-body px-4 py-3">
        
        {/* Title + description + effect stacked with small gap */}
        <div className="space-y-1">
          <h3 className="card-title text-lg md:text-xl font-semibold">
            {item.name}
          </h3>

          <p className="text-sm text-base-content/70 whitespace-pre-wrap">
            {main || 'No description provided.'}
          </p>

          {item.kind === 'mystery_box' && (
            <div className="flex justify-center gap-4 mt-4">
              <button
                className="btn btn-success"
                onClick={displayStats}
              >
                View Details
              </button>
            </div>
          )}

          {effect && (
            <div className="text-sm text-base-content/60">
              <strong>Effect:</strong> {effect}
            </div>
          )}

          {!effect && getEffectDescription(item) && (
            <div className="text-sm text-base-content/60">
              <strong>Effect:</strong> {getEffectDescription(item)}
            </div>
          )}
        </div>

        {/* Price + teacher buttons on one row */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-base-content font-bold text-base">
            <span>{calculatePrice()}</span>

            {item.requiredBadge && (
              <div
                className="tooltip tooltip-right"
                data-tip={
                  isLocked
                    ? `Requires Badge: ${item.requiredBadgeName || "Unknown Badge"}`
                    : "You meet the badge requirement"
                }
              >
                <span
                  className={`flex items-center gap-1 text-xs ${
                    isLocked ? "text-error" : "text-success"
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  {isLocked ? "Locked" : "Unlocked"}
                </span>
              </div>
            )}

          </div>

          {role === 'teacher' && user?._id === teacherId && (
            <div className="flex gap-2">
              <button
                className="btn btn-xs md:btn-sm btn-outline"
                onClick={() => setEditOpen(true)}
              >
                Edit
              </button>
              <button
                className="btn btn-xs md:btn-sm btn-error"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Student button sits close under price row */}
        {role === 'student' && (
          <button
            onClick={() => {
              if (isLocked) {
                toast.error("You must earn the required badge to purchase this item.");
                return;
              }
              addToCart(item);
            }}
            disabled={isLocked}
            className={`btn btn-sm w-full mt-2 ${
              isLocked ? "btn-disabled opacity-50 cursor-not-allowed" : "btn-success"
            }`}
          >
            {isLocked ? "Locked" : "Add to Cart"}
          </button>
        )}
      </div>
      <div>

      </div>

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card w-full max-w-md bg-base-100 shadow-xl rounded-2xl">
            <div className="card-body gap-4">
              <h3 className="text-xl font-bold">Edit Item</h3>
              <form onSubmit={submitEdit} className="space-y-3">

                <label className="form-control">
                  <span className="label-text">Item Name</span>
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
                  <span className="label-text">Category</span>
                  <input
                    type="text"
                    value={categoryLabel}
                    disabled
                    readOnly
                    className="input input-bordered bg-base-200 text-base-content/70 cursor-not-allowed"
                  />
                  <span className="label-text-alt text-xs text-base-content/60">
                    Category can only be selected when creating an item.
                  </span>
                </label>

                {/* Image section from the from Bazaar style */}
                <div className="form-control max-w-xs">
                  <label className="label">
                    <span className="label-text">Image</span>
                  </label>

                  <div className="inline-flex w-fit rounded-full bg-gray-200 p-1">
                    <button
                      type="button"
                      onClick={() => setImageSource('file')}
                      className={`px-3 py-1 rounded-full text-sm transition ${
                        imageSource === 'file'
                          ? 'bg-white shadow text-gray-900'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageSource('url')}
                      className={`ml-1 px-3 py-1 rounded-full text-sm transition ${
                        imageSource === 'url'
                          ? 'bg-white shadow text-gray-900'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Use image URL
                    </button>
                  </div>

                  {imageSource === 'file' ? (
                    <>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          setForm((f) => ({ ...f, image: file }));
                        }}
                        className="file-input file-input-bordered max-w-xs mt-3"
                      />
                      <p className="text-xs text-gray-500">
                        Allowed: jpg, png, webp, gif. Max: 5 MB.
                      </p>
                    </>
                  ) : (
                    <input
                      type="url"
                      placeholder="https://..."
                      className="input input-bordered mt-3 max-w-xs"
                      value={typeof form.image === 'string' ? form.image : ''}
                      onChange={(e) => {
                        const url = e.target.value;
                        setForm((f) => ({ ...f, image: url }));
                      }}
                    />
                  )}
                </div>

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

      {showStats && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-base-100 p-6 rounded-xl shadow-lg w-[90%] max-w-sm">
            <h2> Mystery Box Stats</h2>
            
            <div className="flex items-center gap-2">
              <span className="flex-1">Item</span>
              <span className="w-8 text-left">%</span>  
              <span className="w-40 text-center">Rarity</span>
            </div>
            {mysteryStats.map((reward, spot) => (
              <div key = {spot} className="flex items-center gap-3">
                <span className="flex-1"> {reward.name}</span>
                <span className="w-8 text-left"> {reward.prob}%</span>
                <span className="w-40 text-center">{reward.rarity}</span>                       
              </div>
            ))}
            <button
              className="btn btn-success"
              onClick={() => {
                setShowStats(false);
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default ItemCard;
