import React from 'react';
import Avatar from '../common/Avatar';

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
      if (hasStatus) onView?.();
      else onAdd?.();
    } else {
      onView?.();
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'pointer',
        gap: '2px',
        flexShrink: 0,
        width: '68px',
        padding: '2px 0',
      }}
    >
      <div
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          padding: '2px',
          background: hasStatus 
            ? 'linear-gradient(135deg, #F77737, #FCAF45, #FFDC80)'
            : '#E4E6EB',
          position: 'relative',
          transition: 'transform 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '2.5px solid #FFFFFF',
            position: 'relative',
            background: '#FFFFFF',
          }}
        >
          <Avatar src={avatar} name={name} size={55} />
          
          {isOwn && !hasStatus && (
            <div
              style={{
                position: 'absolute',
                bottom: '-1px',
                right: '-1px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: '#0095F6',
                color: 'white',
                fontSize: '13px',
                fontWeight: '300',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2.5px solid #FFFFFF',
                boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
              }}
            >
              +
            </div>
          )}
          
          {isOwn && hasStatus && (
            <div
              style={{
                position: 'absolute',
                bottom: '-1px',
                right: '-1px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: '#0095F6',
                color: 'white',
                fontSize: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2.5px solid #FFFFFF',
                boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                paddingLeft: '1.5px',
              }}
            >
              ▶
            </div>
          )}
        </div>
      </div>
      
      <span
        style={{
          fontSize: '11px',
          color: '#262626',
          textAlign: 'center',
          maxWidth: '68px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: 400,
          marginTop: '1px',
        }}
      >
        {isOwn ? 'Your Echo' : name?.split(' ')[0] || 'User'}
      </span>
    </div>
  );
};

export default StatusCircle;
