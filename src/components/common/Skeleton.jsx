// src/components/common/Skeleton.jsx
import React from 'react';
import './Skeleton.css';

const Skeleton = ({ count = 3 }) => {
  return (
    <div className="skeleton-list">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-item">
          <div className="skeleton-avatar" />
          <div className="skeleton-text">
            <div className="skeleton-line" style={{ width: '70%' }} />
            <div className="skeleton-line" style={{ width: '40%' }} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default Skeleton;