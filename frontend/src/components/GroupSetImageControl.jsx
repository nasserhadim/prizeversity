import React from 'react';
import { resolveGroupSetSrc, isPlaceholderGroupSetImage } from '../utils/image';
import toast from 'react-hot-toast';

const GroupSetImageControl = ({
  image,
  imageFile,
  imageSource,
  imageUrl,
  onFileChange,
  onSourceChange,
  onUrlChange,
  fileInputRef,
  editing = false,
  onRemoveImage // optional callback used when editing
}) => {
  return (
    <div className="mb-4">
      <label className="label">
        <span className="label-text">Image</span>
        <span className="label-text-alt">Optional</span>
      </label>

      <div className="inline-flex rounded-full bg-gray-200 p-1">
        <button
          type="button"
          onClick={() => onSourceChange('file')}
          className={`px-3 py-1 rounded-full text-sm transition ${imageSource === 'file' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Upload
        </button>
        <button
          type="button"
          onClick={() => onSourceChange('url')}
          className={`ml-1 px-3 py-1 rounded-full text-sm transition ${imageSource === 'url' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Use image URL
        </button>
      </div>

      {imageSource === 'file' ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={e => onFileChange(e.target.files[0])}
            className="file-input file-input-bordered w-full max-w-xs mt-3"
          />
          <p className="text-xs text-gray-500">Allowed: jpg, png, webp, gif. Max: 5 MB.</p>
        </>
      ) : (
        <input
          type="url"
          placeholder="https://..."
          className="input input-bordered w-full mt-3 max-w-xs"
          value={imageUrl}
          onChange={(e) => onUrlChange(e.target.value)}
        />
      )}

      <div className="mt-3">
        {imageFile ? (
          <img src={URL.createObjectURL(imageFile)} alt="Preview" className="w-28 h-28 object-cover rounded border" />
        ) : image ? (
          <img src={resolveGroupSetSrc(image)} alt="Preview" className="w-28 h-28 object-cover rounded border" />
        ) : (
          <img src="/images/groupset-placeholder.svg" alt="Preview" className="w-28 h-28 object-cover rounded border" />
        )}
      </div>

      {editing && !isPlaceholderGroupSetImage(image) && onRemoveImage && (
        <div>
          <button
            className="btn btn-ghost btn-sm mt-2"
            onClick={() => {
              onRemoveImage();
              toast('Image marked for removal; click Update to save');
            }}
          >
            Remove image
          </button>
        </div>
      )}
    </div>
  );
};

export default GroupSetImageControl;