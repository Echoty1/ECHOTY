// src/components/pages/Chat/ChatView.js
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../../../services/firebase';
import {
  ref,
  onValue,
  push,
  set,
  update,
  get,
  remove,
  serverTimestamp,
  runTransaction,
} from 'firebase/database';
import { loadMessagesFromCache, upsertMessageInCache, deleteMessageFromCache, saveMessagesToCache } from '../../../services/messageStorage';
import { useAuth } from '../../../hooks/useAuth';
import { SkeletonMessage } from '../../common/SkeletonLoader';
import { getCache, setCache } from '../../../services/cacheService';
import { clearMessageCache } from '../../../services/messageCache';
import ChatMediaMessage from './ChatMediaMessage';
import AudioPlayer from './AudioPlayer';
import VoiceRecorder from './VoiceRecorder';
import MessageMenu from './MessageMenu';
import ReplyPreview from './ReplyPreview';
import RepliedMessage from './RepliedMessage';
import EditMessageModal from './EditMessageModal';
import EditMediaCaptionModal from './EditMediaCaptionModal';
import ChatEmojiPicker from './ChatEmojiPicker';
import { VideoAudioProvider } from '../../../contexts/VideoAudioContext';
import { useProfile } from '../../../contexts/ProfileContext';
import ECHOMOJI from '../../UI/ECHOMOJI';
import { getSkinById } from '../../../constants/echomoji';
import { cacheMedia } from '../../../utils/mediaCache';
import { cleanCachedMessagesForChat } from '../../../services/messageCleanup';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import EchoAI from './EchoAI';
import ConfirmModal from '../../common/ConfirmModal';
import './ChatView.css';

const ECHO_AI_ID = 'echo_ai_assistant';

const CLOUDINARY_CLOUD_NAME = 'rjlscgan';
const CLOUDINARY_UPLOAD_PRESET = 'echo_uploads';

const DEMO_UID = 'k9Cs6QPfDRNTputzic7V3xRUof63';
const SUPPORT_UID = 'hD7tJzPVI1VSorhok8GToBC6VDy1';

const sanitizeName = (rawName, userId) => {
  if (!rawName) return 'User';
  const str = String(rawName).trim();
  if (str === userId || (str.length >= 20 && !str.includes(' ') && /^[a-zA-Z0-9_-]+$/.test(str))) {
    return 'User';
  }
  return str;
};

