import React, { useRef } from 'react';
import StatusCircle from './StatusCircle';
import './StatusBar.css'; // Make sure to import the CSS

const StatusBar = ({ users, ownStatus, onAddStatus, onViewStatus }) => {
  const scrollRef = useRef(null);

  return (
    <div className="echo-status-container">
      <div
        ref={scrollRef}
        className="echo-status-bar"
      >
        {/* Your own status circle */}
        <StatusCircle
          isOwn={true}
          hasStatus={!!ownStatus}
          avatar={ownStatus?.avatar || 'https://via.placeholder.com/70'}
          name="Your Echo"
          onAdd={onAddStatus}
          onView={() => onViewStatus(ownStatus)}
          isFirst={true}
        />
        
        {/* Other users' status circles */}
        {users?.map((user, index) => (
          <StatusCircle
            key={user.id}
            isOwn={false}
            hasStatus={user.hasStatus}
            avatar={user.avatar}
            name={user.name}
            onView={() => onViewStatus(user.status)}
            isFirst={false}
          />
        ))}
      </div>
      
      {/* Subtle gradient fade on the left edge */}
      <div className="status-fade-left" />
    </div>
  );
};

export default StatusBar;
