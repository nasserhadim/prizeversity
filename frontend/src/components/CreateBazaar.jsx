import { useState } from 'react';
import toast from 'react-hot-toast';
// import axios from 'axios'
import apiBazaar from '../API/apiBazaar.js'

const CreateBazaar = ({ classroomId, onCreate }) => {
  console.log('classroomId:', classroomId);
  const [form, setForm] = useState({
    name: '',
    description: '',
    image: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiBazaar.post(
        `classroom/${classroomId}/bazaar/create`,
        {
          name: form.name,
          description: form.description,
          image: form.image,
        }
      );
      toast.success('Bazaar created!');
      onCreate(res.data.bazaar);
    } catch (err) {
      console.log("classroomId:", classroomId);
      toast.error(err.response?.data?.error || 'Failed to create bazaar');
    } finally {
      setLoading(false);
    }
  };


  return (
    <form onSubmit={handleSubmit} className="card bg-base-100 shadow-lg p-6 max-w-xl mx-auto space-y-4">
      <h2 className="text-xl font-bold text-center">Create Bazaar</h2>
      <input
        type="text"
        name="name"
        placeholder="Bazaar Name"
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
        type="text"
        name="image"
        placeholder="Image URL (optional)"
        className="input input-bordered w-full"
        value={form.image}
        onChange={handleChange}
      />
      <button className="btn btn-primary w-full" disabled={loading}>
        {loading ? 'Creating...' : 'Create Bazaar'}
      </button>
    </form>
  );
};

export default CreateBazaar;
