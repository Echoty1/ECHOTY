import React, { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';

const BottomNav = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });

  const items = [
    { to: '/', icon: 'fa-comment-dots', label: 'Chat' },
    { to: '/profile', icon: 'fa-user', label: 'Profile' },
  ];

  // Detect touch/mouse events for dragging
  const handleStart = (e) => {
    const touch = e.touches ? e.touches[0] : e;
    startPos.current = { x: touch.clientX, y: touch.clientY };
    startOffset.current = { x: position.x, y: position.y };
    setIsDragging(true);
  };

  const handleMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches ? e.touches[0] : e;
    const dx = touch.clientX - startPos.current.x;
    const dy = touch.clientY - startPos.current.y;
    setPosition({
      x: startOffset.current.x + dx,
      y: startOffset.current.y + dy,
    });
  };

  const handleEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleEnd);
    } else {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  return (
    <div
      ref={dragRef}
      style={{
        position: 'fixed',
        bottom: Math.max(12, 12 + position.y),
        left: `calc(50% + ${position.x}px)`,
        transform: 'translateX(-50%)',
        zIndex: 50,
        background: 'rgba(10,10,15,0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '20px',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '6px 8px',
        height: '60px',
        width: 'calc(100% - 32px)',
        maxWidth: '300px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        transition: isDragging ? 'none' : 'all 0.2s ease',
        userSelect: 'none',
      }}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
    >
      {/* Small handle at top */}
      <div
        style={{
          position: 'absolute',
          top: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '30px',
          height: '4px',
          borderRadius: '2px',
          background: 'rgba(255,255,255,0.2)',
          pointerEvents: 'none',
        }}
      />
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: isActive ? 'white' : '#555',
            fontSize: '10px',
            padding: '4px 12px',
            borderRadius: '14px',
            cursor: 'pointer',
            background: isActive ? 'rgba(108,60,225,0.15)' : 'transparent',
            textDecoration: 'none',
            minWidth: '60px',
          })}
        >
          <i className={`fas ${item.icon}`} style={{ fontSize: '22px' }} />
          <span style={{ fontSize: '9px', opacity: 0.7 }}>{item.label}</span>
        </NavLink>
      ))}
    </div>
  );
};

export default BottomNav;