import React from 'react';

const PlusBadge = ({ size = 18 }) => {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '6px' }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="plusGold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="100%" stopColor="#FFA500" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="url(#plusGold)" filter="url(#glow)"/>
        <path d="M9 12L11 14L15 10" stroke="#000" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
};

export default PlusBadge;
