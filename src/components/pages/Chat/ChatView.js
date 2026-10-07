// src/components/pages/Chat/ChatView.js
import React, { useState, useEffect, useRef, useCallback, Fragment, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ref, onValue, push, set, update, get, remove, serverTimestamp, runTransaction,
} from 'firebase/database';
import { useAuth } from '../../../hooks/useAuth';
import { sortMessages as sortMessagesByTime } from '../../../utils/sortMessages';
import { useProfile } from '../../../contexts/ProfileContext';
import { auth, db } from '../../../services/firebase';
import { apiUrl } from '../../../utils/api';
import { postNoteReply } from '../../../services/notesService';
import {
  loadMessagesFromCache, upsertMessageInCache, deleteMessageFromCache, saveMessagesToCache,
} from '../../../services/messageStorage';
import { clearMessageCache } from '../../../services/messageCache';
import { cleanCachedMessagesForChat } from '../../../services/messageCleanup';
import { cacheMedia } from '../../../utils/mediaCache';
import { VideoAudioProvider } from '../../../contexts/VideoAudioContext';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import Avatar from '../../common/Avatar';
import ChatMediaMessage from './ChatMediaMessage';
import AudioPlayer from './AudioPlayer';
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
import WallpaperPicker from './WallpaperPicker';
import { getWallpaperById } from '../../../constants/wallpapers';
import { playSentSound, unlockAudio, getSoundEnabled } from '../../../services/notificationService';
import { REACTION_EMOJIS, REACTION_LABELS } from './ReactionEmoji';
import { useUserSettings } from '../../../hooks/useUserSettings';
import { useUserPrivacy } from '../../../hooks/useUserPrivacy';
import { useUserPresence } from '../../../hooks/usePresence';
import { formatLastSeen } from '../../../utils/formatLastSeen';
import { isBlocked as checkIsBlocked, unblockUser } from '../../../services/blockService';
import { sendPushToUser } from '../../../services/fcmService'; // ← NEW
import './ChatView.css';

// ─── Link preview imports ──────────────────────────────────────
import LinkPreviewCard from './LinkPreviewCard';
import { extractFirstUrl, fetchLinkPreview } from '../../../utils/linkPreview';
// ────────────────────────────────────────────────────────────────

// ─── Spotlight share card ───────────────────────────────────────
import ChatSpotlightCard from './ChatSpotlightCard';
// ────────────────────────────────────────────────────────────────

/* ─────────────────────────────────────────────────────────────
   Visual-viewport hook (unchanged)
   ───────────────────────────────────────────────────────────── */
const useVisualViewport = () => {
  useEffect(() => {
    const root = document.documentElement;
    const isTouch =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(hover: none)').matches ||
        window.matchMedia?.('(pointer: coarse)').matches);
    if (!isTouch) {
      root.style.removeProperty('--vvh');
      root.style.removeProperty('--vvt');
      root.style.removeProperty('--kb');
      root.classList.remove('keyboard-open');
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => {
      const h = vv.height;
      const top = vv.offsetTop;
      const kb = Math.max(0, window.innerHeight - h - top);
      root.style.setProperty('--vvh', `${h}px`);
      root.style.setProperty('--vvt', `${top}px`);
      root.style.setProperty('--kb', `${kb}px`);
      root.classList.toggle('keyboard-open', kb > 120);
    };
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      root.style.removeProperty('--vvh');
      root.style.removeProperty('--vvt');
      root.style.removeProperty('--kb');
      root.classList.remove('keyboard-open');
    };
  }, []);
};

const CLOUDINARY_CLOUD_NAME = 'rjlscgan';
const CLOUDINARY_UPLOAD_PRESET = 'echo_uploads';
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_VIDEO_DURATION = 30 * 60;
const ECHO_AI_ID = 'echo_ai_assistant';

const REACTION_BAR_HEIGHT = 48;
const REACTION_BAR_GAP = 12;
const REACTION_ARROW_SIZE = 12;
const REACTION_BAR_HALF_WIDTH = 150;

const GROUP_WINDOW_MS = 2 * 60 * 1000;

const FONT_SIZE_MAP = { sm: '13px', md: '15px', lg: '17px' };

const sanitizeName = (rawName, userId) => {
  if (!rawName) return 'User';
  const str = String(rawName).trim();
  if (str === userId || (str.length >= 20 && !str.includes(' ') && /^[a-zA-Z0-9_-]+$/.test(str))) return 'User';
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
  } catch { return ''; }
};

const formatReactionCount = (n) => {
  const count = Number(n) || 0;
  if (count <= 1) return '';
  if (count > 99) return '99+';
  return String(count);
};

const startOfDay = (ts) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const formatDayLabel = (ts) => {
  const today = startOfDay(Date.now());
  const yesterday = today - 86400000;
  const day = startOfDay(ts);
  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';
  const d = new Date(ts);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, sameYear
    ? { month: 'long', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
};

const senderColor = (uid) => {
  const colors = ['#e17076', '#7bc862', '#e5ca77', '#65aadd', '#a695e7', '#ee7aae', '#6ec9cb', '#faa774'];
  if (!uid) return colors[0];
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) | 0;
  return colors[Math.abs(h) % colors.length];
};

const MessageReceipt = ({ msg, isMe }) => {
  if (!isMe) return null;
  const read = !!msg.readAt || msg.isRead === true;
  const delivered = !!msg.deliveredAt || msg.received === true;
  if (read) return <span className="message-receipt read" title="Read">✓✓</span>;
  if (delivered) return <span className="message-receipt delivered" title="Delivered">✓✓</span>;
  return <span className="message-receipt sent" title="Sent">✓</span>;
};

