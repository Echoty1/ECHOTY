import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../contexts/SocketContext';
import { db } from '../../services/firebase';
import { ref, onValue } from 'firebase/database';
import { Link, useNavigate } from 'react-router-dom';

const ChatList = () => {
  const { user } = useAuth();
  const { onlineUsers } = useSocket();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [lastMessageData, setLastMessageData] = useState({});
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef(null);
  const touchStartX = useRef(0);
  const isDragging = useRef(false);

  // Load users
  useEffect(() => {
    if (!user) return;
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map((key) => ({ ...data[key], id: key }));
        const filtered = list.filter(
          (u) =>
            u.id !== user.uid &&
            u.username &&
            !u.username.toLowerCase().includes('test')
        );
        setUsers(filtered);
        // Reset active index if list changes
        setActiveIndex(0);
      }
    });
  }, [user]);

  // Fetch last message for each chat
  useEffect(() => {
    if (!user || users.length === 0) return;
    users.forEach((u) => {
      const chatId = [user.uid, u.id].sort().join('_');
      const chatRef = ref(db, `chats/${chatId}`);
      onValue(
        chatRef,
        (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const msgs = Object.values(data).sort((a, b) => b.timestamp - a.timestamp);
            const last = msgs[0];
            if (last) {
              setLastMessageData((prev) => ({
                ...prev,
                [u.id]: {
                  message: last.message || (last.voice ? '🎙️ Voice note' : ''),
                  timestamp: last.timestamp,
                },
              }));
            }
          } else {
            setLastMessageData((prev) => ({
              ...prev,
              [u.id]: { message: '', timestamp: 0 },
            }));
          }
        },
        { onlyOnce: true }
      );
    });
  }, [users, user]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(users.length - 1, prev + 1));
      } else if (e.key === 'Enter' && users.length > 0) {
        const activeUser = users[activeIndex];
        if (activeUser) navigate(`/chat/${activeUser.id}`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [users, activeIndex, navigate]);

  // Touch swipe handling
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    isDragging.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isDragging.current) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > 30) {
      if (deltaX < 0) {
        setActiveIndex((prev) => Math.min(users.length - 1, prev + 1));
      } else {
        setActiveIndex((prev) => Math.max(0, prev - 1));
      }
      isDragging.current = false;
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
  };

  // Helper: get card transforms based on offset
  const getCardStyle = (offset) => {
    const absOffset = Math.abs(offset);
    const rotateY = offset * -18; // degrees
    const translateX = offset * 180; // pixels
    const translateZ = absOffset * -160; // pixels
    const scale = Math.max(1 - absOffset * 0.12, 0.6);
    const opacity = Math.max(1 - absOffset * 0.25, 0.15);
    const zIndex = 100 - absOffset;

    return {
      transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
      opacity,
      zIndex,
      pointerEvents: offset === 0 ? 'auto' : 'none',
    };
  };

  // If no users
  if (users.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888' }}>
        No users yet — invite friends!
      </div>
    );
  }

  const activeUser = users[activeIndex];

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0A0A0F',
        overflow: 'hidden',
        position: 'relative',
        perspective: '1200px',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 3D Stage */}
      <div
        ref={carouselRef}
        style={{
          position: 'relative',
          width: '280px',
          height: '380px',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
        }}
      >
        {users.map((u, index) => {
          const offset = index - activeIndex;
          const isActive = offset === 0;
          const isOnline = onlineUsers.includes(u.id);
          const last = lastMessageData[u.id] || { message: '' };
          const lastMsg = last.message || 'Start chatting...';
          const style = getCardStyle(offset);

          return (
            <div
              key={u.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                borderRadius: '24px',
                background: 'rgba(22, 18, 36, 0.7)',
                backdropFilter: 'blur(16px)',
                border: isActive
                  ? '1px solid rgba(139, 92, 246, 0.6)'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: isActive
                  ? '0 0 40px rgba(139, 92, 246, 0.25), 0 20px 50px rgba(0,0,0,0.6)'
                  : '0 20px 40px rgba(0,0,0,0.4)',
                backfaceVisibility: 'hidden',
                willChange: 'transform, opacity',
                transition: 'transform 0.4s ease-out, opacity 0.4s ease-out, border-color 0.3s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                cursor: isActive ? 'pointer' : 'default',
                ...style,
              }}
              onClick={() => {
                if (isActive) {
                  navigate(`/chat/${u.id}`);
                } else {
                  setActiveIndex(index);
                }
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  position: 'relative',
                  width: '80px',
                  height: '80px',
                  marginBottom: '12px',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '34px',
                    fontWeight: 700,
                    color: 'white',
                  }}
                >
                  {u.avatar || u.username[0].toUpperCase()}
                </div>
                <div
                  style={{
                    position: 'absolute',
                    bottom: '2px',
                    right: '2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: isOnline ? '#10B981' : '#EF4444',
                    border: '2px solid #0A0A0F',
                  }}
                />
              </div>

              {/* Name */}
              <div
                style={{
                  fontSize: isActive ? '20px' : '16px',
                  fontWeight: 600,
                  color: 'white',
                  textAlign: 'center',
                  transition: 'font-size 0.3s ease',
                }}
              >
                {u.username}
              </div>

              {/* Status */}
              <div
                style={{
                  fontSize: '13px',
                  color: isOnline ? '#10B981' : '#888',
                  fontWeight: 500,
                  marginTop: '4px',
                }}
              >
                {isOnline ? '🟢 Online' : 'Offline'}
              </div>

              {/* Last message preview */}
              <div
                style={{
                  fontSize: '13px',
                  color: '#888',
                  marginTop: '8px',
                  maxWidth: '80%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  opacity: isActive ? 1 : 0.6,
                }}
              >
                {lastMsg}
              </div>

              {/* Quick reply hint for active card */}
              {isActive && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '6px 16px',
                    borderRadius: '20px',
                    background: 'rgba(139, 92, 246, 0.15)',
                    fontSize: '12px',
                    color: '#8B5CF6',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                  }}
                >
                  Tap to open chat
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation Arrows */}
      <div
        style={{
          position: 'absolute',
          bottom: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '20px',
          zIndex: 10,
        }}
      >
        <button
          onClick={() => setActiveIndex((prev) => Math.max(0, prev - 1))}
          disabled={activeIndex === 0}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'rgba(18,18,26,0.8)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.06)',
            color: activeIndex === 0 ? '#555' : 'white',
            fontSize: '22px',
            cursor: activeIndex === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}
        >
          ‹
        </button>
        <button
          onClick={() => setActiveIndex((prev) => Math.min(users.length - 1, prev + 1))}
          disabled={activeIndex === users.length - 1}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'rgba(18,18,26,0.8)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.06)',
            color: activeIndex === users.length - 1 ? '#555' : 'white',
            fontSize: '22px',
            cursor: activeIndex === users.length - 1 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}
        >
          ›
        </button>
      </div>

      {/* HUD hint – keyboard / swipe */}
      <div
        style={{
          position: 'absolute',
          bottom: '90px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '12px',
          color: '#555',
          textAlign: 'center',
          opacity: 0.5,
          pointerEvents: 'none',
        }}
      >
        ← swipe or use arrow keys →
      </div>
    </div>
  );
};

export default ChatList;