// src/components/common/Avatar.js
import React from 'react';
import { useCachedImage } from '../../utils/mediaCache';

const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    const single = parts[0];
    // If the single part has at least 2 characters, use first two
    if (single.length >= 2) {
      return single.substring(0, 2).toUpperCase();
    }
    return single.charAt(0).toUpperCase();
  }
  // First letter of first and last name
  const first = parts[0].charAt(0).toUpperCase();
  const last = parts[parts.length - 1].charAt(0).toUpperCase();
  return first + last;
};

const Avatar = ({ src, name, size = 40, className = '', onClick }) => {
  const cachedImage = useCachedImage(src, null);
  const initials = getInitials(name);

  const backgroundStyle = {
    background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 700,
    fontSize: size * 0.45,
    textTransform: 'uppercase',
    flexShrink: 0,
    userSelect: 'none',
  };

  if (cachedImage) {
    return (
      <img
        src={cachedImage}
        alt={name || 'Avatar'}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
        onClick={onClick}
      />
    );
  }

  return (
    <div
      className={className || 'initials-avatar'}
      style={backgroundStyle}
      onClick={onClick}
    >
      {initials}
    </div>
  );
};

export default Avatar;