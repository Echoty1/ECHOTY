// src/components/pages/Chat/ChatPreviewPopup.js
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../../services/firebase';
import { ref, query, orderByChild, limitToLast, onValue } from 'firebase/database';
import Avatar from '../../common/Avatar';

const ChatPreviewPopup = ({ chat, onClose, onOpenChat, position }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const popupRef = useRef(null);

  // Fetch last 5 messages from this chat
  useEffect(() => {
    if (!chat?.id) return;
    setLoading(true);
    const msgsRef = query(
      ref(db, `messages/${chat.id}`),
      orderByChild('timestamp'),
      limitToLast(5)
    );

    const unsub = onValue(msgsRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .map(([id, m]) => ({ id, ...m }))
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      setMessages(list);
      setLoading(false);
    });

    return () => unsub();
  }, [chat?.id]);

  // Dismiss on outside click / touch release elsewhere
  useEffect(() => {
    const handleOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  if (!chat) return null;

  // Position the popup near the chat item but clamp to viewport
  const popupStyle = {
    position: 'fixed',
    top: Math.min(Math.max(position.y, 16), window.innerHeight - 320),
    left: Math.min(Math.max(position.x, 16), window.innerWidth - 320),
    width: 'min(320px, calc(100vw - 32px))',
    maxHeight: '300px',
    background: 'var(--bg-card)',
    borderRadius: '16px',
    border: '1px solid var(--border-color)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(108,60,225,0.3)',
    zIndex: 99999,
    overflow: 'hidden',
    backdropFilter: 'blur(20px)',
    animation: 'chatPreviewIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    display: 'flex',
    flexDirection: 'column',
  };

  const headerStyle = {
    padding: '12px 14px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'linear-gradient(135deg, rgba(108,60,225,0.08), rgba(236,72,153,0.05))',
  };

  const bodyStyle = {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  };

  const footerStyle = {
    padding: '10px 14px',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--bg-input)',
  };

  const bubbleStyle = (isMe) => ({
    alignSelf: isMe ? 'flex-end' : 'flex-start',
    maxWidth: '80%',
    padding: '6px 10px',
    borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
    background: isMe
      ? 'linear-gradient(135deg, #6C3CE1, #EC4899)'
      : 'var(--bg-input)',
    color: isMe ? '#fff' : 'var(--text-primary)',
    fontSize: '12px',
    lineHeight: 1.35,
    wordBreak: 'break-word',
    border: isMe ? 'none' : '1px solid var(--border-color)',
  });

  const timeStyle = (isMe) => ({
    fontSize: '9px',
    color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)',
    marginTop: '2px',
    textAlign: isMe ? 'right' : 'left',
  });

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const openChat = () => {
    onClose();
    onOpenChat(chat.id);
  };

  return (
    <div ref={popupRef} style={popupStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <Avatar src={chat.avatar} name={chat.name} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {chat.name}
          </div>
          <div style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {chat.isOnline ? '🟢 Online' : 'Tap to open chat'}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={bodyStyle}>
        {loading ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
            No messages yet. Say hi 👋
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId === chat.myUid;
            return (
              <div key={m.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column' }}>
                <div style={bubbleStyle(isMe)}>
                  {m.type === 'image' || m.imageUrl ? (
                    <img
                      src={m.imageUrl || m.mediaUrl}
                      alt=""
                      style={{ maxWidth: '140px', borderRadius: '8px', display: 'block' }}
                    />
                  ) : m.type === 'voice' ? (
                    <span>🎤 Voice message</span>
                  ) : m.type === 'gif' ? (
                    <span>🎞️ GIF</span>
                  ) : (
                    <span>{m.text || m.message || ''}</span>
                  )}
                </div>
                <div style={timeStyle(isMe)}>{formatTime(m.timestamp)}</div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div style={footerStyle}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Preview · last {messages.length} messages
        </span>
        <button
          onClick={openChat}
          style={{
            background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
            color: '#fff',
            border: 'none',
            padding: '6px 14px',
            borderRadius: '14px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            minHeight: 'auto',
          }}
        >
          Open Chat →
        </button>
      </div>
    </div>
  );
};

export default ChatPreviewPopup;
