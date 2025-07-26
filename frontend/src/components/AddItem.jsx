import React, { useState } from 'react';
import axios from 'axios';

const AddItem = ({ bazaarId }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(0);
  const [image, setImage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); // it will prevent the page reload on form submit
    try {
      const response = await axios.post(`/api/bazaar/${bazaarId}/items/add`, {
        name,
        description,
        price,
        image,
        bazaar: bazaarId,
        category,
        effect: category !== 'Passive' ? effect : undefined, // Passive doesn't use effect
        passiveAttributes: category === 'Passive' ? passiveAttributes : undefined // only include passiveAttributes if the item is in Passive cateogry
      });
      toast.succes('Item added successfully!');
    } catch (err) {
      toast.error('Failed to add item');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Item Name"
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
        type="number"
        placeholder="Price"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Image URL"
        value={image}
        onChange={(e) => setImage(e.target.value)}
      />
      <button type="submit">Add Item</button>
    </form>
  );
};

export default AddItem;