const ChatView = () => {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { getProfile, fetchProfile } = useProfile();

  useVisualViewport();

  const { settings: userSettings } = useUserSettings(user?.uid);
  const partnerPrivacy = useUserPrivacy(userId);
  const partnerPresence = useUserPresence(userId);

  const tideTTL = userSettings?.echo?.defaultTideTTL ?? PRIVATE_TTL_MS;
  const enterToSend = userSettings?.chats?.enterToSend !== false;
  const showTyping = userSettings?.chats?.showTyping !== false;
  const sendReadReceipts = userSettings?.chats?.sendReadReceipts !== false;
  const fontSize = userSettings?.chats?.fontSize || 'md';
  const autoSaveMedia = userSettings?.chats?.mediaAutoDownload === 'always';
  const videoFullscreenDefault = userSettings?.chats?.videoFullscreen !== false;

  const [blockedByMe, setBlockedByMe] = useState(false);

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
  const [activeMessageMenuId, setActiveMessageMenuId] = useState(null);
  const [partnerIsTyping, setPartnerIsTyping] = useState(false);

  const [replyToNote, setReplyToNote] = useState(null);

  const [wallpaperId, setWallpaperId] = useState('default');
  const [customWallpaper, setCustomWallpaper] = useState(null);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);

  const [haloActive, setHaloActive] = useState(false);
  const longPressTimer = useRef(null);

  const typingTimeoutRef = useRef(null);
  const touchTimerRef = useRef(null);
  const lastTapRef = useRef({ time: 0, msgId: null });

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [captionText, setCaptionText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showCaptionEmoji, setShowCaptionEmoji] = useState(false);
  const fileInputRef = useRef(null);
  const captionInputRef = useRef(null);

  const [fileSizeError, setFileSizeError] = useState(false);
  const [toast, setToast] = useState(null);
  const [bookmarkedIds, setBookmarkedIds] = useState({});
  const stampedLegacyTides = useRef(false);
  const [tideTick, setTideTick] = useState(Date.now());

  const [savingIds, setSavingIds] = useState({});

  const [pressedMsgId, setPressedMsgId] = useState(null);
  const [tappedEmoji, setTappedEmoji] = useState(null);

  const [unreadWhileScrolled, setUnreadWhileScrolled] = useState(0);

  const [pinnedMessageId, setPinnedMessageId] = useState(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: '', message: '', confirmText: 'Confirm', cancelText: 'Cancel', onConfirm: null,
  });

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
  const focusedField = useRef('main');
  const moreOptionsRef = useRef(null);
  const messageRefs = useRef({});
  const clearedAtRef = useRef(0);
  const justSentIdsRef = useRef(new Set());
  const justArrivedIdsRef = useRef(new Set());
  const sendButtonRef = useRef(null);
  const noteReplyContext = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setLoadingMessages(false), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    document.body.classList.add('echo-hide-bottom-nav');
    return () => document.body.classList.remove('echo-hide-bottom-nav');
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTideTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const isTouch =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(hover: none)').matches ||
        window.matchMedia?.('(pointer: coarse)').matches);
    if (!isTouch) return;
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = null;
    const onResize = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = messagesContainerRef.current;
        if (el && isNearBottomRef.current) el.scrollTop = el.scrollHeight;
      });
    };
    vv.addEventListener('resize', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const state = location.state;
    if (!state) return;
    if (state.replyToNote && (state.prefilledNote || state.noteSong)) {
      const noteContext = {
        text: state.prefilledNote || '',
        authorUid: state.noteAuthorUid,
        authorName: state.noteAuthorName || 'User',
        createdAt: state.noteCreatedAt || Date.now(),
        song: state.noteSong || null,
      };
      setReplyToNote(noteContext);
      noteReplyContext.current = noteContext;
      if (typeof state.prefilledNote === 'string' && state.prefilledNote) setNewMessage(state.prefilledNote);
      navigate(location.pathname, { replace: true, state: {} });
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          try {
            const len = (state.prefilledNote || '').length;
            inputRef.current.setSelectionRange(len, len);
          } catch (_) {}
        }
      }, 120);
      return;
    }
    if (state.prefilledNote && typeof state.prefilledNote === 'string') {
      setNewMessage(state.prefilledNote);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          try { inputRef.current.setSelectionRange(state.prefilledNote.length, state.prefilledNote.length); } catch (_) {}
        }
      }, 120);
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => () => { noteReplyContext.current = null; }, [userId]);

  useEffect(() => {
    if (!user?.uid || !userId) return;
    const cId = [user.uid, userId].sort().join('_');
    const typingRef = ref(db, `chats/${cId}/typing/${userId}`);
    const checkTyping = (data) => {
      if (!data || !data.isTyping) return setPartnerIsTyping(false);
      const age = Date.now() - (data.timestamp || 0);
      setPartnerIsTyping(age < 4000);
    };
    const unsub = onValue(typingRef, (snap) => checkTyping(snap.val()));
    const interval = setInterval(() => {
      get(typingRef).then((snap) => checkTyping(snap.val())).catch(() => {});
    }, 2000);
    return () => { unsub(); clearInterval(interval); };
  }, [user?.uid, userId]);

  useEffect(() => {
    if (!user?.uid || !userId) return;
    const cId = [user.uid, userId].sort().join('_');
    const wpRef = ref(db, `chats/${cId}/wallpaper`);
    const cwRef = ref(db, `chats/${cId}/customWallpaper`);
    const unsubWp = onValue(wpRef, (snap) => setWallpaperId(snap.val() || 'default'));
    const unsubCw = onValue(cwRef, (snap) => setCustomWallpaper(snap.val() || null));
    return () => { unsubWp(); unsubCw(); };
  }, [user?.uid, userId]);

  useEffect(() => {
    if (!user?.uid || !userId) return;
    const cId = [user.uid, userId].sort().join('_');
    const pinRef = ref(db, `chats/${cId}/pinnedMessageId`);
    const unsub = onValue(pinRef, (snap) => setPinnedMessageId(snap.val() || null));
    return () => unsub();
  }, [user?.uid, userId]);

  useEffect(() => {
    if (!user?.uid || !userId) return undefined;
    let mounted = true;
    checkIsBlocked(user.uid, userId)
      .then((v) => { if (mounted) setBlockedByMe(!!v); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [user?.uid, userId]);

  const handleWallpaperSelect = async (id) => {
    setWallpaperId(id);
    try {
      const cId = [user.uid, userId].sort().join('_');
      await update(ref(db, `chats/${cId}`), { wallpaper: id });
    } catch (err) { console.error('Failed to save wallpaper', err); }
  };

  const handleCustomWallpaperSelect = async (url) => {
    setCustomWallpaper(url);
    setWallpaperId('__custom__');
    try {
      const cId = [user.uid, userId].sort().join('_');
      await update(ref(db, `chats/${cId}`), { wallpaper: '__custom__', customWallpaper: url });
    } catch (err) { console.error('Failed to save custom wallpaper', err); }
  };

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
    window.dispatchEvent(new CustomEvent('chat-list-update', { detail: { partnerId, patch } }));
  };

  const patchMyUserChat = async (partnerId, fields) => {
    if (!user?.uid || !partnerId) return;
    await update(ref(db, `userChats/${user.uid}/${partnerId}`), { id: partnerId, ...fields });
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
    if (!sendReadReceipts) return;
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

      const msgs = sortMessages(Object.entries(data).map(([key, val]) => ({ id: key, key, ...val })));
      const latest = msgs[msgs.length - 1];
      if (latest) {
        if (latest.type === 'media') latestMsg = latest.mediaType === 'video' ? '🎬 Video' : latest.mediaType === 'audio' ? '🎤 Voice note' : '📷 Image';
        else if (latest.type === 'echomoji') latestMsg = `😤 ECHOMOJI (${latest.mood || 'neutral'})`;
        else if (latest.type === 'spotlight') latestMsg = '🎬 Spotlight';
        else latestMsg = latest.text || '';
        latestSender = latest.senderId || '';
        latestTimestamp = latest.timestamp || Date.now();
      }

      msgs.forEach((msg) => {
        if (msg.receiverId === user.uid && msg.isRead === false) {
          updates[`chats/${cId}/messages/${msg.key}/isRead`] = true;
          updates[`chats/${cId}/messages/${msg.key}/readAt`] = Date.now();
          updates[`chats/${cId}/messages/${msg.key}/expiresAt`] = privateExpiresAt(Date.now(), tideTTL);
          hasUnread = true;
        }
      });
      if (!hasUnread) return;
      await update(ref(db), updates);
      await patchMyUserChat(userId, { partnerName: partnerProfile?.name || location.state?.userName || 'User', partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '', lastMessage: latestMsg, lastSenderId: latestSender, lastUpdated: latestTimestamp, unreadCount: 0 });
      window.dispatchEvent(new CustomEvent('chat-unread-cleared', { detail: { partnerId: userId } }));
      clearMessageCache(cId);
    } catch (err) { console.warn('⚠️ [Unread] markMessagesAsRead error:', err.message); }
  };

  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
    setUnreadWhileScrolled(0);
  };

  const uploadToCloudinary = (file, onProgress) => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, true);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => { if (xhr.status === 200) { try { resolve(JSON.parse(xhr.responseText).secure_url); } catch (err) { reject(err); } } else reject(new Error('Upload failed')); };
      xhr.onerror = () => reject(new Error('Network error'));
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
    if (isNear) setUnreadWhileScrolled(0);
  }, []);

  const handleTyping = useCallback(() => {
    if (!user?.uid || !userId) return;
    if (!showTyping) return;
    const cId = [user.uid, userId].sort().join('_');
    const typingRef = ref(db, `chats/${cId}/typing/${user.uid}`);
    set(typingRef, { isTyping: true, timestamp: Date.now() }).catch(() => {});
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      set(typingRef, { isTyping: false, timestamp: Date.now() }).catch(() => {});
    }, 2500);
  }, [user?.uid, userId, showTyping]);

  const clearMyTyping = useCallback(() => {
    if (!user?.uid || !userId) return;
    const cId = [user.uid, userId].sort().join('_');
    const typingRef = ref(db, `chats/${cId}/typing/${user.uid}`);
    set(typingRef, { isTyping: false, timestamp: Date.now() }).catch(() => {});
  }, [user?.uid, userId]);

  useEffect(() => () => { clearMyTyping(); }, [clearMyTyping]);

  const flashSent = (id) => {
    if (!id) return;
    justSentIdsRef.current.add(id);
    setTimeout(() => { justSentIdsRef.current.delete(id); setMessages((prev) => [...prev]); }, 800);
  };
  const flashArrived = (id) => {
    if (!id) return;
    justArrivedIdsRef.current.add(id);
    setTimeout(() => { justArrivedIdsRef.current.delete(id); setMessages((prev) => [...prev]); }, 700);
  };
  const triggerSendRipple = () => {
    const btn = sendButtonRef.current;
    if (!btn) return;
    btn.classList.remove('rippling');
    void btn.offsetWidth;
    btn.classList.add('rippling');
    setTimeout(() => btn.classList.remove('rippling'), 650);
  };

  const publishNoteReply = (text, song = null) => {
    const ctx = noteReplyContext.current;
    if (!ctx?.authorUid || !user?.uid) return;
    if (ctx.authorUid === user.uid) return;
    postNoteReply(ctx.authorUid, {
      authorUid: user.uid,
      authorName: currentUserProfile?.name || user.displayName || 'User',
      authorAvatar: currentUserProfile?.avatar || '',
      text: text || '',
      song: song || null,
    }).catch((err) => console.warn('postNoteReply failed', err));
    noteReplyContext.current = null;
  };

  const handleDownloadMedia = async (msg, isAuto = false) => {
    if (!msg || !msg.mediaUrl || !msg.mediaUrl.startsWith('http')) return;
    const id = msg.id;
    if (savingIds[id] === 'saving') return;
    setSavingIds((prev) => ({ ...prev, [id]: 'saving' }));

    try {
      const res = await fetch(msg.mediaUrl, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();

      let ext = 'jpg';
      if (msg.mediaType === 'video') ext = 'mp4';
      else if (msg.mediaType === 'audio') ext = 'webm';
      else if (blob.type) {
        if (blob.type.includes('png')) ext = 'png';
        else if (blob.type.includes('gif')) ext = 'gif';
        else if (blob.type.includes('webp')) ext = 'webp';
        else if (blob.type.includes('jpeg') || blob.type.includes('jpg')) ext = 'jpg';
      }
      const safeSender = (msg.senderName || 'echo').replace(/[^a-z0-9]/gi, '_').slice(0, 20);
      const filename = `echo_${safeSender}_${Date.now()}.${ext}`;

      if (window.showSaveFilePicker && !isAuto) {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: msg.mediaType === 'video' ? 'Video' : 'Image',
              accept: { [blob.type || 'application/octet-stream']: ['.' + ext] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      setSavingIds((prev) => ({ ...prev, [id]: 'saved' }));
      if (!isAuto) {
        setToast({ message: 'Saved to your device', type: 'success' });
        setTimeout(() => setToast(null), 2200);
      }
      setTimeout(() => {
        setSavingIds((prev) => {
          const n = { ...prev };
          delete n[id];
          return n;
        });
      }, 2500);
    } catch (err) {
      console.warn('Download failed:', err);
      setSavingIds((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
      if (!isAuto) {
        setToast({ message: 'Could not save media', type: 'error' });
        setTimeout(() => setToast(null), 2200);
      }
    }
  };
    const handleSendText = async (e) => {
    e?.preventDefault?.();
    const textToSend = (typeof e === 'string' ? e : newMessage).trim();
    if (!textToSend || !user?.uid || !userId) return;

    setHaloActive(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    clearMyTyping();

    const currentNoteReply = replyToNote;
    const replyToSave = replyTo;
    setNewMessage('');
    setReplyTo(null);
    setReplyToNote(null);

    if (ended) {
      try { await remove(ref(db, `chats/${[user.uid, userId].sort().join('_')}/ended`)); setEnded(false); } catch (_) {}
    }

    const cId = [user.uid, userId].sort().join('_');
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = { id: tempId, senderId: user.uid, receiverId: userId, type: 'text', text: textToSend, timestamp: Date.now(), isRead: false, expiresAt: privateExpiresAt(Date.now(), tideTTL), pending: true };
    if (replyToSave) optimisticMsg.replyTo = { messageId: replyToSave.messageId, senderName: replyToSave.senderName, messageType: replyToSave.messageType, textSnippet: replyToSave.textSnippet };
    if (currentNoteReply) optimisticMsg.replyToNote = { ...currentNoteReply };
    setMessages((prev) => sortMessages([...prev, optimisticMsg]));
    prevMsgCountRef.current += 1;
    if (isNearBottomRef.current) requestAnimationFrame(() => scrollToBottom(true));

    const messagesRef = ref(db, `chats/${cId}/messages`);
    const newMsgRef = push(messagesRef);
    const msgData = { senderId: user.uid, receiverId: userId, type: 'text', text: textToSend, timestamp: Date.now(), clientTs: Date.now(), isRead: false, expiresAt: privateExpiresAt(Date.now(), tideTTL) };
    if (replyToSave) msgData.replyTo = { messageId: replyToSave.messageId, senderName: replyToSave.senderName, messageType: replyToSave.messageType, textSnippet: replyToSave.textSnippet };
    if (currentNoteReply) msgData.replyToNote = { ...currentNoteReply };

    try { await set(newMsgRef, msgData); } catch (err) { console.error('Send failed:', err); setMessages((prev) => prev.filter((m) => m.id !== tempId)); return; }

    const detectedUrl = extractFirstUrl(textToSend);
    if (detectedUrl) {
      fetchLinkPreview(detectedUrl)
        .then((preview) => {
          if (!preview) return;
          update(ref(db, `chats/${cId}/messages/${newMsgRef.key}`), { linkPreview: preview }).catch(() => {});
        })
        .catch(() => {});
    }

    if (currentNoteReply) publishNoteReply(textToSend);
    triggerSendRipple();
    flashSent(newMsgRef.key);
    if (getSoundEnabled()) playSentSound();

    if (userId === ECHO_AI_ID) {
      setIsAILoading(true);
      try {
        const token = await auth.currentUser?.getIdToken?.();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(apiUrl('/api/chat'), { method: 'POST', headers, body: JSON.stringify({ message: textToSend, userId: user.uid }) });
        if (!response.ok) throw new Error('AI request failed');
        const data = await response.json();
        if (data.reply) setMessages((prev) => sortMessages(prev.concat({ id: `ai_${Date.now()}`, senderId: ECHO_AI_ID, text: data.reply, timestamp: Date.now(), type: 'text' })));
      } catch (err) {
        setMessages((prev) => sortMessages(prev.concat({ id: `ai_err_${Date.now()}`, senderId: ECHO_AI_ID, text: 'ECHO AI could not reply. Check that the backend is running.', timestamp: Date.now(), type: 'text' })));
      } finally { setIsAILoading(false); }
    }

    await patchMyUserChat(userId, { partnerName: location.state?.userName || partnerProfile?.name || 'User', partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '', lastMessage: textToSend, lastSenderId: user.uid, lastUpdated: Date.now(), unreadCount: 0 });
    notifyChatListUpdate(userId, { lastMessage: `You: ${textToSend}`.slice(0, 40), lastSenderId: user.uid, timestamp: Date.now(), unreadCount: 0 });

    const recipientChatRef = ref(db, `userChats/${userId}/${user.uid}`);
    await runTransaction(recipientChatRef, (currentData) => {
      if (currentData === null) return { id: user.uid, partnerName: currentUserProfile?.name || 'User', partnerAvatar: currentUserProfile?.avatar || '', lastMessage: textToSend, lastSenderId: user.uid, lastUpdated: Date.now(), unreadCount: 1 };
      currentData.unreadCount = (currentData.unreadCount || 0) + 1;
      currentData.lastMessage = textToSend;
      currentData.lastSenderId = user.uid;
      currentData.lastUpdated = Date.now();
      return currentData;
    });
    clearMessageCache(cId);

    // 🔔 Fire push notification to recipient (skip AI)
    if (userId !== ECHO_AI_ID) {
      sendPushToUser({
        recipientUid: userId,
        title: currentUserProfile?.name || user.displayName || 'ECHO',
        body: textToSend.slice(0, 120),
        data: {
          partnerId: user.uid,
          title: currentUserProfile?.name || user.displayName || 'ECHO',
          body: textToSend.slice(0, 120),
          icon: currentUserProfile?.avatar || '/logo192.png',
        },
      }).catch(() => {});
    }
  };

  const sendMediaMessage = async (retryMessageId = null) => {
    let file = selectedFile;
    let caption = captionText.trim();
    let reply = replyTo;
    let noteReply = replyToNote;

    if (retryMessageId) {
      const failedMsg = messages.find(m => m.id === retryMessageId);
      if (!failedMsg || !failedMsg._file) { alert('Cannot retry: file not available.'); return; }
      file = failedMsg._file;
      setMessages(prev => prev.filter(m => m.id !== retryMessageId));
    }

    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { setFileSizeError(true); return; }

    setIsUploading(true);
    setUploadProgress(0);
    const cId = [user.uid, userId].sort().join('_');
    const tempId = `temp_${Date.now()}`;
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
    const mediaIcon = mediaType === 'video' ? '🎬 Video' : '📷 Image';
    const blobUrl = URL.createObjectURL(file);
    const currentReply = reply || replyTo;

    const optimisticMsg = { id: tempId, senderId: user.uid, receiverId: userId, type: 'media', mediaType, mediaUrl: blobUrl, realUrl: null, caption, timestamp: Date.now(), isRead: false, expiresAt: privateExpiresAt(Date.now(), tideTTL), isUploading: true, uploadProgress: 0, isMediaReady: true, uploadFailed: false, _file: file };
    if (currentReply) { optimisticMsg.replyTo = { messageId: currentReply.messageId, senderName: currentReply.senderName, messageType: currentReply.messageType, textSnippet: currentReply.textSnippet }; setReplyTo(null); }
    if (noteReply) { optimisticMsg.replyToNote = { ...noteReply }; setReplyToNote(null); }

    setMessages((prev) => sortMessages([...prev, optimisticMsg]));
    setPreviewUrl(null);
    setSelectedFile(null);
    setCaptionText('');

    try {
      const downloadURL = await uploadToCloudinary(file, (progress) => { setUploadProgress(progress); setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, uploadProgress: progress } : m)); });
      const messagesRef = ref(db, `chats/${cId}/messages`);
      const newMsgRef = push(messagesRef);
      const realMsg = { senderId: user.uid, receiverId: userId, type: 'media', mediaType, mediaUrl: downloadURL, caption, timestamp: Date.now(), isRead: false, expiresAt: privateExpiresAt(Date.now(), tideTTL) };
      if (currentReply) realMsg.replyTo = { messageId: currentReply.messageId, senderName: currentReply.senderName, messageType: currentReply.messageType, textSnippet: currentReply.textSnippet };
      if (noteReply) realMsg.replyToNote = { ...noteReply };
      await set(newMsgRef, realMsg);
      setMessages((prev) => sortMessages(prev.map((m) => m.id === tempId ? { ...realMsg, id: newMsgRef.key, isUploading: false, uploadProgress: 100, isMediaReady: true, uploadFailed: false, _file: undefined } : m)));
      URL.revokeObjectURL(blobUrl);

      if (noteReply) publishNoteReply(caption || mediaIcon);
      triggerSendRipple();
      flashSent(newMsgRef.key);
      if (getSoundEnabled()) playSentSound();

      await patchMyUserChat(userId, { partnerName: location.state?.userName || partnerProfile?.name || 'User', partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '', lastMessage: mediaIcon, lastSenderId: user.uid, lastUpdated: Date.now(), unreadCount: 0 });
      const recipientChatRef = ref(db, `userChats/${userId}/${user.uid}`);
      await runTransaction(recipientChatRef, (currentData) => {
        if (currentData === null) return { id: user.uid, partnerName: currentUserProfile?.name || 'User', partnerAvatar: currentUserProfile?.avatar || '', lastMessage: mediaIcon, lastSenderId: user.uid, lastUpdated: Date.now(), unreadCount: 1 };
        currentData.unreadCount = (currentData.unreadCount || 0) + 1;
        currentData.lastMessage = mediaIcon;
        currentData.lastSenderId = user.uid;
        currentData.lastUpdated = Date.now();
        return currentData;
      });
      clearMessageCache(cId);
      setIsUploading(false);
      setUploadProgress(0);

      // 🔔 Fire push notification for media (skip AI)
      if (userId !== ECHO_AI_ID) {
        sendPushToUser({
          recipientUid: userId,
          title: currentUserProfile?.name || user.displayName || 'ECHO',
          body: caption ? caption.slice(0, 120) : mediaIcon,
          data: {
            partnerId: user.uid,
            title: currentUserProfile?.name || user.displayName || 'ECHO',
            body: caption ? caption.slice(0, 120) : mediaIcon,
            icon: currentUserProfile?.avatar || '/logo192.png',
          },
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setIsUploading(false);
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, isUploading: false, uploadFailed: true, uploadProgress: 0 } : m));
      URL.revokeObjectURL(blobUrl);
    }
  };

  const handleVoiceSend = async (audioBlob, duration) => {
    if (ended) { try { const cId = [user.uid, userId].sort().join('_'); await remove(ref(db, `chats/${cId}/ended`)); setEnded(false); } catch (_) {} }
    setShowVoiceRecorder(false);
    const cId = [user.uid, userId].sort().join('_');
    const tempId = `temp_${Date.now()}`;
    const blobUrl = URL.createObjectURL(audioBlob);
    const currentReply = replyTo;
    const noteReply = replyToNote;
    const optimisticMsg = { id: tempId, senderId: user.uid, receiverId: userId, type: 'media', mediaType: 'audio', mediaUrl: blobUrl, duration, timestamp: Date.now(), isRead: false, expiresAt: privateExpiresAt(Date.now(), tideTTL), isUploading: true, uploadProgress: 0, isMediaReady: false, uploadFailed: false, _file: audioBlob };
    if (currentReply) { optimisticMsg.replyTo = { messageId: currentReply.messageId, senderName: currentReply.senderName, messageType: currentReply.messageType, textSnippet: currentReply.textSnippet }; setReplyTo(null); }
    if (noteReply) { optimisticMsg.replyToNote = { ...noteReply }; setReplyToNote(null); }
    setMessages((prev) => sortMessages([...prev, optimisticMsg]));

    try {
      const formData = new FormData();
      formData.append('file', audioBlob);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, true);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) { const progress = Math.round((e.loaded / e.total) * 100); setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, uploadProgress: progress } : m))); } };
      const uploadPromise = new Promise((resolve, reject) => { xhr.onload = () => { if (xhr.status === 200) { try { resolve(JSON.parse(xhr.responseText).secure_url); } catch (e) { reject(e); } } else reject(new Error('Upload failed')); }; xhr.onerror = () => reject(new Error('Network error')); });
      xhr.send(formData);
      const downloadURL = await uploadPromise;
      const messagesRef = ref(db, `chats/${cId}/messages`);
      const newMsgRef = push(messagesRef);
      const realMsg = { senderId: user.uid, receiverId: userId, type: 'media', mediaType: 'audio', mediaUrl: downloadURL, duration, timestamp: Date.now(), isRead: false, expiresAt: privateExpiresAt(Date.now(), tideTTL) };
      if (currentReply) realMsg.replyTo = { messageId: currentReply.messageId, senderName: currentReply.senderName, messageType: currentReply.messageType, textSnippet: currentReply.textSnippet };
      if (noteReply) realMsg.replyToNote = { ...noteReply };
      await set(newMsgRef, realMsg);
      setMessages((prev) => sortMessages(prev.map((m) => m.id === tempId ? { ...realMsg, id: newMsgRef.key, isUploading: false, uploadProgress: 100, isMediaReady: true, uploadFailed: false, _file: undefined } : m)));
      URL.revokeObjectURL(blobUrl);
      if (noteReply) publishNoteReply('🎤 Voice note');
      triggerSendRipple();
      flashSent(newMsgRef.key);
      if (getSoundEnabled()) playSentSound();
      await patchMyUserChat(userId, { partnerName: location.state?.userName || partnerProfile?.name || 'User', partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '', lastMessage: '🎤 Voice note', lastSenderId: user.uid, lastUpdated: Date.now(), unreadCount: 0 });
      const recipientChatRef = ref(db, `userChats/${userId}/${user.uid}`);
      await runTransaction(recipientChatRef, (currentData) => {
        if (currentData === null) return { id: user.uid, partnerName: currentUserProfile?.name || 'User', partnerAvatar: currentUserProfile?.avatar || '', lastMessage: '🎤 Voice note', lastSenderId: user.uid, lastUpdated: Date.now(), unreadCount: 1 };
        currentData.unreadCount = (currentData.unreadCount || 0) + 1;
        currentData.lastMessage = '🎤 Voice note';
        currentData.lastSenderId = user.uid;
        currentData.lastUpdated = Date.now();
        return currentData;
      });
      clearMessageCache(cId);

      // 🔔 Fire push notification for voice note (skip AI)
      if (userId !== ECHO_AI_ID) {
        sendPushToUser({
          recipientUid: userId,
          title: currentUserProfile?.name || user.displayName || 'ECHO',
          body: '🎤 Voice note',
          data: {
            partnerId: user.uid,
            title: currentUserProfile?.name || user.displayName || 'ECHO',
            body: '🎤 Voice note',
            icon: currentUserProfile?.avatar || '/logo192.png',
          },
        }).catch(() => {});
      }
    } catch (err) { console.error('Voice upload failed:', err); setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, isUploading: false, uploadFailed: true, uploadProgress: 0 } : m)); URL.revokeObjectURL(blobUrl); }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (userId === ECHO_AI_ID) { e.target.value = ''; setToast({ message: 'Attachments are not available in ECHO AI chat right now.', type: 'info' }); setTimeout(() => setToast(null), 2800); return; }
    if (file.size > MAX_FILE_SIZE) { setFileSizeError(true); e.target.value = ''; return; }
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setCaptionText('');
    e.target.value = '';
    setTimeout(() => captionInputRef.current?.focus(), 100);
    setShowMoreOptions(false);
  };

  const cancelMediaPreview = () => { if (previewUrl) URL.revokeObjectURL(previewUrl); setSelectedFile(null); setPreviewUrl(null); setCaptionText(''); setShowCaptionEmoji(false); setIsUploading(false); setUploadProgress(0); };

  const handlePaste = (e) => {
    if (userId === ECHO_AI_ID) { const items = e.clipboardData?.items || []; for (let i = 0; i < items.length; i++) { if (items[i].type.startsWith('image/') || items[i].type.startsWith('video/')) { e.preventDefault(); setToast({ message: 'Images and videos are not available in ECHO AI chat right now.', type: 'info' }); setTimeout(() => setToast(null), 2800); return; } } }
    const items = e.clipboardData.items;
    let mediaFile = null;
    for (let i = 0; i < items.length; i++) { const item = items[i]; if (item.type.startsWith('image/') || item.type.startsWith('video/')) { mediaFile = item.getAsFile(); break; } }
    if (mediaFile) { if (mediaFile.size > MAX_FILE_SIZE) { setFileSizeError(true); return; } e.preventDefault(); setSelectedFile(mediaFile); const url = URL.createObjectURL(mediaFile); setPreviewUrl(url); setCaptionText(''); setTimeout(() => captionInputRef.current?.focus(), 100); }
  };

  const handleReply = useCallback((msg) => {
    const isOwnMsg = String(msg.senderId || '') === String(user?.uid || '');
    const senderName = isOwnMsg ? (currentUserProfile?.name || 'You') : (partnerProfile?.name || location.state?.userName || 'User');
    let textSnippet;
    if (msg.type === 'media') textSnippet = msg.mediaType === 'video' ? '🎬 Video' : msg.mediaType === 'audio' ? '🎤 Voice note' : '📷 Image';
    else if (msg.type === 'echomoji') textSnippet = `😤 ECHOMOJI (${msg.mood || 'neutral'})`;
    else if (msg.type === 'spotlight') textSnippet = '🎬 Spotlight';
    else textSnippet = msg.text || 'Message';
    setReplyTo({ messageId: msg.id, senderName, messageType: msg.type || 'text', textSnippet, originalMessage: msg });
    setNewMessage('');
    setActiveMessageMenuId(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [user, partnerProfile, currentUserProfile, location.state?.userName]);

  const handleReact = useCallback((messageId) => {
    setActiveMessageMenuId(null);
    const msgElement = messageRefs.current[messageId];
    if (!msgElement) {
      setReactionPickerAnchor({ top: window.innerHeight / 2, left: window.innerWidth / 2, flipped: false });
      setShowReactionPicker(true);
      setReactingMessageId(messageId);
      return;
    }
    const rect = msgElement.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    let top = rect.top - REACTION_BAR_HEIGHT - REACTION_BAR_GAP - REACTION_ARROW_SIZE;
    let flipped = false;
    if (top < 60) { top = rect.bottom + REACTION_BAR_GAP + REACTION_ARROW_SIZE; flipped = true; }
    let left = rect.left + rect.width / 2 - REACTION_BAR_HALF_WIDTH;
    left = Math.max(10, Math.min(left, windowWidth - 20));
    setReactionPickerAnchor({ top, left, flipped });
    setReactingMessageId(messageId);
    setShowReactionPicker(true);
  }, []);

  const handleReactionSelect = async (emojiKey, msgIdOverride = null) => {
    setTappedEmoji(emojiKey);
    setTimeout(() => setTappedEmoji(null), 220);
    setShowReactionPicker(false);
    setReactionPickerAnchor(null);
    const targetId = msgIdOverride || reactingMessageId;
    if (!targetId || !user?.uid || !userId) return;
    const cId = [user.uid, userId].sort().join('_');
    const reactionRef = ref(db, `chats/${cId}/messages/${targetId}/reactions/${user.uid}`);
    try {
      const currentMsg = messages.find((m) => m.id === targetId);
      const currentReaction = currentMsg?.reactions?.[user.uid];
      if (currentReaction === emojiKey) await remove(reactionRef);
      else await set(reactionRef, emojiKey);
      setReactingMessageId(null);
    } catch (err) { console.warn('Reaction error:', err); if (!err.message?.includes('PERMISSION_DENIED')) alert('Failed to react. Please try again.'); }
  };

  const closeReactionPicker = () => { setShowReactionPicker(false); setReactingMessageId(null); setReactionPickerAnchor(null); };

  useEffect(() => {
    if (!showReactionPicker) return;
    const container = messagesContainerRef.current;
    const onDismiss = () => closeReactionPicker();
    if (container) container.addEventListener('scroll', onDismiss);
    window.addEventListener('resize', onDismiss);
    return () => { if (container) container.removeEventListener('scroll', onDismiss); window.removeEventListener('resize', onDismiss); };
  }, [showReactionPicker]);

  const handleTouchStart = (msg, e) => {
    if (selectMode) return;
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    setPressedMsgId(msg.id);
    touchTimerRef.current = setTimeout(() => {
      if (window.navigator?.vibrate) window.navigator.vibrate(50);
      setPressedMsgId(null);
      const msgElement = messageRefs.current[msg.id];
      if (msgElement) {
        const msgRect = msgElement.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        let top = msgRect.top - REACTION_BAR_HEIGHT - REACTION_BAR_GAP - REACTION_ARROW_SIZE;
        let flipped = false;
        if (top < 60) { top = msgRect.bottom + REACTION_BAR_GAP + REACTION_ARROW_SIZE; flipped = true; }
        let left = msgRect.left + msgRect.width / 2 - REACTION_BAR_HALF_WIDTH;
        left = Math.max(10, Math.min(left, windowWidth - 20));
        setReactionPickerAnchor({ top, left, flipped });
      }
      setShowReactionPicker(true);
      setReactingMessageId(msg.id);
      setActiveMessageMenuId(null);
    }, 400);
  };

  const handleTouchEnd = (msg) => {
    if (touchTimerRef.current) { clearTimeout(touchTimerRef.current); touchTimerRef.current = null; }
    setPressedMsgId(null);
    if (selectMode) return;
    const now = Date.now();
    const lastTap = lastTapRef.current;
    if (lastTap.msgId === msg.id && now - lastTap.time < 300) { handleReactionSelect('heart', msg.id); lastTapRef.current = { time: 0, msgId: null }; }
    else lastTapRef.current = { time: now, msgId: msg.id };
  };

  const handleTouchMove = () => {
    if (touchTimerRef.current) { clearTimeout(touchTimerRef.current); touchTimerRef.current = null; }
    setPressedMsgId(null);
  };

  const handleEditMessage = (msg) => {
    if (msg.senderId !== user?.uid) return;
    if (msg.type === 'media' && msg.mediaType === 'audio') return;
    if (msg.type === 'media') { setEditingMediaMessage(msg); return; }
    setEditingMessage(msg);
    setActiveMessageMenuId(null);
  };

  const saveEditedMessage = async (newText) => {
    if (!editingMessage || !user?.uid || !userId) return;
    const cId = [user.uid, userId].sort().join('_');
    const messageId = editingMessage.id;
    try {
      await update(ref(db, `chats/${cId}/messages/${messageId}`), { text: newText, isEdited: true, lastEditedAt: serverTimestamp() });
      setEditingMessage(null);
      clearMessageCache(cId);
      setToast({ message: 'Message updated successfully', type: 'success' });
    } catch (err) { console.error('Edit failed:', err); setToast({ message: 'Failed to edit message', type: 'error' }); }
  };

  const saveEditedMediaCaption = async (newCaption) => {
    if (!editingMediaMessage || !user?.uid || !userId) return;
    const cId = [user.uid, userId].sort().join('_');
    const messageId = editingMediaMessage.id;
    try {
      await update(ref(db, `chats/${cId}/messages/${messageId}`), { caption: newCaption, isEdited: true, lastEditedAt: serverTimestamp() });
      setEditingMediaMessage(null);
      clearMessageCache(cId);
      setToast({ message: 'Caption updated successfully', type: 'success' });
    } catch (err) { console.error('Edit caption failed:', err); setToast({ message: 'Failed to edit caption', type: 'error' }); }
  };

  const handleDeleteMessage = (msgId) => {
    setDeletingMessageId(msgId);
    setActiveMessageMenuId(null);
    openConfirmModal({ title: 'Delete Message', message: 'Are you sure you want to delete this message? This action cannot be undone.', confirmText: 'Delete', cancelText: 'Cancel', onConfirm: () => confirmDeleteMessage(msgId) });
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
    } catch (err) { console.error('Delete failed:', err); setToast({ message: 'Failed to delete message', type: 'error' }); }
  };

  const handleCopy = async (msg) => {
    const text = msg.type === 'media' ? msg.mediaUrl || msg.caption || '' : msg.text || '';
    try { await navigator.clipboard.writeText(text); setToast({ message: 'Copied to clipboard', type: 'success' }); }
    catch (_) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); setToast({ message: 'Copied to clipboard', type: 'success' }); }
    setActiveMessageMenuId(null);
  };

  const handlePinMessage = async (msg) => {
    if (!user?.uid || !userId) return;
    const cId = [user.uid, userId].sort().join('_');
    setActiveMessageMenuId(null);
    try {
      const currentlyPinned = pinnedMessageId === msg.id;
      await set(ref(db, `chats/${cId}/pinnedMessageId`), currentlyPinned ? null : msg.id);
      await update(ref(db, `chats/${cId}/messages/${msg.id}`), { pinned: !currentlyPinned });
      setToast({ message: currentlyPinned ? 'Message unpinned' : 'Message pinned', type: 'success' });
    } catch (err) {
      console.error('Pin failed:', err);
      setToast({ message: 'Failed to pin message', type: 'error' });
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
          await set(ref(db, `chats/${cId}/ended`), { by: user.uid, byName: myName, at: Date.now() });
          const messagesRef = ref(db, `chats/${cId}/messages`);
          const newMsgRef = push(messagesRef);
          await set(newMsgRef, { senderId: 'system', type: 'system', text: `${myName} ended this ECHO.`, timestamp: Date.now(), clientTs: Date.now(), endedBy: user.uid });
          await update(ref(db, `userChats/${user.uid}/${userId}`), { ended: true, lastMessage: `${myName} ended this ECHO.`, lastSenderId: 'system', lastUpdated: Date.now() });
          await update(ref(db, `userChats/${userId}/${user.uid}`), { ended: true, lastMessage: `${myName} ended this ECHO.`, lastSenderId: 'system', lastUpdated: Date.now() });
          setEnded(true);
          setEndedByName(myName);
          setToast({ message: 'ECHO ended successfully', type: 'success' });
        } catch (err) { console.error('Failed to end ECHO:', err); setToast({ message: 'Failed to end ECHO. Please try again.', type: 'error' }); }
      },
    });
  };

  const jumpToMessage = (messageId) => {
    const el = messageRefs.current[messageId];
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('highlight-flash'); setTimeout(() => el.classList.remove('highlight-flash'), 1600); }
    else scrollToBottom(true);
  };

  useEffect(() => {
    const focusId = new URLSearchParams(location.search || '').get('focus');
    if (!focusId || !messages.length) return;
    const t = setTimeout(() => jumpToMessage(focusId), 250);
    return () => clearTimeout(t);
  }, [location.search, messages.length]);

  const handleEmojiSelect = (emoji) => {
    const target = focusedField.current;
    if (target === 'caption' && captionInputRef.current) {
      const input = captionInputRef.current;
      const start = input.selectionStart; const end = input.selectionEnd;
      const current = captionText;
      const newText = current.substring(0, start) + emoji + current.substring(end);
      setCaptionText(newText);
      const newCursor = start + emoji.length;
      setTimeout(() => { input.focus(); input.setSelectionRange(newCursor, newCursor); }, 0);
      return;
    }
    if (inputRef.current) {
      const input = inputRef.current;
      const start = input.selectionStart; const end = input.selectionEnd;
      const current = newMessage;
      const newText = current.substring(0, start) + emoji + current.substring(end);
      setNewMessage(newText);
      const newCursor = start + emoji.length;
      setTimeout(() => { input.focus(); input.setSelectionRange(newCursor, newCursor); }, 0);
    } else { setNewMessage((prev) => prev + emoji); setTimeout(() => inputRef.current?.focus(), 0); }
  };

  const handleKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    if (enterToSend && !e.shiftKey) {
      e.preventDefault();
      handleSendText(e);
    } else if (!enterToSend && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSendText(e);
    }
  };

  const renderPreviewOverlay = () => {
    if (!previewUrl) return null;
    return (
      <div className="media-preview-overlay" onClick={(e) => { if (e.target === e.currentTarget) cancelMediaPreview(); }}>
        <div className="media-preview-content" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="media-preview-close"
            onClick={cancelMediaPreview}
            aria-label="Close preview"
          >
            <i className="fas fa-times" />
          </button>

          <div className="media-preview-media">
            {selectedFile?.type.startsWith('video/') ? (
              <video src={previewUrl} controls autoPlay loop muted playsInline className="media-preview-video" />
            ) : (
              <img src={previewUrl} alt="Preview" className="media-preview-image" />
            )}
          </div>

          <div className="media-preview-caption-row" ref={captionPreviewRef}>
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
              onFocus={() => { focusedField.current = 'caption'; }}
            />
            <button
              type="button"
              className="media-preview-emoji-btn"
              onClick={() => setShowCaptionEmoji(!showCaptionEmoji)}
              aria-label="Emojis"
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
            type="button"
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

  useEffect(() => {
    if (!user?.uid) return;
    listEchoArchive(user.uid).then((rows) => { const map = {}; rows.forEach((row) => { if (row.message?.id) map[row.message.id] = row.archiveId; }); setBookmarkedIds(map); }).catch(() => {});
  }, [user?.uid]);

  const saveMessageToArchive = async (msg) => {
    const cId = [user.uid, userId].sort().join('_');
    try {
      if (bookmarkedIds[msg.id]) { await removeEchoArchive(bookmarkedIds[msg.id]); await update(ref(db, `chats/${cId}/messages/${msg.id}`), { pinned: null }).catch(() => {}); setBookmarkedIds((prev) => { const n = { ...prev }; delete n[msg.id]; return n; }); return; }
      const senderName = msg.senderId === user.uid ? (currentUserProfile?.name || 'You') : (partnerProfile?.name || getProfile?.(msg.senderId)?.name || 'User');
      const senderAvatar = msg.senderId === user.uid ? (currentUserProfile?.avatar || '') : (partnerProfile?.avatar || getProfile?.(msg.senderId)?.avatar || '');
      const result = await saveToEchoArchive(user.uid, { ...msg, senderName, senderAvatar }, { chatId: cId, source: 'chat', partnerId: userId, senderName, senderAvatar });
      if (result?.ok) { await update(ref(db, `chats/${cId}/messages/${msg.id}`), { pinned: true }).catch(() => {}); const rows = await listEchoArchive(user.uid); const map = {}; rows.forEach((row) => { if (row.message?.id) map[row.message.id] = row.archiveId; }); setBookmarkedIds(map); }
    } catch (_) {}
  };

  const renderTide = (msg) => {
    void tideTick;
    if (userId === ECHO_AI_ID || msg.pinned || bookmarkedIds[msg.id]) return null;
    const fake = { ...msg, expiresAt: msg.expiresAt || (Number(msg.timestamp) || Date.now()) + PRIVATE_TTL_MS };
    return <span className="echo-tide-chip" title="ECHO Tide"><i className="fas fa-water" aria-hidden="true" />{formatTideLeft(fake)}</span>;
  };

  const renderReactions = (reactions, messageId, isOwn) => {
    if (!reactions || typeof reactions !== 'object') return null;
    const entries = Object.entries(reactions);
    if (entries.length === 0) return null;
    const groups = {};
    entries.forEach(([uid, emoji]) => { if (!groups[emoji]) groups[emoji] = []; groups[emoji].push(uid); });
    const openReactionViewer = (emoji, reacs, msgId) => { const userIds = Object.keys(reacs).filter((uid) => reacs[uid] === emoji); if (userIds.length === 0) return; setReactionViewer({ emoji, userIds, messageId: msgId }); };
    return (
      <div className="message-reactions" style={{ position: 'absolute', bottom: '-12px', [isOwn ? 'left' : 'right']: '8px', display: 'flex', gap: '4px', zIndex: 3 }}>
        {Object.entries(groups).map(([emojiKey, uids]) => (
          <span key={emojiKey} className="reaction-badge clickable" onClick={(e) => { e.stopPropagation(); openReactionViewer(emojiKey, reactions, messageId); }} title={`${uids.length} reaction${uids.length !== 1 ? 's' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', background: 'var(--bg-primary, #ffffff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '999px', padding: '2px 6px', fontSize: '13px', lineHeight: 1, boxShadow: '0 2px 6px rgba(0,0,0,0.15)', cursor: 'pointer', userSelect: 'none' }}>
            {REACTION_LABELS[emojiKey] || emojiKey}
            {uids.length > 1 && <span className="reaction-count" style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>{formatReactionCount(uids.length)}</span>}
          </span>
        ))}
      </div>
    );
  };

  const renderInlineActions = (msg) => {
    const isOwn = String(msg.senderId || '') === String(user?.uid || '');
    const isAi = msg.senderId === ECHO_AI_ID;
    const allowEdit = isOwn && userId !== ECHO_AI_ID && msg.type !== 'audio';
    const allowDelete = isOwn || (userId === ECHO_AI_ID && isAi);
    const isPinned = pinnedMessageId === msg.id;
    const EmojiIcon = () => <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>;
    const ReplyIcon = () => <svg viewBox="0 0 24 24"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>;
    const EditIcon = () => <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>;
    const CopyIcon = () => <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>;
    const SaveIcon = () => <svg viewBox="0 0 24 24"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>;
    const DeleteIcon = () => <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>;
    const PinIcon = ({ filled }) => <svg viewBox="0 0 24 24">{filled ? <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/> : <path d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4m3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1z"/>}</svg>;
    const SelectIcon = () => <svg viewBox="0 0 24 24"><path d="M3 5h2V3c-1.1 0-2 .9-2 2zm0 8h2v-2H3v2zm4 8h2v-2H7v2zM3 9h2V7H3v2zm10-6h-2v2h2V3zm6 0v2h2c0-1.1-.9-2-2-2zM5 21v-2H3c0 1.1.9 2 2 2zm-2-4h2v-2H3v2zM9 3H7v2h2V3zm2 18h2v-2h-2v2zm8-8h2v-2h-2v2zm0 8c1.1 0 2-.9 2-2h-2v2zm0-12h2V7h-2v2zm0 8h2v-2h-2v2zm-4 4h2v-2h-2v2zm0-16h2V3h-2v2zM7 17h10V7H7v10zm2-8h6v6H9V9z"/></svg>;

    return (
      <div className={`message-inline-actions ${isOwn ? 'own' : 'partner'}`}>
        <button className="message-action-btn" onClick={(e) => { e.stopPropagation(); handleReact(msg.id); }} title="React"><EmojiIcon /></button>
        <button className="message-action-btn" onClick={(e) => { e.stopPropagation(); handleReply(msg); }} title="Reply"><ReplyIcon /></button>
        {allowEdit && <button className="message-action-btn" onClick={(e) => { e.stopPropagation(); handleEditMessage(msg); }} title="Edit"><EditIcon /></button>}
        <button className="message-action-btn" onClick={(e) => { e.stopPropagation(); handleCopy(msg); }} title="Copy"><CopyIcon /></button>
        <button className="message-action-btn" onClick={(e) => { e.stopPropagation(); handlePinMessage(msg); }} title={isPinned ? 'Unpin' : 'Pin'}><PinIcon filled={isPinned} /></button>
        <button className="message-action-btn" onClick={(e) => { e.stopPropagation(); saveMessageToArchive(msg); }} title="Save to archive"><SaveIcon /></button>
        {allowDelete && <button className="message-action-btn danger" onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id); }} title="Delete"><DeleteIcon /></button>}
        <button className="message-action-btn" onClick={(e) => { e.stopPropagation(); setSelectMode(true); setSelectedIds(new Set([msg.id])); setActiveMessageMenuId(null); }} title="Select"><SelectIcon /></button>
      </div>
    );
  };

  const renderNoteReplyCard = (note) => {
    if (!note) return null;
    return (
      <div className="note-reply-card">
        {note.song?.title && (
          <button type="button" className="note-reply-song" onClick={(e) => { e.stopPropagation(); if (note.song?.sourceUrl) window.open(note.song.sourceUrl, '_blank', 'noopener,noreferrer'); }} aria-label={`Open ${note.song.title}`}>
            <span className="note-reply-song-art">{note.song.artwork ? <img src={note.song.artwork} alt="" loading="lazy" /> : <span>🎵</span>}</span>
            <span className="note-reply-song-meta">
              <span className="note-reply-song-title">{note.song.title}</span>
              {note.song.artist && <span className="note-reply-song-artist">{note.song.artist}</span>}
            </span>
            <span className="note-reply-song-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="12" height="12"><path d="M8 5v14l11-7z" fill="currentColor" /></svg></span>
          </button>
        )}
        {note.text && <p className="note-reply-text">{note.text}</p>}
      </div>
    );
  };

  const groupedMessages = useMemo(() => {
    const sorted = sortMessages(messages);
    return sorted.map((msg, i, arr) => {
      const prev = arr[i - 1];
      const next = arr[i + 1];
      const isSystem = msg.type === 'system' || msg.system;

      const sameSenderAsPrev = !isSystem && prev && !(prev.type === 'system' || prev.system) && prev.senderId === msg.senderId;
      const sameSenderAsNext = !isSystem && next && !(next.type === 'system' || next.system) && next.senderId === msg.senderId;

      const withinPrev = sameSenderAsPrev && Math.abs(msgTime(msg) - msgTime(prev)) < GROUP_WINDOW_MS;
      const withinNext = sameSenderAsNext && Math.abs(msgTime(next) - msgTime(msg)) < GROUP_WINDOW_MS;

      const breaksTop = !withinPrev || !!msg.replyTo || !!msg.replyToNote;
      const breaksBottom = !withinNext || !!next?.replyTo || !!next?.replyToNote;

      const groupTop = breaksTop;
      const groupBottom = breaksBottom;

      const dayThis = startOfDay(msgTime(msg) || Date.now());
      const dayPrev = prev ? startOfDay(msgTime(prev) || Date.now()) : null;
      const showDateSeparator = dayPrev === null || dayThis !== dayPrev;

      return {
        msg,
        groupTop,
        groupBottom,
        showDateSeparator,
        dateLabel: showDateSeparator ? formatDayLabel(msgTime(msg) || Date.now()) : null,
        isSystem,
      };
    });
  }, [messages]);

  const renderMessage = (entry) => {
    const { msg, groupTop, groupBottom, isSystem } = entry;

    if (isSystem) {
      return (
        <Fragment key={msg.id}>
          {entry.showDateSeparator && <DateSeparator label={entry.dateLabel} />}
          <div className="message-bubble system">{msg.text}</div>
        </Fragment>
      );
    }

    const isOwn = String(msg.senderId || '') === String(user?.uid || '');
    const isDeleting = msg.id === deletingMessageId;
    const isAi = msg.senderId === ECHO_AI_ID;
    const replyToDisplay = msg.replyTo ? { ...msg.replyTo, senderName: msg.replyTo.senderName || 'User' } : null;
    const noteReplyDisplay = msg.replyToNote || null;
    const showReply = !isAi;
    const handleMediaClick = () => { if (msg.type === 'media') { if (msg.mediaType === 'video') setVideoPreview({ src: msg.mediaUrl }); else if (msg.mediaType === 'image') setMediaPreview({ src: msg.mediaUrl, type: 'image', alt: msg.caption || 'Image' }); } };
    const handleRetry = () => { sendMediaMessage(msg.id); };
    const sentClock = formatMsgClock(msg);
    const justSent = justSentIdsRef.current.has(msg.id);
    const justArrived = justArrivedIdsRef.current.has(msg.id);
    const isPressed = pressedMsgId === msg.id;
    const isSelected = selectedIds.has(msg.id);
    const isPinned = pinnedMessageId === msg.id;
    const saveState = savingIds[msg.id];

    const shell = (inner) => {
      const row = (
        <div
          className={`message-row ${isOwn ? 'own' : 'partner'} ${isDeleting ? 'deleting' : ''} ${justSent ? 'just-sent' : ''} ${justArrived ? 'just-arrived' : ''} ${isPressed ? 'pressed' : ''} ${groupTop ? 'group-top' : 'group-mid'} ${groupBottom ? 'group-bottom' : 'group-mid'} ${isSelected ? 'selected' : ''} ${selectMode ? 'select-mode' : ''}`}
          ref={(el) => { if (el) messageRefs.current[msg.id] = el; }}
          onClick={() => {
            if (selectMode) {
              setSelectedIds((prev) => {
                const n = new Set(prev);
                if (n.has(msg.id)) n.delete(msg.id); else n.add(msg.id);
                return n;
              });
              return;
            }
            setActiveMessageMenuId(activeMessageMenuId === msg.id ? null : msg.id);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            if (selectMode) return;
            setActiveMessageMenuId(msg.id);
          }}
          onMouseEnter={() => { if (!selectMode) setActiveMessageMenuId(msg.id); }}
          onMouseLeave={() => setActiveMessageMenuId(null)}
          onTouchStart={(e) => handleTouchStart(msg, e)}
          onTouchEnd={() => handleTouchEnd(msg)}
          onTouchMove={handleTouchMove}
        >
          {selectMode && (
            <div className={`select-checkbox ${isSelected ? 'checked' : ''}`} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" fill="currentColor" />
              </svg>
            </div>
          )}
          <div className={`message-stack ${isOwn ? 'own' : 'partner'}`} style={{ position: 'relative', marginBottom: msg.reactions && Object.keys(msg.reactions).length > 0 ? '14px' : 0 }}>
            <div className={`message-bubble ${isOwn ? 'own' : 'partner'} ${msg.pending ? 'pending' : ''} ${isPinned ? 'pinned' : ''}`}>
              {isPinned && (
                <span className="message-pin-badge" title="Pinned">
                  <svg viewBox="0 0 24 24" width="11" height="11"><path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" fill="currentColor"/></svg>
                </span>
              )}
              {inner}
              <div className="message-meta-time">
                {sentClock}
                <MessageReceipt msg={msg} isMe={isOwn} />
              </div>
              {renderTide(msg)}
            </div>
            {renderReactions(msg.reactions, msg.id, isOwn)}
            {!selectMode && activeMessageMenuId === msg.id && <div className="message-inline-menu-wrapper" onClick={(e) => e.stopPropagation()}>{renderInlineActions(msg)}</div>}
          </div>
        </div>
      );
      if (showReply && !selectMode) return <SwipeToReply key={msg.id} direction={isOwn ? 'left' : 'right'} onReply={() => handleReply(msg)}>{row}</SwipeToReply>;
      return <Fragment key={msg.id}>{row}</Fragment>;
    };

    let content;
    if (msg.type === 'spotlight') {
      content = shell(
        <>
          {replyToDisplay && (
            <RepliedMessage
              replyTo={replyToDisplay}
              onTap={() => jumpToMessage(replyToDisplay.messageId)}
            />
          )}
          {noteReplyDisplay && renderNoteReplyCard(noteReplyDisplay)}
          <ChatSpotlightCard
            spotlight={msg.spotlight}
            onOpen={(postId) => navigate(`/spotlight?focus=${postId}`)}
          />
        </>
      );
    } else if (msg.type === 'echomoji') {
      const skinObj = msg.skinId ? getSkinById(msg.skinId) : null;
      content = shell(<>{replyToDisplay && <RepliedMessage replyTo={replyToDisplay} onTap={() => jumpToMessage(replyToDisplay.messageId)} />}{noteReplyDisplay && renderNoteReplyCard(noteReplyDisplay)}<div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}><ECHOMOJI mood={msg.mood || 'neutral'} skin={skinObj} size={56} interactive={false} animated={true} /></div></>);
    } else if (msg.type === 'media') {
      let inner;
      if (msg.mediaType === 'audio') {
        if (msg.isUploading) inner = <div className="media-upload-overlay"><div className="upload-spinner"><svg className="spinner-ring" viewBox="0 0 50 50"><circle className="spinner-path" cx="25" cy="25" r="20" fill="none" strokeWidth="4" /></svg></div></div>;
        else if (msg.uploadFailed) inner = <div className="media-error-placeholder"><i className="fas fa-exclamation-triangle" /><span>Upload failed</span><button onClick={handleRetry}>Retry</button></div>;
        else inner = <AudioPlayer src={msg.mediaUrl} />;
      } else {
        if (msg.uploadFailed) {
          inner = <div className="media-error-placeholder"><i className="fas fa-exclamation-triangle" /><span>Upload failed</span><button onClick={handleRetry}>Retry</button></div>;
        } else {
          inner = (
            <div
              className={msg.mediaType === 'video' ? 'chat-media-video-wrapper' : 'chat-media-image-wrapper'}
              onClick={!msg.isUploading && !selectMode ? handleMediaClick : undefined}
              style={{ cursor: !msg.isUploading && !selectMode ? 'pointer' : 'default', position: 'relative' }}
            >
              <ChatMediaMessage message={msg} isUploading={msg.isUploading} uploadProgress={msg.uploadProgress} disablePreview={true} />
              {!msg.isUploading && !selectMode && msg.mediaUrl && msg.mediaUrl.startsWith('http') && (
                <button
                  type="button"
                  className={`media-download-btn${saveState ? ' ' + saveState : ''}`}
                  onClick={(e) => { e.stopPropagation(); handleDownloadMedia(msg); }}
                  title="Save to device"
                  aria-label="Save to device"
                >
                  {saveState === 'saving' ? (
                    <i className="fas fa-spinner fa-spin" />
                  ) : saveState === 'saved' ? (
                    <i className="fas fa-check" />
                  ) : (
                    <i className="fas fa-download" />
                  )}
                </button>
              )}
            </div>
          );
        }
      }
      content = shell(<>{replyToDisplay && <RepliedMessage replyTo={replyToDisplay} onTap={() => jumpToMessage(replyToDisplay.messageId)} />}{noteReplyDisplay && renderNoteReplyCard(noteReplyDisplay)}{inner}</>);
    } else {
      content = shell(<>
        {replyToDisplay && <RepliedMessage replyTo={replyToDisplay} onTap={() => jumpToMessage(replyToDisplay.messageId)} />}
        {noteReplyDisplay && renderNoteReplyCard(noteReplyDisplay)}
        <div className="message-text" style={{ whiteSpace: userId === ECHO_AI_ID && !isOwn ? 'normal' : 'pre-wrap' }}>
          {userId === ECHO_AI_ID && !isOwn ? <AiRichText text={msg.text} onFollowup={(q) => handleSendText(q)} /> : msg.text}
          {msg.isEdited && <span className="message-edited-badge">(edited)</span>}
        </div>
        {msg.linkPreview && <LinkPreviewCard preview={msg.linkPreview} />}
        {!msg.linkPreview && !msg.pending && extractFirstUrl(msg.text || '') && (
          <div className="link-preview-loading">
            <div className="link-preview-skeleton-logo" />
            <div className="link-preview-skeleton-lines">
              <div className="link-preview-skeleton-line w70" />
              <div className="link-preview-skeleton-line w90" />
              <div className="link-preview-skeleton-line w50" />
            </div>
          </div>
        )}
      </>);
    }

    return (
      <Fragment key={msg.id}>
        {entry.showDateSeparator && <DateSeparator label={entry.dateLabel} />}
        {content}
      </Fragment>
    );
  };

  useEffect(() => { clearedAtRef.current = clearedAt || 0; }, [clearedAt]);

  useEffect(() => {
    return () => { (messages || []).forEach((m) => { if (typeof m?.mediaUrl === 'string' && m.mediaUrl.startsWith('blob:')) { try { URL.revokeObjectURL(m.mediaUrl); } catch (_) {} } }); };
  }, [userId]);

  useEffect(() => {
    if (!user?.uid || !userId) return;
    clearUnreadInstantly();
    const syncTimer = setTimeout(() => { if (isMounted.current) markMessagesAsRead(); }, 100);
    return () => clearTimeout(syncTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, userId, sendReadReceipts]);

  useEffect(() => {
    if (!user?.uid || !userId) { setLoadingMessages(false); return; }
    isMounted.current = true;
    const cId = [user.uid, userId].sort().join('_');
    chatId.current = cId;

    loadMessagesFromCache(cId).then((cachedMessages) => {
      if (isMounted.current && cachedMessages.length > 0) {
        const cut = clearedAtRef.current || 0;
        const visible = cut ? cachedMessages.filter((m) => { const ts = typeof m.timestamp === 'number' ? m.timestamp : 0; return !ts || ts >= cut; }) : cachedMessages;
        setMessages(sortMessages(visible.filter((m) => userId === 'echo_ai_assistant' || !isTideExpired(m))));
        setLoadingMessages(false);
        prevMsgCountRef.current = visible.length;
        if (!initialScrollRef.current) { initialScrollRef.current = true; requestAnimationFrame(() => scrollToBottom(false)); }
      }
    });

    const messagesRef = ref(db, `chats/${cId}/messages`);
    const unsubscribe = onValue(messagesRef, async (snapshot) => {
      if (!isMounted.current) return;
      const data = snapshot.val();
      let newMessages = [];
      if (data) newMessages = sortMessages(Object.entries(data).map(([id, val]) => ({ id, ...val })));
      const cut = clearedAtRef.current || 0;
      let visible = cut ? newMessages.filter((m) => { if (m.pending) return true; const ts = msgTime(m); if (!ts) return true; return ts >= cut; }) : newMessages;
      visible = sortMessages(visible);
      visible = await pruneExpired(visible.filter((m) => userId === ECHO_AI_ID || !isTideExpired(m) || m.pinned || bookmarkedIds[m.id]), cId);
      if (userId !== ECHO_AI_ID) visible = visible.filter((m) => !isTideExpired(m) || m.pinned || bookmarkedIds[m.id]);
      setMessages((prev) => {
        const pending = (prev || []).filter((m) => m.pending && !visible.some((v) => v.id === m.id || (v.text === m.text && v.senderId === m.senderId && Math.abs(msgTime(v) - msgTime(m)) < 5000)));
        const serverOwnTexts = new Set(visible.filter((v) => v.senderId === user.uid).map((v) => v.text));
        const stillPending = pending.filter((p) => !serverOwnTexts.has(p.text));
        return sortMessages([...visible, ...stillPending]);
      });
      setLoadingMessages(false);

      if (autoSaveMedia && userId !== ECHO_AI_ID) {
        const incomingMedia = visible.filter(
          (m) =>
            m.type === 'media' &&
            m.mediaType !== 'audio' &&
            m.senderId !== user.uid &&
            m.mediaUrl &&
            m.mediaUrl.startsWith('http') &&
            !savingIds[m.id]
        );
        if (incomingMedia.length > 0) {
          const newest = incomingMedia[incomingMedia.length - 1];
          handleDownloadMedia(newest, true);
        }
      }

      const prevCount = prevMsgCountRef.current;
      const grew = visible.length > prevCount;
      const newest = visible[visible.length - 1];
      const isIncoming = newest && newest.senderId && newest.senderId !== user.uid;
      prevMsgCountRef.current = visible.length;

      if (grew && isIncoming && newest?.id) flashArrived(newest.id);

      if (grew && isIncoming && !isNearBottomRef.current) {
        setUnreadWhileScrolled((n) => n + Math.max(1, visible.length - prevCount));
      }

      if (!initialScrollRef.current) { initialScrollRef.current = true; requestAnimationFrame(() => scrollToBottom(false)); }
      else if (grew && isNearBottomRef.current) requestAnimationFrame(() => scrollToBottom(true));

      Promise.resolve().then(async () => {
        try { for (const msg of visible) { await upsertMessageInCache(cId, msg); if (msg.type === 'media' && msg.mediaUrl && msg.mediaUrl.startsWith('http')) cacheMedia(msg.mediaUrl); } await saveMessagesToCache(cId, visible); } catch (_) {}
      });
      clearMessageCache(cId);
      const hasUnread = newMessages.some((msg) => msg.receiverId === user.uid && msg.isRead === false);
      if (hasUnread && isMounted.current) {
        clearUnreadInstantly();
        if (markReadTimeout.current) clearTimeout(markReadTimeout.current);
        markReadTimeout.current = setTimeout(() => { if (isMounted.current) markMessagesAsRead(); }, 300);
      }
    }, (error) => {
      console.error('🔥 [ChatView] Firebase listener error:', error);
      setLoadingMessages(false);
      if (messages.length === 0) setMessages([{ id: 'error', senderId: 'system', text: '⚠️ Could not load messages. Please check your connection.', timestamp: Date.now(), type: 'text', isRead: true }]);
    });

    return () => { isMounted.current = false; if (markReadTimeout.current) clearTimeout(markReadTimeout.current); unsubscribe(); };
  }, [user?.uid, userId]);

  useEffect(() => {
    if (!userId) return;
    const cached = getProfile(userId);
    if (cached) setPartnerProfile(cached);
    else fetchProfile(userId);
    const pRef = ref(db, `profiles/${userId}`);
    const unsub = onValue(pRef, (snap) => { if (snap.exists()) setPartnerProfile(snap.val()); });
    return () => unsub();
  }, [userId, getProfile, fetchProfile]);

  useEffect(() => {
    if (!user?.uid) return;
    const myProfileRef = ref(db, `profiles/${user.uid}`);
    get(myProfileRef).then((snap) => { if (snap.exists()) setCurrentUserProfile(snap.val()); }).catch(console.error);
  }, [user?.uid]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) { textarea.style.height = 'auto'; textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`; }
  }, [newMessage]);

  useEffect(() => {
    if (!showMoreOptions) return;
    const handleClickOutside = (e) => { if (moreOptionsRef.current && !moreOptionsRef.current.contains(e.target)) setShowMoreOptions(false); };
    const t = setTimeout(() => { document.addEventListener('mousedown', handleClickOutside); document.addEventListener('touchstart', handleClickOutside); }, 10);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('touchstart', handleClickOutside); };
  }, [showMoreOptions]);

  useEffect(() => {
    if (!messagesEndRef.current) return;
    if (!initialScrollRef.current) { initialScrollRef.current = true; messagesEndRef.current.scrollIntoView({ behavior: 'auto' }); return; }
    if (isNearBottomRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!selectMode) return;
    const onKey = (e) => { if (e.key === 'Escape') { setSelectMode(false); setSelectedIds(new Set()); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectMode]);

  const [chatBgEnabled, setChatBgEnabled] = useState(() => { try { const v = localStorage.getItem('echo_chat_bg'); return v === null ? true : v === '1'; } catch { return true; } });

  useEffect(() => {
    const onBg = (e) => { if (e?.detail && typeof e.detail.enabled === 'boolean') setChatBgEnabled(e.detail.enabled); else { try { const v = localStorage.getItem('echo_chat_bg'); setChatBgEnabled(v === null ? true : v === '1'); } catch (_) {} } };
    window.addEventListener('echo-chat-bg-changed', onBg);
    window.addEventListener('storage', onBg);
    return () => { window.removeEventListener('echo-chat-bg-changed', onBg); window.removeEventListener('storage', onBg); };
  }, []);

  useEffect(() => {
    if (!user?.uid || !userId) { setEnded(false); return; }
    const cId = [user.uid, userId].sort().join('_');
    const endedRef = ref(db, `chats/${cId}/ended`);
    const unsub = onValue(endedRef, (snap) => { const val = snap.val(); if (val === true || (val && (val.by || val === true))) { setEnded(true); setEndedByName((val && val.byName) || ''); } else { setEnded(false); setEndedByName(''); } });
    return () => unsub();
  }, [user?.uid, userId]);

  useEffect(() => {
    if (!user?.uid || !userId) { setClearedAt(0); return; }
    const clearedRef = ref(db, `userChats/${user.uid}/${userId}/clearedAt`);
    const unsub = onValue(clearedRef, (snap) => { const val = typeof snap.val() === 'number' ? snap.val() : 0; clearedAtRef.current = val; setClearedAt(val); if (val) setMessages((prev) => prev.filter((m) => { if (m.pending) return true; const ts = typeof m.timestamp === 'number' ? m.timestamp : 0; return !ts || ts >= val; })); });
    const onLocalClear = (e) => { if (e.detail?.partnerId === userId) { const now = Date.now(); clearedAtRef.current = now; setClearedAt(now); setMessages([]); } };
    window.addEventListener('chat-history-cleared', onLocalClear);
    return () => { unsub(); window.removeEventListener('chat-history-cleared', onLocalClear); };
  }, [user?.uid, userId]);

  const displayName = sanitizeName(location.state?.userName || partnerProfile?.name, userId);

  const handleInputPointerDown = () => {
    if (userId === ECHO_AI_ID) return;
    longPressTimer.current = setTimeout(() => { setHaloActive(true); if (window.navigator?.vibrate) window.navigator.vibrate(50); }, 500);
  };
  const handleInputPointerUp = () => clearTimeout(longPressTimer.current);
  const handleInputPointerLeave = () => clearTimeout(longPressTimer.current);

  const isCustom = wallpaperId === '__custom__' && customWallpaper;
  const wallpaper = isCustom ? null : getWallpaperById(wallpaperId);

  const wallpaperStyle = isCustom
    ? { backgroundImage: `url(${customWallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', transition: 'background 0.3s ease', '--msg-font-size': FONT_SIZE_MAP[fontSize] || FONT_SIZE_MAP.md }
    : {
        background: (wallpaper.type === 'color' || wallpaper.type === 'gradient') ? (wallpaper.value === 'transparent' ? 'var(--bg-primary)' : wallpaper.value) : 'var(--bg-primary)',
        backgroundImage: wallpaper.type === 'pattern' ? wallpaper.value : 'none',
        backgroundSize: wallpaper.type === 'pattern' ? '20px 20px' : 'cover',
        backgroundRepeat: wallpaper.type === 'pattern' ? 'repeat' : 'no-repeat',
        backgroundPosition: 'center',
        transition: 'background 0.3s ease',
        '--msg-font-size': FONT_SIZE_MAP[fontSize] || FONT_SIZE_MAP.md,
      };

  const pinnedMessage = useMemo(() => {
    if (!pinnedMessageId) return null;
    return messages.find((m) => m.id === pinnedMessageId) || null;
  }, [messages, pinnedMessageId]);

  const pinnedPreview = useMemo(() => {
    if (!pinnedMessage) return '';
    if (pinnedMessage.type === 'media') {
      if (pinnedMessage.mediaType === 'video') return '🎬 Video';
      if (pinnedMessage.mediaType === 'audio') return '🎤 Voice note';
      return pinnedMessage.caption || '📷 Image';
    }
    if (pinnedMessage.type === 'echomoji') return `😤 ECHOMOJI (${pinnedMessage.mood || 'neutral'})`;
    if (pinnedMessage.type === 'spotlight') return '🎬 Spotlight';
    return pinnedMessage.text || '';
  }, [pinnedMessage]);

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };

  const bulkCopy = async () => {
    const arr = [...selectedIds].map((id) => messages.find((m) => m.id === id)).filter(Boolean);
    const text = arr.map((m) => (m.type === 'media' ? m.mediaUrl || m.caption || '' : m.text || '')).join('\n');
    try { await navigator.clipboard.writeText(text); setToast({ message: `Copied ${arr.length} message${arr.length !== 1 ? 's' : ''}`, type: 'success' }); }
    catch (_) { setToast({ message: 'Copy failed', type: 'error' }); }
    exitSelectMode();
  };

  const bulkSave = async () => {
    const arr = [...selectedIds].map((id) => messages.find((m) => m.id === id)).filter(Boolean);
    let ok = 0;
    for (const m of arr) { try { await saveMessageToArchive(m); ok++; } catch (_) {} }
    setToast({ message: `Saved ${ok} message${ok !== 1 ? 's' : ''}`, type: 'success' });
    exitSelectMode();
  };

  const bulkDelete = () => {
    openConfirmModal({
      title: `Delete ${selectedIds.size} message${selectedIds.size !== 1 ? 's' : ''}?`,
      message: 'This cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        closeConfirmModal();
        if (!user?.uid || !userId) return;
        const cId = [user.uid, userId].sort().join('_');
        const updates = {};
        selectedIds.forEach((id) => { updates[`chats/${cId}/messages/${id}`] = null; });
        try {
          await update(ref(db), updates);
          selectedIds.forEach((id) => deleteMessageFromCache(cId, id).catch(() => {}));
          clearMessageCache(cId);
          setToast({ message: 'Messages deleted', type: 'success' });
        } catch (err) { console.error('Bulk delete failed:', err); setToast({ message: 'Failed to delete', type: 'error' }); }
        exitSelectMode();
      },
    });
  };

  return (
    <>
      <style>{`
        .echo-reaction-backdrop { position: fixed; inset: 0; z-index: 998; background: transparent; }
        .echo-reaction-bar { position: fixed; z-index: 1000; display: flex; align-items: center; gap: 2px; background: #1a1a1a; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 999px; padding: 6px 8px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4); transform: translateX(-50%); transform-origin: bottom center; animation: snapReactionPop 0.22s cubic-bezier(0.2, 1.3, 0.4, 1) both; }
        html[data-theme="light"] .echo-reaction-bar, html.theme-light .echo-reaction-bar { background: #ffffff; border-color: rgba(0, 0, 0, 0.08); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12); }
        @keyframes snapReactionPop { 0% { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.85); } 100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } }
        .echo-reaction-emoji { width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 0; background: transparent; border: none; border-radius: 50%; cursor: pointer; transition: transform 0.15s cubic-bezier(0.2, 1.3, 0.4, 1), background 0.15s ease; -webkit-tap-highlight-color: transparent; }
        .echo-reaction-emoji .rx-svg { width: 32px; height: 32px; display: block; overflow: visible; animation: rxIdleBounce 3.2s ease-in-out infinite; }
        .echo-reaction-emoji:nth-child(1) .rx-svg { animation-delay: 0s; }
        .echo-reaction-emoji:nth-child(2) .rx-svg { animation-delay: 0.15s; }
        .echo-reaction-emoji:nth-child(3) .rx-svg { animation-delay: 0.30s; }
        .echo-reaction-emoji:nth-child(4) .rx-svg { animation-delay: 0.45s; }
        .echo-reaction-emoji:nth-child(5) .rx-svg { animation-delay: 0.60s; }
        .echo-reaction-emoji:nth-child(6) .rx-svg { animation-delay: 0.75s; }
        @keyframes rxIdleBounce { 0%, 75%, 100% { transform: translateY(0) scale(1); } 82% { transform: translateY(-3px) scale(1.08); } 90% { transform: translateY(0) scale(1); } }
        .echo-reaction-emoji:hover { background: rgba(255, 255, 255, 0.08); transform: scale(1.15); }
        html[data-theme="light"] .echo-reaction-emoji:hover, html.theme-light .echo-reaction-emoji:hover { background: rgba(0, 0, 0, 0.05); }
        .echo-reaction-emoji:hover .rx-svg { animation: rxHoverBounce 0.5s cubic-bezier(0.2, 1.5, 0.4, 1); }
        @keyframes rxHoverBounce { 0% { transform: scale(1) rotate(0deg); } 35% { transform: scale(1.35) rotate(-8deg); } 65% { transform: scale(1.15) rotate(6deg); } 100% { transform: scale(1.15) rotate(0deg); } }
        .echo-reaction-emoji.tapped .rx-svg { animation: rxTapPop 0.42s cubic-bezier(0.2, 1.6, 0.4, 1); }
        @keyframes rxTapPop { 0% { transform: scale(1); } 40% { transform: scale(1.55) rotate(0deg); } 70% { transform: scale(1.3) rotate(-4deg); } 100% { transform: scale(1) rotate(0deg); } }
        .rx-heart-path { transform-origin: 20px 24px; animation: rxHeartBeat 1.6s ease-in-out infinite; }
        @keyframes rxHeartBeat { 0%, 100% { transform: scale(1); } 15% { transform: scale(1.10); } 30% { transform: scale(0.98); } 45% { transform: scale(1.06); } 60% { transform: scale(1); } }
        .rx-heart-shine { animation: rxHeartShine 1.6s ease-in-out infinite; }
        @keyframes rxHeartShine { 0%, 100% { opacity: 0.55; transform: scale(1); } 15% { opacity: 0.85; transform: scale(1.2); } 30% { opacity: 0.55; transform: scale(1); } }
        .rx-laugh-eye-left, .rx-laugh-eye-right { transform-origin: center; animation: rxLaughSquint 2s ease-in-out infinite; }
        .rx-laugh-eye-right { animation-delay: 0.05s; }
        @keyframes rxLaughSquint { 0%, 80%, 100% { transform: scaleY(1); } 88% { transform: scaleY(0.4); } }
        .rx-laugh-tear { animation: rxLaughTear 2s ease-in-out infinite; }
        @keyframes rxLaughTear { 0%, 40%, 100% { opacity: 0; transform: translateY(0) scale(0); } 55% { opacity: 1; transform: translateY(0) scale(1); } 90% { opacity: 0; transform: translateY(4px) scale(0.6); } }
        .rx-wow-eye-left, .rx-wow-eye-right { transform-origin: center; animation: rxWowEyes 1.6s ease-in-out infinite; }
        @keyframes rxWowEyes { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); } }
        .rx-wow-mouth { transform-origin: 20px 26px; animation: rxWowMouth 1.2s ease-in-out infinite; }
        @keyframes rxWowMouth { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18); } }
        .rx-sad-tear { animation: rxSadTear 2.4s ease-in-out infinite; transform-origin: 17px 20px; }
        @keyframes rxSadTear { 0%, 40%, 100% { opacity: 0; transform: translateY(0) scale(0.4); } 55% { opacity: 1; transform: translateY(0) scale(1); } 90% { opacity: 0; transform: translateY(6px) scale(0.7); } }
        .rx-pray-left { transform-origin: 20px 34px; animation: rxPrayLeft 2.4s ease-in-out infinite; }
        .rx-pray-right { transform-origin: 20px 34px; animation: rxPrayRight 2.4s ease-in-out infinite; }
        @keyframes rxPrayLeft { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(3deg); } }
        @keyframes rxPrayRight { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-3deg); } }
        .rx-pray-sparkle { transform-origin: 32px 12px; animation: rxPraySparkle 2.4s ease-in-out infinite; }
        @keyframes rxPraySparkle { 0%, 100% { opacity: 0.4; transform: scale(1) rotate(0deg); } 50% { opacity: 1; transform: scale(1.35) rotate(180deg); } }
        .rx-fire-outer { transform-origin: 20px 34px; animation: rxFireFlicker 0.9s ease-in-out infinite; }
        @keyframes rxFireFlicker { 0%, 100% { transform: scale(1) skewX(0deg); } 25% { transform: scale(1.03) skewX(2deg); } 50% { transform: scale(0.98) skewX(-2deg); } 75% { transform: scale(1.05) skewX(1deg); } }
        .rx-fire-inner { transform-origin: 20px 30px; animation: rxFireInner 0.7s ease-in-out infinite; }
        @keyframes rxFireInner { 0%, 100% { transform: scale(1); opacity: 0.95; } 50% { transform: scale(0.85); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .echo-reaction-emoji .rx-svg, .echo-reaction-emoji:hover .rx-svg, .echo-reaction-emoji.tapped .rx-svg, .rx-heart-path, .rx-heart-shine, .rx-laugh-eye-left, .rx-laugh-eye-right, .rx-laugh-tear, .rx-wow-eye-left, .rx-wow-eye-right, .rx-wow-mouth, .rx-sad-tear, .rx-pray-left, .rx-pray-right, .rx-pray-sparkle, .rx-fire-outer, .rx-fire-inner { animation: none !important; } }
        .echo-reaction-bar-arrow { display: none; }

        .highlight-flash { animation: highlightFlash 1.6s ease; }
        @keyframes highlightFlash { 0%, 100% { background: transparent; } 20% { background: rgba(255, 215, 0, 0.3); } }
        .message-inline-menu-wrapper { display: flex; width: 100%; margin-top: 8px; z-index: 10; }
        .message-inline-actions.own { justify-content: flex-end; }
        .message-inline-actions.partner { justify-content: flex-start; }
        .message-inline-actions { display: flex; align-items: center; gap: 4px; background: var(--bg-primary, #ffffff); border: 1px solid rgba(0,0,0,0.08); padding: 3px; border-radius: 20px; box-shadow: 0 6px 16px rgba(0,0,0,0.08); animation: menuFadeIn 0.24s cubic-bezier(0.2, 1.2, 0.4, 1); flex-wrap: wrap; }
        @keyframes menuFadeIn { 0% { opacity: 0; transform: translateY(-6px) scale(0.92); } 70% { opacity: 1; transform: translateY(1px) scale(1.02); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        .message-action-btn { background: transparent; border: none; cursor: pointer; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--text-secondary, #555); transition: all 0.15s ease; }
        .message-action-btn svg { width: 18px; height: 18px; fill: currentColor; }
        .message-action-btn:hover { background: var(--bg-hover, #eaeaea); color: var(--text-primary, #333); transform: scale(1.15) translateY(-1px); }
        .message-action-btn.danger:hover { background: #fde8e8; color: #d32f2f; }

        .message-row.own .message-bubble, .message-row.partner .message-bubble {
          animation: echoBubbleIn 0.3s cubic-bezier(0.2, 0.9, 0.25, 1.05) both;
          transform-origin: bottom;
          will-change: transform, opacity;
          transition: transform 0.2s cubic-bezier(0.2, 0.9, 0.25, 1.05), box-shadow 0.25s ease;
        }
        .message-row.own .message-bubble { transform-origin: bottom right; }
        .message-row.partner .message-bubble { transform-origin: bottom left; }
        @keyframes echoBubbleIn { 0% { opacity: 0; transform: translateY(10px) scale(0.84); } 60% { opacity: 1; transform: translateY(-1px) scale(1.03); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @media (hover: hover) { .message-row:hover .message-bubble { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(0,0,0,0.18); } }
        .message-row.pressed .message-bubble { transform: scale(0.94); transition: transform 0.15s ease; }
        .message-row .message-bubble.pending { animation: echoSendingPulse 1.4s ease-in-out infinite; }
        @keyframes echoSendingPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(108, 60, 225, 0.0); } 50% { box-shadow: 0 0 0 4px rgba(108, 60, 225, 0.15); } }

        .message-receipt { transition: color 0.25s ease, transform 0.25s ease; display: inline-block; }
        .message-receipt.sent { color: rgba(255, 255, 255, 0.55); }
        .message-receipt.delivered { color: rgba(255, 255, 255, 0.8); animation: receiptDeliveredPop 0.32s cubic-bezier(0.2, 1.4, 0.4, 1) both; }
        .message-receipt.read { color: #60A5FA; animation: receiptReadPop 0.45s cubic-bezier(0.2, 1.5, 0.4, 1) both; }
        @keyframes receiptDeliveredPop { 0% { transform: scale(0.7); opacity: 0.4; } 60% { transform: scale(1.18); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes receiptReadPop { 0% { transform: scale(0.7); opacity: 0.4; color: rgba(255,255,255,0.6); } 40% { transform: scale(1.25); opacity: 1; color: #60A5FA; } 100% { transform: scale(1); opacity: 1; color: #60A5FA; } }

        .chat-send-btn { position: relative; overflow: visible; transition: transform 0.12s ease, background 0.2s ease, box-shadow 0.2s ease; }
        .chat-send-btn:not(:disabled):active { transform: scale(0.88); }
        .chat-send-btn:not(:disabled):hover { transform: scale(1.06); box-shadow: 0 6px 18px rgba(108, 60, 225, 0.45); }
        .chat-send-btn.rippling::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; border: 2px solid rgba(108, 60, 225, 0.55); animation: sendRipple 0.6s cubic-bezier(0.2, 0.8, 0.4, 1) forwards; pointer-events: none; }
        @keyframes sendRipple { 0% { transform: scale(0.9); opacity: 0.85; } 100% { transform: scale(2.4); opacity: 0; } }

        .message-row.own.just-sent .message-bubble { animation: sentGlow 0.75s ease-out both; }
        @keyframes sentGlow { 0% { box-shadow: 0 0 0 0 rgba(108, 60, 225, 0.55), 0 4px 14px rgba(108,60,225,0.35); } 100% { box-shadow: 0 0 0 14px rgba(108, 60, 225, 0), 0 4px 14px rgba(108,60,225,0.35); } }
        .message-row.partner.just-arrived .message-bubble { animation: arrivedPulse 0.6s ease-out both; }
        @keyframes arrivedPulse { 0% { box-shadow: 0 0 0 0 rgba(236, 72, 153, 0.4); } 100% { box-shadow: 0 0 0 12px rgba(236, 72, 153, 0); } }

        .typing-indicator-container { display: inline-flex; align-items: center; gap: 10px; padding: 8px 14px 8px 8px; border-radius: 22px 22px 22px 4px; align-self: flex-start; max-width: 260px; margin: 6px 0 10px 12px; background: rgba(20, 15, 35, 0.85); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border: 1px solid rgba(255, 255, 255, 0.15); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(108, 60, 225, 0.35), 0 0 24px rgba(108, 60, 225, 0.25); animation: typingContainerIn 0.28s cubic-bezier(0.2, 1.3, 0.4, 1); }
        html.theme-light .typing-indicator-container { background: rgba(255, 255, 255, 0.94); border: 1px solid rgba(0, 0, 0, 0.08); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(108, 60, 225, 0.35), 0 0 24px rgba(108, 60, 225, 0.15); }
        .typing-echomoji-wrapper { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; overflow: hidden; background: linear-gradient(135deg, rgba(108, 60, 225, 0.25), rgba(236, 72, 153, 0.2)); box-shadow: 0 0 0 2px rgba(108, 60, 225, 0.5), 0 0 12px rgba(108, 60, 225, 0.4); animation: typingEchoBob 1.4s ease-in-out infinite; flex-shrink: 0; }
        @keyframes typingEchoBob { 0%, 100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-2px) rotate(-2deg); } 75% { transform: translateY(-2px) rotate(2deg); } }
        .typing-dots-row { display: inline-flex; align-items: center; gap: 5px; }
        .typing-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: linear-gradient(135deg, #A78BFA, #F472B6); box-shadow: 0 0 8px rgba(167, 139, 250, 0.65); animation: typingBounce 1.4s infinite ease-in-out; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typingBounce { 0%, 60%, 100% { transform: translateY(0) scale(1); opacity: 0.55; } 30% { transform: translateY(-5px) scale(1.15); opacity: 1; } }
        @keyframes typingContainerIn { 0% { opacity: 0; transform: translateY(6px) scale(0.9); } 100% { opacity: 1; transform: translateY(0) scale(1); } }

        .chat-date-separator {
          position: sticky;
          top: 8px;
          z-index: 5;
          display: flex;
          justify-content: center;
          margin: 10px 0 6px;
          pointer-events: none;
        }
        .chat-date-separator > span {
          pointer-events: auto;
          background: rgba(20, 15, 35, 0.78);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          color: #fff;
          font-size: 11.5px;
          font-weight: 600;
          letter-spacing: 0.02em;
          padding: 4px 12px;
          border-radius: 999px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          border: 1px solid rgba(255,255,255,0.06);
        }
        html.theme-light .chat-date-separator > span {
          background: rgba(255,255,255,0.92);
          color: #111;
          border: 1px solid rgba(0,0,0,0.06);
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }

        .message-row.group-mid { margin-top: 1px; }
        .message-row.group-top { margin-top: 8px; }
        .message-row.group-mid .message-bubble,
        .message-row.group-bottom .message-bubble { border-radius: 18px; }
        .message-row.own.group-top .message-bubble { border-bottom-right-radius: 18px; }
        .message-row.own.group-mid .message-bubble { border-bottom-right-radius: 4px; border-top-right-radius: 4px; }
        .message-row.own.group-bottom .message-bubble { border-top-right-radius: 4px; }
        .message-row.partner.group-top .message-bubble { border-bottom-left-radius: 18px; }
        .message-row.partner.group-mid .message-bubble { border-bottom-left-radius: 4px; border-top-left-radius: 4px; }
        .message-row.partner.group-bottom .message-bubble { border-top-left-radius: 4px; }

        .message-row.group-mid:not(.group-bottom) .message-meta-time { opacity: 0.55; }

        .message-row.group-mid .message-bubble,
        .message-row.group-bottom:not(.group-top) .message-bubble {
          animation: none;
        }

        .chat-scroll-fab {
          position: absolute;
          right: 16px;
          bottom: 96px;
          z-index: 20;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px 8px 12px;
          border-radius: 999px;
          background: linear-gradient(135deg, #6C3CE1, #EC4899);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(108,60,225,0.4);
          animation: fabIn 0.25s cubic-bezier(0.2, 1.3, 0.4, 1) both;
        }
        .chat-scroll-fab:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(108,60,225,0.5); }
        .chat-scroll-fab svg { width: 16px; height: 16px; fill: currentColor; }
        @keyframes fabIn { 0% { opacity: 0; transform: translateY(10px) scale(0.9); } 100% { opacity: 1; transform: translateY(0) scale(1); } }

        .message-bubble.pinned { box-shadow: inset 0 0 0 1.5px rgba(255, 193, 7, 0.5); }
        .message-pin-badge {
          position: absolute;
          top: -6px;
          right: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #FFC107;
          color: #111;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        }
        .message-row.partner .message-pin-badge { right: auto; left: 8px; }

        .pinned-banner {
          position: sticky;
          top: 0;
          z-index: 9;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          background: rgba(20, 15, 35, 0.92);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          color: #fff;
          cursor: pointer;
          animation: pinnedIn 0.25s cubic-bezier(0.2, 1.3, 0.4, 1) both;
        }
        html.theme-light .pinned-banner { background: rgba(255,255,255,0.96); border-bottom: 1px solid rgba(0,0,0,0.08); color: #111; }
        .pinned-banner:hover { background: rgba(30, 20, 50, 0.96); }
        html.theme-light .pinned-banner:hover { background: rgba(250, 250, 250, 1); }
        .pinned-banner-icon {
          width: 28px; height: 28px;
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 50%;
          background: linear-gradient(135deg, #FFC107, #FF9800);
          color: #111;
          flex-shrink: 0;
        }
        .pinned-banner-body { flex: 1; min-width: 0; }
        .pinned-banner-label { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.75; margin-bottom: 1px; }
        .pinned-banner-text { display: block; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pinned-banner-close { background: none; border: none; color: inherit; padding: 4px; cursor: pointer; opacity: 0.75; display: flex; align-items: center; justify-content: center; }
        .pinned-banner-close:hover { opacity: 1; }
        @keyframes pinnedIn { 0% { opacity: 0; transform: translateY(-10px); } 100% { opacity: 1; transform: translateY(0); } }

        .message-row.select-mode { cursor: pointer; padding-left: 34px; padding-right: 34px; transition: background 0.15s ease; }
        .message-row.select-mode.selected { background: rgba(108, 60, 225, 0.14); }
        html.theme-light .message-row.select-mode.selected { background: rgba(108, 60, 225, 0.08); }
        .select-checkbox {
          position: absolute;
          top: 50%;
          left: 8px;
          transform: translateY(-50%);
          width: 22px; height: 22px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.5);
          display: flex; align-items: center; justify-content: center;
          background: transparent;
          color: transparent;
          transition: all 0.15s ease;
          z-index: 4;
        }
        .message-row.own .select-checkbox { left: auto; right: 8px; }
        html.theme-light .select-checkbox { border-color: rgba(0,0,0,0.35); }
        .select-checkbox.checked {
          background: linear-gradient(135deg, #6C3CE1, #EC4899);
          border-color: transparent;
          color: #fff;
          animation: checkboxPop 0.22s cubic-bezier(0.2, 1.4, 0.4, 1);
        }
        @keyframes checkboxPop { 0% { transform: translateY(-50%) scale(0.6); } 60% { transform: translateY(-50%) scale(1.15); } 100% { transform: translateY(-50%) scale(1); } }

        .select-top-bar {
          position: absolute;
          top: 0; left: 0; right: 0;
          z-index: 30;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: rgba(20, 15, 35, 0.95);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          animation: selectTopIn 0.22s ease both;
        }
        html.theme-light .select-top-bar { background: rgba(255,255,255,0.98); color: #111; border-bottom: 1px solid rgba(0,0,0,0.08); }
        @keyframes selectTopIn { 0% { transform: translateY(-100%); } 100% { transform: translateY(0); } }
        .select-top-title { flex: 1; font-size: 15px; font-weight: 700; }
        .select-top-btn { background: none; border: none; color: inherit; cursor: pointer; padding: 6px 10px; border-radius: 8px; font-size: 14px; font-weight: 600; }
        .select-top-btn:hover { background: rgba(255,255,255,0.1); }
        html.theme-light .select-top-btn:hover { background: rgba(0,0,0,0.06); }

        .select-bottom-bar {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          z-index: 30;
          display: flex;
          align-items: center;
          justify-content: space-around;
          gap: 4px;
          padding: 8px 10px calc(8px + env(safe-area-inset-bottom, 0px));
          background: rgba(20, 15, 35, 0.95);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-top: 1px solid rgba(255,255,255,0.1);
          animation: selectBottomIn 0.22s ease both;
        }
        html.theme-light .select-bottom-bar { background: rgba(255,255,255,0.98); border-top: 1px solid rgba(0,0,0,0.08); }
        @keyframes selectBottomIn { 0% { transform: translateY(100%); } 100% { transform: translateY(0); } }
        .select-action {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          background: none;
          border: none;
          color: #fff;
          cursor: pointer;
          padding: 6px 4px;
          border-radius: 10px;
          transition: background 0.15s ease;
          font-size: 11px;
          font-weight: 600;
        }
        html.theme-light .select-action { color: #111; }
        .select-action:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
        html.theme-light .select-action:hover:not(:disabled) { background: rgba(0,0,0,0.06); }
        .select-action:disabled { opacity: 0.35; cursor: not-allowed; }
        .select-action svg { width: 20px; height: 20px; fill: currentColor; }
        .select-action.danger { color: #ff6b6b; }

        .messages-container.has-pinned { padding-top: 0; }

        .messages-container .message-text { font-size: var(--msg-font-size, 15px); }

        .blocked-composer-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          background: var(--bg-input);
          border-top: 1px solid var(--border-color);
          color: var(--text-secondary);
          font-size: 14px;
        }
        .blocked-composer-unblock {
          padding: 8px 18px;
          border-radius: 20px;
          border: none;
          background: linear-gradient(135deg, #6C3CE1, #EC4899);
          color: #fff;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }
      `}</style>

      <SEO title={`Chat with ${displayName}`} description={`Chat with ${displayName} on ECHO.`} />
      <StructuredData />
      <div className="chat-view">
        <VideoAudioProvider>
          {chatBgEnabled && (<div className="echo-rings-bg is-active" aria-hidden="true"><span className="echo-bg-ring r1" /><span className="echo-bg-ring r2" /><span className="echo-bg-ring r3" /></div>)}

          {selectMode && (
            <div className="select-top-bar">
              <button type="button" className="select-top-btn" onClick={exitSelectMode} aria-label="Cancel select">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
              <span className="select-top-title">{selectedIds.size} selected</span>
              <button type="button" className="select-top-btn" onClick={() => { if (selectedIds.size === messages.length) setSelectedIds(new Set()); else setSelectedIds(new Set(messages.map(m => m.id))); }}>{selectedIds.size === messages.length ? 'Clear' : 'All'}</button>
            </div>
          )}

          {!selectMode && pinnedMessage && (
            <div className="pinned-banner" onClick={() => jumpToMessage(pinnedMessage.id)} role="button" tabIndex={0}>
              <span className="pinned-banner-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14"><path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" fill="currentColor"/></svg>
              </span>
              <div className="pinned-banner-body">
                <span className="pinned-banner-label">Pinned Message</span>
                <span className="pinned-banner-text">{pinnedPreview || 'Message'}</span>
              </div>
              <button type="button" className="pinned-banner-close" onClick={(e) => { e.stopPropagation(); handlePinMessage(pinnedMessage); }} aria-label="Unpin">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
            </div>
          )}

          <div className={`messages-container ${pinnedMessage && !selectMode ? 'has-pinned' : ''}`} ref={messagesContainerRef} onScroll={handleScroll} style={wallpaperStyle}>
            {loadingMessages && messages.length === 0 ? (
              <div className="chat-skeleton-list"><SkeletonMessage /><SkeletonMessage /><SkeletonMessage /></div>
            ) : messages.length === 0 ? (
              <div className="empty-chat-state"><i className="fas fa-paper-plane empty-icon" /><p>No messages yet. Say hello!</p></div>
            ) : (
              groupedMessages.map((entry) => renderMessage(entry))
            )}
            {isAILoading && (<div className="message-bubble partner"><div className="typing-indicator"><span></span><span></span><span></span></div></div>)}
            {partnerIsTyping && (
              <div className="typing-indicator-container">
                <div className="typing-echomoji-wrapper">
                  <ECHOMOJI mood={partnerProfile?.mood || 'happy'} skin={partnerProfile?.activeSkin ? getSkinById(partnerProfile.activeSkin) : null} size={44} interactive={false} animated={false} />
                </div>
                <div className="typing-dots-row">
                  <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </VideoAudioProvider>

        {!isNearBottom && !selectMode && (
          <button type="button" className="chat-scroll-fab" onClick={() => scrollToBottom(true)} aria-label="Scroll to latest">
            <svg viewBox="0 0 24 24"><path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z"/></svg>
            {unreadWhileScrolled > 0 ? `${unreadWhileScrolled} new` : ''}
          </button>
        )}

        {showEmojiPicker && (<ChatEmojiPicker onClose={() => setShowEmojiPicker(false)} onSelect={handleEmojiSelect} excludeRefs={[inputContainerRef, captionPreviewRef]} />)}

        {showReactionPicker && reactionPickerAnchor && (
          <>
            <div className="echo-reaction-backdrop" onClick={closeReactionPicker} />
            <div className="echo-reaction-bar" style={{ top: reactionPickerAnchor.top, left: reactionPickerAnchor.left }} onClick={(e) => e.stopPropagation()}>
              {REACTION_EMOJIS.map(({ key, Component }) => (
                <button key={key} type="button" className={`echo-reaction-emoji${tappedEmoji === key ? ' tapped' : ''}`} onClick={() => handleReactionSelect(key)} aria-label={key}>
                  <Component />
                </button>
              ))}
            </div>
          </>
        )}

        {reactionViewer && (
          <div className="reaction-viewer-modal" onClick={() => setReactionViewer(null)}>
            <div className="reaction-viewer-content" onClick={(e) => e.stopPropagation()}>
              <h3>{REACTION_LABELS[reactionViewer.emoji] || reactionViewer.emoji} Reactions</h3>
              <div className="reaction-viewer-list">
                {reactionViewer.userIds.map((uid) => (
                  <div
                    key={uid}
                    className="reaction-viewer-item"
                    onClick={() => { setReactionViewer(null); navigate(`/user/${uid}`); }}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}
                  >
                    <Avatar uid={uid} size="small" />
                    <span>{getProfile(uid)?.name || 'User'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!selectMode && blockedByMe && (
          <div className="blocked-composer-bar">
            <span>You blocked this user.</span>
            <button
              type="button"
              className="blocked-composer-unblock"
              onClick={async () => {
                try {
                  await unblockUser(user.uid, userId);
                  setBlockedByMe(false);
                  setToast({ message: 'User unblocked', type: 'success' });
                  setTimeout(() => setToast(null), 2500);
                } catch (_) {
                  setToast({ message: 'Failed to unblock', type: 'error' });
                  setTimeout(() => setToast(null), 2500);
                }
              }}
            >Unblock</button>
          </div>
        )}

        {!selectMode && !blockedByMe && (
          <form className="chat-input-container" onSubmit={handleSendText} ref={inputContainerRef}>
            {replyTo && <ReplyPreview replyTo={replyTo} onCancel={() => setReplyTo(null)} />}
            {replyToNote && (
              <div className="note-reply-preview-banner">
                <div className="note-reply-preview-banner-content">
                  <span className="note-reply-preview-banner-label">Replying to {replyToNote.authorName}'s note</span>
                  {replyToNote.song?.title ? (
                    <span className="note-reply-preview-banner-text">🎵 {replyToNote.song.title}{replyToNote.song.artist ? ` · ${replyToNote.song.artist}` : ''}</span>
                  ) : (
                    <span className="note-reply-preview-banner-text">{replyToNote.text}</span>
                  )}
                </div>
                <button type="button" className="note-reply-preview-banner-close" onClick={() => setReplyToNote(null)} aria-label="Cancel note reply">✕</button>
              </div>
            )}
            <div className="chat-input-row">
              <button type="button" className="chat-emoji-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)} title="Emojis"><i className="fas fa-smile" /></button>
              <button type="button" className="chat-voice-btn" onClick={() => { if (userId === ECHO_AI_ID) { setToast({ message: 'Voice notes are not available in ECHO AI chat right now.', type: 'info' }); setTimeout(() => setToast(null), 2800); return; } setShowVoiceRecorder(true); }} title="Voice note"><i className="fas fa-microphone" /></button>
              <div className="chat-more-wrapper" ref={moreOptionsRef}>
                <button type="button" className="chat-more-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowMoreOptions((v) => !v); }} title="More options"><i className="fas fa-ellipsis-h" /></button>
                {showMoreOptions && (
                  <div className="chat-more-options-popup" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="chat-more-option" onClick={() => { fileInputRef.current?.click(); setShowMoreOptions(false); }}><i className="fas fa-paperclip" /><span>Attach</span></button>
                    <button type="button" className="chat-more-option" onClick={() => { setShowWallpaperPicker(true); setShowMoreOptions(false); }}><i className="fas fa-image" /><span>Wallpaper</span></button>
                    <button type="button" className="chat-more-option danger" onClick={() => { setShowMoreOptions(false); handleEndEcho(); }} disabled={ended} style={ended ? { opacity: 0.4, pointerEvents: 'none' } : undefined}><i className="fas fa-stop-circle" /><span>End ECHO</span></button>
                  </div>
                )}
              </div>
              <input type="file" ref={fileInputRef} accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFileSelect} />
              <textarea
                ref={inputRef}
                className={`chat-input ${haloActive ? 'halo-active' : ''}`}
                placeholder={`Message ${displayName}...`}
                value={newMessage}
                onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }}
                onBlur={clearMyTyping}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onPointerDown={handleInputPointerDown}
                onPointerUp={handleInputPointerUp}
                onPointerLeave={handleInputPointerLeave}
                rows={1}
                style={{ resize: 'none', overflow: 'hidden', minHeight: '44px', maxHeight: '120px', lineHeight: '1.4', fontFamily: 'inherit', flex: 1, padding: '10px 16px', borderRadius: '24px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                onFocus={() => { focusedField.current = 'main'; }}
              />
              <button ref={sendButtonRef} type="submit" className="chat-send-btn" disabled={!newMessage.trim()}><i className="fas fa-paper-plane" /></button>
            </div>
          </form>
        )}

        {selectMode && (
          <div className="select-bottom-bar">
            <button type="button" className="select-action" onClick={bulkCopy} disabled={selectedIds.size === 0}>
              <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
              Copy
            </button>
            <button type="button" className="select-action" onClick={bulkSave} disabled={selectedIds.size === 0}>
              <svg viewBox="0 0 24 24"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
              Save
            </button>
            <button type="button" className="select-action danger" onClick={bulkDelete} disabled={selectedIds.size === 0}>
              <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              Delete
            </button>
          </div>
        )}

        {showVoiceRecorder && (<VoiceRecorder onSend={handleVoiceSend} onCancel={() => setShowVoiceRecorder(false)} />)}
        {renderPreviewOverlay()}
        <EditMessageModal isOpen={!!editingMessage} onClose={() => setEditingMessage(null)} messageText={editingMessage?.text || ''} onSave={saveEditedMessage} />
        <EditMediaCaptionModal isOpen={!!editingMediaMessage} onClose={() => setEditingMediaMessage(null)} currentCaption={editingMediaMessage?.caption || ''} mediaType={editingMediaMessage?.mediaType} onSave={saveEditedMediaCaption} />

        {mediaPreview && (<MediaPreview src={mediaPreview.src} type={mediaPreview.type} alt={mediaPreview.alt} onClose={() => setMediaPreview(null)} />)}
        {videoPreview && (
          <CustomVideoPlayer
            src={videoPreview.src}
            autoFullscreen={videoFullscreenDefault}
            onClose={() => setVideoPreview(null)}
          />
        )}

        {showWallpaperPicker && (
          <WallpaperPicker current={wallpaperId} currentCustom={customWallpaper} onSelect={handleWallpaperSelect} onSelectCustom={handleCustomWallpaperSelect} onClose={() => setShowWallpaperPicker(false)} />
        )}

        <ConfirmModal isOpen={confirmModal.isOpen} onClose={closeConfirmModal} onConfirm={confirmModal.onConfirm} title={confirmModal.title} message={confirmModal.message} confirmText={confirmModal.confirmText} cancelText={confirmModal.cancelText} />
        <Modal isOpen={fileSizeError} onClose={() => setFileSizeError(false)} title="File Too Large" message="The file you tried to upload exceeds the 20 MB limit. Please choose a smaller file." type="error" />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </>
  );
};

const DateSeparator = ({ label }) => (
  <div className="chat-date-separator"><span>{label}</span></div>
);

export default ChatView;