const getBackendUrl = (path) => {
  let base = process.env.REACT_APP_API_URL ||
             (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
               ? 'http://localhost:3000'
               : 'https://echoty-pdcy.onrender.com/');
  base = base.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

const msgTime = (m) => {
  if (!m) return 0;
  const t = m.timestamp;
  if (typeof t === 'number' && !Number.isNaN(t)) return t;
  if (t && typeof t === 'object') {
    if (typeof t.toMillis === 'function') return t.toMillis();
    if (typeof t.seconds === 'number') return t.seconds * 1000;
  }
  if (typeof m.clientTs === 'number') return m.clientTs;
  return 0;
};

const sortMessages = (list) =>
  (list || [])
    .slice()
    .sort((a, b) => {
      const d = msgTime(a) - msgTime(b);
      if (d !== 0) return d;
      return String(a.id || a.key || '').localeCompare(String(b.id || b.key || ''));
    });

// ─── Format reaction count ─────────────────────────────────────
const formatReactionCount = (count) => {
  if (count < 1000) return String(count);
  if (count < 1000000) {
    const k = count / 1000;
    return k >= 10 ? Math.round(k) + 'K' : k.toFixed(1) + 'K';
  }
  const m = count / 1000000;
  return m >= 10 ? Math.round(m) + 'M' : m.toFixed(1) + 'M';
};

const ChatView = () => {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (userId === ECHO_AI_ID) {
    return <EchoAI />;
  }

  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [partnerProfile, setPartnerProfile] = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const isNearBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);
  const prevMsgCountRef = useRef(0);
  const [ended, setEnded] = useState(false);
  const [endedByName, setEndedByName] = useState('');
  const [clearedAt, setClearedAt] = useState(0);
  const [chatBgEnabled, setChatBgEnabled] = useState(() => {
    try {
      const v = localStorage.getItem('echo_chat_bg');
      return v === null ? true : v === '1';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const onBg = (e) => {
      if (e?.detail && typeof e.detail.enabled === 'boolean') {
        setChatBgEnabled(e.detail.enabled);
      } else {
        try {
          const v = localStorage.getItem('echo_chat_bg');
          setChatBgEnabled(v === null ? true : v === '1');
        } catch (_) {}
      }
    };
    window.addEventListener('echo-chat-bg-changed', onBg);
    window.addEventListener('storage', onBg);
    return () => {
      window.removeEventListener('echo-chat-bg-changed', onBg);
      window.removeEventListener('storage', onBg);
    };
  }, []);
  const clearedAtRef = useRef(0);

  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const moreOptionsRef = useRef(null);

  const [confirmEndState, setConfirmEndState] = useState({
    isOpen: false,
    partnerName: '',
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [captionText, setCaptionText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const captionInputRef = useRef(null);
  const inputRef = useRef(null);
  const inputContainerRef = useRef(null);
  const captionPreviewRef = useRef(null);

  const focusedField = useRef('main');
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);

  const { getProfile, fetchProfile } = useProfile();
  const [editingMessage, setEditingMessage] = useState(null);
  const [editingMediaMessage, setEditingMediaMessage] = useState(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const chatId = useRef(null);

  const cacheKey = `messages_${user?.uid}_${userId}`;
  const isMounted = useRef(true);
  const [replyTo, setReplyTo] = useState(null);
  const messageRefs = useRef({});
  const markReadTimeout = useRef(null);
  const hasMarkedRead = useRef(false);

  const [minLoadingTimePassed, setMinLoadingTimePassed] = useState(false);
  const loadingTimerRef = useRef(null);

  const scrollCooldownRef = useRef(false);

  // ─── Reactions state ──────────────────────────────────────────
  const [reactingMessageId, setReactingMessageId] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  // ─── Helper functions ──────────────────────────────────────────
  const notifyChatListUpdate = (partnerId, patch) => {
    window.dispatchEvent(
      new CustomEvent('chat-list-update', {
        detail: { partnerId, patch },
      })
    );
  };

  const patchMyUserChat = async (partnerId, fields) => {
    if (!user?.uid || !partnerId) return;
    await update(ref(db, `userChats/${user.uid}/${partnerId}`), {
      id: partnerId,
      ...fields,
    });
  };

  const clearUnreadInstantly = () => {
    if (!userId) return;
    sessionStorage.setItem(`chat_read_${userId}`, 'true');
    window.dispatchEvent(new CustomEvent('chat-read', { detail: { userId } }));
    notifyChatListUpdate(userId, { unreadCount: 0 });
    hasMarkedRead.current = true;
  };

  const markMessagesAsRead = async () => {
    if (!user?.uid || !userId) return;
    const cId = [user.uid, userId].sort().join('_');
    try {
      const messagesRef = ref(db, `chats/${cId}/messages`);
      const snapshot = await get(messagesRef);
      if (!snapshot.exists()) return;
      const data = snapshot.val();
      const updates = {};
      let hasUnread = false;
      let latestMsg = '';
      let latestSender = '';
      let latestTimestamp = Date.now();

      let msgs = sortMessages(Object.entries(data).map(([key, val]) => ({ id: key, key, ...val })));
      const latest = msgs[msgs.length - 1];
      if (latest) {
        if (latest.type === 'media') {
          latestMsg = latest.mediaType === 'video' ? '🎬 Video' : latest.mediaType === 'audio' ? '🎤 Voice note' : '📷 Image';
        } else if (latest.type === 'echomoji') {
          latestMsg = `😊 ECHOMOJI (${latest.mood || 'neutral'})`;
        } else {
          latestMsg = latest.text || '';
        }
        latestSender = latest.senderId || '';
        latestTimestamp = latest.timestamp || Date.now();
      }

      msgs.forEach((msg) => {
        if (msg.receiverId === user.uid && msg.isRead === false) {
          updates[`chats/${cId}/messages/${msg.key}/isRead`] = true;
          hasUnread = true;
        }
      });

      if (!hasUnread) return;
      await update(ref(db), updates);
      await patchMyUserChat(userId, {
        partnerName: partnerProfile?.name || location.state?.userName || 'User',
        partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '',
        lastMessage: latestMsg,
        lastSenderId: latestSender,
        lastUpdated: latestTimestamp,
        unreadCount: 0,
      });
      window.dispatchEvent(new CustomEvent('chat-unread-cleared', { detail: { partnerId: userId } }));
      clearMessageCache(cId);
    } catch (err) {
      console.warn('⚠️ [Unread] markMessagesAsRead error:', err.message);
    }
  };

  const clearOldSupportDemoMessages = async () => {
    const isSupportDemoChat = (user?.uid === SUPPORT_UID && userId === DEMO_UID) || (user?.uid === DEMO_UID && userId === SUPPORT_UID);
    if (!isSupportDemoChat) return;
    const cId = [SUPPORT_UID, DEMO_UID].sort().join('_');
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
    try {
      const messagesRef = ref(db, `chats/${cId}/messages`);
      const snapshot = await get(messagesRef);
      if (!snapshot.exists()) return;
      const data = snapshot.val();
      const updates = {};
      let hasOldMessages = false;
      Object.entries(data).forEach(([key, msg]) => {
        const timestamp = msg.timestamp || 0;
        const msgTime = typeof timestamp === 'number' ? timestamp : timestamp?.getTime?.() || 0;
        if (msgTime > 0 && msgTime < twentyFourHoursAgo) {
          updates[`chats/${cId}/messages/${key}`] = null;
          hasOldMessages = true;
        }
      });
      if (hasOldMessages) {
        await update(ref(db), updates);
        clearMessageCache(cId);
      }
    } catch (err) {
      console.warn('Failed to clear old support‑demo messages:', err);
    }
  };

  useEffect(() => {
    if (!user?.uid || !userId) return;
    clearUnreadInstantly();
    if (!userId) return;
    clearOldSupportDemoMessages();
    const syncTimer = setTimeout(() => {
      if (isMounted.current) {
        markMessagesAsRead();
      }
    }, 100);
    const cleanupInterval = setInterval(() => {
      clearOldSupportDemoMessages();
    }, 60 * 60 * 1000);
    return () => {
      clearTimeout(syncTimer);
      clearInterval(cleanupInterval);
    };
  }, [user?.uid, userId]);

  useEffect(() => {
    setMinLoadingTimePassed(false);
    initialScrollDoneRef.current = false;
    prevMsgCountRef.current = 0;
    isNearBottomRef.current = true;
    setIsNearBottom(true);
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    loadingTimerRef.current = setTimeout(() => {
      setMinLoadingTimePassed(true);
    }, 80);
    return () => {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    };
  }, [userId]);

  const handleReply = (msg) => {
    if (msg.senderId === user?.uid) return;
    const senderName = partnerProfile?.name || location.state?.userName || 'User';
    let textSnippet;
    if (msg.type === 'media') {
      if (msg.mediaType === 'video') textSnippet = '🎬 Video';
      else if (msg.mediaType === 'audio') textSnippet = '🎤 Voice note';
      else textSnippet = '📷 Image';
    } else if (msg.type === 'echomoji') {
      textSnippet = `😊 ECHOMOJI (${msg.mood || 'neutral'})`;
    } else {
      textSnippet = msg.text || 'Message';
    }
    setReplyTo({
      messageId: msg.id,
      senderName: senderName,
      messageType: msg.type || 'text',
      textSnippet: textSnippet,
      originalMessage: msg,
    });
    setNewMessage('');
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  };

  const cancelReply = () => {
    setReplyTo(null);
  };

  const scrollToMessage = (messageId) => {
    const element = messageRefs.current[messageId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('highlight-flash');
      setTimeout(() => {
        element.classList.remove('highlight-flash');
      }, 2000);
    } else {
      scrollToBottom(true);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!user?.uid || !userId) return;
    const cId = [user.uid, userId].sort().join('_');
    setDeletingMessageId(messageId);
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      await remove(ref(db, `chats/${cId}/messages/${messageId}`));
      await deleteMessageFromCache(cId, messageId);
      const messagesRef = ref(db, `chats/${cId}/messages`);
      const snapshot = await get(messagesRef);
      let latestMsg = '';
      let latestSender = '';
      let latestTimestamp = Date.now();
      if (snapshot.exists()) {
        const data = snapshot.val();
        let msgs = sortMessages(Object.entries(data).map(([key, val]) => ({ id: key, key, ...val })));
        const latest = msgs[msgs.length - 1];
        if (latest) {
          if (latest.type === 'media') {
            latestMsg = latest.mediaType === 'video' ? '🎬 Video' : latest.mediaType === 'audio' ? '🎤 Voice note' : '📷 Image';
          } else if (latest.type === 'echomoji') {
            latestMsg = `😊 ECHOMOJI (${latest.mood || 'neutral'})`;
          } else {
            latestMsg = latest.text || '';
          }
          latestSender = latest.senderId || '';
          latestTimestamp = latest.timestamp || Date.now();
        }
      }
      await patchMyUserChat(userId, {
        partnerName: location.state?.userName || partnerProfile?.name || 'User',
        partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '',
        lastMessage: latestMsg,
        lastSenderId: latestSender,
        lastUpdated: latestTimestamp,
        unreadCount: 0,
      });
      if (partnerProfile) {
        const partnerChatRef = ref(db, `userChats/${userId}/${user.uid}`);
        const partnerSnapshot = await get(partnerChatRef);
        if (partnerSnapshot.exists()) {
          const partnerData = partnerSnapshot.val();
          await set(partnerChatRef, {
            ...partnerData,
            lastMessage: latestMsg,
            lastSenderId: latestSender,
            lastUpdated: latestTimestamp,
          });
        }
      }
      clearMessageCache(cId);
      await cleanCachedMessagesForChat(cId);
      setDeletingMessageId(null);
    } catch (err) {
      console.warn('Delete failed:', err.message);
      setDeletingMessageId(null);
    }
  };

  const handleEditMessage = (msg) => {
    if (msg.senderId !== user?.uid) return;
    if (msg.type === 'media' && msg.mediaType === 'audio') return;
    if (msg.type === 'media') {
      setEditingMediaMessage(msg);
      return;
    }
    setEditingMessage(msg);
  };

  // ─── FIXED: saveEditedMessage ──────────────────────────────────
  const saveEditedMessage = async (newText) => {
    if (!editingMessage || !user?.uid || !userId) return;
    const cId = [user.uid, userId].sort().join('_');
    const messageId = editingMessage.id;
    try {
      await update(ref(db, `chats/${cId}/messages/${messageId}`), {
        text: newText,
        isEdited: true,
        lastEditedAt: serverTimestamp(),
      });

      const updatedMsg = { ...editingMessage, text: newText, isEdited: true };
      await upsertMessageInCache(cId, updatedMsg);

      setMessages((prev) => {
        const next = prev.map((m) =>
          m.id === messageId ? { ...m, text: newText, isEdited: true } : m
        );
        saveMessagesToCache(
          cId,
          next.filter((m) => !String(m.id).startsWith('temp_'))
        ).catch(() => {});
        return next;
      });

      const messagesRef = ref(db, `chats/${cId}/messages`);
      const snapshot = await get(messagesRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const msgs = sortMessages(
          Object.entries(data).map(([key, val]) => ({ id: key, key, ...val }))
        );
        const latest = msgs[msgs.length - 1];
        if (latest && latest.key === messageId) {
          await patchMyUserChat(userId, {
            partnerName: partnerProfile?.name || location.state?.userName || 'User',
            partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '',
            lastMessage: newText,
            lastSenderId: user.uid,
            lastUpdated: Date.now(),
            unreadCount: 0,
          });
          notifyChatListUpdate(userId, {
            lastMessage: `You: ${newText}`.slice(0, 80),
            lastSenderId: user.uid,
            timestamp: Date.now(),
            unreadCount: 0,
          });
          try {
            const partnerChatRef = ref(db, `userChats/${userId}/${user.uid}`);
            const partnerSnapshot = await get(partnerChatRef);
            if (partnerSnapshot.exists()) {
              await update(partnerChatRef, {
                lastMessage: newText,
                lastSenderId: user.uid,
                lastUpdated: Date.now(),
              });
            }
          } catch (e) {
            console.warn('[Edit] partner userChats update skipped:', e.message);
          }
        }
      }
      clearMessageCache(cId);
      setEditingMessage(null);
    } catch (err) {
      console.error('Failed to edit message:', err);
      alert('Failed to edit message. Please try again.');
    }
  };

  // ─── FIXED: saveMediaCaption ──────────────────────────────────
  const saveMediaCaption = async (newCaption) => {
    if (!editingMediaMessage || !user?.uid || !userId) return;
    const cId = [user.uid, userId].sort().join('_');
    const messageId = editingMediaMessage.id;
    try {
      await update(ref(db, `chats/${cId}/messages/${messageId}`), {
        caption: newCaption,
        isEdited: true,
        lastEditedAt: serverTimestamp(),
      });

      const updatedMsg = {
        ...editingMediaMessage,
        caption: newCaption,
        isEdited: true,
      };
      await upsertMessageInCache(cId, updatedMsg);

      setMessages((prev) => {
        const next = prev.map((m) =>
          m.id === messageId ? { ...m, caption: newCaption, isEdited: true } : m
        );
        saveMessagesToCache(
          cId,
          next.filter((m) => !String(m.id).startsWith('temp_'))
        ).catch(() => {});
        return next;
      });

      const messagesRef = ref(db, `chats/${cId}/messages`);
      const snapshot = await get(messagesRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const msgs = sortMessages(
          Object.entries(data).map(([key, val]) => ({ id: key, key, ...val }))
        );
        const latest = msgs[msgs.length - 1];
        if (latest && latest.key === messageId) {
          const mediaIcon =
            editingMediaMessage.mediaType === 'video' ? '🎬 Video' : '📷 Image';
          const displayText = newCaption
            ? `${mediaIcon}: ${newCaption}`
            : mediaIcon;
          await patchMyUserChat(userId, {
            partnerName: partnerProfile?.name || location.state?.userName || 'User',
            partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '',
            lastMessage: displayText,
            lastSenderId: user.uid,
            lastUpdated: Date.now(),
            unreadCount: 0,
          });
          try {
            const partnerChatRef = ref(db, `userChats/${userId}/${user.uid}`);
            const partnerSnapshot = await get(partnerChatRef);
            if (partnerSnapshot.exists()) {
              await update(partnerChatRef, {
                lastMessage: displayText,
                lastSenderId: user.uid,
                lastUpdated: Date.now(),
              });
            }
          } catch (e) {
            console.warn('[Edit caption] partner update skipped:', e.message);
          }
        }
      }
      clearMessageCache(cId);
      setEditingMediaMessage(null);
    } catch (err) {
      console.error('Failed to edit media caption:', err);
      alert('Failed to edit caption. Please try again.');
    }
  };

  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
    }
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 80;
    const isNear = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    isNearBottomRef.current = isNear;
    setIsNearBottom(isNear);
  };

  // ─── Reactions ──────────────────────────────────────────────
  const handleReact = (msg) => {
    setReactingMessageId(msg.id);
    setShowReactionPicker(true);
  };

  const handleReactionSelect = async (emoji) => {
    setShowReactionPicker(false);
    if (!reactingMessageId || !user?.uid || !userId) return;
    const cId = [user.uid, userId].sort().join('_');
    const reactionRef = ref(db, `chats/${cId}/messages/${reactingMessageId}/reactions/${user.uid}`);
    try {
      const currentMsg = messages.find(m => m.id === reactingMessageId);
      const currentReaction = currentMsg?.reactions?.[user.uid];
      if (currentReaction === emoji) {
        await remove(reactionRef);
      } else {
        await set(reactionRef, emoji);
      }
      setReactingMessageId(null);
    } catch (err) {
      console.warn('Reaction error:', err);
    }
  };

  const closeReactionPicker = () => {
    setShowReactionPicker(false);
    setReactingMessageId(null);
  };

  // ─── Render reactions (grouped, below bubble) ────────────────
  const renderReactions = (reactions) => {
    if (!reactions || typeof reactions !== 'object') return null;
    const entries = Object.entries(reactions);
    if (entries.length === 0) return null;

    const groups = {};
    entries.forEach(([uid, emoji]) => {
      if (!groups[emoji]) groups[emoji] = [];
      groups[emoji].push(uid);
    });

    return (
      <div className="message-reactions">
        {Object.entries(groups).map(([emoji, uids]) => (
          <span key={emoji} className="reaction-badge">
            {emoji}
            {uids.length > 1 && (
              <span className="reaction-count">{formatReactionCount(uids.length)}</span>
            )}
          </span>
        ))}
      </div>
    );
  };

  // ─── Respect "Clear History" ────────────────────────────────────
  useEffect(() => {
    if (!user?.uid || !userId) {
      setClearedAt(0);
      return;
    }
    const clearedRef = ref(db, `userChats/${user.uid}/${userId}/clearedAt`);
    const unsub = onValue(clearedRef, (snap) => {
      const val = snap.val();
      const n = typeof val === 'number' ? val : 0;
      clearedAtRef.current = n;
      setClearedAt(n);
    });
    const onLocalClear = (e) => {
      if (e.detail?.partnerId === userId) {
        clearedAtRef.current = Date.now();
        setClearedAt(clearedAtRef.current);
        setMessages([]);
      }
    };
    window.addEventListener('chat-history-cleared', onLocalClear);
    return () => {
      unsub();
      window.removeEventListener('chat-history-cleared', onLocalClear);
    };
  }, [user?.uid, userId]);

  // ─── Listen for ended ECHO flag ────────────────────────────────
  useEffect(() => {
    if (!user?.uid || !userId) {
      setEnded(false);
      return;
    }
    const cId = [user.uid, userId].sort().join('_');
    const endedRef = ref(db, `chats/${cId}/ended`);
    const unsub = onValue(endedRef, (snap) => {
      const val = snap.val();
      if (val === true || (val && (val.by || val === true))) {
        setEnded(true);
        setEndedByName((val && val.byName) || '');
      } else {
        setEnded(false);
        setEndedByName('');
      }
    });
    return () => unsub();
  }, [user?.uid, userId]);

  const clearEndedFlag = async () => {
    if (!user?.uid || !userId) return;
    const cId = [user.uid, userId].sort().join('_');
    try {
      await remove(ref(db, `chats/${cId}/ended`));
      await remove(ref(db, `userChats/${user.uid}/${userId}/ended`));
      await remove(ref(db, `userChats/${userId}/${user.uid}/ended`));
      setEnded(false);
      setEndedByName('');
    } catch (err) {
      console.warn('clearEndedFlag:', err.message);
    }
  };

  const handleEndEcho = () => {
    if (!user?.uid || !userId) return;
    const partnerName = sanitizeName(location.state?.userName || partnerProfile?.name, userId);
    setConfirmEndState({
      isOpen: true,
      partnerName,
    });
    setShowMoreOptions(false);
  };

  const confirmEndEcho = async () => {
    setConfirmEndState({ isOpen: false, partnerName: '' });
    if (!user?.uid || !userId) return;
    if (ended) return;
    const cId = [user.uid, userId].sort().join('_');
    const myName =
      (currentUserProfile && currentUserProfile.name) ||
      user.displayName ||
      'User';
    const endTs = Date.now();
    try {
      await set(ref(db, `chats/${cId}/ended`), {
        by: user.uid,
        byName: myName,
        at: endTs,
      });
      const messagesRef = ref(db, `chats/${cId}/messages`);
      const newMsgRef = push(messagesRef);
      await set(newMsgRef, {
        senderId: 'system',
        type: 'system',
        text: `${myName} ended this ECHO.`,
        timestamp: endTs,
        clientTs: endTs,
        endedBy: user.uid,
      });
      await update(ref(db, `userChats/${user.uid}/${userId}`), {
        ended: true,
        lastMessage: `${myName} ended this ECHO.`,
        lastSenderId: 'system',
        lastUpdated: Date.now(),
      });
      await update(ref(db, `userChats/${userId}/${user.uid}`), {
        ended: true,
        lastMessage: `${myName} ended this ECHO.`,
        lastSenderId: 'system',
        lastUpdated: Date.now(),
      });
    } catch (err) {
      console.error('Failed to end ECHO:', err);
      alert('Failed to end ECHO. Please try again.');
    }
  };

  // ─── Real‑time listener ─────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid || !userId) {
      setLoadingMessages(false);
      return;
    }
    isMounted.current = true;
    const cId = [user.uid, userId].sort().join('_');
    chatId.current = cId;

    loadMessagesFromCache(cId).then((cachedMessages) => {
      if (isMounted.current && cachedMessages.length > 0) {
        const cut = clearedAtRef.current || 0;
        const visible = cut
          ? cachedMessages.filter((m) => {
              const ts = typeof m.timestamp === 'number' ? m.timestamp : 0;
              return !ts || ts >= cut;
            })
          : cachedMessages;
        setMessages(visible);
        setLoadingMessages(false);
        setMinLoadingTimePassed(true);
        prevMsgCountRef.current = visible.length;
        if (!initialScrollDoneRef.current) {
          initialScrollDoneRef.current = true;
          requestAnimationFrame(() => scrollToBottom(false));
        }
      }
    });

    const messagesRef = ref(db, `chats/${cId}/messages`);
    const unsubscribe = onValue(
      messagesRef,
      async (snapshot) => {
        if (!isMounted.current) return;
        const data = snapshot.val();
        let newMessages = [];
        if (data) {
          newMessages = sortMessages(
            Object.entries(data).map(([id, val]) => ({ id, ...val }))
          );
        }
        const cut = clearedAtRef.current || 0;
        let visible = cut
          ? newMessages.filter((m) => {
              if (m.pending) return true;
              const ts = msgTime(m);
              if (!ts) return true;
              return ts >= cut;
            })
          : newMessages;
        visible = sortMessages(visible);

        setMessages((prev) => {
          const pending = (prev || []).filter(
            (m) => m.pending && !visible.some((v) => v.id === m.id || (v.text === m.text && v.senderId === m.senderId && Math.abs(msgTime(v) - msgTime(m)) < 5000))
          );
          const serverOwnTexts = new Set(
            visible.filter((v) => v.senderId === user.uid).map((v) => v.text)
          );
          const stillPending = pending.filter((p) => !serverOwnTexts.has(p.text));
          return sortMessages([...visible, ...stillPending]);
        });
        setLoadingMessages(false);

        const prevCount = prevMsgCountRef.current;
        const grew = visible.length > prevCount;
        const newest = visible[visible.length - 1];
        const isIncoming =
          newest && newest.senderId && newest.senderId !== user.uid;
        prevMsgCountRef.current = visible.length;

        if (!initialScrollDoneRef.current) {
          initialScrollDoneRef.current = true;
          requestAnimationFrame(() => scrollToBottom(false));
        } else if (grew && isNearBottomRef.current) {
          requestAnimationFrame(() => scrollToBottom(true));
        } else if (grew && isIncoming && isNearBottomRef.current) {
          requestAnimationFrame(() => scrollToBottom(true));
        }

        // Persist in background
        Promise.resolve().then(async () => {
          try {
            for (const msg of visible) {
              await upsertMessageInCache(cId, msg);
              if (msg.type === 'media' && msg.mediaUrl && msg.mediaUrl.startsWith('http')) {
                cacheMedia(msg.mediaUrl);
              }
            }
            await saveMessagesToCache(cId, visible);
            setCache(cacheKey, visible).catch(() => {});
          } catch (_) {}
        });
        clearMessageCache(cId);

        const hasUnread = visible.some(
          (msg) => msg.receiverId === user.uid && msg.isRead === false
        );

        if (hasUnread && isMounted.current) {
          clearUnreadInstantly();
          if (markReadTimeout.current) clearTimeout(markReadTimeout.current);
          markReadTimeout.current = setTimeout(() => {
            if (isMounted.current) {
              markMessagesAsRead();
            }
          }, 300);
        }
      },
      (error) => {
        console.error('❌ [ChatView] Firebase listener error:', error);
        setLoadingMessages(false);
        setMinLoadingTimePassed(true);
        if (messages.length === 0) {
          setMessages([{
            id: 'error',
            senderId: 'system',
            text: '⚠️ Could not load messages. Please check your connection.',
            timestamp: Date.now(),
            type: 'text',
            isRead: true,
          }]);
        }
      }
    );

    return () => {
      isMounted.current = false;
      if (markReadTimeout.current) clearTimeout(markReadTimeout.current);
      unsubscribe();
      if (!userId) {
        setTimeout(() => {
          if (!isMounted.current) {
            markMessagesAsRead();
          }
        }, 300);
      }
    };
  }, [user?.uid, userId, cacheKey, isNearBottom]);

  // ─── Partner profile loading ────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const cached = getProfile(userId);
    if (cached) {
      setPartnerProfile(cached);
    } else {
      fetchProfile(userId);
    }
    const pRef = ref(db, `profiles/${userId}`);
    const unsub = onValue(pRef, (snap) => {
      if (snap.exists()) {
        setPartnerProfile(snap.val());
      }
    });
    return () => unsub();
  }, [userId, getProfile, fetchProfile]);

  useEffect(() => {
    if (!user?.uid) return;
    const myProfileRef = ref(db, `profiles/${user.uid}`);
    get(myProfileRef)
      .then((snap) => {
        if (snap.exists()) setCurrentUserProfile(snap.val());
      })
      .catch(console.error);
  }, [user?.uid]);

  // ─── File / media handlers ─────────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setCaptionText('');
    e.target.value = '';
    setTimeout(() => captionInputRef.current?.focus(), 100);
    setShowMoreOptions(false);
  };

  const uploadToCloudinary = (file, onProgress) => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, true);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data.secure_url);
          } catch (err) {
            reject(new Error('Invalid response from Cloudinary'));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });
  };

  const sendMediaMessage = async () => {
    if (ended) await clearEndedFlag();
    if (!selectedFile || !user?.uid || !userId) return;
    setIsUploading(true);
    setUploadProgress(0);
    const cId = [user.uid, userId].sort().join('_');
    const timestamp = Date.now();
    const tempId = `temp_${Date.now()}`;
    const mediaType = selectedFile.type.startsWith('video/') ? 'video' : 'image';
    const mediaIcon = mediaType === 'video' ? '🎬 Video' : '📷 Image';
    const blobUrl = URL.createObjectURL(selectedFile);
    const optimisticMsg = {
      id: tempId,
      senderId: user.uid,
      receiverId: userId,
      type: 'media',
      mediaType,
      mediaUrl: blobUrl,
      realUrl: null,
      caption: captionText.trim(),
      timestamp: Date.now(),
      isRead: false,
      isUploading: true,
      uploadProgress: 0,
      isMediaReady: true,
    };
    const currentReply = replyTo;
    if (currentReply) {
      optimisticMsg.replyTo = {
        messageId: currentReply.messageId,
        senderName: currentReply.senderName,
        messageType: currentReply.messageType,
        textSnippet: currentReply.textSnippet,
      };
      setReplyTo(null);
    }
    setMessages((prev) => [...prev, optimisticMsg]);
    setPreviewUrl(null);
    setSelectedFile(null);
    setCaptionText('');
    try {
      const downloadURL = await uploadToCloudinary(selectedFile, (progress) => {
        setUploadProgress(progress);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, uploadProgress: progress } : m))
        );
      });
      let realMediaLoaded = false;
      if (mediaType === 'image') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = downloadURL;
        await new Promise((resolve) => {
          img.onload = () => { realMediaLoaded = true; resolve(); };
          img.onerror = () => { realMediaLoaded = false; resolve(); };
          if (img.complete) { realMediaLoaded = true; resolve(); }
        });
      } else {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = downloadURL;
        await new Promise((resolve) => {
          video.onloadedmetadata = () => { realMediaLoaded = true; resolve(); };
          video.onerror = () => { realMediaLoaded = false; resolve(); };
          if (video.readyState >= 1) { realMediaLoaded = true; resolve(); }
        });
      }
      const messagesRef = ref(db, `chats/${cId}/messages`);
      const newMsgRef = push(messagesRef);
      const realMsg = {
        senderId: user.uid,
        receiverId: userId,
        type: 'media',
        mediaType,
        mediaUrl: downloadURL,
        caption: captionText.trim(),
        timestamp: Date.now(),
        isRead: false,
      };
      if (currentReply) {
        realMsg.replyTo = {
          messageId: currentReply.messageId,
          senderName: currentReply.senderName,
          messageType: currentReply.messageType,
          textSnippet: currentReply.textSnippet,
        };
      }
      await set(newMsgRef, realMsg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...realMsg, id: newMsgRef.key, isUploading: false, uploadProgress: 100, isMediaReady: true }
            : m
        )
      );
      URL.revokeObjectURL(blobUrl);
      await patchMyUserChat(userId, {
        partnerName: location.state?.userName || partnerProfile?.name || 'User',
        partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '',
        lastMessage: mediaIcon,
        lastSenderId: user.uid,
        lastUpdated: Date.now(),
        unreadCount: 0,
      });
      const recipientChatRef = ref(db, `userChats/${userId}/${user.uid}`);
      await runTransaction(recipientChatRef, (currentData) => {
        if (currentData === null) {
          return {
            id: user.uid,
            partnerName: currentUserProfile?.name || 'User',
            partnerAvatar: currentUserProfile?.avatar || '',
            lastMessage: mediaIcon,
            lastSenderId: user.uid,
            lastUpdated: Date.now(),
            unreadCount: 1,
          };
        } else {
          currentData.unreadCount = (currentData.unreadCount || 0) + 1;
          currentData.lastMessage = mediaIcon;
          currentData.lastSenderId = user.uid;
          currentData.lastUpdated = Date.now();
          return currentData;
        }
      });
      clearMessageCache(cId);
      setIsUploading(false);
      setUploadProgress(0);
    } catch (err) {
      console.error('Upload failed:', err);
      setIsUploading(false);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      URL.revokeObjectURL(blobUrl);
      alert('Upload failed: ' + (err.message || 'Please try again.'));
    }
  };

  const handleVoiceSend = async (audioBlob, duration) => {
    if (ended) await clearEndedFlag();
    setShowVoiceRecorder(false);
    const cId = [user.uid, userId].sort().join('_');
    const tempId = `temp_${Date.now()}`;
    const blobUrl = URL.createObjectURL(audioBlob);
    const optimisticMsg = {
      id: tempId,
      senderId: user.uid,
      receiverId: userId,
      type: 'media',
      mediaType: 'audio',
      mediaUrl: blobUrl,
      duration: duration,
      timestamp: Date.now(),
      isRead: false,
      isUploading: true,
      uploadProgress: 0,
      isMediaReady: false,
    };
    const currentReply = replyTo;
    if (currentReply) {
      optimisticMsg.replyTo = {
        messageId: currentReply.messageId,
        senderName: currentReply.senderName,
        messageType: currentReply.messageType,
        textSnippet: currentReply.textSnippet,
      };
      setReplyTo(null);
    }
    setMessages((prev) => [...prev, optimisticMsg]);
    try {
      const formData = new FormData();
      formData.append('file', audioBlob);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, true);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, uploadProgress: progress } : m))
          );
        }
      };
      const uploadPromise = new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data.secure_url);
            } catch (e) { reject(e); }
          } else {
            reject(new Error('Upload failed'));
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
      });
      xhr.send(formData);
      const downloadURL = await uploadPromise;
      const messagesRef = ref(db, `chats/${cId}/messages`);
      const newMsgRef = push(messagesRef);
      const realMsg = {
        senderId: user.uid,
        receiverId: userId,
        type: 'media',
        mediaType: 'audio',
        mediaUrl: downloadURL,
        duration: duration,
        timestamp: Date.now(),
        isRead: false,
      };
      if (currentReply) {
        realMsg.replyTo = {
          messageId: currentReply.messageId,
          senderName: currentReply.senderName,
          messageType: currentReply.messageType,
          textSnippet: currentReply.textSnippet,
        };
      }
      await set(newMsgRef, realMsg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...realMsg, id: newMsgRef.key, isUploading: false, uploadProgress: 100, isMediaReady: true }
            : m
        )
      );
      URL.revokeObjectURL(blobUrl);
      await patchMyUserChat(userId, {
        partnerName: location.state?.userName || partnerProfile?.name || 'User',
        partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '',
        lastMessage: '🎤 Voice note',
        lastSenderId: user.uid,
        lastUpdated: Date.now(),
        unreadCount: 0,
      });
      notifyChatListUpdate(userId, {
        lastMessage: 'You: 🎤 Voice note',
        lastSenderId: user.uid,
        timestamp: Date.now(),
        unreadCount: 0,
      });
      const recipientChatRef = ref(db, `userChats/${userId}/${user.uid}`);
      await runTransaction(recipientChatRef, (currentData) => {
        if (currentData === null) {
          return {
            id: user.uid,
            partnerName: currentUserProfile?.name || 'User',
            partnerAvatar: currentUserProfile?.avatar || '',
            lastMessage: '🎤 Voice note',
            lastSenderId: user.uid,
            lastUpdated: Date.now(),
            unreadCount: 1,
          };
        } else {
          currentData.unreadCount = (currentData.unreadCount || 0) + 1;
          currentData.lastMessage = '🎤 Voice note';
          currentData.lastSenderId = user.uid;
          currentData.lastUpdated = Date.now();
          return currentData;
        }
      });
      clearMessageCache(cId);
    } catch (err) {
      console.error('Voice upload failed:', err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      URL.revokeObjectURL(blobUrl);
      alert('Voice note upload failed. Please try again.');
    }
  };

  const cancelMediaPreview = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaptionText('');
    setIsUploading(false);
    setUploadProgress(0);
  };

  const handleSendText = async (e) => {
    e.preventDefault();
    const textToSend = newMessage.trim();
    if (!textToSend || !user?.uid || !userId) return;

    let currentReply = replyTo;
    setNewMessage('');
    const replyToSave = currentReply;
    setReplyTo(null);

    if (ended) {
      await clearEndedFlag();
    }

    const cId = [user.uid, userId].sort().join('_');
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      senderId: user.uid,
      receiverId: userId,
      type: 'text',
      text: textToSend,
      timestamp: Date.now(),
      isRead: false,
      pending: true,
    };
    if (replyToSave) {
      optimisticMsg.replyTo = {
        messageId: replyToSave.messageId,
        senderName: replyToSave.senderName,
        messageType: replyToSave.messageType,
        textSnippet: replyToSave.textSnippet,
      };
    }
    setMessages((prev) => [...prev, optimisticMsg]);
    prevMsgCountRef.current += 1;
    if (isNearBottomRef.current) {
      requestAnimationFrame(() => scrollToBottom(true));
    }

    const messagesRef = ref(db, `chats/${cId}/messages`);
    const newMsgRef = push(messagesRef);
    const sentAt = Date.now();
    const msgData = {
      senderId: user.uid,
      receiverId: userId,
      type: 'text',
      text: textToSend,
      timestamp: sentAt,
      clientTs: sentAt,
      isRead: false,
    };
    if (replyToSave) {
      msgData.replyTo = {
        messageId: replyToSave.messageId,
        senderName: replyToSave.senderName,
        messageType: replyToSave.messageType,
        textSnippet: replyToSave.textSnippet,
      };
    }
    try {
      await set(newMsgRef, msgData);
    } catch (err) {
      console.error('Send failed:', err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return;
    }

    await patchMyUserChat(userId, {
      partnerName: location.state?.userName || partnerProfile?.name || 'User',
      partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '',
      lastMessage: textToSend,
      lastSenderId: user.uid,
      lastUpdated: Date.now(),
      unreadCount: 0,
    });
    notifyChatListUpdate(userId, {
      lastMessage: `You: ${textToSend}`.slice(0, 40),
      lastSenderId: user.uid,
      timestamp: Date.now(),
      unreadCount: 0,
    });

    const recipientChatRef = ref(db, `userChats/${userId}/${user.uid}`);
    await runTransaction(recipientChatRef, (currentData) => {
      if (currentData === null) {
        return {
          id: user.uid,
          partnerName: currentUserProfile?.name || 'User',
          partnerAvatar: currentUserProfile?.avatar || '',
          lastMessage: textToSend,
          lastSenderId: user.uid,
          lastUpdated: Date.now(),
          unreadCount: 1,
        };
      } else {
        currentData.unreadCount = (currentData.unreadCount || 0) + 1;
        currentData.lastMessage = textToSend;
        currentData.lastSenderId = user.uid;
        currentData.lastUpdated = Date.now();
        return currentData;
      }
    });

    clearMessageCache(cId);
  };

  const displayName = sanitizeName(location.state?.userName || partnerProfile?.name, userId);

  // ─── Render message with reactions ─────────────────────────────
  const renderMessage = (msg) => {
    if (msg.type === 'system') {
      return (
        <div className="message-bubble system" key={msg.id}>
          {msg.text}
        </div>
      );
    }

    const isOwn = msg.senderId === user?.uid;
    const isDeleting = msg.id === deletingMessageId;
    const isAi = msg.senderId === 'echo_ai_assistant';

    const replyToDisplay = msg.replyTo
      ? { ...msg.replyTo, senderName: msg.replyTo.senderName || 'User' }
      : null;

    const showReply = !isOwn && !isAi;
    let allowEdit = false;
    if (isOwn) {
      if (msg.type === 'text') allowEdit = true;
      else if (msg.type === 'media' && msg.mediaType !== 'audio') allowEdit = true;
    }

    let copyText = null;
    if (msg.type === 'text' && msg.text) copyText = msg.text;
    const allowDelete = isOwn;

    // Reactions
    const reactions = msg.reactions || {};

    // ─── Shared shell: OUTER row does left/right alignment ──────
    const shell = (content) => (
      <div
        key={msg.id}
        className={`message-row ${isOwn ? 'own' : 'partner'} ${isDeleting ? 'deleting' : ''}`}
        ref={(el) => {
          if (el) messageRefs.current[msg.id] = el;
        }}
        style={msg.pending ? { opacity: 0.75 } : undefined}
      >
        <div className={`message-bubble ${isOwn ? 'own' : 'partner'}`}>
          <MessageMenu
            isOwn={isOwn}
            canDelete={allowDelete}
            onDelete={() => handleDeleteMessage(msg.id)}
            onReply={showReply ? () => handleReply(msg) : null}
            onEdit={allowEdit ? () => handleEditMessage(msg) : null}
            onReact={() => handleReact(msg)}
            copyText={copyText}
          >
            {replyToDisplay && (
              <RepliedMessage
                replyTo={replyToDisplay}
                onTap={() => scrollToMessage(replyToDisplay.messageId)}
              />
            )}
            {content}
          </MessageMenu>
        </div>
        {/* ─── Reactions rendered BELOW the bubble ─────────────── */}
        {renderReactions(reactions)}
      </div>
    );

    if (msg.type === 'echomoji') {
      const skinObj = msg.skinId ? getSkinById(msg.skinId) : null;
      return shell(
        <ECHOMOJI
          mood={msg.mood || 'neutral'}
          skin={skinObj}
          size={56}
          interactive={false}
          animated={true}
        />
      );
    }

    if (msg.type === 'media') {
      let content;
      if (msg.mediaType === 'audio') {
        content = msg.isUploading ? (
          <div className="media-upload-overlay">
            <div className="upload-spinner">
              <svg className="spinner-ring" viewBox="0 0 50 50">
                <circle className="spinner-path" cx="25" cy="25" r="20" fill="none" strokeWidth="4" />
              </svg>
            </div>
          </div>
        ) : (
          <AudioPlayer src={msg.mediaUrl} />
        );
      } else {
        content = (
          <ChatMediaMessage
            message={msg}
            isUploading={msg.isUploading}
            uploadProgress={msg.uploadProgress}
          />
        );
      }
      return shell(content);
    }

    // text
    return shell(
      <div className="message-text" style={{ whiteSpace: 'pre-wrap' }}>
        {msg.text}
        {msg.isEdited && <span className="message-edited-badge">(edited)</span>}
      </div>
    );
  };

  const renderPreviewOverlay = () => {
    if (!previewUrl) return null;
    return ReactDOM.createPortal(
      <div className="media-preview-overlay" onClick={cancelMediaPreview}>
        <div className="media-preview-content" onClick={(e) => e.stopPropagation()}>
          <button className="media-preview-close" onClick={cancelMediaPreview}>
            <i className="fas fa-times" />
          </button>
          <div className="media-preview-media">
            {selectedFile?.type.startsWith('video/') ? (
              <video src={previewUrl} controls autoPlay loop muted playsInline className="media-preview-video" />
            ) : (
              <img src={previewUrl} alt="Preview" className="media-preview-image" />
            )}
          </div>
          <div ref={captionPreviewRef} style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
            <input
              ref={captionInputRef}
              type="text"
              className="media-preview-caption"
              placeholder="Add a caption..."
              value={captionText}
              onChange={(e) => setCaptionText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  sendMediaMessage();
                }
              }}
              style={{ flex: 1 }}
              onFocus={() => { focusedField.current = 'caption'; }}
              onBlur={() => { /* keep last known focus */ }}
            />
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                fontSize: '22px',
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              <i className="fas fa-smile" />
            </button>
          </div>
          <button
            className="media-preview-send"
            onClick={sendMediaMessage}
            disabled={isUploading}
          >
            {isUploading ? `Uploading ${Math.round(uploadProgress)}%` : 'Send Media'}
          </button>
        </div>
      </div>,
      document.body
    );
  };

  const handleEmojiSelect = (emoji) => {
    const target = focusedField.current;
    if (target === 'caption' && captionInputRef.current) {
      const input = captionInputRef.current;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const current = captionText;
      const newText = current.substring(0, start) + emoji + current.substring(end);
      setCaptionText(newText);
      const newCursor = start + emoji.length;
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(newCursor, newCursor);
      }, 0);
      return;
    }
    if (inputRef.current) {
      const input = inputRef.current;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const current = newMessage;
      const newText = current.substring(0, start) + emoji + current.substring(end);
      setNewMessage(newText);
      const newCursor = start + emoji.length;
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(newCursor, newCursor);
      }, 0);
    } else {
      setNewMessage((prev) => prev + emoji);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText(e);
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    let mediaFile = null;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
        mediaFile = item.getAsFile();
        break;
      }
    }
    if (mediaFile) {
      e.preventDefault();
      setSelectedFile(mediaFile);
      const url = URL.createObjectURL(mediaFile);
      setPreviewUrl(url);
      setCaptionText('');
      setTimeout(() => captionInputRef.current?.focus(), 100);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (msgDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [newMessage]);

  useEffect(() => {
    if (!showMoreOptions) return;
    const handleClickOutside = (e) => {
      if (moreOptionsRef.current && !moreOptionsRef.current.contains(e.target)) {
        setShowMoreOptions(false);
      }
    };
    const t = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 10);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showMoreOptions]);

  return (
    <>
      <SEO
        title={`Chat with ${displayName}`}
        description={`Chat with ${displayName} on ECHO.`}
        url={`https://echoty.xyz/chat/${userId}`}
      />
      <StructuredData />

      <div className="chat-view">
        <VideoAudioProvider>
          {chatBgEnabled && (
            <div
              className={`echo-rings-bg ${ended ? 'is-ended' : 'is-active'}`}
              aria-hidden="true"
            >
              <span className="echo-bg-ring r1" />
              <span className="echo-bg-ring r2" />
              <span className="echo-bg-ring r3" />
            </div>
          )}

          <div className="messages-container" ref={messagesContainerRef} onScroll={handleScroll}>
            {(loadingMessages || !minLoadingTimePassed) && messages.length === 0 ? (
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
              messages.map((msg) => renderMessage(msg))
            )}
            {isAILoading && (
              <div className="message-bubble partner">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </VideoAudioProvider>

        {showEmojiPicker && (
          <ChatEmojiPicker
            onClose={() => setShowEmojiPicker(false)}
            onSelect={handleEmojiSelect}
            excludeRefs={[inputContainerRef, captionPreviewRef]}
          />
        )}

        <form className="chat-input-container" onSubmit={handleSendText} ref={inputContainerRef}>
          {replyTo && <ReplyPreview replyTo={replyTo} onCancel={cancelReply} />}
          <div className="chat-input-row">
            <button
              type="button"
              className="chat-emoji-btn"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Emojis"
            >
              <i className="fas fa-smile" />
            </button>

            <div className="chat-more-wrapper" ref={moreOptionsRef}>
              <button
                type="button"
                className="chat-more-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMoreOptions((v) => !v);
                }}
                title="More options"
              >
                <i className="fas fa-ellipsis-h" />
              </button>
              {showMoreOptions && (
                <div className="chat-more-options-popup" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="chat-more-option"
                    onClick={() => {
                      fileInputRef.current?.click();
                      setShowMoreOptions(false);
                    }}
                  >
                    <i className="fas fa-paperclip" />
                    <span>Attach</span>
                  </button>
                  <button
                    type="button"
                    className="chat-more-option danger"
                    onClick={() => {
                      setShowMoreOptions(false);
                      handleEndEcho();
                    }}
                    disabled={ended}
                    style={ended ? { opacity: 0.4, pointerEvents: 'none' } : undefined}
                  >
                    <i className="fas fa-stop-circle" />
                    <span>End ECHO</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className="chat-voice-btn"
              onClick={() => setShowVoiceRecorder(true)}
              title="Voice note"
            >
              <i className="fas fa-microphone" />
            </button>

            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder={`Message ${displayName}...`}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              rows={1}
            />

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,video/*"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />

            <button
              type="submit"
              className="chat-send-btn"
              disabled={!newMessage.trim()}
            >
              <i className="fas fa-paper-plane" />
            </button>
          </div>
        </form>

        {showVoiceRecorder && (
          <VoiceRecorder
            onSend={handleVoiceSend}
            onCancel={() => setShowVoiceRecorder(false)}
          />
        )}

        {renderPreviewOverlay()}

        <EditMessageModal
          isOpen={!!editingMessage}
          onClose={() => setEditingMessage(null)}
          messageText={editingMessage?.text || ''}
          onSave={saveEditedMessage}
        />

        <EditMediaCaptionModal
          isOpen={!!editingMediaMessage}
          onClose={() => setEditingMediaMessage(null)}
          currentCaption={editingMediaMessage?.caption || ''}
          mediaType={editingMediaMessage?.mediaType}
          onSave={saveMediaCaption}
        />

        <ConfirmModal
          isOpen={confirmEndState.isOpen}
          onClose={() => setConfirmEndState({ isOpen: false, partnerName: '' })}
          onConfirm={confirmEndEcho}
          title="End ECHO"
          message={`Are you sure you want to end this ECHO with ${confirmEndState.partnerName}?`}
          confirmText="End ECHO"
          cancelText="Cancel"
        />
      </div>

      {/* ─── Reaction Picker ────────────────────────────────────── */}
      {showReactionPicker && (
        <div className="reaction-picker-overlay" onClick={closeReactionPicker}>
          <div className="reaction-picker-container" onClick={(e) => e.stopPropagation()}>
            <ChatEmojiPicker
              onClose={closeReactionPicker}
              onSelect={handleReactionSelect}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default ChatView;