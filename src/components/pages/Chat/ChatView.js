// src/components/pages/Chat/ChatView.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../../../services/firebase';
import {
  ref,
  query,
  orderByChild,
  limitToLast,
  onChildAdded,
  onValue,
  update,
  push,
  set,
  get,
  serverTimestamp,
  onDisconnect,
} from 'firebase/database';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../contexts/ProfileContext';
import ECHOMOJI from '../../UI/ECHOMOJI';
import { getSkinById } from '../../../constants/echomoji';
import Modal from '../../common/Modal';
import { removeChat, markChatAsKept } from '../../../services/accountCleanup';
import { useInfiniteScroll } from '../../../hooks/useInfiniteScroll';
import { getCache, setCache } from '../../../services/cacheService';
import { SkeletonMessage } from '../../common/SkeletonLoader';
import './ChatView.css';

const CHUNK_SIZE = 25;

const ChatView = () => {
  const { userId } = useParams();
  const { user } = useAuth();
  const { profiles, fetchProfile } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();

  // ─── Get name from navigation state ─────────────────────
  const cachedName = location.state?.userName || 'User';
  const cachedAvatar = location.state?.userAvatar || '';

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [oldestTimestamp, setOldestTimestamp] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const [keptPartnerName, setKeptPartnerName] = useState('');

  // ─── Partner state – initialised immediately with cached data ──
  const [partner, setPartner] = useState({
    uid: userId,
    name: cachedName,
    avatar: cachedAvatar,
    mood: 'neutral',
    activeSkin: null,
    online: false,
    isPlaceholder: true,
  });

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const isActive = useRef(true);
  const chatId = [user?.uid, userId].sort().join('_');
  const chatCacheKey = `chat_${chatId}`;

  // ─── Active state & presence ──────────────────────────────
  useEffect(() => {
    if (!user || !userId) return;
    isActive.current = true;
    const presenceRef = ref(db, `presence/chat/${chatId}/${user.uid}`);
    set(presenceRef, true);
    onDisconnect(presenceRef).set(false);
    return () => {
      isActive.current = false;
      set(presenceRef, false);
    };
  }, [user, userId, chatId]);

  // ─── Check partner profile and read‑only status ────────────
  useEffect(() => {
    if (!user || !userId) return;

    // We already have the cached name, so we can hide loading immediately.
    setLoading(false);

    const profileRef = ref(db, `profiles/${userId}`);
    const unsubscribe = onValue(
      profileRef,
      async (snapshot) => {
        const data = snapshot.val();
        if (data) {
          // Update partner with fresh data
          setPartner({
            uid: userId,
            name: data.name || data.username || data.displayName || cachedName || userId,
            avatar: data.avatar || cachedAvatar,
            mood: data.mood || 'neutral',
            activeSkin: data.activeSkin || null,
            online: data.online || false,
            isPlaceholder: false,
            ...data,
          });
          setIsReadOnly(false);
          return;
        }

        // Partner profile missing → check if already kept
        try {
          const chatEntryRef = ref(db, `userChats/${user.uid}/${userId}`);
          const chatSnap = await get(chatEntryRef);
          const chatData = chatSnap.val();
          if (chatData?.partnerDeleted === true) {
            setIsReadOnly(true);
            setKeptPartnerName(chatData.partnerName || 'Deleted Account');
            setPartner((prev) => ({
              ...prev,
              name: chatData.partnerName || cachedName || 'Deleted Account',
              isPlaceholder: false,
            }));
          } else {
            setShowDeletedModal(true);
          }
        } catch (err) {
          console.error('Error checking chat status:', err);
        }
      },
      (error) => {
        console.warn('Profile listener error, keeping cached name:', error);
      }
    );

    return () => unsubscribe();
  }, [userId, user, cachedName, cachedAvatar]);

  // ─── Reset unread count ────────────────────────────────────
  useEffect(() => {
    if (!user || !userId || isReadOnly) return;
    const myChatRef = ref(db, `userChats/${user.uid}/${userId}`);
    get(myChatRef).then((snap) => {
      if (snap.exists()) {
        update(myChatRef, { unreadCount: 0 }).catch(() => {});
      }
    }).catch(() => {});
  }, [user, userId, isReadOnly]);

  // ─── Load messages with pagination ──────────────────────────
  const loadMessages = useCallback(async (loadMore = false) => {
    if (!chatId || !user) return;
    if (isLoadingMore) return;

    setIsLoadingMore(true);

    try {
      const messagesRef = ref(db, `messages/${chatId}`);
      let q;

      if (loadMore && oldestTimestamp) {
        // Load older messages (before oldest)
        q = query(
          messagesRef,
          orderByChild('timestamp'),
          endAt(oldestTimestamp - 1),
          limitToLast(CHUNK_SIZE)
        );
      } else {
        // Load latest messages
        q = query(
          messagesRef,
          orderByChild('timestamp'),
          limitToLast(CHUNK_SIZE)
        );
      }

      const snapshot = await get(q);
      const data = snapshot.val();

      if (!data) {
        if (loadMore) setHasMore(false);
        setLoading(false);
        setIsLoadingMore(false);
        return [];
      }

      const messageList = Object.entries(data)
        .map(([id, msg]) => ({
          id,
          ...msg,
          timestamp: msg.timestamp || Date.now(),
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      if (messageList.length < CHUNK_SIZE) {
        setHasMore(false);
      }

      // Update oldest timestamp for next load
      if (messageList.length > 0) {
        setOldestTimestamp(messageList[0].timestamp);
      }

      if (loadMore) {
        // Prepend older messages
        setMessages(prev => [...messageList, ...prev]);
      } else {
        // Replace with latest messages
        setMessages(messageList);
        // Cache messages for instant load next time
        await setCache(chatCacheKey, messageList, 300);
        // Scroll to bottom
        setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
          }
        }, 100);
      }

      setLoading(false);
      setIsLoadingMore(false);
      return messageList;
    } catch (error) {
      console.error('Error loading messages:', error);
      setLoading(false);
      setIsLoadingMore(false);
      return [];
    }
  }, [chatId, user, oldestTimestamp, isLoadingMore]);

  // ─── Initial load with cache ──────────────────────────────────
  useEffect(() => {
    if (!chatId || !user) return;

    const loadInitial = async () => {
      // Try cache first (instant)
      const cached = await getCache(chatCacheKey);
      if (cached && cached.length > 0) {
        setMessages(cached);
        setLoading(false);
        if (cached.length > 0) {
          setOldestTimestamp(cached[0].timestamp);
        }
        if (cached.length < CHUNK_SIZE) {
          setHasMore(false);
        }
        // Still fetch fresh data in background
        loadMessages(false);
      } else {
        await loadMessages(false);
      }
    };

    loadInitial();

    // ─── Real-time listener for new messages ──────────────────
    const messagesRef = ref(db, `messages/${chatId}`);
    const latestQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(1));

    const unsubscribe = onChildAdded(latestQuery, (snapshot) => {
      const msg = snapshot.val();
      if (!msg) return;

      const newMsg = {
        id: snapshot.key,
        ...msg,
        timestamp: msg.timestamp || Date.now(),
      };

      // Check if message already exists
      setMessages(prev => {
        const exists = prev.some(m => m.id === newMsg.id);
        if (exists) return prev;
        return [...prev, newMsg];
      });

      // Update cache with new message
      const updatedMessages = [...messages, newMsg];
      setCache(chatCacheKey, updatedMessages, 300);

      // Scroll to bottom on new message (if not scrolling up)
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    });

    return () => unsubscribe();
  }, [chatId, user]);

  // ─── Infinite scroll ──────────────────────────────────────────
  const { containerRef, setHasMore: setScrollHasMore } = useInfiniteScroll(
    async () => {
      if (!hasMore || isLoadingMore) return;
      await loadMessages(true);
    },
    300,
    [hasMore, isLoadingMore]
  );

  useEffect(() => {
    setScrollHasMore(hasMore);
  }, [hasMore]);

  // ─── Send message ───────────────────────────────────────────
  const sendMessage = async () => {
    if (isReadOnly || !input.trim() || !user || !userId) return;

    const messageText = input.trim();
    setInput('');

    const chatRef = ref(db, `messages/${chatId}`);
    const newMessageRef = push(chatRef);
    const messageData = {
      senderId: user.uid,
      text: messageText,
      timestamp: serverTimestamp(),
      read: false,
    };

    try {
      await set(newMessageRef, messageData);

      // Update sender's userChats
      const partnerName = partner?.name || userId;
      const partnerAvatar = partner?.avatar || '';
      const myChatRef = ref(db, `userChats/${user.uid}/${userId}`);
      await update(myChatRef, {
        lastMessage: messageText,
        lastSenderId: user.uid,
        lastUpdated: serverTimestamp(),
        partnerName,
        partnerAvatar,
        unreadCount: 0,
      });

      // Update receiver's userChats
      const receiverPresenceRef = ref(db, `presence/chat/${chatId}/${userId}`);
      const presenceSnap = await get(receiverPresenceRef);
      const isReceiverActive = presenceSnap.val() === true;

      const receiverChatRef = ref(db, `userChats/${userId}/${user.uid}`);
      const receiverSnap = await get(receiverChatRef);
      const currentUnread = receiverSnap.val()?.unreadCount || 0;
      const newUnread = isReceiverActive ? 0 : currentUnread + 1;

      await update(receiverChatRef, {
        lastMessage: messageText,
        lastSenderId: user.uid,
        lastUpdated: serverTimestamp(),
        partnerName: user?.displayName || user?.email?.split('@')[0] || 'User',
        partnerAvatar: user?.photoURL || '',
        unreadCount: newUnread,
      });
    } catch (err) {
      console.error('❌ Error sending message:', err);
      setInput(messageText);
    }
  };

  // ─── Mark messages as read ──────────────────────────────────
  useEffect(() => {
    if (!userId || messages.length === 0 || isReadOnly) return;
    const unreadMessages = messages.filter(
      (msg) => msg.senderId === userId && !msg.read
    );
    if (unreadMessages.length === 0) return;
    const updates = {};
    unreadMessages.forEach((msg) => {
      updates[`messages/${chatId}/${msg.id}/read`] = true;
    });
    update(ref(db), updates).catch((err) =>
      console.warn('Error marking read:', err)
    );
  }, [messages, userId, chatId, isReadOnly]);

  // ─── Modal handlers ────────────────────────────────────────
  const handleKeepChat = async () => {
    setShowDeletedModal(false);
    const name = partner?.name || userId;
    await markChatAsKept(user.uid, userId, name);
    setIsReadOnly(true);
    setKeptPartnerName(name);
  };

  const handleDeleteChat = async () => {
    setShowDeletedModal(false);
    if (user && userId) {
      await removeChat(user.uid, userId);
    }
    navigate('/chats');
  };

  // ─── Loading state ──────────────────────────────────────────
  if (loading && messages.length === 0) {
    return (
      <div style={{ padding: '16px', paddingTop: '70px', maxWidth: '480px', margin: '0 auto' }}>
        {[...Array(8)].map((_, i) => (
          <SkeletonMessage key={i} />
        ))}
      </div>
    );
  }

  // ─── Modal actions ─────────────────────────────────────────
  const modalActions = (
    <>
      <button
        onClick={handleKeepChat}
        style={{
          padding: '10px 24px',
          borderRadius: '50px',
          background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
          border: 'none',
          color: '#fff',
          fontWeight: 600,
          fontSize: '14px',
          cursor: 'pointer',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        Keep
      </button>
      <button
        onClick={handleDeleteChat}
        style={{
          padding: '10px 24px',
          borderRadius: '50px',
          background: '#EF4444',
          border: 'none',
          color: '#fff',
          fontWeight: 600,
          fontSize: '14px',
          cursor: 'pointer',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        Delete
      </button>
    </>
  );

  // ─── Main render ────────────────────────────────────────────
  const displayName = partner?.name || cachedName || 'User';

  return (
    <div className="chat-view">
      <Modal
        isOpen={showDeletedModal}
        onClose={() => {}}
        title="Account Deleted"
        message="This user has deleted their account. Would you like to keep this chat as a read‑only archive, or delete it?"
        type="warning"
        actions={modalActions}
      />

      {/* Header */}
      <div className="chat-header">
        <button className="back-btn" onClick={() => navigate('/chats')}>←</button>
        <div className="partner-info">
          {partner && !partner.isPlaceholder ? (
            <ECHOMOJI
              mood={partner.mood || 'neutral'}
              skin={partner.activeSkin ? getSkinById(partner.activeSkin) : null}
              size={40}
              interactive={false}
            />
          ) : (
            <div className="avatar-placeholder" style={{ backgroundColor: '#6C3CE1', color: '#fff', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600 }}>
              {displayName[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <div className="partner-details">
            <span className="partner-name">{displayName}</span>
            <span className="partner-status">
              {isReadOnly ? 'Archived' : partner?.online ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container" ref={containerRef}>
        {isLoadingMore && (
          <div className="loading-more">Loading older messages...</div>
        )}
        {!hasMore && messages.length > 0 && (
          <div className="no-more-messages">Beginning of conversation</div>
        )}

        {messages.length === 0 ? (
          <div className="chat-empty">
            <span>💬</span>
            <p>No messages yet</p>
            <span className="chat-empty-sub">
              {isReadOnly ? 'This chat is archived.' : 'Say hello to start the conversation'}
            </span>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`message ${msg.senderId === user?.uid ? 'sent' : 'received'}`}
            >
              <div className="message-bubble">
                <span className="message-text">{msg.text}</span>
                <span className="message-time">
                  {msg.timestamp
                    ? new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {!isReadOnly ? (
        <form className="chat-input-form" onSubmit={(e) => { e.preventDefault(); sendMessage(); }}>
          <input
            type="text"
            className="chat-input"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" className="chat-send-btn" disabled={!input.trim()}>
            <i className="fas fa-paper-plane" />
          </button>
        </form>
      ) : (
        <div className="chat-readonly-banner">
          <i className="fas fa-lock" /> This conversation is archived (account deleted).
        </div>
      )}
    </div>
  );
};

export default ChatView;