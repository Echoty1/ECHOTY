// src/components/pages/Chat/ChatView.js
import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
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

// ─── QUICK FIX: Add handleKeyDown function ────────────────────
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

  // Touch gesture refs
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

  // ─── QUICK FIX: Add handleKeyDown function ────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText(e);
    }
  };

  // ─── Message Handlers ────────────────────────────────────────
  const handleSendText = async (e) => {
    e?.preventDefault?.();
    const textToSend = (typeof e === 'string' ? e : newMessage).trim();
    if (!textToSend || !user?.uid || !userId) return;

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

  const handleReply = (msg) => {
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
  };

  // ─── Quick-reaction bar positioning ────────────────────────────
  const openReactionPickerFor = (msg, rectOverride = null) => {
    if (!msg) return;
    let rect = rectOverride;
    if (!rect) {
      const el = messageRefs.current[msg.id];
      rect = el ? el.getBoundingClientRect() : null;
    }

    let top = 96;
    let left = window.innerWidth / 2;
    let flipped = false;

    if (rect) {
      const barTopAbove = rect.top - REACTION_BAR_HEIGHT - REACTION_BAR_GAP;
      flipped = barTopAbove < 8;
      top = flipped ? rect.bottom + REACTION_BAR_GAP : barTopAbove;

      const maxTop = window.innerHeight - REACTION_BAR_HEIGHT - 8;
      if (top > maxTop) top = maxTop;
      if (top < 8) top = 8;

      left = rect.left + rect.width / 2;
      const minLeft = 8 + REACTION_BAR_HALF_WIDTH;
      const maxLeft = window.innerWidth - 8 - REACTION_BAR_HALF_WIDTH;
      if (left < minLeft) left = minLeft;
      if (left > maxLeft) left = maxLeft;
    }

    setReactionPickerAnchor({ top, left, flipped });
    setReactingMessageId(msg.id);
    setShowReactionPicker(true);
  };

  const handleReact = (msg) => {
    openReactionPickerFor(msg);
  };

  const handleReactionSelect = async (emoji, msgIdOverride = null) => {
    setShowReactionPicker(false);
    setReactionPickerAnchor(null);
    const targetId = msgIdOverride || reactingMessageId;
    if (!targetId || !user?.uid || !userId) return;
    const cId = [user.uid, userId].sort().join('_');
    const reactionRef = ref(db, `chats/${cId}/messages/${targetId}/reactions/${user.uid}`);
    try {
      const currentMsg = messages.find((m) => m.id === targetId);
      const currentReaction = currentMsg?.reactions?.[user.uid];
      if (currentReaction === emoji) {
        await remove(reactionRef);
      } else {
        await set(reactionRef, emoji);
      }
      setReactingMessageId(null);
    } catch (err) {
      console.warn('Reaction error:', err);
      if (!err.message?.includes('PERMISSION_DENIED')) {
        alert('Failed to react. Please try again.');
      }
    }
  };

  const closeReactionPicker = () => {
    setShowReactionPicker(false);
    setReactingMessageId(null);
    setReactionPickerAnchor(null);
  };

  // Close the floating bar if the list scrolls or the viewport resizes
  useEffect(() => {
    if (!showReactionPicker) return;
    const container = messagesContainerRef.current;
    const onDismiss = () => closeReactionPicker();
    if (container) container.addEventListener('scroll', onDismiss);
    window.addEventListener('resize', onDismiss);
    return () => {
      if (container) container.removeEventListener('scroll', onDismiss);
      window.removeEventListener('resize', onDismiss);
    };
  }, [showReactionPicker]);

  // ─── Touch Gesture handlers ────────────────────────────────────
  const handleTouchStart = (msg, e) => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    const targetEl = e?.currentTarget || null;
    const rect = targetEl ? targetEl.getBoundingClientRect() : null;
    touchTimerRef.current = setTimeout(() => {
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(50);
      }
      openReactionPickerFor(msg, rect);
    }, 400);
  };

  const handleTouchEnd = (msg) => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    const now = Date.now();
    const lastTap = lastTapRef.current;
    if (lastTap.msgId === msg.id && now - lastTap.time < 300) {
      handleReactionSelect('❤️', msg.id);
      lastTapRef.current = { time: 0, msgId: null };
    } else {
      lastTapRef.current = { time: now, msgId: msg.id };
    }
  };

  const handleTouchMove = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleEndEcho = () => {
    setShowMoreOptions(false);
    openConfirmModal({
      title: 'End ECHO',
      message: `Are you sure you want to end this ECHO with ${partnerProfile?.name || 'User'}?`,
      confirmText: 'End ECHO',
      cancelText: 'Cancel',
      onConfirm: async () => {
        closeConfirmModal();
        if (!user?.uid || !userId) return;
        const cId = [user.uid, userId].sort().join('_');
        const myName = currentUserProfile?.name || user.displayName || 'User';
        try {
          await set(ref(db, `chats/${cId}/ended`), {
            by: user.uid,
            byName: myName,
            at: Date.now(),
          });
          const messagesRef = ref(db, `chats/${cId}/messages`);
          const newMsgRef = push(messagesRef);
          await set(newMsgRef, {
            senderId: 'system',
            type: 'system',
            text: `${myName} ended this ECHO.`,
            timestamp: Date.now(),
            clientTs: Date.now(),
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
          setEnded(true);
          setEndedByName(myName);
        } catch (err) {
          console.error('Failed to end ECHO:', err);
          alert('Failed to end ECHO. Please try again.');
        }
      },
    });
  };

  const jumpToMessage = (messageId) => {
    const el = messageRefs.current[messageId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-flash');
      setTimeout(() => el.classList.remove('highlight-flash'), 1600);
    } else {
      scrollToBottom(true);
    }
  };

  useEffect(() => {
    const focusId = new URLSearchParams(location.search || '').get('focus');
    if (!focusId || !messages.length) return;
    const t = setTimeout(() => jumpToMessage(focusId), 250);
    return () => clearTimeout(t);
  }, [location.search, messages.length]);

  const openUserChat = (senderId) => {
    if (!senderId || senderId === user?.uid || senderId === 'system') return;
    const profile = getProfile?.(senderId);
    navigate(`/chat/${senderId}`, {
      state: {
        fromCommunity: location.state?.fromCommunity || null,
        userName: profile?.name || 'User',
        userAvatar: profile?.avatar || '',
        returnTo: 'chat',
      },
    });
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

  const renderPreviewOverlay = () => {
    if (!previewUrl) return null;
    return (
      <div className="media-preview-overlay" onClick={(e) => {
        if (e.target === e.currentTarget) cancelMediaPreview();
      }}>
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
            <textarea
              ref={captionInputRef}
              className="media-preview-caption"
              placeholder="Add a caption..."
              value={captionText}
              onChange={(e) => setCaptionText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMediaMessage();
                }
              }}
              style={{
                flex: 1,
                resize: 'none',
                minHeight: '44px',
                maxHeight: '120px',
                lineHeight: '1.4',
                fontFamily: 'inherit',
                padding: '10px 16px',
                borderRadius: '24px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={() => focusedField.current = 'caption'}
            />
            <button
              type="button"
              className="media-preview-emoji-btn"
              onClick={() => setShowCaptionEmoji(!showCaptionEmoji)}
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                fontSize: '22px',
                cursor: 'pointer',
                padding: '4px 8px',
                flexShrink: 0,
              }}
            >
              <i className="fas fa-smile" />
            </button>
          </div>
          {showCaptionEmoji && (
            <ChatEmojiPicker
              onClose={() => setShowCaptionEmoji(false)}
              onSelect={(emoji) => setCaptionText((t) => t + emoji)}
              excludeRefs={[captionPreviewRef]}
            />
          )}
          <button
            className="media-preview-send"
            onClick={() => sendMediaMessage()}
            disabled={isUploading}
          >
            {isUploading ? `Uploading ${Math.round(uploadProgress)}%` : 'Send Media'}
          </button>
        </div>
      </div>
    );
  };

  // ─── Render message ────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    listEchoArchive(user.uid).then((rows) => {
      const map = {};
      rows.forEach((row) => { if (row.message?.id) map[row.message.id] = row.archiveId; });
      setBookmarkedIds(map);
    }).catch(() => {});
  }, [user?.uid]);

  const saveMessageToArchive = async (msg) => {
    const cId = [user.uid, userId].sort().join('_');
    try {
      if (bookmarkedIds[msg.id]) {
        await removeEchoArchive(bookmarkedIds[msg.id]);
        await update(ref(db, `chats/${cId}/messages/${msg.id}`), { pinned: null }).catch(() => {});
        setBookmarkedIds((prev) => { const n = { ...prev }; delete n[msg.id]; return n; });
        return;
      }
      const senderName = msg.senderId === user.uid ? (currentUserProfile?.name || 'You') : (partnerProfile?.name || getProfile?.(msg.senderId)?.name || 'User');
      const senderAvatar = msg.senderId === user.uid ? (currentUserProfile?.avatar || '') : (partnerProfile?.avatar || getProfile?.(msg.senderId)?.avatar || '');
      const result = await saveToEchoArchive(user.uid, { ...msg, senderName, senderAvatar }, {
        chatId: cId,
        source: 'chat',
        partnerId: userId,
        senderName,
        senderAvatar,
      });
      if (result?.ok) {
        await update(ref(db, `chats/${cId}/messages/${msg.id}`), { pinned: true }).catch(() => {});
        const rows = await listEchoArchive(user.uid);
        const map = {};
        rows.forEach((row) => { if (row.message?.id) map[row.message.id] = row.archiveId; });
        setBookmarkedIds(map);
      }
    } catch (_) {}
  };

  const renderTide = (msg) => {
    void tideTick;
    if (userId === ECHO_AI_ID || msg.pinned || bookmarkedIds[msg.id]) return null;
    const fake = { ...msg, expiresAt: msg.expiresAt || (Number(msg.timestamp) || Date.now()) + PRIVATE_TTL_MS };
    return (
      <span className="echo-tide-chip" title="ECHO Tide">
        <i className="fas fa-water" aria-hidden="true" />
        {formatTideLeft(fake)}
      </span>
    );
  };

  const renderReactions = (reactions, messageId, isOwn) => {
    if (!reactions || typeof reactions !== 'object') return null;
    const entries = Object.entries(reactions);
    if (entries.length === 0) return null;

    const groups = {};
    entries.forEach(([uid, emoji]) => {
      if (!groups[emoji]) groups[emoji] = [];
      groups[emoji].push(uid);
    });

    const openReactionViewer = (emoji, reacs, msgId) => {
      const userIds = Object.keys(reacs).filter((uid) => reacs[uid] === emoji);
      if (userIds.length === 0) return;
      setReactionViewer({ emoji, userIds, messageId: msgId });
    };

    return (
      <div
        className="message-reactions"
        style={{
          position: 'absolute',
          bottom: '-12px',
          [isOwn ? 'left' : 'right']: '8px',
          display: 'flex',
          gap: '4px',
          zIndex: 3,
        }}
      >
        {Object.entries(groups).map(([emoji, uids]) => (
          <span
            key={emoji}
            className="reaction-badge clickable"
            onClick={(e) => {
              e.stopPropagation();
              openReactionViewer(emoji, reactions, messageId);
            }}
            title={`${uids.length} reaction${uids.length !== 1 ? 's' : ''}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              background: 'var(--bg-primary, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '999px',
              padding: '2px 6px',
              fontSize: '13px',
              lineHeight: 1,
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            {emoji}
            {uids.length > 1 && (
              <span
                className="reaction-count"
                style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}
              >
                {formatReactionCount(uids.length)}
              </span>
            )}
          </span>
        ))}
      </div>
    );
  };

  const renderMessage = (msg) => {
    if (msg.type === 'system' || msg.system) {
      return (
        <div className="message-bubble system" key={msg.id}>
          {msg.text}
        </div>
      );
    }

    const isOwn = String(msg.senderId || '') === String(user?.uid || '');
    const isDeleting = msg.id === deletingMessageId;
    const isAi = msg.senderId === ECHO_AI_ID;

    const replyToDisplay = msg.replyTo
      ? { ...msg.replyTo, senderName: msg.replyTo.senderName || 'User' }
      : null;

    const showReply = !isAi;
    let allowEdit = false;
    if (isOwn && userId !== ECHO_AI_ID) {
      if (msg.type === 'text') allowEdit = true;
      else if (msg.type === 'media' && msg.mediaType !== 'audio') allowEdit = true;
    }

    let copyText = null;
    if (msg.type === 'text' && msg.text) copyText = msg.text;

    const allowDelete = isOwn || (userId === ECHO_AI_ID && (isOwn || isAi));

    const handleMediaClick = () => {
      if (msg.type === 'media') {
        if (msg.mediaType === 'video') {
          setVideoPreview({ src: msg.mediaUrl });
        } else if (msg.mediaType === 'image') {
          setMediaPreview({ src: msg.mediaUrl, type: 'image', alt: msg.caption || 'Image' });
        }
      }
    };

    const handleRetry = () => {
      sendMediaMessage(msg.id);
    };

    const sentClock = formatMsgClock(msg);

    const shell = (inner) => {
      const isHovered = hoveredMessageId === msg.id;
      const row = (
        <div
          className={`message-row ${isOwn ? 'own' : 'partner'} ${isDeleting ? 'deleting' : ''} ${Date.now() - (msg.timestamp || 0) < 1600 ? (isOwn ? 'just-sent' : 'just-received') : ''} ${isTideExpired(msg) ? 'tide-leaving' : ''} ${isHovered ? 'is-hovered' : ''}`}
          ref={(el) => {
            if (el) messageRefs.current[msg.id] = el;
          }}
          onMouseEnter={() => setHoveredMessageId(msg.id)}
          onMouseLeave={() => setHoveredMessageId(null)}
          onTouchStart={(e) => handleTouchStart(msg, e)}
          onTouchEnd={() => handleTouchEnd(msg)}
          onTouchMove={handleTouchMove}
        >
          <div
            className={`message-stack ${isOwn ? 'own' : 'partner'}`}
            style={{
              position: 'relative',
              marginBottom: msg.reactions && Object.keys(msg.reactions).length > 0 ? '14px' : 0,
            }}
          >
            <div className={`message-bubble ${isOwn ? 'own' : 'partner'}`}>
              {inner}
              {sentClock ? <div className="message-meta-time">{sentClock}</div> : null}
              {renderTide(msg)}
            </div>
            {renderReactions(msg.reactions, msg.id, isOwn)}
          </div>
        </div>
      );

      if (showReply) {
        return (
          <SwipeToReply key={msg.id} direction={isOwn ? 'left' : 'right'} onReply={() => handleReply(msg)}>
            {row}
          </SwipeToReply>
        );
      }

      return <Fragment key={msg.id}>{row}</Fragment>;
    };

    if (msg.type === 'echomoji') {
      const skinObj = msg.skinId ? getSkinById(msg.skinId) : null;
      return shell(
        <MessageMenu
          isOwn={isOwn}
          canDelete={allowDelete}
          onDelete={() => handleDeleteMessage(msg.id)}
          onReply={showReply ? () => handleReply(msg) : null}
          onEdit={null}
          onReact={isAi || userId === ECHO_AI_ID ? null : () => handleReact(msg)}
          onSave={() => saveMessageToArchive(msg)}
          saved={!!bookmarkedIds[msg.id]}
          copyText={null}
        >
          {replyToDisplay && (
            <RepliedMessage replyTo={replyToDisplay} onTap={() => jumpToMessage(replyToDisplay.messageId)} />
          )}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
            <ECHOMOJI
              mood={msg.mood || 'neutral'}
              skin={skinObj}
              size={56}
              interactive={false}
              animated={true}
            />
          </div>
        </MessageMenu>
      );
    }

    if (msg.type === 'media') {
      let content;
      if (msg.mediaType === 'audio') {
        if (msg.isUploading) {
          content = (
            <div className="media-upload-overlay">
              <div className="upload-spinner">
                <svg className="spinner-ring" viewBox="0 0 50 50">
                  <circle className="spinner-path" cx="25" cy="25" r="20" fill="none" strokeWidth="4" />
                </svg>
              </div>
            </div>
          );
        } else if (msg.uploadFailed) {
          content = (
            <div className="media-error-placeholder">
              <i className="fas fa-exclamation-triangle" />
              <span>Upload failed</span>
              <button onClick={handleRetry}>Retry</button>
            </div>
          );
        } else {
          content = <AudioPlayer src={msg.mediaUrl} />;
        }
      } else {
        if (msg.uploadFailed) {
          content = (
            <div className="media-error-placeholder">
              <i className="fas fa-exclamation-triangle" />
              <span>Upload failed</span>
              <button onClick={handleRetry}>Retry</button>
            </div>
          );
        } else {
          content = (
            <div
              onClick={!msg.isUploading ? handleMediaClick : undefined}
              style={{ cursor: !msg.isUploading ? 'pointer' : 'default' }}
            >
              <ChatMediaMessage
                message={msg}
                isUploading={msg.isUploading}
                uploadProgress={msg.uploadProgress}
                disablePreview={true}
              />
            </div>
          );
        }
      }
      return shell(
        <MessageMenu
          isOwn={isOwn}
          canDelete={allowDelete}
          onDelete={() => handleDeleteMessage(msg.id)}
          onReply={showReply ? () => handleReply(msg) : null}
          onEdit={allowEdit ? () => handleEditMessage(msg) : null}
          onReact={isAi || userId === ECHO_AI_ID ? null : () => handleReact(msg)}
          onSave={() => saveMessageToArchive(msg)}
          saved={!!bookmarkedIds[msg.id]}
          copyText={null}
        >
          {replyToDisplay && (
            <RepliedMessage replyTo={replyToDisplay} onTap={() => jumpToMessage(replyToDisplay.messageId)} />
          )}
          {content}
        </MessageMenu>
      );
    }

    return shell(
      <MessageMenu
        isOwn={isOwn}
        canDelete={allowDelete}
        onDelete={() => handleDeleteMessage(msg.id)}
        onReply={showReply ? () => handleReply(msg) : null}
        onEdit={allowEdit ? () => handleEditMessage(msg) : null}
        onReact={isAi || userId === ECHO_AI_ID ? null : () => handleReact(msg)}
        onSave={() => saveMessageToArchive(msg)}
        saved={!!bookmarkedIds[msg.id]}
        copyText={copyText}
      >
        {replyToDisplay && (
          <RepliedMessage replyTo={replyToDisplay} onTap={() => jumpToMessage(replyToDisplay.messageId)} />
        )}
        <div className="message-text" style={{ whiteSpace: userId === ECHO_AI_ID && !isOwn ? 'normal' : 'pre-wrap' }}>
          {userId === ECHO_AI_ID && !isOwn ? (
            <AiRichText text={msg.text} onFollowup={(q) => handleSendText(q)} />
          ) : (
            msg.text
          )}
          {msg.isEdited && <span className="message-edited-badge">(edited)</span>}
        </div>
      </MessageMenu>
    );
  };

  useEffect(() => {
    clearedAtRef.current = clearedAt || 0;
  }, [clearedAt]);

  useEffect(() => {
    return () => {
      (messages || []).forEach((m) => {
        if (typeof m?.mediaUrl === 'string' && m.mediaUrl.startsWith('blob:')) {
          try { URL.revokeObjectURL(m.mediaUrl); } catch (_) {}
        }
      });
    };
  }, [userId]);

  // ─── UseEffect: clear unread ──────────────────────────────────
  useEffect(() => {
    if (!user?.uid || !userId) return;
    clearUnreadInstantly();
    const syncTimer = setTimeout(() => {
      if (isMounted.current) {
        markMessagesAsRead();
      }
    }, 100);
    return () => {
      clearTimeout(syncTimer);
    };
  }, [user?.uid, userId]);

  // ─── UseEffect: messages listener ────────────────────────────
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
        setMessages(sortMessages(visible.filter((m) => userId === 'echo_ai_assistant' || !isTideExpired(m))));
        if (userId !== ECHO_AI_ID && !stampedLegacyTides.current && visible.length) {
          stampedLegacyTides.current = true;
          const stamp = {};
          visible.forEach((m) => {
            if (m.id && !m.expiresAt) {
              stamp[`chats/${cId}/messages/${m.id}/expiresAt`] = privateExpiresAt(m.timestamp || m.createdAt);
            }
          });
          if (Object.keys(stamp).length) update(ref(db), stamp).catch(() => {});
        }
        setLoadingMessages(false);
        prevMsgCountRef.current = visible.length;
        if (!initialScrollRef.current) {
          initialScrollRef.current = true;
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
        visible = await pruneExpired(
          visible.filter((m) => userId === ECHO_AI_ID || !isTideExpired(m) || m.pinned || bookmarkedIds[m.id]),
          cId
        );
        if (userId !== ECHO_AI_ID) {
          visible = visible.filter((m) => !isTideExpired(m) || m.pinned || bookmarkedIds[m.id]);
        }

        setMessages((prev) => {
          const pending = (prev || []).filter(
            (m) =>
              m.pending &&
              !visible.some(
                (v) =>
                  v.id === m.id ||
                  (v.text === m.text &&
                    v.senderId === m.senderId &&
                    Math.abs(msgTime(v) - msgTime(m)) < 5000)
              )
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
        const isIncoming = newest && newest.senderId && newest.senderId !== user.uid;
        prevMsgCountRef.current = visible.length;

        if (!initialScrollRef.current) {
          initialScrollRef.current = true;
          requestAnimationFrame(() => scrollToBottom(false));
        } else if (grew && isNearBottomRef.current) {
          requestAnimationFrame(() => scrollToBottom(true));
        } else if (grew && isIncoming && isNearBottomRef.current) {
          requestAnimationFrame(() => scrollToBottom(true));
        }

        Promise.resolve().then(async () => {
          try {
            for (const msg of visible) {
              await upsertMessageInCache(cId, msg);
              if (msg.type === 'media' && msg.mediaUrl && msg.mediaUrl.startsWith('http')) {
                cacheMedia(msg.mediaUrl);
              }
            }
            await saveMessagesToCache(cId, visible);
          } catch (_) {}
        });
        clearMessageCache(cId);

        const hasUnread = newMessages.some((msg) => msg.receiverId === user.uid && msg.isRead === false);
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
        if (messages.length === 0) {
          setMessages([
            {
              id: 'error',
              senderId: 'system',
              text: '⚠️ Could not load messages. Please check your connection.',
              timestamp: Date.now(),
              type: 'text',
              isRead: true,
            },
          ]);
        }
      }
    );

    return () => {
      isMounted.current = false;
      if (markReadTimeout.current) clearTimeout(markReadTimeout.current);
      unsubscribe();
    };
  }, [user?.uid, userId]);

  // ─── UseEffect: partner profile ───────────────────────────────
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

  // ─── UseEffect: current user profile ──────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const myProfileRef = ref(db, `profiles/${user.uid}`);
    get(myProfileRef)
      .then((snap) => {
        if (snap.exists()) setCurrentUserProfile(snap.val());
      })
      .catch(console.error);
  }, [user?.uid]);

  // ─── UseEffect: auto-resize textarea ──────────────────────────
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [newMessage]);

  // ─── UseEffect: click outside more options ────────────────────
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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (!messagesEndRef.current) return;
    if (!initialScrollRef.current) {
      initialScrollRef.current = true;
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
      return;
    }
    if (isNearBottomRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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

  // ─── UseEffect: ended flag ────────────────────────────────────
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

  // ─── UseEffect: clearedAt ──────────────────────────────────────
  useEffect(() => {
    if (!user?.uid || !userId) {
      setClearedAt(0);
      return;
    }
    const clearedRef = ref(db, `userChats/${user.uid}/${userId}/clearedAt`);
    const unsub = onValue(clearedRef, (snap) => {
      const val = typeof snap.val() === 'number' ? snap.val() : 0;
      clearedAtRef.current = val;
      setClearedAt(val);
      if (val) {
        setMessages((prev) =>
          prev.filter((m) => {
            if (m.pending) return true;
            const ts = typeof m.timestamp === 'number' ? m.timestamp : 0;
            return !ts || ts >= val;
          })
        );
      }
    });
    const onLocalClear = (e) => {
      if (e.detail?.partnerId === userId) {
        const now = Date.now();
        clearedAtRef.current = now;
        setClearedAt(now);
        setMessages([]);
      }
    };
    window.addEventListener('chat-history-cleared', onLocalClear);
    return () => {
      unsub();
      window.removeEventListener('chat-history-cleared', onLocalClear);
    };
  }, [user?.uid, userId]);

  const displayName = sanitizeName(location.state?.userName || partnerProfile?.name, userId);

  // ─── FINAL RENDER ──────────────────────────────────────────────
  return (
    <>
      <style>{`
        .echo-reaction-backdrop {
          position: fixed;
          inset: 0;
          z-index: 998;
          background: transparent;
        }
        .echo-reaction-bar {
          position: fixed;
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 4px;
          background: var(--bg-primary, #ffffff);
          border: 1px solid var(--border-color, rgba(0,0,0,0.06));
          border-radius: 999px;
          padding: 6px 10px;
          box-shadow: 0 10px 28px rgba(0,0,0,0.20), 0 2px 8px rgba(0,0,0,0.10);
          transform: translateX(-50%);
          animation: echoReactionPop 0.15s cubic-bezier(0.2, 0.8, 0.4, 1) both;
        }
        @keyframes echoReactionPop {
          from { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.85); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        .echo-reaction-bar .echo-reaction-emoji {
          background: none;
          border: none;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 50%;
          transition: transform 0.12s ease, background 0.12s ease;
        }
        .echo-reaction-bar .echo-reaction-emoji:hover,
        .echo-reaction-bar .echo-reaction-emoji:active {
          transform: scale(1.3);
          background: rgba(0,0,0,0.06);
        }
        .echo-reaction-bar-arrow {
          position: fixed;
          width: ${REACTION_ARROW_SIZE}px;
          height: ${REACTION_ARROW_SIZE}px;
          background: var(--bg-primary, #ffffff);
          border: 1px solid var(--border-color, rgba(0,0,0,0.06));
          border-top: none;
          border-left: none;
          transform: translateX(-50%) rotate(45deg);
          z-index: 999;
        }
      `}</style>

      <SEO title={`Chat with ${displayName}`} description={`Chat with ${displayName} on ECHO.`} />
      <StructuredData />
      <div className="chat-view">
        <VideoAudioProvider>
          {chatBgEnabled && (
            <div className="echo-rings-bg is-active" aria-hidden="true">
              <span className="echo-bg-ring r1" />
              <span className="echo-bg-ring r2" />
              <span className="echo-bg-ring r3" />
            </div>
          )}

          <div className="messages-container" ref={messagesContainerRef} onScroll={handleScroll}>
            {loadingMessages && messages.length === 0 ? (
              <div className="chat-skeleton-list">
                <SkeletonMessage />
                <SkeletonMessage />
                <SkeletonMessage />
              </div>
            ) : messages.length === 0 ? (
              <div className="empty-chat-state">
                <i className="fas fa-paper-plane empty-icon" />
                <p>No messages yet. Say hello!</p>
              </div>
            ) : (
              sortMessages(messages).map((msg) => renderMessage(msg))
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

        {showReactionPicker && reactionPickerAnchor && (
          <>
            <div className="echo-reaction-backdrop" onClick={closeReactionPicker} />
            <div
              className="echo-reaction-bar"
              style={{ top: reactionPickerAnchor.top, left: reactionPickerAnchor.left }}
              onClick={(e) => e.stopPropagation()}
            >
              {['❤️', '😂', '😮', '😢', '👍', '👎'].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="echo-reaction-emoji"
                  onClick={() => handleReactionSelect(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div
              className="echo-reaction-bar-arrow"
              style={{
                top: reactionPickerAnchor.flipped
                  ? reactionPickerAnchor.top - REACTION_ARROW_SIZE / 2
                  : reactionPickerAnchor.top + REACTION_BAR_HEIGHT - REACTION_ARROW_SIZE / 2,
                left: reactionPickerAnchor.left,
              }}
            />
          </>
        )}

        <form className="chat-input-container" onSubmit={handleSendText} ref={inputContainerRef}>
          {replyTo && <ReplyPreview replyTo={replyTo} onCancel={() => setReplyTo(null)} />}
          <div className="chat-input-row">
            <button
              type="button"
              className="chat-emoji-btn"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Emojis"
            >
              <i className="fas fa-smile" />
            </button>

            <button
              type="button"
              className="chat-voice-btn"
              onClick={() => {
                if (userId === ECHO_AI_ID) {
                  setToast({ message: 'Voice notes are not available in ECHO AI chat right now.', type: 'info' });
                  setTimeout(() => setToast(null), 2800);
                  return;
                }
                setShowVoiceRecorder(true);
              }}
              title="Voice note"
            >
              <i className="fas fa-microphone" />
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

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,video/*"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />

            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder={`Message ${displayName}...`}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              rows={1}
              style={{
                resize: 'none',
                overflow: 'hidden',
                minHeight: '44px',
                maxHeight: '120px',
                lineHeight: '1.4',
                fontFamily: 'inherit',
                flex: 1,
                padding: '10px 16px',
                borderRadius: '24px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={() => { focusedField.current = 'main'; }}
            />

            <button type="submit" className="chat-send-btn" disabled={!newMessage.trim()}>
              <i className="fas fa-paper-plane" />
            </button>
          </div>
        </form>

        {showVoiceRecorder && (
          <VoiceRecorder onSend={handleVoiceSend} onCancel={() => setShowVoiceRecorder(false)} />
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

        {mediaPreview && (
          <MediaPreview
            src={mediaPreview.src}
            type={mediaPreview.type}
            alt={mediaPreview.alt}
            onClose={() => setMediaPreview(null)}
          />
        )}

        {videoPreview && (
          <CustomVideoPlayer src={videoPreview.src} onClose={() => setVideoPreview(null)} />
        )}

        <ConfirmModal
          isOpen={confirmModal.isOpen}
          onClose={closeConfirmModal}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          cancelText={confirmModal.cancelText}
        />

        <Modal
          isOpen={fileSizeError}
          onClose={() => setFileSizeError(false)}
          title="File Too Large"
          message="The file you tried to upload exceeds the 20 MB limit. Please choose a smaller file."
          type="error"
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </>
  );
};

export default ChatView;
