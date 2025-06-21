import { useState } from 'react';
import toast from 'react-hot-toast';
// import axios from 'axios'
import apiBazaar from '../API/apiBazaar.js'

const CreateItem = ({ bazaarId, classroomId, onAdd }) => {
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    image: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiBazaar.post(
        `classroom/${classroomId}/bazaar/${bazaarId}/items`,
        form
      );
      toast.success('Item created!');
      onAdd && onAdd(res.data.item);
      setForm({ name: '', description: '', price: '', image: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card bg-base-100 shadow p-5 max-w-xl mx-auto mb-6 space-y-3">
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
      <button className="btn btn-secondary w-full" disabled={loading}>
        {loading ? 'Adding...' : 'Add Item'}
      </button>
    </form>
  );
};

export default CreateItem;
