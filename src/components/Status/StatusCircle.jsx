import React from 'react';
import Avatar from '../common/Avatar';

const StatusCircle = ({
  isOwn = false,
  hasStatus = false,
  avatar,
  name,
  onAdd,
  onView,
  isFirst = false,
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
        gap: '4px',
        flexShrink: 0,
        width: '88px',
        padding: '6px 0',
        marginLeft: isFirst ? '-30px' : '0',
        transition: 'margin-left 0.3s ease',
      }}
      onMouseEnter={(e) => {
        const parent = e.currentTarget.closest('.status-bar-scroll');
        if (parent && isFirst) {
          e.currentTarget.style.marginLeft = '0px';
        }
        e.currentTarget.querySelector('.status-ring').style.transform = 'scale(1.08)';
      }}
      onMouseLeave={(e) => {
        const parent = e.currentTarget.closest('.status-bar-scroll');
        if (parent && isFirst) {
          e.currentTarget.style.marginLeft = '-30px';
        }
        e.currentTarget.querySelector('.status-ring').style.transform = 'scale(1)';
      }}
    >
      <div
        className="status-ring"
        style={{
          width: '76px',
          height: '76px',
          borderRadius: '50%',
          padding: '3px',
          background: hasStatus 
            ? 'conic-gradient(from 0deg, #feda75, #fa7e1e, #d62976, #962fbf, #4f5bd5, #feda75)'
            : '#DBDBDB',
          position: 'relative',
          transition: 'transform 0.3s ease, margin-left 0.3s ease',
          transform: 'scale(1)',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '3.5px solid #FFFFFF',
            position: 'relative',
            background: '#FFFFFF',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <Avatar src={avatar} name={name} size={70} />
          
          {isOwn && !hasStatus && (
            <div
              style={{
                position: 'absolute',
                bottom: '-1px',
                right: '-1px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#0095F6',
                color: 'white',
                fontSize: '18px',
                fontWeight: '300',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '3px solid #FFFFFF',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                transition: 'transform 0.2s ease',
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
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#0095F6',
                color: 'white',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '3px solid #FFFFFF',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                paddingLeft: '2px',
              }}
            >
              ▶
            </div>
          )}
        </div>
      </div>
      
      <span
        style={{
          fontSize: '12px',
          color: '#262626',
          textAlign: 'center',
          maxWidth: '88px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: 400,
          marginTop: '2px',
          lineHeight: '1.2',
        }}
      >
        {isOwn ? 'Your Echo' : name?.split(' ')[0] || 'User'}
      </span>
    </div>
  );
};

export default StatusCircle;
