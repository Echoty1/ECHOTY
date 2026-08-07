// src/components/Chat/ChatView.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { db } from '../../services/firebase';
import {
  ref,
  push,
  onChildAdded,
  onValue,
  update,
  set,
  get,
  serverTimestamp,
} from 'firebase/database';
import ECHOMOJI from '../UI/ECHOMOJI';
import { getSkinById } from '../../constants/echomoji';
import './ChatView.css';

const ChatView = () => {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [partnerProfile, setPartnerProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Get partner name from location state if available
  const partnerNameFromState = location.state?.userName || 'User';

  // ─── Load partner profile ──────────────────────────────────
  useEffect(() => {
    if (!user || !userId) return;

    const profileRef = ref(db, `profiles/${userId}`);
    const unsubscribe = onValue(profileRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPartnerProfile({
          ...data,
          name: data.name || data.username || data.displayName || userId,
          uid: userId,
        });
      } else {
        // Fallback
        setPartnerProfile({
          name: partnerNameFromState || userId,
          uid: userId,
          avatar: '',
          mood: 'neutral',
          activeSkin: null,
        });
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userId, partnerNameFromState, user]);

  // ─── Presence (online/offline) ────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const presenceRef = ref(db, `presence/online/${userId}`);
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      const online = snapshot.val() === true;
      setIsOnline(online);
    });
    return () => unsubscribe();
  }, [userId]);

  // ─── Load messages ──────────────────────────────────────────
  useEffect(() => {
    if (!user || !userId) return;

    const chatId = [user.uid, userId].sort().join('_');
    const messagesRef = ref(db, `messages/${chatId}`);

    // Listen for new messages
    const unsubscribe = onChildAdded(messagesRef, (snapshot) => {
      const data = snapshot.val();
      setMessages((prev) => [
        ...prev,
        {
          id: snapshot.key,
          ...data,
        },
      ]);
      // Auto-scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    // Load initial messages (optional – onChildAdded handles all)
    // But we can also get existing messages once
    return () => unsubscribe();
  }, [user, userId]);

  // ─── Scroll to bottom on new messages ──────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Send message ───────────────────────────────────────────
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !userId) return;

    const chatId = [user.uid, userId].sort().join('_');
    const messagesRef = ref(db, `messages/${chatId}`);
    const messageData = {
      senderId: user.uid,
      text: newMessage.trim(),
      timestamp: serverTimestamp(),
    };

    try {
      // Push message
      await push(messagesRef, messageData);

      // Update userChats for both users
      const senderChatRef = ref(db, `userChats/${user.uid}/${userId}`);
      const receiverChatRef = ref(db, `userChats/${userId}/${user.uid}`);

      const chatUpdate = {
        lastMessage: newMessage.trim(),
        lastUpdated: serverTimestamp(),
        partnerName: partnerProfile?.name || userId,
        partnerAvatar: partnerProfile?.avatar || '',
      };

      await update(senderChatRef, chatUpdate);
      await update(receiverChatRef, {
        ...chatUpdate,
        partnerName: user?.displayName || user?.name || 'User',
        partnerAvatar: user?.avatar || '',
      });

      setNewMessage('');
      inputRef.current?.focus();
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  // ─── Get EchoMoji for partner ──────────────────────────────
  const getPartnerEchomoji = () => {
    if (!partnerProfile) return null;
    const mood = partnerProfile.mood || 'neutral';
    const skinId = partnerProfile.activeSkin;
    const skin = skinId ? getSkinById(skinId) : null;
    return { mood, skin };
  };

  // ─── Loading state ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="chat-loading">
        <div className="loading-spinner" />
        <span>Loading conversation...</span>
      </div>
    );
  }

  const partnerName = partnerProfile?.name || partnerNameFromState || userId;
  const partnerInitial = partnerName[0]?.toUpperCase() || 'U';
  const echomoji = getPartnerEchomoji();

  return (
    <div className="chat-view">
      {/* ─── Header ────────────────────────────────────────────── */}
      <div className="chat-header">
        <button className="chat-back" onClick={() => navigate('/chats')}>
          ←
        </button>
        <div className="chat-partner-info">
          <div className="chat-avatar-container">
            {partnerProfile?.avatar ? (
              <img
                src={partnerProfile.avatar}
                alt={partnerName}
                className="chat-avatar-img"
              />
            ) : (
              <div className="chat-avatar-placeholder">
                {partnerInitial}
              </div>
            )}
            <span className={`chat-presence-dot ${isOnline ? 'online' : 'offline'}`} />
          </div>
          <div className="chat-partner-details">
            <span className="chat-partner-name">{partnerName}</span>
            <span className="chat-partner-status">
              {isOnline ? '🟢 Online' : '🔴 Offline'}
            </span>
          </div>
          {echomoji && (
            <div className="chat-echomoji">
              <ECHOMOJI
                mood={echomoji.mood}
                skin={echomoji.skin}
                size={40}
                interactive={false}
              />
            </div>
          )}
        </div>
      </div>

      {/* ─── Messages ──────────────────────────────────────────── */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <span>💬</span>
            <p>No messages yet</p>
            <span className="chat-empty-sub">Say hello to start the conversation</span>
          </div>
        ) : (
          messages.map((msg) => {
            const isSender = msg.senderId === user?.uid;
            return (
              <div
                key={msg.id}
                className={`chat-message ${isSender ? 'sent' : 'received'}`}
              >
                <div className="chat-bubble">
                  {!isSender && (
                    <div className="chat-sender-avatar">
                      {partnerProfile?.avatar ? (
                        <img src={partnerProfile.avatar} alt="" />
                      ) : (
                        partnerInitial
                      )}
                    </div>
                  )}
                  <div className="chat-text">{msg.text}</div>
                </div>
                <div className="chat-time">
                  {msg.timestamp
                    ? new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ─── Input ─────────────────────────────────────────────── */}
      <form className="chat-input-form" onSubmit={sendMessage}>
        <input
          ref={inputRef}
          type="text"
          className="chat-input"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button type="submit" className="chat-send-btn" disabled={!newMessage.trim()}>
          <i className="fas fa-paper-plane" />
        </button>
      </form>
    </div>
  );
};

export default ChatView;c