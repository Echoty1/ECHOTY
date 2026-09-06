// src/components/Status/StatusCircle.jsx
import React from 'react';
import Avatar from '../common/Avatar';
import './StatusBar.css';

const StatusCircle = ({
  isOwn = false,
  hasStatus = false,
  avatar,
  name,
  onAdd,
  onView,
}) => {
  const handleClick = () => {
    if (isOwn) {
      onAdd?.();           // Always open recorder for own circle
    } else {
      onView?.();
    }
  };

  return (
    <div className="status-circle-wrapper" onClick={handleClick}>
      <div
        className={`status-ring ${hasStatus ? 'has-status' : ''} ${isOwn ? 'own' : ''}`}
      >
        <div className="status-avatar-inner">
          <Avatar 
            src={avatar} 
            name={name} 
            size={58} 
          />

          {/* Plus badge only for own empty circle */}
          {isOwn && (
            <div className="add-badge">+</div>
          )}
        </div>
      </div>

      <span className="status-name">
        {isOwn ? 'Your Echo' : (name?.split(' ')[0] || 'User')}
      </span>
    </div>
  );
};

export default StatusCircle;
