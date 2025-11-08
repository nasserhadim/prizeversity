import React, { useState } from 'react';

const TeacherBadgesPage = ({ classroomId }) => {
  const [badges, setBadges] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    levelRequired: '',
    icon: '',
    image: null,
  });

  // Handle input changes
  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'image') {
      setFormData({ ...formData, image: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // Handle badge creation (temporary local version)
  const handleCreateBadge = (e) => {
    e.preventDefault();

    const newBadge = {
      id: Date.now(),
      ...formData,
      imageUrl: formData.image ? URL.createObjectURL(formData.image) : null,
    };

    setBadges([...badges, newBadge]);
    setShowModal(false);

    // Reset form
    setFormData({
      name: '',
      description: '',
      levelRequired: '',
      icon: '',
      image: null,
    });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Badge Management</h2>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          onClick={() => setShowModal(true)}
        >
          + Create Badge
        </button>
      </div>

      {/* All Badges Section */}
      <h3 className="font-semibold mb-3">
        All Badges ({badges.length})
      </h3>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className="border rounded-md p-3 shadow hover:shadow-lg transition"
          >
            {badge.imageUrl && (
              <img
                src={badge.imageUrl}
                alt={badge.name}
                className="w-full h-32 object-cover mb-2 rounded"
              />
            )}
            <p className="text-lg font-bold">{badge.icon} {badge.name}</p>
            <p className="text-sm text-gray-600">{badge.description}</p>
            <p className="text-sm mt-1">Level {badge.levelRequired} Required</p>
          </div>
        ))}
      </div>

      {/* Modal Popup */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-md w-96 shadow-lg">
            <h3 className="text-lg font-bold mb-4">Create Badge</h3>
            <form onSubmit={handleCreateBadge} className="flex flex-col gap-3">
              <label className="text-sm font-semibold">
                Badge Name:
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="border p-2 rounded w-full mt-1"
                  required
                />
              </label>

              <label className="text-sm font-semibold">
                Description:
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="border p-2 rounded w-full mt-1"
                  required
                />
              </label>

              <label className="text-sm font-semibold">
                Level Required:
                <input
                  type="number"
                  name="levelRequired"
                  value={formData.levelRequired}
                  onChange={handleChange}
                  className="border p-2 rounded w-full mt-1"
                  required
                />
              </label>

              <label className="text-sm font-semibold">
                Icon (Emoji):
                <input
                  type="text"
                  name="icon"
                  value={formData.icon}
                  onChange={handleChange}
                  placeholder="⭐ or 🔥"
                  className="border p-2 rounded w-full mt-1"
                />
              </label>

              <label className="text-sm font-semibold">
                Badge Image (Optional):
                <input
                  type="file"
                  name="image"
                  accept="image/*"
                  onChange={handleChange}
                  className="border p-2 rounded w-full mt-1"
                />
              </label>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-md hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherBadgesPage;
