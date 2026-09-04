// src/components/pages/Chat/ChatView.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
import { useAuth } from '../../../hooks/useAuth';
import { sortMessages as sortMessagesByTime } from '../../../utils/sortMessages';
import { useProfile } from '../../../contexts/ProfileContext';
import { auth, db } from '../../../services/firebase';
import { apiUrl } from '../../../utils/api';
import {
  loadMessagesFromCache,
  upsertMessageInCache,
  deleteMessageFromCache,
  saveMessagesToCache,
} from '../../../services/messageStorage';
import { clearMessageCache } from '../../../services/messageCache';
import { cleanCachedMessagesForChat } from '../../../services/messageCleanup';
import { cacheMedia } from '../../../utils/mediaCache';
import { VideoAudioProvider } from '../../../contexts/VideoAudioContext';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import ChatMediaMessage from './ChatMediaMessage';
import AudioPlayer from './AudioPlayer';
import MessageMenu from './MessageMenu';
import { saveToEchoArchive, listEchoArchive, removeEchoArchive } from '../../../services/echoArchive';
import { privateExpiresAt, isTideExpired, tideProgress, formatTideLeft, PRIVATE_TTL_MS } from '../../../utils/echoTides';
import ReplyPreview from './ReplyPreview';
import RepliedMessage from './RepliedMessage';
import SwipeToReply from './SwipeToReply';
import EditMessageModal from './EditMessageModal';
import EditMediaCaptionModal from './EditMediaCaptionModal';
import ChatEmojiPicker from './ChatEmojiPicker';
import VoiceRecorder from './VoiceRecorder';
import MediaPreview from '../../common/MediaPreview';
import CustomVideoPlayer from '../../common/CustomVideoPlayer';
import ConfirmModal from '../../common/ConfirmModal';
import Modal from '../../common/Modal';
import Toast from '../../Toast/Toast';
import AiRichText from './AiRichText';
import { SkeletonMessage } from '../../common/SkeletonLoader';
import ECHOMOJI from '../../UI/ECHOMOJI';
import { getSkinById } from '../../../constants/echomoji';
import './ChatView.css';

const CLOUDINARY_CLOUD_NAME = 'rjlscgan';
const CLOUDINARY_UPLOAD_PRESET = 'echo_uploads';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_VIDEO_DURATION = 30 * 60; // 30 minutes

const ECHO_AI_ID = 'echo_ai_assistant';

// ─── Quick-reaction bar geometry ─────────────────────────────────
const REACTION_BAR_HEIGHT = 48;
const REACTION_BAR_GAP = 12;
const REACTION_ARROW_SIZE = 12;
const REACTION_BAR_HALF_WIDTH = 150;

// ─── NEW: Quick Responses ──────────────────────────────────────
const QUICK_RESPONSES = [
  '👍 Thanks!',
  '😊 Sounds good',
  '✅ Will do',
  '📌 Noted',
  '⏰ Let me check',
  '👋 Hey!',
  '💯 Agreed',
  '🙏 Appreciate it'
];

// ─── NEW: Scheduled Messages ──────────────────────────────────
const SCHEDULE_OPTIONS = [
  { label: 'In 1 hour', value: 3600000 },
  { label: 'In 2 hours', value: 7200000 },
  { label: 'In 6 hours', value: 21600000 },
  { label: 'Tomorrow', value: 86400000 },
  { label: 'Custom', value: 'custom' }
];

const sanitizeName = (rawName, userId) => {
  if (!rawName) return 'User';
  const str = String(rawName).trim();
  if (str === userId || (str.length >= 20 && !str.includes(' ') && /^[a-zA-Z0-9_-]+$/.test(str))) {
    return 'User';
  }
  return str;
};

const msgTime = (m) => {
  if (!m) return 0;
  const raw = m.timestamp ?? m.createdAt ?? m.clientTs ?? m.time;
  let t = raw;
  if (t && typeof t === 'object') {
    if (typeof t.toMillis === 'function') t = t.toMillis();
    else if (typeof t.seconds === 'number') t = t.seconds * 1000;
    else t = Number(t);
  } else {
    t = Number(t);
  }
  if (!Number.isFinite(t) || t <= 0) return 0;
  if (t < 1e12) t *= 1000;
  return t;
};

