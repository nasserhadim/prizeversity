import { useState } from 'react';
import toast from 'react-hot-toast';
// import axios from 'axios'
import apiBazaar from '../API/apiBazaar.js'
import { Image as ImageIcon, Copy as CopyIcon } from 'lucide-react';
import { API_BASE } from '../config/api';

const resolveImageSrc = (src) => {
  if (!src) return null;
  // backend stores absolute URL now; but keep backwards-compatibility for "/uploads/..." paths
  if (src.startsWith('/uploads/')) return `${API_BASE}${src}`;
  return src;
};

const CreateBazaar = ({ classroomId, onCreate }) => {
  console.log('classroomId:', classroomId);
  const [form, setForm] = useState({
    name: '',
    description: '',
    image: ''
  }); // form state for bazaar fields

  // loading state for submit button
  const [loading, setLoading] = useState(false);
  const [imageSource, setImageSource] = useState('file'); // Upload first by default
  const [imageFile, setImageFile] = useState(null); // ADD
  const [imageUrlLocal, setImageUrlLocal] = useState(''); // ADD
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

  const handleChange = (e) => {
    // handle input changes for form fields
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  // handle submit: send multipart if file selected
  const handleSubmit = async (e) => {
    // prevent default form submission
    e.preventDefault();
    // set loading to true while submitting
    setLoading(true);
    try {
      let res;
      if (imageSource === 'file' && imageFile) {
        const fd = new FormData();
        fd.append('name', form.name);
        fd.append('description', form.description);
        fd.append('image', imageFile);
        fd.append('classroomId', classroomId);
        res = await apiBazaar.post(`classroom/${classroomId}/bazaar/create`, fd, { headers: { 'Content-Type': 'multipart/form-data' }});
      } else {
        res = await apiBazaar.post(`classroom/${classroomId}/bazaar/create`, {
          name: form.name,
          description: form.description,
          image: imageSource === 'url' ? imageUrlLocal : form.image,
        });
      }
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
        <label className="label"><span className="label-text">Image</span><span className="label-text-alt">Optional</span></label>
        <div className="flex items-center gap-2 mb-2">
          <div className="inline-flex rounded-full bg-gray-200 p-1">
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
        </div>

        {imageSource === 'file' ? (
          <>
            {/* Styled file input to match other upload controls */}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={e => setImageFile(e.target.files[0])}
              className="file-input file-input-bordered w-full max-w-xs"
            />
            <p className="text-xs text-gray-500">Allowed: jpg, png, webp, gif. Max: 5 MB.</p>
          </>
        ) : (
          <input type="url" placeholder="https://example.com/image.jpg" value={imageUrlLocal} onChange={e => setImageUrlLocal(e.target.value)} className="input input-bordered" />
        )}
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
