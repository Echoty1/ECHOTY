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

  const [isMinimized, setIsMinimized] = useState(() => {
    return localStorage.getItem('bottomNavMinimized') === 'true';
  });

  const toggleMinimize = () => {
    const newState = !isMinimized;
    setIsMinimized(newState);
    localStorage.setItem('bottomNavMinimized', String(newState));
  };

  const isSupport = user?.uid === SUPPORT_UID;

  // ─── Define tabs based on user role ──────────────────────────
  const getTabs = () => {
    // Common tabs for all users (Home, Chats, Communities, Other)
    const commonTabs = [
      { to: '/', label: 'Home', icon: 'fa-house' },
      { to: '/chats', label: 'Chats', icon: 'fa-comment-dots' },
      { to: '/communities', label: 'Communities', icon: 'fa-users' },
      { to: '/other', label: 'Other', icon: 'fa-ellipsis-h' },
    ];

    if (isSupport) {
      // Admin: insert Control after Chats
      const controlTab = { to: '/control', label: 'Control', icon: 'fa-sliders-h' };
      // Insert at index 2 (after Home and Chats)
      return [commonTabs[0], commonTabs[1], controlTab, commonTabs[2], commonTabs[3]];
    }

    // Non-admin: Home, Chats, Communities, Other
    return commonTabs;
  };

  const tabs = getTabs();

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

  // ─── Dragging handlers ──────────────────────────────────────
  const handleStart = (e) => {
    if (isMinimized) return;
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

  const navHeight = isMinimized ? '32px' : '72px';
  const tabOpacity = isMinimized ? 0 : 1;
  const pointerEvents = isMinimized ? 'none' : 'auto';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: `translateX(calc(-50% + ${position.x}px)) translateY(${position.y}px)`,
        zIndex: 50,
        background: 'var(--bg-primary)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--border-color)',
        borderRadius: '28px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 0',
        height: navHeight,
        width: 'calc(100% - 16px)',
        maxWidth: '440px',
        boxShadow: '0 8px 40px var(--shadow-color)',
        cursor: isDragging ? 'grabbing' : isMinimized ? 'default' : 'grab',
        touchAction: 'none',
        transition: 'height 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease',
        userSelect: 'none',
        willChange: 'transform, height',
        overflow: 'hidden',
      }}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
    >
      {/* ─── Toggle Button ────────────────────────────────────── */}
      <button
        onClick={toggleMinimize}
        style={{
          position: 'absolute',
          top: '4px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: '14px',
          cursor: 'pointer',
          padding: '2px 8px',
          zIndex: 10,
        }}
        aria-label={isMinimized ? 'Expand navigation' : 'Minimize navigation'}
      >
        <i className={`fas fa-chevron-${isMinimized ? 'up' : 'down'}`} />
      </button>

      {/* ─── Nav Links ────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          width: '100%',
          padding: isMinimized ? '0 12px' : '8px 12px',
          opacity: tabOpacity,
          pointerEvents: pointerEvents,
          transition: 'opacity 0.25s ease, pointer-events 0.25s ease',
          flex: 1,
        }}
      >
        {tabs.map((tab) => {
          const isChatTab = tab.to === '/chats';
          const isControlTab = tab.to === '/control';
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              style={({ isActive }) => ({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
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
                      border: '2px solid var(--bg-primary)',
                      boxShadow: '0 0 8px rgba(239,68,68,0.3)',
                      lineHeight: 1,
                    }}
                  >
                    {unreadChatsCount > 9 ? '9+' : unreadChatsCount}
                  </span>
                )}
                {isControlTab && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-10px',
                      minWidth: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: '#10B981',
                      color: '#fff',
                      fontSize: '8px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid var(--bg-primary)',
                      lineHeight: 1,
                    }}
                  >
                    ★
                  </span>
                )}
              </div>
              <span style={{ fontSize: '9px', opacity: 0.8, fontWeight: 500 }}>{tab.label}</span>
            </NavLink>
          );
        })}
      </div>

      {isMinimized && (
        <div
          style={{
            position: 'absolute',
            bottom: '6px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '30px',
            height: '3px',
            borderRadius: '2px',
            background: 'var(--border-color)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
};

export default BottomNav;