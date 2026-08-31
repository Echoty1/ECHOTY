// src/components/VideoChat/LiveChat.jsx
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../services/firebase';
import { ref, onValue, push, set, remove } from 'firebase/database';
import { useAuth } from '../../hooks/useAuth';
import { sortMessages } from '../../utils/sortMessages';
import Avatar from '../common/Avatar';
import MessageMenu from '../pages/Chat/MessageMenu';
import './LiveChat.css';

const REACTION_EMOJIS = ['❤️', '😂', '🔥', '😮', '👏', '👍', '👎'];

const LiveChat = ({ broadcasterId, isHost, compact = false, onPulse }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const seenPulseIds = useRef(new Set());
  const [deletingMessageId, setDeletingMessageId] = useState(null);

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
      const ordered = sortMessages(msgs);
      ordered.forEach((m) => {
        if (m.type === 'reaction' && m.text && !seenPulseIds.current.has(m.id)) {
          seenPulseIds.current.add(m.id);
          if (Date.now() - (m.timestamp || 0) < 8000) onPulse?.(m.text);
        }
      });
      setMessages(ordered.filter((m) => m.type !== 'reaction'));
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

  const handleDelete = async (messageId) => {
    if (!broadcasterId || !messageId) return;
    setDeletingMessageId(messageId);
    await new Promise(resolve => setTimeout(resolve, 300));
    await remove(ref(db, `liveChat/${broadcasterId}/messages/${messageId}`));
    setDeletingMessageId(null);
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = (msg) => {
    const isOwn = user?.uid && msg.senderId === user.uid;
    // Host (broadcaster) can delete anyone's message, users can delete their own
    const canDelete = Boolean(isHost || isOwn);

    const senderName = msg.senderName || 'User';
    const senderAvatar = msg.senderAvatar || '';

    return (
      <div key={msg.id} className={`message-row ${isOwn ? 'own' : 'partner'} ${Date.now() - (msg.timestamp || 0) < 1600 ? (isOwn ? 'just-sent' : 'just-received') : ''} ${deletingMessageId === msg.id ? 'deleting' : ''}`}>
        {!isOwn && (
          <div className="message-sender-info">
            <Avatar src={senderAvatar} name={senderName} size={24} />
            <span className="message-sender-name">{senderName}</span>
            <span className="message-sender-time">{formatTime(msg.timestamp)}</span>
          </div>
        )}
        <div className={`message-bubble ${isOwn ? 'own' : 'partner'}`}>
          <MessageMenu
            isOwn={isOwn}
            canDelete={canDelete}
            onDelete={() => handleDelete(msg.id)}
            onReply={null}
            onReact={null}
            copyText={null}
          >
            <div className="live-message-content">
              <div className="message-text">{msg.text}</div>
            </div>
          </MessageMenu>
        </div>
        {isOwn && (
          <div className="message-meta-time own-time">{formatTime(msg.timestamp)}</div>
        )}
      </div>
    );
  };

  return (
    <div className={`live-chat ${compact ? 'is-compact' : ''}`}>
      <div className="live-chat-messages">
        {messages.length === 0 ? (
          <div className="live-chat-empty">No messages yet. Say hi!</div>
        ) : (
          sortMessages(messages).map((msg) => renderMessage(msg))
        )}
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
        <input
          type="text"
          placeholder="Send a message..."
          value={newMessage}
          maxLength={240}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button type="submit" disabled={!newMessage.trim()}>
          <i className="fas fa-paper-plane" />
        </button>
      </form>
    </div>
  );
};

export default LiveChat;
