import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Award, Plus, Trash2, Edit2, Coins, TrendingUp, Zap, ShoppingCart, Shield } from 'lucide-react';
import EmojiPicker from './EmojiPicker';
import BadgeRewardsDisplay from './BadgeRewardsDisplay';

const BadgeManager = ({ classroomId }) => {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBadge, setEditingBadge] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    levelRequired: 2,
    icon: '🏅',
    image: null,
    rewards: {
      bits: 0,
      multiplier: 0,
      luck: 0,
      discount: 0,
      shield: 0,
      applyPersonalMultiplier: false,
      applyGroupMultiplier: false
    }
  });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [imageSource, setImageSource] = useState('file');
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    fetchBadges();
  }, [classroomId]);

  const fetchBadges = async () => {
    try {
      const res = await axios.get(`/api/badge/classroom/${classroomId}`, {
        withCredentials: true
      });
      setBadges(res.data);
    } catch (err) {
      toast.error('Failed to load badges');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const base = {
      name: formData.name,
      description: formData.description,
      levelRequired: formData.levelRequired,
      icon: formData.icon
    };

    try {
      if (imageSource === 'file' && formData.image) {
        const fd = new FormData();
        Object.entries(base).forEach(([k, v]) => fd.append(k, v));
        fd.append('image', formData.image);
        
        // Append rewards
        fd.append('rewards.bits', formData.rewards.bits);
        fd.append('rewards.multiplier', formData.rewards.multiplier);
        fd.append('rewards.luck', formData.rewards.luck);
        fd.append('rewards.discount', formData.rewards.discount);
        fd.append('rewards.shield', formData.rewards.shield);
        fd.append('rewards.applyPersonalMultiplier', formData.rewards.applyPersonalMultiplier);
        fd.append('rewards.applyGroupMultiplier', formData.rewards.applyGroupMultiplier);

        if (editingBadge) {
          await axios.patch(`/api/badge/${editingBadge._id}`, fd, {
            withCredentials: true,
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          toast.success('Badge updated successfully');
        } else {
          await axios.post(`/api/badge/classroom/${classroomId}`, fd, {
            withCredentials: true,
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          toast.success('Badge created successfully');
        }
      } else {
        const payload = { 
          ...base,
          'rewards.bits': formData.rewards.bits,
          'rewards.multiplier': formData.rewards.multiplier,
          'rewards.luck': formData.rewards.luck,
          'rewards.discount': formData.rewards.discount,
          'rewards.shield': formData.rewards.shield,
          'rewards.applyPersonalMultiplier': formData.rewards.applyPersonalMultiplier,
          'rewards.applyGroupMultiplier': formData.rewards.applyGroupMultiplier
        };
        if (imageSource === 'url' && imageUrl.trim()) payload.imageUrl = imageUrl.trim();

        if (editingBadge) {
          await axios.patch(`/api/badge/${editingBadge._id}`, payload, { withCredentials: true });
          toast.success('Badge updated successfully');
        } else {
          await axios.post(`/api/badge/classroom/${classroomId}`, payload, { withCredentials: true });
          toast.success('Badge created successfully');
        }
      }

      fetchBadges();
      setShowModal(false);
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save badge');
    }
  };

  const handleDelete = async (badgeId) => {
    if (!confirm('Are you sure you want to delete this badge?')) return;
    
    try {
      await axios.delete(`/api/badge/${badgeId}`, { withCredentials: true });
      toast.success('Badge deleted successfully');
      fetchBadges();
    } catch (err) {
      toast.error('Failed to delete badge');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      levelRequired: 2,
      icon: '🏅',
      image: null,
      rewards: {
        bits: 0,
        multiplier: 0,
        luck: 0,
        discount: 0,
        shield: 0,
        applyPersonalMultiplier: false,
        applyGroupMultiplier: false
      }
    });
    setEditingBadge(null);
    setImageSource('file');
    setImageUrl('');
  };

  const openEditModal = (badge) => {
    setEditingBadge(badge);
    setFormData({
      name: badge.name,
      description: badge.description,
      levelRequired: badge.levelRequired,
      icon: badge.icon,
      image: null,
      rewards: {
        bits: badge.rewards?.bits || 0,
        multiplier: badge.rewards?.multiplier || 0,
        luck: badge.rewards?.luck || 0,
        discount: badge.rewards?.discount || 0,
        shield: badge.rewards?.shield || 0,
        applyPersonalMultiplier: badge.rewards?.applyPersonalMultiplier || false,
        applyGroupMultiplier: badge.rewards?.applyGroupMultiplier || false
      }
    });
    if (badge.image && badge.image.startsWith('http')) {
      setImageSource('url');
      setImageUrl(badge.image);
    } else {
      setImageSource('file');
      setImageUrl('');
    }
    setShowModal(true);
  };

  const updateReward = (field, value) => {
    setFormData(prev => ({
      ...prev,
      rewards: {
        ...prev.rewards,
        [field]: value
      }
    }));
  };

  if (loading) {
    return <div className="text-center">Loading badges...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Award className="w-6 h-6" />
          Badge Management
        </h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          <Plus className="w-4 h-4" />
          Create Badge
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {badges.map((badge) => (
          <div key={badge._id} className="card bg-base-100 shadow-md">
            <div className="card-body">
              <div className="flex justify-between items-start">
                <div className="text-4xl">{badge.icon}</div>
                <div className="flex gap-2">
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => openEditModal(badge)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    className="btn btn-sm btn-ghost text-error"
                    onClick={() => handleDelete(badge._id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="card-title">{badge.name}</h3>
              <p className="text-sm text-gray-600">{badge.description}</p>
              <div className="badge badge-primary">
                Level {badge.levelRequired} Required
              </div>
              
              {/* Badge Rewards Display */}
              <BadgeRewardsDisplay rewards={badge.rewards} size="sm" />
            </div>
          </div>
        ))}
      </div>

      {/* Modal for creating/editing badges */}
      {showModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">
              {editingBadge ? 'Edit Badge' : 'Create Badge'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Badge Name</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  maxLength={100}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Description</span>
                </label>
                <textarea
                  className="textarea textarea-bordered"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  maxLength={500}
                  rows={3}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Level Required</span>
                </label>
                <input
                  type="number"
                  className="input input-bordered"
                  value={formData.levelRequired}
                  onChange={(e) => setFormData({ ...formData, levelRequired: parseInt(e.target.value) })}
                  min={2}
                  required
                />
              </div>

              <div className="form-control relative">
                <label className="label">
                  <span className="label-text">Icon (Emoji)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input input-bordered flex-1"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    maxLength={4}
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setShowEmojiPicker(v => !v)}
                    title="Pick Emoji"
                  >
                    {formData.icon || '😀'}
                  </button>
                </div>
                {showEmojiPicker && (
                  <EmojiPicker
                    onSelect={(emoji) => setFormData(f => ({ ...f, icon: emoji }))}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                )}
              </div>

              {/* Rewards Section */}
              <div className="divider">Rewards</div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text flex items-center gap-1">
                      <Coins className="w-4 h-4 text-yellow-500" /> Bits
                    </span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered input-sm"
                    value={formData.rewards.bits}
                    onChange={(e) => updateReward('bits', parseInt(e.target.value) || 0)}
                    min={0}
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text flex items-center gap-1">
                      <TrendingUp className="w-4 h-4 text-blue-500" /> Multiplier
                    </span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered input-sm"
                    value={formData.rewards.multiplier}
                    onChange={(e) => updateReward('multiplier', parseFloat(e.target.value) || 0)}
                    min={0}
                    step={0.1}
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text flex items-center gap-1">
                      <Zap className="w-4 h-4 text-purple-500" /> Luck
                    </span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered input-sm"
                    value={formData.rewards.luck}
                    onChange={(e) => updateReward('luck', parseFloat(e.target.value) || 0)}
                    min={0}
                    step={0.1}
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text flex items-center gap-1">
                      <ShoppingCart className="w-4 h-4 text-green-500" /> Discount %
                    </span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered input-sm"
                    value={formData.rewards.discount}
                    onChange={(e) => updateReward('discount', parseInt(e.target.value) || 0)}
                    min={0}
                    max={100}
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text flex items-center gap-1">
                      <Shield className="w-4 h-4 text-cyan-500" /> Shield
                    </span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered input-sm"
                    value={formData.rewards.shield}
                    onChange={(e) => updateReward('shield', parseInt(e.target.value) || 0)}
                    min={0}
                  />
                </div>
              </div>

              {/* Multiplier Options (only show if bits > 0) */}
              {formData.rewards.bits > 0 && (
                <div className="bg-base-200 p-3 rounded-lg space-y-2">
                  <div className="text-sm font-medium">Apply multipliers to bit rewards:</div>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm checkbox-primary"
                        checked={formData.rewards.applyPersonalMultiplier}
                        onChange={(e) => updateReward('applyPersonalMultiplier', e.target.checked)}
                      />
                      <span className="text-sm">Personal Multiplier</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm checkbox-primary"
                        checked={formData.rewards.applyGroupMultiplier}
                        onChange={(e) => updateReward('applyGroupMultiplier', e.target.checked)}
                      />
                      <span className="text-sm">Group Multiplier</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Badge Image (Optional)</span>
                </label>

                <div className="inline-flex rounded-full bg-gray-200 p-1 mb-2">
                  <button
                    type="button"
                    onClick={() => setImageSource('file')}
                    className={`px-3 py-1 rounded-full text-sm transition ${imageSource === 'file' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageSource('url')}
                    className={`ml-1 px-3 py-1 rounded-full text-sm transition ${imageSource === 'url' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    Use image URL
                  </button>
                </div>

                {imageSource === 'file' ? (
                  <input
                    type="file"
                    className="file-input file-input-bordered"
                    accept="image/*"
                    onChange={(e) => setFormData({ ...formData, image: e.target.files[0] })}
                  />
                ) : (
                  <input
                    type="url"
                    placeholder="https://example.com/badge.png"
                    className="input input-bordered"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                )}
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingBadge ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop" onClick={() => { setShowModal(false); resetForm(); }}></div>
        </div>
      )}
    </div>
  );
};

export default BadgeManager;