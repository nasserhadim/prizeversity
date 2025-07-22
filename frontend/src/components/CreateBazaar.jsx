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
  }); // form state for bazaar fields

  // loading state for submit button
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    // handle input changes for form fields
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    // prevent default form submission
    e.preventDefault();
    // set loading to true while submitting
    setLoading(true);
    try {
      // send POST request to create a new bazaar under the given classroom
      const res = await apiBazaar.post(
        `classroom/${classroomId}/bazaar/create`,
        {
          name: form.name,
          description: form.description,
          image: form.image,
        }
      );
      toast.success('Bazaar created!');
      // callback to notify parent about new bazaar
      onCreate(res.data.bazaar);
    } catch (err) {
      console.log("classroomId:", classroomId);
      toast.error(err.response?.data?.error || 'Failed to create bazaar');
    } finally {
      setLoading(false); // reset loading state
    }
  };


  return (
    <form
      onSubmit={handleSubmit}
      className="card bg-base-100 shadow-xl border border-base-200 rounded-2xl p-8 max-w-2xl mx-auto space-y-6"
    >
      <h2 className="text-2xl font-semibold text-center text-success">
        Create Bazaar
      </h2>

      <div className="form-control">
        <label className="label">
          <span className="label-text font-medium">Bazaar Name</span>
        </label>
        <input
          type="text"
          name="name"
          placeholder="Enter the bazaar name"
          className="input input-bordered w-full focus:outline-none focus:ring-2 focus:ring-success"
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
          placeholder="Brief description of your bazaar"
          className="textarea textarea-bordered w-full min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-success"
          value={form.description}
          onChange={handleChange}
        />
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text font-medium">Image URL</span>
          <span className="label-text-alt">Optional</span>
        </label>
        <input
          type="text"
          name="image"
          placeholder="https://example.com/image.jpg"
          className="input input-bordered w-full"
          value={form.image}
          onChange={handleChange}
        />
      </div>

      <div>
        <button
          type="submit"
          className="btn btn-success w-full transition-all duration-200"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="loading loading-spinner"></span>
              Creating...
            </>
          ) : (
            'Create Bazaar'
          )}
        </button>
      </div>
    </form>
  );
};

export default CreateBazaar;
