import React, { useState } from 'react';
import axios from 'axios';

const AddItem = ({ bazaarId, onAdd }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(0);
  const [image, setImage] = useState('');
  const [category, setCategory] = useState('');
  const [effect, setEffect] = useState('');
  const [passiveAttributes, setPassiveAttributes] = useState('');
  const [imageSource, setImageSource] = useState('file');
  const [imageFile, setImageFile] = useState(null);
  const [imageUrlLocal, setImageUrlLocal] = useState('');
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let response;
      if (imageSource === 'file' && imageFile) {
        const fd = new FormData();
        fd.append('name', name);
        fd.append('description', description);
        fd.append('price', price);
        fd.append('bazaar', bazaarId);
        fd.append('category', category);
        fd.append('image', imageFile);
        response = await axios.post(`/api/bazaar/${bazaarId}/items`, fd, { headers: { 'Content-Type': 'multipart/form-data' }});
      } else {
        response = await axios.post(`/api/bazaar/${bazaarId}/items`, {
          name,
          description,
          price,
          image: imageSource === 'url' ? imageUrlLocal : image
        });
      }
      toast.success('Item added successfully!');
      onAdd(response.data);
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
      <div>
        <label>Upload / Image URL</label>
        <div className="inline-flex rounded-full bg-gray-200 p-1 my-2">
          <button
            type="button"
            onClick={() => setImageSource('file')}
            className={`px-3 py-1 rounded-full ${imageSource === 'file' ? 'bg-white shadow' : 'text-gray-600'}`}
          >
            Upload
          </button>
          <button
            type="button"
            onClick={() => setImageSource('url')}
            className={`ml-1 px-3 py-1 rounded-full ${imageSource === 'url' ? 'bg-white shadow' : 'text-gray-600'}`}
          >
            URL
          </button>
        </div>

        {imageSource === 'file' ? (
          <>
            <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} />
            <p className="text-xs text-gray-500">Allowed: jpg, png, webp, gif. Max: 5 MB.</p>
          </>
        ) : (
          <input type="url" placeholder="https://example.com/image.jpg" value={imageUrlLocal} onChange={e => setImageUrlLocal(e.target.value)} />
        )}
      </div>
      <button type="submit">Add Item</button>
    </form>
  );
};

export default AddItem;