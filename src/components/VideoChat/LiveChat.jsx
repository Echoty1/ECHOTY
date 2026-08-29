// src/components/VideoChat/LiveChat.jsx
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../services/firebase';
import { ref, onValue, push, set, remove } from 'firebase/database';
import { useAuth } from '../../hooks/useAuth';
import Avatar from '../common/Avatar';
import './LiveChat.css';

const REACTION_EMOJIS = ['❤️', '😂', '🔥', '😮', '👏', '👍', '👎'];

const LiveChat = ({ broadcasterId, isHost, compact = false, onPulse }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const messagesEndRef = useRef(null);
  const seenPulseIds = useRef(new Set());

  useEffect(() => {
    if (!broadcasterId) return undefined;
    const messagesRef = ref(db, `liveChat/${broadcasterId}/messages`);
    const unsub = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setMessages([]);
        return;
      }
      const msgs = Object.entries(data).map(([id, msg]) => ({ id, ...msg }));
      msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      msgs.forEach((m) => {
        if (m.type === 'reaction' && m.text && !seenPulseIds.current.has(m.id)) {
          seenPulseIds.current.add(m.id);
          if (Date.now() - (m.timestamp || 0) < 8000) onPulse?.(m.text);
        }
      });
      setMessages(msgs.filter((m) => m.type !== 'reaction'));
    });
    return () => unsub();
  }, [broadcasterId, onPulse]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !broadcasterId) return;
    const text = newMessage.trim().slice(0, 240);
    setNewMessage('');
    const msgRef = push(ref(db, `liveChat/${broadcasterId}/messages`));
    await set(msgRef, {
      senderId: user.uid,
      senderName: user.displayName || user.name || 'User',
      senderAvatar: user.avatar || '',
      text,
      type: 'text',
      timestamp: Date.now(),
      reactions: {},
    });
  };

  const sendPulse = async (emoji) => {
    if (!user || !broadcasterId) return;
    onPulse?.(emoji);
    const msgRef = push(ref(db, `liveChat/${broadcasterId}/messages`));
    await set(msgRef, {
      senderId: user.uid,
      senderName: user.displayName || user.name || 'User',
      senderAvatar: user.avatar || '',
      text: emoji,
      type: 'reaction',
      timestamp: Date.now(),
    });
  };

  const handleReact = async (messageId, emoji) => {
    if (!user || !broadcasterId) return;
    setShowReactionPicker(null);
    await set(ref(db, `liveChat/${broadcasterId}/messages/${messageId}/reactions/${user.uid}`), emoji);
  };

  const handleDelete = async (messageId) => {
    if (!broadcasterId || !messageId) return;
    await remove(ref(db, `liveChat/${broadcasterId}/messages/${messageId}`));
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`live-chat ${compact ? 'is-compact' : ''}`}>
      <div className="live-chat-messages">
        {messages.map((msg) => {
          const isOwn = user?.uid && msg.senderId === user.uid;
          const canDelete = Boolean(isHost || isOwn);
          const reactionGroups = {};
          Object.values(msg.reactions || {}).forEach((emoji) => {
            reactionGroups[emoji] = (reactionGroups[emoji] || 0) + 1;
          });
          return (
            <div key={msg.id} className={`live-chat-message ${isOwn ? 'is-own' : ''}`}>
              <Avatar src={msg.senderAvatar} name={msg.senderName} size={28} />
              <div className="live-chat-message-body">
                <div className="live-chat-message-header">
                  <span className="live-chat-message-name">{msg.senderName}</span>
                  <span className="live-chat-message-time">{formatTime(msg.timestamp)}</span>
                  {canDelete && (
                    <button className="live-chat-delete-btn" onClick={() => handleDelete(msg.id)} type="button" aria-label="Delete">
                      <i className="fas fa-trash-alt" />
                    </button>
                  )}
                  <button
                    className="live-chat-react-btn"
                    type="button"
                    onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}
                  >
                    <i className="fas fa-smile" />
                  </button>
                </div>
                <div className="live-chat-message-text">{msg.text}</div>
                {Object.keys(reactionGroups).length > 0 && (
                  <div className="live-chat-reactions">
                    {Object.entries(reactionGroups).map(([emoji, count]) => (
                      <span key={emoji} className="live-chat-reaction-badge">
                        {emoji} {count > 1 && count}
                      </span>
                    ))}
                  </div>
                )}
                {showReactionPicker === msg.id && (
                  <div className="live-chat-reaction-picker">
                    {REACTION_EMOJIS.map((emoji) => (
                      <button key={emoji} type="button" onClick={() => handleReact(msg.id, emoji)}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <div className="live-chat-pulses">
        {REACTION_EMOJIS.map((emoji) => (
          <button key={emoji} type="button" className="live-pulse-btn" onClick={() => sendPulse(emoji)}>
            {emoji}
          </button>
        ))}
      </div>
      <form className="live-chat-input" onSubmit={handleSend}>
        <input type="text" placeholder="Send a message..." value={newMessage} maxLength={240} onChange={(e) => setNewMessage(e.target.value)} />
        <button type="submit" disabled={!newMessage.trim()}><i className="fas fa-paper-plane" /></button>
      </form>
    </div>
  );
};

export default LiveChat;
