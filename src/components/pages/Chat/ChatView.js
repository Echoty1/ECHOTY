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
      if (snap.exists() && snap.val()?.unreadCount > 0) {
        update(myChatRef, { unreadCount: 0 }).catch(console.error);
      }
    });
  }, [user, userId, isReadOnly]);

  // ─── Auto Scroll to Bottom ─────────────────────────────────
  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // ─── Load Initial Messages (Cached + Realtime) ──────────────
  useEffect(() => {
    if (!user || !userId) return;

    let isMounted = true;

    const loadInitialMessages = async () => {
      const cachedData = await getCache(chatCacheKey);
      if (cachedData && isMounted) {
        setMessages(cachedData.messages || []);
        setOldestTimestamp(cachedData.oldestTimestamp || null);
        setHasMore(cachedData.hasMore ?? true);
        setTimeout(() => scrollToBottom('auto'), 50);
      }

      const messagesRef = ref(db, `messages/${chatId}`);
      const initialQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(CHUNK_SIZE));

      get(initialQuery).then((snapshot) => {
        if (!isMounted) return;
        const data = snapshot.val();
        if (data) {
          const msgList = Object.entries(data)
            .map(([id, val]) => ({ id, ...val }))
            .sort((a, b) => a.timestamp - b.timestamp);

          setMessages(msgList);
          if (msgList.length > 0) {
            setOldestTimestamp(msgList[0].timestamp);
          }
          if (msgList.length < CHUNK_SIZE) {
            setHasMore(false);
          }

          setCache(chatCacheKey, {
            messages: msgList,
            oldestTimestamp: msgList.length > 0 ? msgList[0].timestamp : null,
            hasMore: msgList.length >= CHUNK_SIZE,
          });
        } else {
          setHasMore(false);
        }
        setTimeout(() => scrollToBottom('auto'), 50);
      });
    };

    loadInitialMessages();

    // Listen for new incoming messages
    const messagesRef = ref(db, `messages/${chatId}`);
    const newMsgQuery = query(messagesRef, orderByChild('timestamp'), limitToLast(1));
    const unsubscribeNew = onChildAdded(newMsgQuery, (snapshot) => {
      if (!isMounted) return;
      const newMsg = { id: snapshot.key, ...snapshot.val() };
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        const updated = [...prev, newMsg];
        setCache(chatCacheKey, {
          messages: updated,
          oldestTimestamp: updated[0]?.timestamp || null,
          hasMore: hasMore,
        });
        return updated;
      });
      setTimeout(() => scrollToBottom('smooth'), 100);
    });

    return () => {
      isMounted = false;
      unsubscribeNew();
    };
  }, [user, userId, chatId, chatCacheKey]);

  // ─── Pagination: Load older messages ───────────────────────
  const loadMoreMessages = useCallback(async () => {
    if (!hasMore || isLoadingMore || !oldestTimestamp) return;

    setIsLoadingMore(true);
    try {
      const messagesRef = ref(db, `messages/${chatId}`);
      const olderQuery = query(
        messagesRef,
        orderByChild('timestamp'),
        limitToLast(CHUNK_SIZE + 1)
      );

      const snapshot = await get(olderQuery);
      const data = snapshot.val();

      if (data) {
        const olderList = Object.entries(data)
          .map(([id, val]) => ({ id, ...val }))
          .filter((m) => m.timestamp < oldestTimestamp)
          .sort((a, b) => a.timestamp - b.timestamp);

        if (olderList.length > 0) {
          setMessages((prev) => {
            const combined = [...olderList, ...prev];
            setCache(chatCacheKey, {
              messages: combined,
              oldestTimestamp: olderList[0].timestamp,
              hasMore: olderList.length >= CHUNK_SIZE,
            });
            return combined;
          });
          setOldestTimestamp(olderList[0].timestamp);
        } else {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading older messages:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, oldestTimestamp, chatId, chatCacheKey]);

  const { containerRef } = useInfiniteScroll(loadMoreMessages, 100, [
    hasMore,
    isLoadingMore,
    oldestTimestamp,
  ]);

  // ─── Send Message ──────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || !user || !userId || isReadOnly) return;

    const textToSend = input.trim();
    setInput('');

    try {
      const messagesRef = ref(db, `messages/${chatId}`);
      const newMsgRef = push(messagesRef);

      const messageData = {
        senderId: user.uid,
        text: textToSend,
        timestamp: serverTimestamp(),
      };

      await set(newMsgRef, messageData);

      const now = Date.now();
      const myChatMeta = ref(db, `userChats/${user.uid}/${userId}`);
      const partnerChatMeta = ref(db, `userChats/${userId}/${user.uid}`);

      // Update sender's meta
      await set(myChatMeta, {
        lastMessage: textToSend,
        timestamp: now,
        unreadCount: 0,
        partnerName: partner.name || 'User',
      });

      // Update partner's meta
      const partnerSnap = await get(partnerChatMeta);
      const currentUnread = partnerSnap.val()?.unreadCount || 0;

      await set(partnerChatMeta, {
        lastMessage: textToSend,
        timestamp: now,
        unreadCount: currentUnread + 1,
        partnerName: user.displayName || user.email?.split('@')[0] || 'User',
      });
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  // ─── Handle Deleted Account Modal Actions ──────────────────
  const handleKeepChat = async () => {
    try {
      await markChatAsKept(user.uid, userId, partner.name || cachedName);
      setIsReadOnly(true);
      setShowDeletedModal(false);
    } catch (err) {
      console.error('Failed to keep chat:', err);
    }
  };

  const handleRemoveChat = async () => {
    try {
      await removeChat(user.uid, userId);
      setShowDeletedModal(false);
      navigate('/chats');
    } catch (err) {
      console.error('Failed to remove chat:', err);
    }
  };

  return (
    <div className="chat-view">
      {/* ─── MESSAGES CONTAINER ────────────────────────────── */}
      <div className="messages-container" ref={containerRef}>
        {isLoadingMore && <div className="loading-more">Loading older messages...</div>}

        {loading ? (
          <>
            <SkeletonMessage />
            <SkeletonMessage />
            <SkeletonMessage />
          </>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <span>💬</span>
            <p>No messages yet.</p>
            <p className="chat-empty-sub">Say hello to start the conversation!</p>
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

      {/* ─── INPUT FORM BAR / ARCHIVED BANNER ───────────── */}
      {!isReadOnly ? (
        <form
          className="chat-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >
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

      {/* ─── DELETED ACCOUNT MODAL ───────────────────────── */}
      <Modal
        isOpen={showDeletedModal}
        onClose={() => setShowDeletedModal(false)}
        title="Account Deleted"
      >
        <p style={{ color: '#ccc', marginBottom: '20px' }}>
          This user’s account has been deleted. Would you like to keep the chat history as read-only or remove it completely?
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleRemoveChat}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#ef4444',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Remove Chat
          </button>
          <button
            onClick={handleKeepChat}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#6C3CE1',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Keep Chat (Read-Only)
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default ChatView;