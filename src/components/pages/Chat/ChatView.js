// src/components/pages/Chat/ChatView.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../../../services/firebase';
import {
  ref,
  onValue,
  push,
  set,
  get,
  serverTimestamp,
} from 'firebase/database';
import { useAuth } from '../../../hooks/useAuth';
import { SkeletonMessage } from '../../common/SkeletonLoader';
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

  // Fetch current logged-in user profile
  useEffect(() => {
    if (!user?.uid) return;
    const myProfileRef = ref(db, `profiles/${user.uid}`);
    get(myProfileRef)
      .then((snap) => {
        if (snap.exists()) {
          setCurrentUserProfile(snap.val());
        }
      })
      .catch(console.error);
  }, [user?.uid]);

  // Load profile for title/state
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
          if (snap.exists()) {
            setPartnerProfile(snap.val());
          }
        })
        .catch(console.error);
    }
  }, [userId, isEchoAi]);

  // Fetch Realtime Messages
  useEffect(() => {
    if (!user?.uid || !userId) return;

    if (isEchoAi) {
      setMessages([
        {
          id: 'welcome_ai',
          senderId: 'echo_ai_assistant',
          text: 'Hello! I am ECHO AI. How can I assist you today?',
          timestamp: Date.now(),
        },
      ]);
      setLoadingMessages(false);
      return;
    }

    const chatId = [user.uid, userId].sort().join('_');
    const messagesRef = ref(db, `chats/${chatId}/messages`);

    get(messagesRef)
      .then((snapshot) => {
        if (!snapshot.exists()) {
          setMessages([]);
          setLoadingMessages(false);
        }
      })
      .catch(() => setLoadingMessages(false));

    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsed = Object.entries(data).map(([id, val]) => ({
          id,
          ...val,
        }));
        setMessages(parsed);
      } else {
        setMessages([]);
      }
      setLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [user?.uid, userId, isEchoAi]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user?.uid || !userId) return;

    const textToSend = newMessage.trim();
    setNewMessage('');

    // 1. ECHO AI LOGIC (LOCAL ONLY - NO FIREBASE WRITES)
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

    // 2. REGULAR CHAT LOGIC (FIREBASE WRITES)
    try {
      const chatId = [user.uid, userId].sort().join('_');
      const timestamp = Date.now();

      // A. Push message to database
      const messagesRef = ref(db, `chats/${chatId}/messages`);
      const newMsgRef = push(messagesRef);

      await set(newMsgRef, {
        senderId: user.uid,
        text: textToSend,
        timestamp: serverTimestamp(),
      });

      // B. UPDATE MY `userChats` INDEX
      const myChatRef = ref(db, `userChats/${user.uid}/${userId}`);
      await set(myChatRef, {
        id: userId,
        partnerName:
          location.state?.userName ||
          partnerProfile?.name ||
          partnerProfile?.displayName ||
          'User',
        partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '',
        lastMessage: textToSend,
        lastSenderId: user.uid,
        lastUpdated: timestamp,
        unreadCount: 0,
      });

      // C. UPDATE RECIPIENT'S `userChats` INDEX
      const recipientChatRef = ref(db, `userChats/${userId}/${user.uid}`);
      await set(recipientChatRef, {
        id: user.uid,
        partnerName:
          currentUserProfile?.name ||
          currentUserProfile?.displayName ||
          currentUserProfile?.username ||
          'User',
        partnerAvatar: currentUserProfile?.avatar || '',
        lastMessage: textToSend,
        lastSenderId: user.uid,
        lastUpdated: timestamp,
        unreadCount: 1,
      });
    } catch (err) {
      console.error('Failed to send message and update recent chats:', err);
    }
  };

  const displayName = isEchoAi
    ? 'ECHO AI'
    : sanitizeName(location.state?.userName || partnerProfile?.name, userId);

  return (
    <div className="chat-view">
      {/* ── MESSAGES CONTAINER ── */}
      <div className="messages-container">
        {loadingMessages ? (
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

      {/* ── TYPING INPUT BAR ── */}
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