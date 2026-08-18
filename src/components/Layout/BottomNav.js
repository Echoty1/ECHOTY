// src/components/Layout/BottomNav.js
import React, { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../services/firebase';
import { ref, onValue } from 'firebase/database';

const SUPPORT_UID = 'hD7tJzPVI1VSorhok8GToBC6VDy1';

const BottomNav = () => {
  const { user } = useAuth();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);

  const isSupport = user?.uid === SUPPORT_UID;

  const tabs = [
    { to: '/', label: 'Home', icon: 'fa-house' },
    { to: '/chats', label: 'Chats', icon: 'fa-comment-dots' },
    isSupport
      ? { to: '/control', label: 'CONTROL', icon: 'fa-sliders-h' }
      : { to: '/shop', label: 'Shop', icon: 'fa-store' },
    { to: '/profile', label: 'Profile', icon: 'fa-user' },
    { to: '/other', label: 'Other', icon: 'fa-ellipsis-h' },
  ];

  // ─── Real‑time unread contacts count ──────────────────────────
  useEffect(() => {
    if (!user?.uid) {
      setUnreadChatsCount(0);
      return;
    }

    const userChatsRef = ref(db, `userChats/${user.uid}`);
    const unsubscribe = onValue(userChatsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setUnreadChatsCount(0);
        return;
      }

      let count = 0;
      Object.values(data).forEach((chat) => {
        if (chat.unreadCount && chat.unreadCount > 0) {
          count++;
        }
      });
      setUnreadChatsCount(count);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // ─── Dragging handlers ─────────────────────────────────────────
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

    let newX = startOffset.current.x + dx;
    let newY = startOffset.current.y + dy;

    const maxX = 600;
    const maxY = 400;
    newX = Math.max(-maxX, Math.min(maxX, newX));
    newY = Math.max(-maxY, Math.min(maxY, newY));

    setPosition({ x: newX, y: newY });
  };

  const handleEnd = () => setIsDragging(false);

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
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: `translateX(calc(-50% + ${position.x}px)) translateY(${position.y}px)`,
        zIndex: 50,
        background: 'rgba(10,10,15,0.92)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '28px',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '8px 12px',
        height: '72px',
        width: 'calc(100% - 16px)',
        maxWidth: '440px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        transition: isDragging ? 'none' : 'all 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
        userSelect: 'none',
        willChange: 'transform',
        overflow: 'hidden',
      }}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
    >
      <div
        style={{
          position: 'absolute',
          top: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '40px',
          height: '4px',
          borderRadius: '2px',
          background: 'rgba(255,255,255,0.15)',
          pointerEvents: 'none',
        }}
      />
      {tabs.map((tab) => {
        const isChatTab = tab.to === '/chats';
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            style={({ isActive }) => ({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: isActive ? 'white' : '#555',
              fontSize: '10px',
              padding: '4px 8px',
              borderRadius: '16px',
              cursor: 'pointer',
              background: isActive ? 'rgba(108,60,225,0.2)' : 'transparent',
              textDecoration: 'none',
              minWidth: '44px',
              transition: 'all 0.15s ease',
              position: 'relative',
            })}
          >
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <i className={`fas ${tab.icon}`} style={{ fontSize: '22px', marginBottom: '2px' }} />
              {isChatTab && unreadChatsCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-10px',
                    minWidth: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: '#EF4444',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                    border: '2px solid rgba(10,10,15,0.92)',
                    boxShadow: '0 0 8px rgba(239,68,68,0.3)',
                    lineHeight: 1,
                  }}
                >
                  {unreadChatsCount > 9 ? '9+' : unreadChatsCount}
                </span>
              )}
            </div>
            <span style={{ fontSize: '9px', opacity: 0.8, fontWeight: 500 }}>{tab.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
};

export default BottomNav;