const sortMessages = (list) => sortMessagesByTime(list);

const formatMsgClock = (m) => {
  const ts = msgTime(m);
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
};

const formatReactionCount = (n) => {
  const count = Number(n) || 0;
  if (count <= 1) return '';
  if (count > 99) return '99+';
  return String(count);
};

const ChatView = () => {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { getProfile, fetchProfile } = useProfile();

  // ─── State ──────────────────────────────────────────────────────
  const [partnerProfile, setPartnerProfile] = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [ended, setEnded] = useState(false);
  const [endedByName, setEndedByName] = useState('');
  const [clearedAt, setClearedAt] = useState(0);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editingMediaMessage, setEditingMediaMessage] = useState(null);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactingMessageId, setReactingMessageId] = useState(null);
  const [reactionPickerAnchor, setReactionPickerAnchor] = useState(null);
  const [reactionViewer, setReactionViewer] = useState(null);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);

  // ─── NEW: Typing Indicators ──────────────────────────────────
  const [partnerIsTyping, setPartnerIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  // ─── NEW: Message Search ─────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);

  // ─── NEW: Scheduled Messages ─────────────────────────────────
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduledTime, setScheduledTime] = useState(null);
  const [scheduledMessages, setScheduledMessages] = useState([]);

  // ─── NEW: Quick Responses ────────────────────────────────────
  const [showQuickResponses, setShowQuickResponses] = useState(false);

  // ─── NEW: Online Status ──────────────────────────────────────
  const [partnerOnline, setPartnerOnline] = useState(false);

  // ─── NEW: Message Stats ──────────────────────────────────────
  const [messageStats, setMessageStats] = useState({ total: 0, sent: 0, received: 0 });

  // ─── NEW: Read Receipts ──────────────────────────────────────
  const [readReceipts, setReadReceipts] = useState({});

  // ─── NEW: Dark Mode ──────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('echo-dark-mode') === 'true';
    } catch {
      return false;
    }
  });

  // ─── Touch gesture refs ──────────────────────────────────────
  const touchTimerRef = useRef(null);
  const lastTapRef = useRef({ time: 0, msgId: null });

  // ─── Upload State ─────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [captionText, setCaptionText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showCaptionEmoji, setShowCaptionEmoji] = useState(false);
  const fileInputRef = useRef(null);
  const captionInputRef = useRef(null);

  // ─── File size warning modal ──────────────────────────────────
  const [fileSizeError, setFileSizeError] = useState(false);
  const [toast, setToast] = useState(null);
  const [bookmarkedIds, setBookmarkedIds] = useState({});
  const stampedLegacyTides = useRef(false);
  const [tideTick, setTideTick] = useState(Date.now());

  // ─── Confirm Modal State ──────────────────────────────────────
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: null,
  });

  // ─── Refs ──────────────────────────────────────────────────────
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const inputContainerRef = useRef(null);
  const captionPreviewRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const initialScrollRef = useRef(false);
  const prevMsgCountRef = useRef(0);
  const chatId = useRef(null);
  const isMounted = useRef(true);
  const markReadTimeout = useRef(null);
  const hasMarkedRead = useRef(false);
  const scrollCooldownRef = useRef(false);
  const focusedField = useRef('main');
  const moreOptionsRef = useRef(null);
  const messageRefs = useRef({});
  const clearedAtRef = useRef(0);

  // ─── Effects ──────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setLoadingMessages(false), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const hide = Boolean(previewUrl || editingMediaMessage || mediaPreview);
    document.body.classList.toggle('echo-hide-bottom-nav', hide);
    return () => document.body.classList.remove('echo-hide-bottom-nav');
  }, [previewUrl, editingMediaMessage, mediaPreview]);

  useEffect(() => {
    const id = setInterval(() => setTideTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // ─── NEW: Dark Mode Effect ──────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('echo-dark-mode', String(darkMode));
  }, [darkMode]);

  // ─── NEW: Typing Indicator Listener ──────────────────────────
  useEffect(() => {
    if (!user?.uid || !userId) return;
    const cId = [user.uid, userId].sort().join('_');
    const typingRef = ref(db, `chats/${cId}/typing/${userId}`);
    const unsub = onValue(typingRef, (snap) => {
      const data = snap.val();
      if (data?.isTyping && data?.timestamp > Date.now() - 3000) {
        setPartnerIsTyping(true);
      } else {
        setPartnerIsTyping(false);
      }
    });
    return () => unsub();
  }, [user?.uid, userId]);

  // ─── NEW: Online Status Listener ────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const statusRef = ref(db, `status/${userId}`);
    const unsub = onValue(statusRef, (snap) => {
      const data = snap.val();
      setPartnerOnline(data?.online && data?.lastSeen > Date.now() - 60000);
    });
    return () => unsub();
  }, [userId]);

  // ─── NEW: Scheduled Messages Listener ──────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const scheduleRef = ref(db, `scheduledMessages/${user.uid}`);
    const unsub = onValue(scheduleRef, (snap) => {
      const data = snap.val();
      if (data) {
        const msgs = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        setScheduledMessages(msgs);
        // Check if any scheduled messages are due
        const now = Date.now();
        msgs.forEach(async (msg) => {
          if (msg.scheduledAt <= now && msg.status === 'scheduled') {
            await sendScheduledMessage(msg);
          }
        });
      }
    });
    return () => unsub();
  }, [user?.uid]);

  // ─── NEW: Toggle Dark Mode ──────────────────────────────────
  const toggleDarkMode = () => setDarkMode(prev => !prev);

  // ─── NEW: Send Scheduled Message ────────────────────────────
  const sendScheduledMessage = async (scheduledMsg) => {
    if (!user?.uid || !userId) return;
    const cId = [user.uid, userId].sort().join('_');
    const messagesRef = ref(db, `chats/${cId}/messages`);
    const newMsgRef = push(messagesRef);
    const msgData = {
      senderId: user.uid,
      receiverId: userId,
      type: 'text',
      text: scheduledMsg.text,
      timestamp: Date.now(),
      clientTs: Date.now(),
      isRead: false,
      expiresAt: privateExpiresAt(),
      isScheduled: false,
      scheduledAt: scheduledMsg.scheduledAt,
    };
    await set(newMsgRef, msgData);
    // Remove from scheduled
    const scheduleRef = ref(db, `scheduledMessages/${user.uid}/${scheduledMsg.id}`);
    await remove(scheduleRef);
  };

  // ─── NEW: Schedule Message ──────────────────────────────────
  const scheduleMessage = async (text, delay) => {
    if (!user?.uid || !userId || !text.trim()) return;
    const scheduledAt = Date.now() + delay;
    const scheduleRef = ref(db, `scheduledMessages/${user.uid}`);
    const newRef = push(scheduleRef);
    await set(newRef, {
      text: text.trim(),
      scheduledAt,
      status: 'scheduled',
      chatId: [user.uid, userId].sort().join('_'),
      senderId: user.uid,
      receiverId: userId,
      createdAt: Date.now(),
    });
    setToast({ message: `Message scheduled for ${new Date(scheduledAt).toLocaleString()}`, type: 'success' });
    setNewMessage('');
    setShowSchedulePicker(false);
    setScheduledTime(null);
  };

  // ─── NEW: Message Search ────────────────────────────────────
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const results = messages.filter(msg => 
      msg.text?.toLowerCase().includes(query.toLowerCase()) ||
      msg.caption?.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResults(results);
  }, [messages]);

  // ─── NEW: Jump to Search Result ────────────────────────────
  const jumpToSearchResult = (messageId) => {
    const el = messageRefs.current[messageId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-flash');
      setTimeout(() => el.classList.remove('highlight-flash'), 2000);
    }
  };

  // ─── NEW: Quick Response Handler ────────────────────────────
  const handleQuickResponse = (response) => {
    setNewMessage(response);
    setShowQuickResponses(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ─── NEW: Typing Handler ────────────────────────────────────
  const handleTyping = useCallback(() => {
    if (!user?.uid || !userId) return;
    const cId = [user.uid, userId].sort().join('_');
    const typingRef = ref(db, `chats/${cId}/typing/${user.uid}`);
    set(typingRef, { isTyping: true, timestamp: Date.now() });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      set(typingRef, { isTyping: false });
    }, 2000);
  }, [user?.uid, userId]);

  // ─── NEW: Message Stats ─────────────────────────────────────
  useEffect(() => {
    const stats = messages.reduce((acc, msg) => {
      acc.total++;
      if (msg.senderId === user?.uid) acc.sent++;
      else acc.received++;
      return acc;
    }, { total: 0, sent: 0, received: 0 });
    setMessageStats(stats);
  }, [messages, user?.uid]);

  // ─── NEW: Read Receipts ────────────────────────────────────
  const updateReadReceipt = useCallback((msgId, userId, readAt) => {
    setReadReceipts(prev => ({
      ...prev,
      [msgId]: { ...prev[msgId], [userId]: readAt }
    }));
  }, []);

  // ─── Helper Functions ────────────────────────────────────────
  const pruneExpired = async (list, cId) => {
    if (userId === ECHO_AI_ID) return list;
    const keep = [];
    const gone = [];
    (list || []).forEach((m) => {
      if (isTideExpired(m) && !bookmarkedIds[m.id] && !m.pinned) gone.push(m);
      else keep.push(m);
    });
    if (gone.length && cId) {
      const updates = {};
      gone.forEach((m) => {
        if (m.id && !String(m.id).startsWith('temp_')) {
          updates[`chats/${cId}/messages/${m.id}`] = null;
          deleteMessageFromCache(cId, m.id).catch(() => {});
        }
      });
      if (keep.length === 0 && user?.uid && userId) {
        updates[`userChats/${user.uid}/${userId}/lastMessage`] = 'Start chatting...';
        updates[`userChats/${userId}/${user.uid}/lastMessage`] = 'Start chatting...';
      }
      if (Object.keys(updates).length) update(ref(db), updates).catch(() => {});
    }
    return keep;
  };

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  const openConfirmModal = (config) => setConfirmModal({ isOpen: true, ...config });

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

      const msgs = sortMessages(
        Object.entries(data).map(([key, val]) => ({ id: key, key, ...val }))
      );
      const latest = msgs[msgs.length - 1];
      if (latest) {
        if (latest.type === 'media') {
          latestMsg =
            latest.mediaType === 'video'
              ? '🎬 Video'
              : latest.mediaType === 'audio'
              ? '🎤 Voice note'
              : '📷 Image';
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
          updates[`chats/${cId}/messages/${msg.key}/readAt`] = Date.now();
          updates[`chats/${cId}/messages/${msg.key}/expiresAt`] = privateExpiresAt();
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

  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
    }
  };

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 0);

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

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 80;
    const isNear = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    isNearBottomRef.current = isNear;
    setIsNearBottom(isNear);
  }, []);

  // ─── Message Handlers ────────────────────────────────────────
  const handleSendText = async (e) => {
    e?.preventDefault?.();
    const textToSend = (typeof e === 'string' ? e : newMessage).trim();
    if (!textToSend || !user?.uid || !userId) return;

    // Check if schedule is set
    if (scheduledTime) {
      await scheduleMessage(textToSend, scheduledTime);
      return;
    }

    let currentReply = replyTo;
    const replyToSave = currentReply;
    setNewMessage('');
    setReplyTo(null);

    if (ended) {
      try {
        await remove(ref(db, `chats/${[user.uid, userId].sort().join('_')}/ended`));
        setEnded(false);
      } catch (_) {}
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
      expiresAt: privateExpiresAt(),
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
    const msgData = {
      senderId: user.uid,
      receiverId: userId,
      type: 'text',
      text: textToSend,
      timestamp: Date.now(),
      clientTs: Date.now(),
      isRead: false,
      expiresAt: privateExpiresAt(),
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

    if (userId === ECHO_AI_ID) {
      setIsAILoading(true);
      try {
        const token = await auth.currentUser?.getIdToken?.();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(apiUrl('/api/chat'), {
          method: 'POST',
          headers,
          body: JSON.stringify({ message: textToSend, userId: user.uid }),
        });
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || 'AI request failed');
        }
        const data = await response.json();
        if (data.reply) {
          setMessages((prev) => prev.concat({
            id: `ai_${Date.now()}`,
            senderId: ECHO_AI_ID,
            text: data.reply,
            timestamp: Date.now(),
            type: 'text',
          }));
        }
      } catch (err) {
        setMessages((prev) => prev.concat({
          id: `ai_err_${Date.now()}`,
          senderId: ECHO_AI_ID,
          text: 'ECHO AI could not reply. Check that the backend is running.',
          timestamp: Date.now(),
          type: 'text',
        }));
      } finally {
        setIsAILoading(false);
      }
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

  // ─── NEW: Voice-to-Text Input ──────────────────────────────
  const startVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
      setToast({ message: 'Voice input not supported in this browser', type: 'error' });
      return;
    }
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      setNewMessage(prev => prev + ' ' + transcript);
    };
    recognition.onerror = (err) => {
      console.error('Voice input error:', err);
      setToast({ message: 'Voice input failed. Please try again.', type: 'error' });
    };
    recognition.start();
  };

  // ─── NEW: Message Forwarding ────────────────────────────────
  const [forwardModal, setForwardModal] = useState({ isOpen: false, message: null, targetUserId: '' });

  const handleForward = async () => {
    if (!forwardModal.message || !forwardModal.targetUserId) return;
    const cId = [user.uid, forwardModal.targetUserId].sort().join('_');
    const forwardedMsg = {
      ...forwardModal.message,
      id: null,
      timestamp: Date.now(),
      isForwarded: true,
      originalSender: forwardModal.message.senderId,
    };
    delete forwardedMsg.pending;
    delete forwardedMsg.isUploading;
    delete forwardedMsg._file;
    const messagesRef = ref(db, `chats/${cId}/messages`);
    const newRef = push(messagesRef);
    await set(newRef, forwardedMsg);
    setForwardModal({ isOpen: false, message: null, targetUserId: '' });
    setToast({ message: 'Message forwarded successfully', type: 'success' });
  };

  // ─── sendMediaMessage ────────────────────────────────────────
  const sendMediaMessage = async (retryMessageId = null) => {
    let file = selectedFile;
    let caption = captionText.trim();
    let reply = replyTo;

    if (retryMessageId) {
      const failedMsg = messages.find(m => m.id === retryMessageId);
      if (!failedMsg || !failedMsg._file) {
        alert('Cannot retry: file not available.');
        return;
      }
      file = failedMsg._file;
      setMessages(prev => prev.filter(m => m.id !== retryMessageId));
    }

    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setFileSizeError(true);
      return;
    }

    if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const duration = await new Promise((resolve) => {
        video.onloadedmetadata = () => resolve(video.duration);
        video.onerror = () => resolve(0);
        video.src = URL.createObjectURL(file);
        video.load();
      });
      URL.revokeObjectURL(video.src);
      if (duration > MAX_VIDEO_DURATION) {
        alert(`Video is longer than 30 minutes (${Math.round(duration / 60)} min). Please choose a shorter video.`);
        return;
      }
    }

    setIsUploading(true);
    setUploadProgress(0);
    const cId = [user.uid, userId].sort().join('_');
    const tempId = `temp_${Date.now()}`;
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
    const mediaIcon = mediaType === 'video' ? '🎬 Video' : '📷 Image';
    const blobUrl = URL.createObjectURL(file);
    const currentReply = reply || replyTo;

    const optimisticMsg = {
      id: tempId,
      senderId: user.uid,
      receiverId: userId,
      type: 'media',
      mediaType,
      mediaUrl: blobUrl,
      realUrl: null,
      caption: caption,
      timestamp: Date.now(),
      isRead: false,
      expiresAt: privateExpiresAt(),
      isUploading: true,
      uploadProgress: 0,
      isMediaReady: true,
      uploadFailed: false,
      _file: file,
    };
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
      const downloadURL = await uploadToCloudinary(file, (progress) => {
        setUploadProgress(progress);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, uploadProgress: progress } : m
          )
        );
      });

      const messagesRef = ref(db, `chats/${cId}/messages`);
      const newMsgRef = push(messagesRef);
      const realMsg = {
        senderId: user.uid,
        receiverId: userId,
        type: 'media',
        mediaType,
        mediaUrl: downloadURL,
        caption: caption,
        timestamp: Date.now(),
        isRead: false,
        expiresAt: privateExpiresAt(),
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
            ? { ...realMsg, id: newMsgRef.key, isUploading: false, uploadProgress: 100, isMediaReady: true, uploadFailed: false, _file: undefined }
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
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, isUploading: false, uploadFailed: true, uploadProgress: 0 }
            : m
        )
      );
      URL.revokeObjectURL(blobUrl);
    }
  };

  const handleVoiceSend = async (audioBlob, duration) => {
    if (ended) {
      try {
        const cId = [user.uid, userId].sort().join('_');
        await remove(ref(db, `chats/${cId}/ended`));
        setEnded(false);
      } catch (_) {}
    }
    setShowVoiceRecorder(false);
    const cId = [user.uid, userId].sort().join('_');
    const tempId = `temp_${Date.now()}`;
    const blobUrl = URL.createObjectURL(audioBlob);
    const currentReply = replyTo;

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
      expiresAt: privateExpiresAt(),
      isUploading: true,
      uploadProgress: 0,
      isMediaReady: false,
      uploadFailed: false,
      _file: audioBlob,
    };
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
            } catch (e) {
              reject(e);
            }
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
        expiresAt: privateExpiresAt(),
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
            ? { ...realMsg, id: newMsgRef.key, isUploading: false, uploadProgress: 100, isMediaReady: true, uploadFailed: false, _file: undefined }
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
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, isUploading: false, uploadFailed: true, uploadProgress: 0 }
            : m
        )
      );
      URL.revokeObjectURL(blobUrl);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (userId === ECHO_AI_ID) {
      e.target.value = '';
      setToast({ message: 'Attachments are not available in ECHO AI chat right now.', type: 'info' });
      setTimeout(() => setToast(null), 2800);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileSizeError(true);
      e.target.value = '';
      return;
    }

    if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const duration = await new Promise((resolve) => {
        video.onloadedmetadata = () => resolve(video.duration);
        video.onerror = () => resolve(0);
        video.src = URL.createObjectURL(file);
        video.load();
      });
      URL.revokeObjectURL(video.src);
      if (duration > MAX_VIDEO_DURATION) {
        alert(`Video is longer than 30 minutes (${Math.round(duration / 60)} min). Please choose a shorter video.`);
        e.target.value = '';
        return;
      }
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setCaptionText('');
    e.target.value = '';
    setTimeout(() => captionInputRef.current?.focus(), 100);
    setShowMoreOptions(false);
  };

  const openMediaPreview = (file) => {
    if (!file) return;
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setCaptionText('');
    setTimeout(() => captionInputRef.current?.focus(), 100);
  };

  const cancelMediaPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaptionText('');
    setShowCaptionEmoji(false);
    setIsUploading(false);
    setUploadProgress(0);
  };

  const handlePaste = (e) => {
    if (userId === ECHO_AI_ID) {
      const items = e.clipboardData?.items || [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/') || items[i].type.startsWith('video/')) {
          e.preventDefault();
          setToast({ message: 'Images and videos are not available in ECHO AI chat right now.', type: 'info' });
          setTimeout(() => setToast(null), 2800);
          return;
        }
      }
    }
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
      if (mediaFile.size > MAX_FILE_SIZE) {
        setFileSizeError(true);
        return;
      }
      e.preventDefault();
      setSelectedFile(mediaFile);
      const url = URL.createObjectURL(mediaFile);
      setPreviewUrl(url);
      setCaptionText('');
      setTimeout(() => captionInputRef.current?.focus(), 100);
    }
  };

  const handleReply = useCallback((msg) => {
    const isOwnMsg = String(msg.senderId || '') === String(user?.uid || '');
    const senderName = isOwnMsg
      ? (currentUserProfile?.name || 'You')
      : (partnerProfile?.name || location.state?.userName || 'User');
    
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
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [user, partnerProfile, currentUserProfile, location.state?.userName]);

  const handleReact = useCallback((messageId) => {
    if (showReactionPicker && reactingMessageId === messageId) {
      setShowReactionPicker(false);
      setReactingMessageId(null);
      setReactionPickerAnchor(null);
      return;
    }

    const msgElement = messageRefs.current[messageId];
    if (msgElement) {
      const rect = msgElement.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;

      let top = rect.top - REACTION_BAR_HEIGHT - REACTION_BAR_GAP - REACTION_ARROW_SIZE;
      let flipped = false;

      if (top < 60) {
        top = rect.bottom + REACTION_BAR_GAP + REACTION_ARROW_SIZE;
        flipped = true;
      }

      let left = rect.left + rect.width / 2 - REACTION_BAR_HALF_WIDTH;
      left = Math.max(10, Math.min(left, windowWidth - 20));

      setReactionPickerAnchor({ top, left, flipped });
    }

    setShowReactionPicker(true);
    setReactingMessageId(messageId);
  }, [showReactionPicker, reactingMessageId]);

  // ─── NEW: Reaction Viewer ──────────────────────────────────
  const ReactionViewerModal = ({ isOpen, onClose, emoji, userIds }) => {
    if (!isOpen) return null;
    return (
      <div className="reaction-viewer-modal" onClick={onClose}>
        <div className="reaction-viewer-content" onClick={e => e.stopPropagation()}>
          <h3>Reactions {emoji}</h3>
          <div className="reaction-viewer-list">
            {userIds?.map(uid => (
              <div key={uid} className="reaction-viewer-item">
                <Avatar uid={uid} size="small" />
                <span>{getProfile(uid)?.name || 'User'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
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
      setEditingMessage(null);
      clearMessageCache(cId);
      setToast({ message: 'Message updated successfully', type: 'success' });
    } catch (err) {
      console.error('Edit failed:', err);
      setToast({ message: 'Failed to edit message', type: 'error' });
    }
  };

  const saveEditedMediaCaption = async (newCaption) => {
    if (!editingMediaMessage || !user?.uid || !userId) return;
    const cId = [user.uid, userId].sort().join('_');
    const messageId = editingMediaMessage.id;
    try {
      await update(ref(db, `chats/${cId}/messages/${messageId}`), {
        caption: newCaption,
        isEdited: true,
        lastEditedAt: serverTimestamp(),
      });
      setEditingMediaMessage(null);
      clearMessageCache(cId);
      setToast({ message: 'Caption updated successfully', type: 'success' });
    } catch (err) {
      console.error('Edit caption failed:', err);
      setToast({ message: 'Failed to edit caption', type: 'error' });
    }
  };

  const handleDeleteMessage = (msgId) => {
    setDeletingMessageId(msgId);
    openConfirmModal({
      title: 'Delete Message',
      message: 'Are you sure you want to delete this message? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: () => confirmDeleteMessage(msgId),
    });
  };

  const confirmDeleteMessage = async (msgId) => {
    if (!user?.uid || !userId) return;
    const cId = [user.uid, userId].sort().join('_');
    try {
      await remove(ref(db, `chats/${cId}/messages/${msgId}`));
      deleteMessageFromCache(cId, msgId).catch(() => {});
      setDeletingMessageId(null);
      clearMessageCache(cId);
      setToast({ message: 'Message deleted successfully', type: 'success' });
    } catch (err) {
      console.error('Delete failed:', err);
      setToast({ message: 'Failed to delete message', type: 'error' });
    }
  };

  const handleBookmark = (msgId) => {
    setBookmarkedIds((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
    const cId = [user.uid, userId].sort().join('_');
    const bookmarkRef = ref(db, `userChats/${user.uid}/${userId}/bookmarks/${msgId}`);
    if (bookmarkedIds[msgId]) {
      remove(bookmarkRef).catch(() => {});
    } else {
      set(bookmarkRef, { bookmarkedAt: Date.now() }).catch(() => {});
    }
  };

  // ─── NEW: Export Chat History ──────────────────────────────
  const exportChatHistory = async () => {
    const chatData = {
      partner: partnerProfile?.name || 'User',
      exportedAt: new Date().toISOString(),
      messages: messages.map(msg => ({
        sender: msg.senderId === user?.uid ? 'You' : (partnerProfile?.name || 'User'),
        text: msg.text || msg.caption || '[Media]',
        timestamp: new Date(msg.timestamp).toISOString(),
        type: msg.type || 'text'
      }))
    };
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_${partnerProfile?.name}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ message: 'Chat history exported successfully', type: 'success' });
  };

  // ─── Render ──────────────────────────────────────────────────
  // ... (Continue with render function - truncated for length)

  return (
    <div className={`chat-view-container ${darkMode ? 'dark-theme' : 'light-theme'}`}>
      {/* ... rest of render ... */}
    </div>
  );
};

export default ChatView;
