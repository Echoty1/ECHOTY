import React, { useRef, useEffect } from 'react';
import StatusCircle from './StatusCircle';
import './StatusBar.css';

const StatusBar = ({ users, ownStatus, onAddStatus, onViewStatus }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (event) => {
      if (event.deltaY !== 0) {
        event.preventDefault();
        el.scrollLeft += event.deltaY;
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  return (
    <div className="echo-status-container">
      <div
        ref={scrollRef}
        className="echo-status-bar"
      >
        <StatusCircle
          isOwn={true}
          hasStatus={!!ownStatus}
          avatar={ownStatus?.avatar || 'https://via.placeholder.com/70'}
          name="Your Echo"
          onAdd={onAddStatus}
          onView={() => onViewStatus(ownStatus)}
          isFirst={true}
        />
        
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
      
      <div className="status-fade-left" />
    </div>
  );
};

export default StatusBar;
