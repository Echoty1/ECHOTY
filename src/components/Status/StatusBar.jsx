import React, { useRef } from 'react';
import StatusCircle from './StatusCircle';

const StatusBar = ({ users, ownStatus, onAddStatus, onViewStatus }) => {
  const scrollRef = useRef(null);

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #EFEFEF',
        padding: '4px 0',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        ref={scrollRef}
        className="status-bar-scroll"
        style={{
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '4px 16px 4px 10px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Your own status circle - first item with left offset */}
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
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '40px',
          background: 'linear-gradient(to right, rgba(255,255,255,0.9), rgba(255,255,255,0))',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />
    </div>
  );
};

export default StatusBar;
