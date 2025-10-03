import React, { useState } from 'react';
import { getAvatarSrc, getInitials } from '../utils/avatar';

const Avatar = ({ user, size = 32, className = '' }) => {
  const [failed, setFailed] = useState(false);
  const src = getAvatarSrc(user);
  const initials = getInitials(user);

  if (!src || failed) {
    return (
      <div
        className={`rounded-full bg-base-300 text-base-content/70 flex items-center justify-center font-bold ${className}`}
        style={{ width: size, height: size, minWidth: size }}
        title={initials}
      >
        <span className="text-xs">{initials}</span>
      </div>
    );
  }

  return (
    <img
      alt="User Avatar"
      src={src}
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  );
};

export default Avatar;