import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import apiBazaar from '../API/apiBazaar';
import apiItem from '../API/apiItem';
import apiClassroom from '../API/apiClassroom';

const effectDescriptions = {
  halveBits: "Halves another student's bits.",
  stealBits: "Steals 10% of another student's bits.",
  shield: "Activates a shield that protects from one attack.",
  default: "No effect or passive item."
};

const InventorySection = ({ userId, classroomId }) => {
  const [items, setItems] = useState([]);
  const [students, setStudents] = useState([]);
  const [targets, setTargets] = useState({}); // itemId that will target the user === targetUserId

  useEffect(() => {
    const load = async () => {
      try {
        const invRes = await apiBazaar.get(`/inventory/${userId}`);
        setItems(invRes.data.items);

        const studentRes = await apiClassroom.get(`/${classroomId}/students`);
        setStudents(studentRes.data); // no `.students` if backend sends array
      } catch (err) {
        console.error(err);
        toast.error('Failed to load inventory or student list');
      }
    };
    if (userId && classroomId) load();
  }, [userId, classroomId]);

  const handleUse = async (itemId) => {
    const targetUserId = targets[itemId] || null;

    try {
      const response = await apiItem.post(`/${itemId}/use`, { userId, targetUserId });
      toast.success(response.data.message || 'Item used!');

      // Remove used item
      setItems((prev) => prev.filter((item) => item._id !== itemId));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to use item');
    }
  };

  return (
    <div className="mt-6 space-y-6">
      {/* Inventory Header */}
      <h2 className="text-2xl font-bold text-success flex items-center gap-2">
        🎒 My Inventory
      </h2>

      {/* Empty State */}
      {items.length === 0 && (
        <p className="text-gray-500 italic">You don't own any items yet.</p>
      )}

      {/* Inventory Items */}
      {items.map((item) => (
        <div
          key={item._id}
          className="card bg-base-100 shadow-md border border-base-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4"
        >
          {/* Image or Fallback */}
          <div className="w-24 h-24 bg-base-200 rounded-lg overflow-hidden flex items-center justify-center border">
            {item.image ? (
              <img
                src={item.image}
                alt={item.name}
                className="object-cover w-full h-full"
              />
            ) : (
              <ImageOff className="w-8 h-8 text-gray-400" />
            )}
          </div>

          {/* Item Info */}
          <div className="flex-1 space-y-1">
            <h4 className="text-lg font-semibold">{item.name}</h4>
            <p className="text-sm text-gray-600">{item.description}</p>
            <p className="text-sm italic text-gray-500">
              Effect: {effectDescriptions[item.effect] || effectDescriptions.default}
            </p>

            {/* Shield Info */}
            {item.effect === 'shield' && item.active && (
              <p className="text-green-600 font-semibold">🛡 Active Shield</p>
            )}
            {item.effect === 'shield' && (
              <p className="text-sm text-gray-500">
                Uses Remaining: {item.usesRemaining ?? 1}
              </p>
            )}
          </div>

          {/* Action Area */}
          <div className="flex flex-col gap-2 md:w-1/3">
            {/* Target Select (for attacks) */}
            {['halveBits', 'stealBits'].includes(item.effect) && (
              <select
                className="select select-bordered w-full"
                onChange={(e) =>
                  setTargets((prev) => ({ ...prev, [item._id]: e.target.value }))
                }
                value={targets[item._id] || ''}
              >
                <option value="">Select a student to target</option>
                {students
                  .filter((s) => s._id !== userId)
                  .map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.firstName} {s.lastName}
                    </option>
                  ))}
              </select>
            )}

            {/* Use Button */}
            <button
              className="btn btn-success btn-sm w-full"
              onClick={() => handleUse(item._id)}
              disabled={item.effect === 'shield' && item.active}
            >
              {item.effect === 'shield' && item.active ? 'Already Active' : 'Use Item'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default InventorySection;
