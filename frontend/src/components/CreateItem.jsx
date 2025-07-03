import { useState } from 'react';
import toast from 'react-hot-toast';
import apiBazaar from '../API/apiBazaar.js';

const CATEGORY_OPTIONS = {
  Attack: [
    { label: 'Bit Splitter (halve bits)', value: 'halveBits' },
    { label: 'Bit Leech (steal 10%)', value: 'stealBits' }
  ],
  Defend: [
    { label: 'Shield (block next attack)', value: 'shield' }
  ]
};

const CreateItem = ({ bazaarId, classroomId, onAdd }) => {
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    image: '',
    category: '',
    effect: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'category' ? { effect: '' } : {}) // reset effect when category changes
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...form,
      price: Number(form.price),
    };

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
        effect: ''
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
      className="card bg-base-100 shadow p-5 max-w-xl mx-auto mb-6 space-y-3"
    >
      <h3 className="text-lg font-semibold">Add Item</h3>

      <input
        name="name"
        placeholder="Item Name"
        className="input input-bordered w-full"
        value={form.name}
        onChange={handleChange}
        required
      />

      <textarea
        name="description"
        placeholder="Description"
        className="textarea textarea-bordered w-full"
        value={form.description}
        onChange={handleChange}
      />

      <input
        name="price"
        type="number"
        placeholder="Price"
        className="input input-bordered w-full"
        value={form.price}
        onChange={handleChange}
        required
      />

      <input
        name="image"
        placeholder="Image URL"
        className="input input-bordered w-full"
        value={form.image}
        onChange={handleChange}
      />

      <select
        name="category"
        className="select select-bordered w-full"
        value={form.category}
        onChange={handleChange}
        required
      >
        <option value="" disabled>Select Category</option>
        {Object.keys(CATEGORY_OPTIONS).map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      {form.category && (
        <select
          name="effect"
          className="select select-bordered w-full"
          value={form.effect}
          onChange={handleChange}
          required
        >
          <option value="" disabled>Select Effect</option>
          {CATEGORY_OPTIONS[form.category].map(effect => (
            <option key={effect.value} value={effect.value}>
              {effect.label}
            </option>
          ))}
        </select>
      )}

      <button className="btn btn-secondary w-full" disabled={loading}>
        {loading ? 'Adding...' : 'Add Item'}
      </button>
    </form>
  );
};

export default CreateItem;
