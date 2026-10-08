// src/components/common/UsernamePill.jsx
import React from 'react';
import { useUserUsername } from '../../hooks/useUsername';
import './UsernamePill.css';

/**
 * Shows a user's @handle. Fetches live if you don't pass `username`.
 *
 * Props:
 *   uid      — the user's uid (required if username not passed)
 *   username — optional; if provided, skips fetching
 *   size     — 'sm' | 'md' | 'lg' (default 'md')
 *   onClick  — optional click handler
 */
const UsernamePill = ({ uid, username, size = 'md', onClick, className = '' }) => {
  const fetchedUsername = useUserUsername(uid);
  const finalUsername = username ?? fetchedUsername;

  if (!finalUsername) return null;

  const handleClick = onClick
    ? (e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick(finalUsername);
      }
    : undefined;

  return (
    <span
      className={`username-pill username-pill-${size} ${onClick ? 'clickable' : ''} ${className}`}
      onClick={handleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      @{finalUsername}
    </span>
  );
};

export default UsernamePill;
