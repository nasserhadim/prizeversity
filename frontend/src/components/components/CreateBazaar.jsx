import React, { useState } from 'react';
import axios from 'axios';

const CreateBazaar = ({ classroomId }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/bazaar/create', {
        name,
        description,
        image,
        classroomId,
      });
      alert('Bazaar created successfully!');
    } catch (err) {
      alert('Failed to create bazaar');
    }
  };

  return (
  <form onSubmit={handleSubmit} className="space-y-4 bg-base-100 p-4 rounded-box shadow-md">
    <div className="form-control">
      <label className="label">
        <span className="label-text font-semibold">Bazaar Name</span>
      </label>
      <input
        type="text"
        placeholder="Enter bazaar name"
        className="input input-bordered"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
    </div>

    <div className="form-control">
      <label className="label">
        <span className="label-text font-semibold">Description</span>
      </label>
      <input
        type="text"
        placeholder="Enter a short description"
        className="input input-bordered"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
    </div>

    <div className="form-control">
      <label className="label">
        <span className="label-text font-semibold">Image URL</span>
      </label>
      <input
        type="text"
        placeholder="Optional image URL"
        className="input input-bordered"
        value={image}
        onChange={(e) => setImage(e.target.value)}
      />
    </div>

    <div className="form-control mt-4">
      <button type="submit" className="btn btn-primary">
        Create Bazaar
      </button>
    </div>
  </form>
);

};

export default CreateBazaar;