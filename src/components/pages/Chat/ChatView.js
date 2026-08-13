// src/components/pages/Chat/ChatView.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../../../services/firebase';
import {
  ref,
  onValue,
  push,
  set,
  update,
  get,
  serverTimestamp,
  runTransaction,
} from 'firebase/database';
import { useAuth } from '../../../hooks/useAuth';
import { SkeletonMessage } from '../../common/SkeletonLoader';
import { getCache, setCache } from '../../../services/cacheService';
import './ChatView.css';

const ECHO_AI_AVATAR = '/videos/library/Artificial Intelligence Ai GIF by Abdi Slick.gif';

const sanitizeName = (rawName, userId) => {
  if (!rawName) return 'User';
  const str = String(rawName).trim();
  if (
    str === userId ||
    (str.length >= 20 && !str.includes(' ') && /^[a-zA-Z0-9_-]+$/.test(str))
  ) {
    return 'User';
  }
  return str;
};

const ChatView = () => {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isEchoAi = userId === 'echo_ai_assistant';

  const [partnerProfile, setPartnerProfile] = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(true);

  const messagesEndRef = useRef(null);
  const chatId = useRef(null);

  // Cache key for this chat's messages
  const cacheKey = `messages_${user?.uid}_${userId}`;
  const isMounted = useRef(true);

  // ── Helper: Mark all messages as read for this chat ──
  const markMessagesAsRead = async () => {
    if (!user?.uid || !userId || isEchoAi) return;
    const cId = [user.uid, userId].sort().join('_');
    const messagesRef = ref(db, `chats/${cId}/messages`);

    try {
      const snapshot = await get(messagesRef);
      if (!snapshot.exists()) return;
      const data = snapshot.val();
      const updates = {};
      let hasUnread = false;
      Object.entries(data).forEach(([key, msg]) => {
        if (msg.receiverId === user.uid && msg.isRead === false) {
          updates[`chats/${cId}/messages/${key}/isRead`] = true;
          hasUnread = true;
        }
      });

      if (!hasUnread) return;

      await update(ref(db), updates);

      const myChatRef = ref(db, `userChats/${user.uid}/${userId}`);
      await set(myChatRef, {
        id: userId,
        partnerName: location.state?.userName || partnerProfile?.name || 'User',
        partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '',
        lastMessage: messages.length > 0 ? messages[messages.length - 1]?.text || '' : '',
        lastSenderId: messages.length > 0 ? messages[messages.length - 1]?.senderId || '' : '',
        lastUpdated: Date.now(),
        unreadCount: 0,
      });
    } catch (err) {
      console.warn('markMessagesAsRead error:', err);
    }
  };

  // ─── Stale‑while‑revalidate for messages ────────────────────
  useEffect(() => {
    if (!user?.uid || !userId) return;
    isMounted.current = true;

    // 1. Load from cache instantly
    const cached = getCache(cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      setMessages(cached);
      setLoadingMessages(false);
    }

    // 2. Real‑time listener
    const cId = [user.uid, userId].sort().join('_');
    chatId.current = cId;
    const messagesRef = ref(db, `chats/${cId}/messages`);

    const unsubscribe = onValue(messagesRef, (snapshot) => {
      if (!isMounted.current) return;
      const data = snapshot.val();
      let newMessages = [];
      if (data) {
        newMessages = Object.entries(data)
          .map(([id, val]) => ({ id, ...val }))
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      }
      setMessages(newMessages);
      setLoadingMessages(false);
      setCache(cacheKey, newMessages);

      // Auto‑mark any new incoming message as read (with defensive checks)
      const latest = newMessages[newMessages.length - 1];
      if (
        latest &&
        latest.receiverId === user.uid &&
        latest.isRead === false
      ) {
        const msgRef = ref(db, `chats/${cId}/messages/${latest.id}`);
        // Defensive: ensure `set` returns a promise-like value
        try {
          const promise = set(msgRef, { ...latest, isRead: true });
          if (promise && typeof promise.then === 'function') {
            promise
              .then(() => {
                const myChatRef = ref(db, `userChats/${user.uid}/${userId}`);
                return set(myChatRef, {
                  id: userId,
                  partnerName: location.state?.userName || partnerProfile?.name || 'User',
                  partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '',
                  lastMessage: latest.text,
                  lastSenderId: latest.senderId,
                  lastUpdated: Date.now(),
                  unreadCount: 0,
                });
              })
              .catch((err) => console.warn('Auto‑mark read error:', err));
          } else {
            console.warn('set() did not return a Promise, skipping auto‑mark');
          }
        } catch (err) {
          console.warn('Auto‑mark read exception:', err);
        }
      }
    });

    return () => {
      isMounted.current = false;
      unsubscribe();
    };
  }, [user?.uid, userId, cacheKey]);

  // ── Mark as read on mount ──
  useEffect(() => {
    if (!user?.uid || !userId || isEchoAi) return;
    markMessagesAsRead();
  }, [user?.uid, userId, isEchoAi]);

  // ── Fetch profiles ──
  useEffect(() => {
    if (!user?.uid) return;
    const myProfileRef = ref(db, `profiles/${user.uid}`);
    get(myProfileRef)
      .then((snap) => {
        if (snap.exists()) setCurrentUserProfile(snap.val());
      })
      .catch(console.error);
  }, [user?.uid]);

  useEffect(() => {
    if (isEchoAi) {
      setPartnerProfile({
        name: 'ECHO AI',
        avatar: ECHO_AI_AVATAR,
        mood: 'happy',
        isAi: true,
      });
      return;
    }
    if (userId) {
      const pRef = ref(db, `profiles/${userId}`);
      get(pRef)
        .then((snap) => {
          if (snap.exists()) setPartnerProfile(snap.val());
        })
        .catch(console.error);
    }
  }, [userId, isEchoAi]);

  // ── Scroll to bottom ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Handle sending message ──
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user?.uid || !userId) return;

    const textToSend = newMessage.trim();
    setNewMessage('');

    // 1. ECHO AI (local only)
    if (isEchoAi || userId === 'echo_ai_assistant') {
      const userMsg = {
        id: Date.now().toString(),
        senderId: user.uid,
        text: textToSend,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setTimeout(() => {
        const aiMsg = {
          id: (Date.now() + 1).toString(),
          senderId: 'echo_ai_assistant',
          text: 'I am currently under Production',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      }, 600);
      return;
    }

    // 2. Regular chat
    try {
      const cId = [user.uid, userId].sort().join('_');
      const timestamp = Date.now();

      const messagesRef = ref(db, `chats/${cId}/messages`);
      const newMsgRef = push(messagesRef);
      await set(newMsgRef, {
        senderId: user.uid,
        receiverId: userId,
        text: textToSend,
        timestamp: serverTimestamp(),
        isRead: false,
      });

      // Update sender's userChats
      const myChatRef = ref(db, `userChats/${user.uid}/${userId}`);
      await set(myChatRef, {
        id: userId,
        partnerName: location.state?.userName || partnerProfile?.name || 'User',
        partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '',
        lastMessage: textToSend,
        lastSenderId: user.uid,
        lastUpdated: timestamp,
        unreadCount: 0,
      });

      // Update recipient's userChats (increment unreadCount)
      const recipientChatRef = ref(db, `userChats/${userId}/${user.uid}`);
      await runTransaction(recipientChatRef, (currentData) => {
        if (currentData === null) {
          return {
            id: user.uid,
            partnerName: currentUserProfile?.name || 'User',
            partnerAvatar: currentUserProfile?.avatar || '',
            lastMessage: textToSend,
            lastSenderId: user.uid,
            lastUpdated: timestamp,
            unreadCount: 1,
          };
        } else {
          currentData.unreadCount = (currentData.unreadCount || 0) + 1;
          currentData.lastMessage = textToSend;
          currentData.lastSenderId = user.uid;
          currentData.lastUpdated = timestamp;
          currentData.partnerName = currentUserProfile?.name || currentData.partnerName || 'User';
          currentData.partnerAvatar = currentUserProfile?.avatar || currentData.partnerAvatar || '';
          return currentData;
        }
      });
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const displayName = isEchoAi
    ? 'ECHO AI'
    : sanitizeName(location.state?.userName || partnerProfile?.name, userId);

  return (
    <div className="chat-view">
      <div className="messages-container">
        {loadingMessages && messages.length === 0 ? (
          <div className="chat-skeleton-list">
            <SkeletonMessage isOwn={false} />
            <SkeletonMessage isOwn={true} />
            <SkeletonMessage isOwn={false} />
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-chat-state">
            <i className="fas fa-paper-plane empty-icon" />
            <p>No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.senderId === user?.uid;
            return (
              <div
                key={msg.id}
                className={`message-bubble ${isOwn ? 'own' : 'partner'}`}
              >
                <div className="message-text">{msg.text}</div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-container" onSubmit={handleSendMessage}>
        <input
          type="text"
          className="chat-input"
          placeholder={`Message ${displayName}...`}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={!newMessage.trim()}
        >
          <i className="fas fa-paper-plane" />
        </button>
      </form>
    </div>
  );
};

export default ChatView;