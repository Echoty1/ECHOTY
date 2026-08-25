// src/components/Layout/BottomNav.js
import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom'; // ✅ useLocation added
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../services/firebase';
import { ref, onValue } from 'firebase/database';

const SUPPORT_UID = 'hD7tJzPVI1VSorhok8GToBC6VDy1';
const AD_ZONE_ID = '12035158';

const BottomNav = () => {
  const { user } = useAuth();
  const location = useLocation(); // ✅ get current route
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

  useEffect(() => {
    setPosition({ x: 0, y: 0 });
  }, []);

  const isSupport = user?.uid === SUPPORT_UID;

  const getTabs = () => {
    const commonTabs = [
      { to: '/chats', label: 'Chats', icon: 'fa-comment-dots' },
      { to: '/communities', label: 'Communities', icon: 'fa-users' },
      { to: '/shop', label: 'Shop', icon: 'fa-store' },
      { to: '/other', label: 'Other', icon: 'fa-ellipsis-h' },
    ];
    if (isSupport) {
      return [{ to: '/control', label: 'Control', icon: 'fa-sliders-h' }, ...commonTabs];
    } else {
      return [{ to: '/', label: 'Home', icon: 'fa-house' }, ...commonTabs];
    }
  };

  const tabs = getTabs();

  // ─── Unread count listener ──────────────────────────────────
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

  // ─── Drag handlers ──────────────────────────────────────────
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
    const maxX = 200;
    const maxY = 100;
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

  // ─── Ad loading function ────────────────────────────────────
  const runAd = async () => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    const loadLibrary = () => {
      return new Promise((resolve) => {
        if (window.aclib) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.id = 'aclib';
        script.type = 'text/javascript';
        script.src = '//acscdn.com/script/aclib.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.head.appendChild(script);
      });
    };

    try {
      await loadLibrary();
      const container = document.getElementById('ad-bg-container');
      if (!container) return;
      container.innerHTML = '';

      if (isLocalhost) {
        const placeholder = document.createElement('div');
        placeholder.style.width = '100%';
        placeholder.style.height = '100%';
        placeholder.style.background = 'linear-gradient(135deg, #6C3CE1, #EC4899)';
        placeholder.style.display = 'flex';
        placeholder.style.alignItems = 'center';
        placeholder.style.justifyContent = 'center';
        placeholder.style.color = '#fff';
        placeholder.style.fontSize = '14px';
        placeholder.style.fontWeight = '700';
        placeholder.style.letterSpacing = '0.5px';
        placeholder.textContent = '📢 Ad (localhost)';
        container.appendChild(placeholder);
        return;
      }

      const zoneScript = document.createElement('script');
      zoneScript.type = 'text/javascript';
      zoneScript.innerHTML = `
        try {
          aclib.runBanner({
            zoneId: '${AD_ZONE_ID}',
          });
        } catch (e) {
          console.warn('AdCash banner error:', e);
        }
      `;
      container.appendChild(zoneScript);
    } catch (err) {
      const container = document.getElementById('ad-bg-container');
      if (container) {
        container.innerHTML = '';
        const fallback = document.createElement('div');
        fallback.style.width = '100%';
        fallback.style.height = '100%';
        fallback.style.background = 'var(--bg-input, #222)';
        fallback.style.display = 'flex';
        fallback.style.alignItems = 'center';
        fallback.style.justifyContent = 'center';
        fallback.style.color = 'var(--text-muted, #888)';
        fallback.style.fontSize = '12px';
        fallback.textContent = 'Ad unavailable';
        container.appendChild(fallback);
      }
    }
  };

  // ─── Load ad on mount and on route change ───────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      runAd();
    }, 300);
    return () => clearTimeout(timer);
  }, [location.pathname]); // ✅ reload when URL changes

  const navHeight = isMinimized ? '32px' : '72px';
  const tabOpacity = isMinimized ? 0 : 1;
  const pointerEvents = isMinimized ? 'none' : 'auto';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: `translateX(calc(-50% + ${position.x}px)) translateY(${position.y}px)`,
        zIndex: 9999,
        borderRadius: '28px 28px 0 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0',
        height: navHeight,
        width: 'calc(100% - 16px)',
        maxWidth: '440px',
        boxShadow: '0 -4px 20px var(--shadow-color)',
        cursor: isDragging ? 'grabbing' : isMinimized ? 'default' : 'grab',
        touchAction: 'none',
        transition: 'height 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease',
        userSelect: 'none',
        willChange: 'transform, height',
        overflow: 'hidden',
        background: 'var(--bg-secondary, #1a1a2e)',
        border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
      }}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
    >
      {/* ─── Ad Background Container ───────────────────────────── */}
      <div
        id="ad-bg-container"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          zIndex: 0,
          borderRadius: '28px 28px 0 0',
        }}
      />

      {/* ─── Dark overlay for icon readability ─────────────────── */}
      {!isMinimized && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.35)',
            borderRadius: '28px 28px 0 0',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      )}

      {/* ─── Minimize toggle ──────────────────────────────────── */}
      <button
        onClick={toggleMinimize}
        style={{
          position: 'absolute',
          top: '4px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'none',
          border: 'none',
          color: isMinimized ? 'var(--text-muted, #666)' : 'rgba(255,255,255,0.8)',
          fontSize: '12px',
          cursor: 'pointer',
          padding: '2px 8px',
          zIndex: 10,
        }}
        aria-label={isMinimized ? 'Expand navigation' : 'Minimize navigation'}
      >
        <i className={`fas fa-chevron-${isMinimized ? 'up' : 'down'}`} style={{ fontSize: '12px' }} />
      </button>

      {/* ─── Icons row ────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          width: '100%',
          padding: isMinimized ? '0 12px' : '4px 12px 0 12px',
          opacity: tabOpacity,
          pointerEvents: pointerEvents,
          transition: 'opacity 0.25s ease, pointer-events 0.25s ease',
          flex: '0 0 auto',
          position: 'relative',
          zIndex: 2,
          height: isMinimized ? '32px' : '68px',
        }}
      >
        {tabs.map((tab) => {
          const isChatTab = tab.to === '/chats';
          const isControlTab = tab.to === '/control';
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className="nav-link"
              style={({ isActive }) => ({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: isActive ? 'var(--text-primary, #fff)' : 'var(--text-muted, #aaa)',
                fontSize: '10px',
                padding: '4px 8px',
                borderRadius: '16px',
                cursor: 'pointer',
                background: isActive ? 'rgba(108,60,225,0.2)' : 'transparent',
                textDecoration: 'none',
                minWidth: '44px',
                transition: 'all 0.15s ease',
                position: 'relative',
                fontWeight: 900,
              })}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                <i
                  className={`fas ${tab.icon}`}
                  style={{
                    fontSize: '24px',
                    marginBottom: '1px',
                    fontWeight: 900,
                  }}
                />
                {isChatTab && unreadChatsCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-10px',
                      minWidth: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: '#EF4444',
                      color: '#fff',
                      fontSize: '9px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                      border: '2px solid var(--bg-primary, #0A0A0F)',
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
                      top: '-4px',
                      right: '-10px',
                      minWidth: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: '#10B981',
                      color: '#fff',
                      fontSize: '7px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid var(--bg-primary, #0A0A0F)',
                      lineHeight: 1,
                    }}
                  >
                    ★
                  </span>
                )}
              </div>
              <span
                style={{
                  fontSize: '11px',
                  opacity: 0.9,
                  fontWeight: 900,
                  marginTop: '1px',
                }}
              >
                {tab.label}
              </span>
            </NavLink>
          );
        })}
      </div>

      {/* ─── "Ad" label ────────────────────────────────────────── */}
      {!isMinimized && (
        <div
          style={{
            position: 'absolute',
            bottom: '4px',
            right: '14px',
            fontSize: '7px',
            color: 'rgba(255,255,255,0.3)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            zIndex: 3,
            pointerEvents: 'none',
          }}
        >
          Ad
        </div>
      )}

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
            background: 'var(--border-color, rgba(255,255,255,0.08))',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
};

export default BottomNav;