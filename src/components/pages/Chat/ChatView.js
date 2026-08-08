// src/components/pages/Chat/ChatView.js
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { db } from '../../../services/firebase';
import Modal from '../../common/Modal';
import { removeChat, markChatAsKept } from '../../../services/accountCleanup';
import {
  ref,
  push,
  onChildAdded,
  onValue,
  update,
  get,
  serverTimestamp,
  set,
  onDisconnect,
} from 'firebase/database';
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
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [keptPartnerName, setKeptPartnerName] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const isActive = useRef(true);
  const chatIdRef = useRef(null);

  const partnerNameFromState = location.state?.userName || 'User';

  // ─── Compute chatId ──────────────────────────────────────────
  const chatId = [user?.uid, userId].sort().join('_');
  chatIdRef.current = chatId;

  // ─── Active state & presence ──────────────────────────────
  useEffect(() => {
    if (!user || !userId) return;

    isActive.current = true;

    // Set presence in this chat
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

    const profileRef = ref(db, `profiles/${userId}`);
    const unsubscribe = onValue(profileRef, async (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPartnerProfile({
          ...data,
          name: data.name || data.username || data.displayName || userId,
          uid: userId,
        });
        setIsReadOnly(false);
        setIsLoading(false);
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
          setPartnerProfile(null);
          setIsLoading(false);
        } else {
          setPartnerProfile(null);
          setIsLoading(false);
          setShowDeletedModal(true);
        }
      } catch (err) {
        console.error('Error checking chat status:', err);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [userId, user]);

  // ─── Reset unread count (only if node exists) ──────────────
  useEffect(() => {
    if (!user || !userId || isReadOnly) return;
    const myChatRef = ref(db, `userChats/${user.uid}/${userId}`);

    // ✅ Only reset if the node already exists (prevents auto-creation)
    get(myChatRef).then((snap) => {
      if (snap.exists()) {
        update(myChatRef, { unreadCount: 0 }).catch(() => {});
      }
    }).catch(() => {});
  }, [user, userId, isReadOnly]);

  // ─── Load messages ──────────────────────────────────────────
  useEffect(() => {
    if (!user || !userId) return;
    const chatId = [user.uid, userId].sort().join('_');
    const messagesRef = ref(db, `messages/${chatId}`);
    setMessages([]);

    const unsubscribe = onChildAdded(messagesRef, async (snapshot) => {
      const data = snapshot.val();
      setMessages((prev) => [...prev, { id: snapshot.key, ...data }]);

      if (!isReadOnly && data.senderId !== user.uid && data.text) {
        try {
          const myChatRef = ref(db, `userChats/${user.uid}/${userId}`);
          const partnerName = partnerProfile?.name || userId;
          const partnerAvatar = partnerProfile?.avatar || '';

          const unreadDelta = isActive.current ? 0 : 1;
          const snap = await get(myChatRef);
          const currentUnread = snap.val()?.unreadCount || 0;
          const newUnread = Math.max(0, currentUnread + unreadDelta);

          await update(myChatRef, {
            lastMessage: data.text,
            lastSenderId: data.senderId,
            lastUpdated: serverTimestamp(),
            partnerName: partnerName,
            partnerAvatar: partnerAvatar,
            unreadCount: newUnread,
          });
        } catch (err) {
          console.error('❌ Error updating receiver userChats:', err);
        }
      }

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [user, userId, partnerProfile, isReadOnly]);

  // ─── Scroll to bottom ──────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Modal handlers ────────────────────────────────────────
  const handleKeepChat = async () => {
    setShowDeletedModal(false);
    const name = partnerProfile?.name || userId;
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

  // ─── Send message ──────────────────────────────────────────
  const sendMessage = async (e) => {
    e.preventDefault();
    if (isReadOnly || !newMessage.trim() || !user || !userId) return;

    const chatId = [user.uid, userId].sort().join('_');
    const messagesRef = ref(db, `messages/${chatId}`);
    const messageData = {
      senderId: user.uid,
      text: newMessage.trim(),
      timestamp: serverTimestamp(),
    };

    try {
      await push(messagesRef, messageData);

      // Always update sender's userChats (creates if needed)
      const partnerName = partnerProfile?.name || userId;
      const partnerAvatar = partnerProfile?.avatar || '';
      const myChatRef = ref(db, `userChats/${user.uid}/${userId}`);
      await update(myChatRef, {
        lastMessage: newMessage.trim(),
        lastSenderId: user.uid,
        lastUpdated: serverTimestamp(),
        partnerName: partnerName,
        partnerAvatar: partnerAvatar,
      });

      // ─── Check if receiver is active in this chat ──────────
      const receiverPresenceRef = ref(db, `presence/chat/${chatId}/${userId}`);
      const presenceSnap = await get(receiverPresenceRef);
      const isReceiverActive = presenceSnap.val() === true;

      // Always update receiver's userChats with the latest message,
      // but only increment unread if not active.
      const receiverChatRef = ref(db, `userChats/${userId}/${user.uid}`);
      const receiverSnap = await get(receiverChatRef);
      const currentUnread = receiverSnap.val()?.unreadCount || 0;
      const newUnread = isReceiverActive ? 0 : currentUnread + 1;

      await update(receiverChatRef, {
        lastMessage: newMessage.trim(),
        lastSenderId: user.uid,
        lastUpdated: serverTimestamp(),
        partnerName: user?.name || user?.displayName || 'User',
        partnerAvatar: user?.avatar || '',
        unreadCount: newUnread,
      });

      console.log(`📩 Message sent. Receiver active: ${isReceiverActive}, unread: ${newUnread}`);

    } catch (err) {
      console.error('❌ Error sending message:', err);
    } finally {
      setNewMessage('');
      inputRef.current?.focus();
    }
  };

  if (isLoading) {
    return (
      <div className="chat-loading">
        <div className="loading-spinner" />
        <span>Loading conversation...</span>
      </div>
    );
  }

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

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <span>💬</span>
            <p>No messages yet</p>
            <span className="chat-empty-sub">
              {isReadOnly ? 'This chat is archived.' : 'Say hello to start the conversation'}
            </span>
          </div>
        ) : (
          messages.map((msg) => {
            const isSender = msg.senderId === user?.uid;
            const partnerInitial = partnerProfile?.name?.[0]?.toUpperCase() || 'U';
            return (
              <div key={msg.id} className={`chat-message ${isSender ? 'sent' : 'received'}`}>
                <div className="chat-bubble">
                  {!isSender && (
                    <div className="chat-sender-avatar">
                      {partnerProfile?.avatar ? <img src={partnerProfile.avatar} alt="" /> : partnerInitial}
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

      {!isReadOnly ? (
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
      ) : (
        <div className="chat-readonly-banner">
          <i className="fas fa-lock" /> This conversation is archived (account deleted).
        </div>
      )}
    </div>
  );
};

export default ChatView;