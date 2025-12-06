import React, { useState } from 'react';
import { getAvatarSrc, getInitials } from '../utils/avatar';

export default function Avatar({ user, size = 32, showStatus = true }) {
  const src = getAvatarSrc(user);
  const initials = getInitials(user);
  const isOnline = user && user._id && window.__classroomOnlineSet?.has(String(user._id)); // fallback if needed

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt="Avatar" className="w-full h-full rounded-full object-cover" />
      ) : (
        <div className="w-full h-full rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-700">
          {initials}
        </div>
      )}
      {showStatus && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}
          aria-label={isOnline ? 'Online' : 'Offline'}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}