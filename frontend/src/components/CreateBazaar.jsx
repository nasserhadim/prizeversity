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
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Bazaar Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <input
        type="text"
        placeholder="Image URL"
        value={image}
        onChange={(e) => setImage(e.target.value)}
      />
      <button type="submit">Create Bazaar</button>
    </form>
  );
};

export default CreateBazaar;