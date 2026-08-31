// src/components/UI/Skeleton.jsx
import React from 'react';

export const ProfileSkeleton = () => {
  return (
    <div style={{ padding: '24px', maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
      {/* Avatar Circle Skeleton */}
      <div style={{
        width: '100px',
        height: '100px',
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.08)',
        animation: 'pulse 1.5s infinite ease-in-out'
      }} />

      {/* Name Skeleton */}
      <div style={{
        width: '140px',
        height: '24px',
        borderRadius: '6px',
        background: 'rgba(255, 255, 255, 0.08)',
        animation: 'pulse 1.5s infinite ease-in-out'
      }} />

      {/* Details Box Skeleton */}
      <div style={{
        width: '100%',
        height: '120px',
        borderRadius: '16px',
        background: 'rgba(255, 255, 255, 0.05)',
        animation: 'pulse 1.5s infinite ease-in-out'
      }} />
    </div>
  );
};