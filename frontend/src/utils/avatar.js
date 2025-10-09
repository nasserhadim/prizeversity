import { API_BASE } from '../config/api';

// Resolve a user's avatar URL (uploaded file, data URL, or remote OAuth image)
export const getAvatarSrc = (u) => {
  if (!u) return null;
  if (u.avatar) {
    if (typeof u.avatar === 'string' && (u.avatar.startsWith('data:') || u.avatar.startsWith('http'))) {
      return u.avatar;
    }
    return `${API_BASE}/uploads/${u.avatar}`;
  }
  if (u.profileImage) return u.profileImage;
  return null;
};

// Compute initials fallback
export const getInitials = (u) =>
  `${(u?.firstName?.[0] || u?.email?.[0] || 'U')}${(u?.lastName?.[0] || '')}`.toUpperCase();