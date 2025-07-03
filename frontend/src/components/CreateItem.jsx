import { useState } from 'react';
import toast from 'react-hot-toast';
import apiBazaar from '../API/apiBazaar.js';
import {Hammer} from 'lucide-react'

const CATEGORY_OPTIONS = {
  Attack: [
    { label: 'Bit Splitter (halve bits)', value: 'halveBits' },
    { label: 'Bit Leech (steal 10%)', value: 'stealBits' }
  ],
  Defend: [
    { label: 'Shield (block next attack)', value: 'shield' }
  ],
  Utility: [
    { label: 'Earnings Multiplier (2x)', value: 'doubleEarnings' },
    { label: 'Shop Discount (20%)', value: 'discountShop' }
  ],
  Passive: [] // no predefined effects, controlled via checkboxes
};

const CreateItem = ({ bazaarId, classroomId, onAdd }) => {
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    image: '',
    category: '',
    effect: '',
    passiveAttributes: {
      luck: false,
      multiplier: false,
      groupMultiplier: false,
    }
  });

  const [passiveAttributes, setPassiveAttributes] = useState({
    luck: false,
    multiplier: false,
    groupMultiplier: false,
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'category' ? {
        effect: '',
        passiveAttributes: { luck: false, multiplier: false, groupMultiplier: false }
      } : {})
    }));
  };

  const handlePassiveCheckbox = (e) => {
    const { name, checked } = e.target;
    setPassiveAttributes((prev) => ({
      ...prev,
      [name]: checked
    }));
  };


  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setForm(prev => ({
      ...prev,
      passiveAttributes: {
        ...prev.passiveAttributes,
        [name]: checked
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...form,
      price: Number(form.price),
      passiveAttributes:
        form.category === 'Attack' || form.category === 'Passive'
          ? passiveAttributes
          : undefined
    };

    // If not Passive, remove passiveAttributes
    if (form.category !== 'Passive') {
      delete payload.passiveAttributes;
    }

    try {
      const res = await apiBazaar.post(
        `classroom/${classroomId}/bazaar/${bazaarId}/items`,
        payload
      );
      toast.success('Item created!');
      onAdd && onAdd(res.data.item);
      setForm({
        name: '',
        description: '',
        price: '',
        image: '',
        category: '',
        effect: '',
        passiveAttributes: {
          luck: false,
          multiplier: false,
          groupMultiplier: false,
        }
      });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="card bg-base-100 border border-base-200 shadow-md rounded-2xl p-6 space-y-4"
    >
      <h3 className="text-2xl font-bold text-success flex items-center gap-2">
        <Hammer />
        Add New Item
      </h3>

      <div className="form-control">
        <label className="label">
          <span className="label-text font-medium">Item Name</span>
        </label>
        <input
          name="name"
          placeholder="Enter item name"
          className="input input-bordered w-full"
          value={form.name}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text font-medium">Description</span>
        </label>
        <textarea
          name="description"
          placeholder="Write a short description"
          className="textarea textarea-bordered w-full min-h-[100px] resize-none"
          value={form.description}
          onChange={handleChange}
        />
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text font-medium">Price</span>
        </label>
        <input
          name="price"
          type="number"
          placeholder="Enter price"
          className="input input-bordered w-full"
          value={form.price}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text font-medium">Image URL</span>
        </label>
        <input
          name="image"
          placeholder="https://example.com/item.jpg"
          className="input input-bordered w-full"
          value={form.image}
          onChange={handleChange}
        />
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text font-medium">Category</span>
        </label>
        <select
          name="category"
          className="select select-bordered w-full"
          value={form.category}
          onChange={handleChange}
          required
        >
          <option value="" disabled>Select category</option>
          {Object.keys(CATEGORY_OPTIONS).map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {form.category && form.category !== 'Passive' && (
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Effect</span>
          </label>
          <select
            name="effect"
            className="select select-bordered w-full"
            value={form.effect}
            onChange={handleChange}
            required
          >
            <option value="" disabled>Select effect</option>
            {CATEGORY_OPTIONS[form.category].map(effect => (
              <option key={effect.value} value={effect.value}>
                {effect.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {(form.category === 'Attack' || form.category === 'Passive') && (
        <div className="form-control space-y-2">
          <label className="label">
            <span className="label-text font-medium">Extra Attributes</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="luck"
              checked={passiveAttributes.luck}
              onChange={handlePassiveCheckbox}
              className="checkbox"
            />
            {form.category === 'Attack' ? 'Attack Luck' : 'Grants Luck'}
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="multiplier"
              checked={passiveAttributes.multiplier}
              onChange={handlePassiveCheckbox}
              className="checkbox"
            />
            {form.category === 'Attack' ? 'Attack Multiplier' : 'Grants Multiplier'}
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="groupMultiplier"
              checked={passiveAttributes.groupMultiplier}
              onChange={handlePassiveCheckbox}
              className="checkbox"
            />
            {form.category === 'Attack'
              ? 'Attack Group Multiplier'
              : 'Grants Group Multiplier'}
          </label>
        </div>
      )}

      <button
        className="btn btn-success w-full mt-2"
        disabled={loading}
        type="submit"
      >
        {loading ? (
          <>
            <span className="loading loading-spinner"></span>
            Adding...
          </>
        ) : (
          'Add Item'
        )}
      </button>
    </form>
  );
};

export default CreateItem;
