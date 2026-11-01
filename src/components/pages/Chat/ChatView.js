// src/components/pages/Chat/ChatView.js
import React, { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ref, onValue, push, set, update, get, remove, runTransaction } from 'firebase/database';
import { useAuth } from '../../../hooks/useAuth';
import { sortMessages as sortMessagesByTime } from '../../../utils/sortMessages';
import { useProfile } from '../../../contexts/ProfileContext';
import { db } from '../../../services/firebase';
import { clearMessageCache } from '../../../services/messageCache';
import { VideoAudioProvider } from '../../../contexts/VideoAudioContext';
import SEO from '../../common/SEO';
import ChatMediaMessage from './ChatMediaMessage';
import AudioPlayer from './AudioPlayer';
import { saveToEchoArchive, listEchoArchive } from '../../../services/echoArchive';
import { isTideExpired } from '../../../utils/echoTides';
import ReplyPreview from './ReplyPreview';
import RepliedMessage from './RepliedMessage';
import EditMessageModal from './EditMessageModal';
import EditMediaCaptionModal from './EditMediaCaptionModal';
import ChatEmojiPicker from './ChatEmojiPicker';
import VoiceRecorder from './VoiceRecorder';
import MediaPreview from '../../common/MediaPreview';
import CustomVideoPlayer from '../../common/CustomVideoPlayer';
import ConfirmModal from '../../common/ConfirmModal';
import Modal from '../../common/Modal';
import Toast from '../../Toast/Toast';
import { SkeletonMessage } from '../../common/SkeletonLoader';
import WallpaperPicker from './WallpaperPicker';
import { getWallpaperById } from '../../../constants/wallpapers';
import { playSentSound, unlockAudio, getSoundEnabled } from '../../../services/notificationService';
import { REACTION_EMOJIS, REACTION_LABELS } from './ReactionEmoji';
import { useUserSettings } from '../../../hooks/useUserSettings';
import { isBlocked as checkIsBlocked, unblockUser } from '../../../services/blockService';
import { hapticSend, hapticLight } from '../../../utils/haptics';
import { isGroupChatId, chatIdToGroupId } from '../../../utils/groupId';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import './ChatView.css';
import './ChatViewLiquid.css';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const CLOUDINARY_CLOUD_NAME = 'rjlscgan';
const CLOUDINARY_UPLOAD_PRESET = 'echo_uploads';
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ECHO_AI_ID = 'echo_ai_assistant';
const GROUP_WINDOW_MS = 2 * 60 * 1000;
const FONT_SIZE_MAP = { sm: '13px', md: '15px', lg: '17px' };

const LONG_PRESS_MS = 380;
const SWIPE_THRESHOLD = 56;
const SWIPE_MAX = 84;
const MENU_W = 236;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

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
  } catch {
    return '';
  }
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
  return d.toLocaleDateString(
    undefined,
    sameYear ? { month: 'long', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }
  );
};

const senderColor = (uid) => {
  const colors = ['#e17076', '#7bc862', '#e5ca77', '#65aadd', '#a695e7', '#ee7aae', '#6ec9cb', '#faa774'];
  if (!uid) return colors[0];
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) | 0;
  return colors[Math.abs(h) % colors.length];
};

const clean = (obj) => {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(clean).filter((v) => v !== undefined);
  const result = {};
  for (const key of Object.keys(obj)) {
    const val = clean(obj[key]);
    if (val !== undefined) result[key] = val;
  }
  return result;
};

const EMOJI_ONLY_RE = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u200d|\ufe0f|\s)+$/u;
const isEmojiOnly = (t) => {
  if (!t || t.length > 24 || !EMOJI_ONLY_RE.test(t)) return false;
  const n = Array.from(t.replace(/\s/g, '')).filter((ch) => /\p{Extended_Pictographic}/u.test(ch)).length;
  return n > 0 && n <= 3;
};

const TOKEN_RE = /(https?:\/\/[^\s<]+|@[A-Za-z0-9_.]+)/g;
const linkify = (text) => {
  if (!text) return null;
  return String(text).split(TOKEN_RE).map((p, i) => {
    if (!p) return null;
    if (/^https?:\/\//.test(p)) {
      const cleanUrl = p.replace(/[.,!?)]+$/, '');
      const tail = p.slice(cleanUrl.length);
      return (
        <Fragment key={i}>
          <a href={cleanUrl} target="_blank" rel="noopener noreferrer" className="cv-link" onClick={(e) => e.stopPropagation()}>
            {cleanUrl}
          </a>
          {tail}
        </Fragment>
      );
    }
    if (/^@[A-Za-z0-9_.]+$/.test(p)) return <span key={i} className="mention">{p}</span>;
    return <Fragment key={i}>{p}</Fragment>;
  });
};

const isMessageExpired = (m) => {
  const hasExpiry = m.expiresAt != null || m.tideExpiresAt != null || m.expireAt != null;
  if (!hasExpiry) return false;
  try { return !!isTideExpired(m); } catch (_) { return false; }
};

const useVisualViewport = () => {
  useEffect(() => {
    const root = document.documentElement;
    const isTouch =
      window.matchMedia?.('(hover: none)').matches || window.matchMedia?.('(pointer: coarse)').matches;
    if (!isTouch) return undefined;
    const vv = window.visualViewport;
    if (!vv) return undefined;
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

const MessageReceipt = ({ msg, isMe, group }) => {
  if (!isMe) return null;
  if (msg.pending || msg.isUploading) return <span className="message-receipt pending" title="Sending"><i className="far fa-clock" /></span>;
  if (msg.uploadFailed) return <span className="message-receipt failed" title="Failed"><i className="fas fa-exclamation-circle" /></span>;
  if (group) return <span className="message-receipt sent" title="Sent">✓</span>;
  const read = !!msg.readAt || msg.isRead === true;
  const delivered = !!msg.deliveredAt || msg.received === true;
  if (read) return <span className="message-receipt read" title="Read">✓✓</span>;
  if (delivered) return <span className="message-receipt delivered" title="Delivered">✓✓</span>;
  return <span className="message-receipt sent" title="Sent">✓</span>;
};

/* ------------------------------------------------------------------ */
/* MessageRow                                                          */
/* ------------------------------------------------------------------ */

const MessageRow = ({
  msg, isOwn, rowClass, selectMode, selected, canReply,
  onLongPress, onReply, onDoubleTap, onToggleSelect, registerRef, children,
}) => {
  const rowRef = useRef(null);
  const stackRef = useRef(null);
  const iconRef = useRef(null);
  const g = useRef({
    id: null, x: 0, y: 0, mode: null, timer: null, pressTimer: null,
    longFired: false, passed: false, lastTap: 0, noSwipe: false,
  });

  const clearTimers = () => {
    const s = g.current;
    if (s.timer) clearTimeout(s.timer);
    if (s.pressTimer) clearTimeout(s.pressTimer);
    s.timer = null;
    s.pressTimer = null;
    rowRef.current?.classList.remove('pressed');
  };

  useEffect(() => () => {
    const s = g.current;
    if (s.timer) clearTimeout(s.timer);
    if (s.pressTimer) clearTimeout(s.pressTimer);
  }, []);

  const resetSwipe = (animate) => {
    const st = stackRef.current;
    if (st) {
      st.style.transition = animate ? 'transform .34s cubic-bezier(.2,.9,.3,1.25)' : 'none';
      st.style.transform = '';
    }
    const ic = iconRef.current;
    if (ic) {
      ic.style.opacity = '0';
      ic.style.transform = 'translateY(-50%) scale(.4)';
      ic.classList.remove('armed');
    }
  };

  const fireLong = () => {
    const s = g.current;
    s.longFired = true;
    s.mode = 'long';
    clearTimers();
    const bubble = rowRef.current?.querySelector('.message-bubble');
    const rect = (bubble || rowRef.current)?.getBoundingClientRect();
    if (rect) onLongPress(msg, rect);
  };

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const s = g.current;
    s.id = e.pointerId;
    s.x = e.clientX;
    s.y = e.clientY;
    s.mode = null;
    s.longFired = false;
    s.passed = false;
    s.noSwipe = !!e.target.closest?.('input, [role="slider"], video');
    clearTimers();
    if (selectMode) return;
    s.pressTimer = setTimeout(() => rowRef.current?.classList.add('pressed'), 110);
    if (e.pointerType !== 'mouse') s.timer = setTimeout(fireLong, LONG_PRESS_MS);
  };

  const onPointerMove = (e) => {
    const s = g.current;
    if (s.id !== e.pointerId || s.mode === 'long') return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (s.mode === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      clearTimers();
      if (!selectMode && canReply && !s.noSwipe && e.pointerType !== 'mouse' && dx < 0 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        s.mode = 'swipe';
        try { rowRef.current.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        if (stackRef.current) stackRef.current.style.transition = 'none';
      } else {
        s.mode = 'scroll';
        return;
      }
    }
    if (s.mode !== 'swipe') return;
    const raw = Math.max(0, -dx);
    const eased = raw <= SWIPE_THRESHOLD ? raw : Math.min(SWIPE_MAX, SWIPE_THRESHOLD + (raw - SWIPE_THRESHOLD) * 0.35);
    if (stackRef.current) stackRef.current.style.transform = `translate3d(${-eased}px,0,0)`;
    const p = Math.min(1, raw / SWIPE_THRESHOLD);
    const ic = iconRef.current;
    if (ic) {
      ic.style.opacity = String(p);
      ic.style.transform = `translateY(-50%) scale(${0.5 + 0.5 * p})`;
    }
    const armed = raw >= SWIPE_THRESHOLD;
    if (armed !== s.passed) {
      s.passed = armed;
      ic?.classList.toggle('armed', armed);
      if (armed) hapticLight();
    }
  };

  const finish = (e, cancelled) => {
    const s = g.current;
    if (s.id !== e.pointerId) return;
    s.id = null;
    clearTimers();
    if (s.mode === 'swipe') {
      const doReply = s.passed && !cancelled;
      resetSwipe(true);
      try { rowRef.current.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      s.mode = null;
      if (doReply) onReply(msg);
      return;
    }
    if (s.mode === null && !cancelled && !s.longFired) {
      if (selectMode) { onToggleSelect(msg); return; }
      if (e.target.closest?.('a, button, .chat-media-wrapper, .cv-reply-hit, audio, input, .cv-retry')) return;
      const now = Date.now();
      if (now - s.lastTap < 300) { s.lastTap = 0; onDoubleTap(msg); } else { s.lastTap = now; }
    }
  };

  const onContextMenu = (e) => {
    e.preventDefault();
    if (selectMode) return;
    if (!g.current.longFired) fireLong();
  };

  const onClickCapture = (e) => {
    if (g.current.longFired) {
      e.preventDefault();
      e.stopPropagation();
      g.current.longFired = false;
    }
  };

  return (
    <div
      ref={(el) => { rowRef.current = el; registerRef?.(msg.id, el); }}
      className={rowClass}
      data-msg-id={msg.id}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finish(e, false)}
      onPointerCancel={(e) => finish(e, true)}
      onContextMenu={onContextMenu}
      onClickCapture={onClickCapture}
    >
      {selectMode && (
        <span className={`select-checkbox ${selected ? 'checked' : ''}`}><i className="fas fa-check" /></span>
      )}
      <div className="cv-swipe-reply" ref={iconRef} aria-hidden="true"><i className="fas fa-reply" /></div>
      <div className={`message-stack ${isOwn ? 'own' : 'partner'}`} ref={stackRef}>{children}</div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Liquid long-press menu                                              */
/* ------------------------------------------------------------------ */

const computeMenuLayout = (rect, itemCount, isOwn, reactionCount) => {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const REACT_H = 56;
  const ITEM_H = 46;
  const GAP = 10;
  const TOP = 70;
  const BOTTOM = 26;
  const EDGE = 12;
  const menuH = itemCount * ITEM_H + 12;
  const reactW = Math.min(vw - EDGE * 2, reactionCount * 46 + 20);
  let bubbleH = Math.min(rect.height, vh * 0.36);
  const avail = vh - TOP - BOTTOM - REACT_H - menuH - GAP * 2;
  if (bubbleH > avail) bubbleH = Math.max(48, avail);
  const minTop = TOP + REACT_H + GAP;
  const maxTop = vh - BOTTOM - menuH - GAP - bubbleH;
  const bubbleTop = Math.max(minTop, Math.min(rect.top, maxTop));
  const clampX = (x, w) => Math.max(EDGE, Math.min(x, vw - w - EDGE));
  return {
    bubbleH,
    bubbleTop,
    reactW,
    reactTop: bubbleTop - REACT_H - GAP,
    reactLeft: clampX(isOwn ? rect.right - reactW : rect.left, reactW),
    menuTop: bubbleTop + Math.min(rect.height, bubbleH) + GAP,
    menuLeft: clampX(isOwn ? rect.right - MENU_W : rect.left, MENU_W),
  };
};

const MessageMenu = ({ menu, items, myReaction, onReact, onClose, children }) => {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  const close = useCallback((after) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(() => {
      onClose();
      if (typeof after === 'function') after();
    }, 180);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const onResize = () => close();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [close]);

  const L = useMemo(
    () => computeMenuLayout(menu.rect, items.length, menu.isOwn, REACTION_EMOJIS.length),
    [menu, items.length]
  );

  return createPortal(
    <div
      className={`cv-menu-root${closing ? ' closing' : ''}`}
      onClick={() => close()}
      onContextMenu={(e) => { e.preventDefault(); close(); }}
    >
      <div className="cv-menu-backdrop" />

      <div
        className="cv-menu-reactions cv-glass"
        style={{ top: L.reactTop, left: L.reactLeft, width: L.reactW, transformOrigin: `${menu.isOwn ? 'right' : 'left'} bottom` }}
        onClick={(e) => e.stopPropagation()}
      >
        {REACTION_EMOJIS.map(({ key, Component }, i) => (
          <button
            type="button"
            key={key}
            className={`echo-reaction-emoji cv-react-btn${myReaction === key ? ' active' : ''}`}
            style={{ '--i': i }}
            onClick={() => close(() => onReact(key))}
          >
            <Component />
          </button>
        ))}
      </div>

      <div
        className="cv-menu-lift"
        style={{
          top: L.bubbleTop,
          left: menu.rect.left,
          width: menu.rect.width,
          maxHeight: L.bubbleH,
          '--dy': `${menu.rect.top - L.bubbleTop}px`,
        }}
      >
        {children}
      </div>

      <div
        className="cv-menu-list cv-glass"
        style={{ top: L.menuTop, left: L.menuLeft, width: MENU_W, transformOrigin: `${menu.isOwn ? 'right' : 'left'} top` }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((it) => (
          <button
            type="button"
            key={it.key}
            className={`cv-menu-item${it.danger ? ' danger' : ''}`}
            onClick={() => close(it.onPress)}
          >
            <span>{it.label}</span>
            <i className={`fas ${it.icon}`} />
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
};

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

const ChatView = () => {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { getProfile, fetchProfile } = useProfile();
  const { chatStyle: myChatStyle, isEchoPlus } = useSubscription();

  useVisualViewport();
  const { settings: userSettings } = useUserSettings(user?.uid);

  const enterToSend = userSettings?.chats?.enterToSend !== false;
  const showTyping = userSettings?.chats?.showTyping !== false;
  const sendReadReceipts = userSettings?.chats?.sendReadReceipts !== false;
  const fontSize = userSettings?.chats?.fontSize || 'md';

  const isGroupChat = isGroupChatId(userId);
  const groupIdFromChat = isGroupChat ? chatIdToGroupId(userId) : null;

  const chatKey = useMemo(() => {
    if (!user?.uid || !userId) return null;
    return isGroupChat ? userId : [user.uid, userId].sort().join('_');
  }, [user?.uid, userId, isGroupChat]);

  const msgRoot = useMemo(() => {
    if (!chatKey) return null;
    return isGroupChat ? `groups/${groupIdFromChat}/messages` : `chats/${chatKey}/messages`;
  }, [chatKey, isGroupChat, groupIdFromChat]);

  /* ---------------- state ---------------- */
  const [groupData, setGroupData] = useState(null);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [localMsgs, setLocalMsgs] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [unreadWhileScrolled, setUnreadWhileScrolled] = useState(0);
  const [replyTo, setReplyTo] = useState(null);
  const [replyToNote, setReplyToNote] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editingMediaMessage, setEditingMediaMessage] = useState(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [menu, setMenu] = useState(null);
  const [partnerIsTyping, setPartnerIsTyping] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [wallpaperId, setWallpaperId] = useState('default');
  const [customWallpaper, setCustomWallpaper] = useState(null);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [captionText, setCaptionText] = useState('');
  const [fileSizeError, setFileSizeError] = useState(false);
  const [toast, setToast] = useState(null);
  const [bookmarkedIds, setBookmarkedIds] = useState({});
  const [pinnedMessageId, setPinnedMessageId] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [highlightId, setHighlightId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false, title: '', message: '', confirmText: 'Confirm', cancelText: 'Cancel', onConfirm: null,
  });

  /* ---------------- refs ---------------- */
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const inputContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const moreOptionsRef = useRef(null);
  const sendButtonRef = useRef(null);
  const messageRefs = useRef({});
  const seenIdsRef = useRef(new Set());
  const isNearBottomRef = useRef(true);
  const initialScrollRef = useRef(false);
  const prevLastTimeRef = useRef(0);
  const typingTimeoutRef = useRef(null);
  const latestTypingRef = useRef(null);
  const toastTimerRef = useRef(null);
  const lastMarkKeyRef = useRef(null);

  /* ---------------- tiny helpers ---------------- */
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  const openConfirmModal = (config) => setConfirmModal({ isOpen: true, cancelText: 'Cancel', ...config });

  const registerRef = useCallback((id, el) => {
    if (el) messageRefs.current[id] = el;
    else delete messageRefs.current[id];
  }, []);

  const upsertLocal = useCallback((m) => {
    setLocalMsgs((prev) => {
      const i = prev.findIndex((x) => x.id === m.id);
      if (i < 0) return [...prev, m];
      const next = [...prev];
      next[i] = m;
      return next;
    });
  }, []);
  const patchLocal = useCallback((id, patch) => {
    setLocalMsgs((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);
  const removeLocal = useCallback((id) => {
    setLocalMsgs((prev) => {
      const found = prev.find((x) => x.id === id);
      if (found?.mediaUrl && String(found.mediaUrl).startsWith('blob:')) {
        try { URL.revokeObjectURL(found.mediaUrl); } catch (_) { /* ignore */ }
      }
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  /* ---------------- global effects ---------------- */
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    document.body.classList.add('echo-hide-bottom-nav');
    return () => document.body.classList.remove('echo-hide-bottom-nav');
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setLoadingMessages(false), 1200);
    return () => clearTimeout(t);
  }, []);

  // Partner profile / group data
  useEffect(() => {
    if (isGroupChat && groupIdFromChat) {
      const groupRef = ref(db, `groups/${groupIdFromChat}`);
      const unsub = onValue(groupRef, (snap) => {
        setGroupData(snap.exists() ? { id: groupIdFromChat, ...snap.val() } : null);
      });
      return () => unsub();
    }
    if (!userId) return undefined;
    const cached = getProfile(userId);
    if (cached) setPartnerProfile(cached);
    else fetchProfile(userId);
    const unsub = onValue(ref(db, `profiles/${userId}`), (snap) => {
      if (snap.exists()) setPartnerProfile(snap.val());
    });
    return () => unsub();
  }, [userId, getProfile, fetchProfile, isGroupChat, groupIdFromChat]);

  // My profile
  useEffect(() => {
    if (!user?.uid) return;
    get(ref(db, `profiles/${user.uid}`))
      .then((snap) => { if (snap.exists()) setCurrentUserProfile(snap.val()); })
      .catch(console.error);
  }, [user?.uid]);

  // Reply-to-note / prefilled text coming from navigation state
  useEffect(() => {
    const state = location.state;
    if (!state) return;
    const focusEnd = (text) => {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          try { inputRef.current.setSelectionRange(text.length, text.length); } catch (_) { /* ignore */ }
        }
      }, 120);
    };
    if (state.replyToNote && (state.prefilledNote || state.noteSong)) {
      setReplyToNote({
        text: state.prefilledNote || '',
        authorUid: state.noteAuthorUid || null,
        authorName: state.noteAuthorName || 'User',
        createdAt: state.noteCreatedAt || Date.now(),
        song: state.noteSong || null,
      });
      if (typeof state.prefilledNote === 'string' && state.prefilledNote) setNewMessage(state.prefilledNote);
      navigate(location.pathname, { replace: true, state: {} });
      focusEnd(state.prefilledNote || '');
      return;
    }
    if (state.prefilledNote && typeof state.prefilledNote === 'string') {
      setNewMessage(state.prefilledNote);
      focusEnd(state.prefilledNote);
    }
  }, [location.state, location.pathname, navigate]);

  // Partner typing
  useEffect(() => {
    if (!chatKey || !userId || isGroupChat) return undefined;
    latestTypingRef.current = null;
    const typingRef = ref(db, `chats/${chatKey}/typing/${userId}`);
    const evaluate = () => {
      const data = latestTypingRef.current;
      if (!data || !data.isTyping) return setPartnerIsTyping(false);
      return setPartnerIsTyping(Date.now() - (data.timestamp || 0) < 4000);
    };
    const unsub = onValue(typingRef, (snap) => { latestTypingRef.current = snap.val(); evaluate(); });
    const interval = setInterval(evaluate, 1500);
    return () => { unsub(); clearInterval(interval); setPartnerIsTyping(false); };
  }, [chatKey, userId, isGroupChat]);

  // Wallpaper
  useEffect(() => {
    if (!chatKey) return undefined;
    const unsubWp = onValue(ref(db, `chats/${chatKey}/wallpaper`), (snap) => setWallpaperId(snap.val() || 'default'));
    const unsubCw = onValue(ref(db, `chats/${chatKey}/customWallpaper`), (snap) => setCustomWallpaper(snap.val() || null));
    return () => { unsubWp(); unsubCw(); };
  }, [chatKey]);

  // Pinned message
  useEffect(() => {
    if (!chatKey) return undefined;
    const unsub = onValue(ref(db, `chats/${chatKey}/pinnedMessageId`), (snap) => setPinnedMessageId(snap.val() || null));
    return () => unsub();
  }, [chatKey]);

  // Mute (groups)
  useEffect(() => {
    if (!user?.uid || !userId || !isGroupChat) return undefined;
    const unsub = onValue(ref(db, `userChats/${user.uid}/${userId}/muted`), (snap) => setIsMuted(!!snap.val()));
    return () => unsub();
  }, [user?.uid, userId, isGroupChat]);

  // Block state
  useEffect(() => {
    if (!user?.uid || !userId || isGroupChat) return undefined;
    let mounted = true;
    Promise.resolve(checkIsBlocked(user.uid, userId))
      .then((v) => { if (mounted) setBlockedByMe(!!v); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [user?.uid, userId, isGroupChat]);

  // Saved (bookmarked) message ids
  useEffect(() => {
    if (!user?.uid) return undefined;
    let alive = true;
    Promise.resolve(listEchoArchive(user.uid))
      .then((items) => {
        if (!alive) return;
        const arr = Array.isArray(items) ? items : Object.values(items || {});
        const map = {};
        arr.forEach((it) => {
          const id = it?.messageId || it?.originalId || it?.id;
          if (id) map[id] = true;
        });
        setBookmarkedIds(map);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [user?.uid]);

  // Messages listener
  useEffect(() => {
    seenIdsRef.current = new Set();
    initialScrollRef.current = false;
    prevLastTimeRef.current = 0;
    lastMarkKeyRef.current = null;
    setMessages([]);
    setLocalMsgs([]);
    setReplyTo(null);
    setSelectMode(false);
    setSelectedIds(new Set());
    setMenu(null);
    if (!msgRoot) { setLoadingMessages(false); return undefined; }
    setLoadingMessages(true);
    let active = true;
    let first = true;
    const unsub = onValue(
      ref(db, msgRoot),
      (snap) => {
        if (!active) return;
        const data = snap.val();
        const list = data ? Object.entries(data).map(([id, val]) => ({ ...val, id })) : [];
        if (first) {
          first = false;
          list.forEach((m) => seenIdsRef.current.add(m.id));
        }
        setMessages(sortMessages(list));
        setLoadingMessages(false);
      },
      (error) => { console.error('Firebase listener error:', error); setLoadingMessages(false); }
    );
    return () => { active = false; unsub(); };
  }, [msgRoot]);

  // Merge server messages + local optimistic ones, hide truly expired tides
  const displayMessages = useMemo(() => {
    const byId = new Map();
    messages.forEach((m) => byId.set(m.id, m));
    localMsgs.forEach((m) => { if (!byId.has(m.id)) byId.set(m.id, { ...m, _local: true }); });
    let list = Array.from(byId.values());
    if (userId !== ECHO_AI_ID) {
      list = list.filter((m) => !(isMessageExpired(m) && !bookmarkedIds[m.id] && !m.pinned && m.id !== pinnedMessageId));
    }
    return sortMessages(list);
  }, [messages, localMsgs, bookmarkedIds, pinnedMessageId, userId]);

  const entries = useMemo(() => {
    const near = (a, b) =>
      a && b && a.type !== 'system' && b.type !== 'system' && a.senderId === b.senderId &&
      Math.abs(msgTime(b) - msgTime(a)) < GROUP_WINDOW_MS;
    return displayMessages.map((msg, i) => {
      const prev = displayMessages[i - 1];
      const next = displayMessages[i + 1];
      const dayThis = startOfDay(msgTime(msg) || Date.now());
      const dayPrev = prev ? startOfDay(msgTime(prev) || Date.now()) : null;
      return {
        msg,
        isSystem: msg.type === 'system',
        groupTop: !near(prev, msg),
        groupBottom: !near(msg, next),
        showDateSeparator: dayPrev === null || dayThis !== dayPrev,
        dateLabel: formatDayLabel(msgTime(msg) || Date.now()),
      };
    });
  }, [displayMessages]);

  /* ---------------- scrolling ---------------- */
  const scrollToBottom = useCallback((smooth = true) => {
    const c = messagesContainerRef.current;
    if (c) c.scrollTo({ top: c.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    setUnreadWhileScrolled(0);
  }, []);

  const handleScroll = useCallback(() => {
    const c = messagesContainerRef.current;
    if (!c) return;
    const near = c.scrollHeight - c.scrollTop - c.clientHeight < 80;
    isNearBottomRef.current = near;
    setIsNearBottom(near);
    if (near) setUnreadWhileScrolled(0);
  }, []);

  useEffect(() => {
    if (!displayMessages.length) return;
    const last = displayMessages[displayMessages.length - 1];
    if (!initialScrollRef.current) {
      initialScrollRef.current = true;
      prevLastTimeRef.current = msgTime(last);
      requestAnimationFrame(() => scrollToBottom(false));
    } else if (msgTime(last) > prevLastTimeRef.current) {
      prevLastTimeRef.current = msgTime(last);
      const mine = last.senderId === user?.uid;
      if (mine || isNearBottomRef.current) requestAnimationFrame(() => scrollToBottom(true));
      else setUnreadWhileScrolled((c) => c + 1);
    }
    displayMessages.forEach((m) => seenIdsRef.current.add(m.id));
  }, [displayMessages, user?.uid, scrollToBottom]);

  useEffect(() => {
    if (partnerIsTyping && isNearBottomRef.current) requestAnimationFrame(() => scrollToBottom(true));
  }, [partnerIsTyping, scrollToBottom]);

  const scrollToMessage = useCallback((id) => {
    const el = messageRefs.current[id];
    if (!el) { showToast('Message not found', 'error'); return; }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(id);
    setTimeout(() => setHighlightId(null), 1400);
  }, [showToast]);

  /* ---------------- read receipts ---------------- */
  useEffect(() => {
    if (!user?.uid || !userId || !chatKey || !msgRoot) return undefined;
    const run = () => {
      if (document.visibilityState === 'hidden') return;
      if (isGroupChat) {
        const key = `g:${messages.length}`;
        if (lastMarkKeyRef.current === key) return;
        lastMarkKeyRef.current = key;
        update(ref(db, `userChats/${user.uid}/${userId}`), { unreadCount: 0 }).catch(() => {});
        return;
      }
      const unread = messages.filter((m) => m.receiverId === user.uid && m.isRead === false);
      if (!unread.length) { lastMarkKeyRef.current = ''; return; }
      const key = unread.map((m) => m.id).join(',');
      if (lastMarkKeyRef.current === key) return;
      lastMarkKeyRef.current = key;

      sessionStorage.setItem(`chat_read_${userId}`, 'true');
      window.dispatchEvent(new CustomEvent('chat-read', { detail: { userId } }));
      window.dispatchEvent(new CustomEvent('chat-list-update', { detail: { partnerId: userId, patch: { unreadCount: 0 } } }));
      update(ref(db, `userChats/${user.uid}/${userId}`), { unreadCount: 0 }).catch(() => {});

      if (sendReadReceipts) {
        const upd = {};
        const now = Date.now();
        unread.forEach((m) => {
          upd[`${msgRoot}/${m.id}/isRead`] = true;
          upd[`${msgRoot}/${m.id}/readAt`] = now;
        });
        update(ref(db), upd).catch(() => {});
      }
      window.dispatchEvent(new CustomEvent('chat-unread-cleared', { detail: { partnerId: userId } }));
      clearMessageCache(chatKey);
    };
    run();
    document.addEventListener('visibilitychange', run);
    return () => document.removeEventListener('visibilitychange', run);
  }, [messages, user?.uid, userId, chatKey, msgRoot, isGroupChat, sendReadReceipts]);

  /* ---------------- input helpers ---------------- */
  useEffect(() => {
    const ta = inputRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }, [newMessage]);

  useEffect(() => {
    if (!showMoreOptions) return undefined;
    const onDown = (e) => {
      if (moreOptionsRef.current && !moreOptionsRef.current.contains(e.target)) setShowMoreOptions(false);
    };
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onDown);
      document.addEventListener('touchstart', onDown);
    }, 10);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [showMoreOptions]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const clearMyTyping = useCallback(() => {
    if (!chatKey || isGroupChat || !user?.uid) return;
    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
    set(ref(db, `chats/${chatKey}/typing/${user.uid}`), { isTyping: false, timestamp: Date.now() }).catch(() => {});
  }, [chatKey, isGroupChat, user?.uid]);

  const handleTyping = useCallback(() => {
    if (!chatKey || !user?.uid || !showTyping || isGroupChat) return;
    const typingRef = ref(db, `chats/${chatKey}/typing/${user.uid}`);
    set(typingRef, { isTyping: true, timestamp: Date.now() }).catch(() => {});
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      set(typingRef, { isTyping: false, timestamp: Date.now() }).catch(() => {});
    }, 2500);
  }, [chatKey, user?.uid, showTyping, isGroupChat]);

  useEffect(() => () => { clearMyTyping(); }, [clearMyTyping]);

  const triggerSendRipple = () => {
    const btn = sendButtonRef.current;
    if (!btn) return;
    btn.classList.remove('rippling');
    void btn.offsetWidth;
    btn.classList.add('rippling');
  };

  const playSendSound = () => {
    try { if (typeof getSoundEnabled !== 'function' || getSoundEnabled()) playSentSound(); } catch (_) { /* ignore */ }
  };

  /* ---------------- sending ---------------- */
  const patchMyUserChat = async (partnerId, fields) => {
    if (!user?.uid || !partnerId || isGroupChat) return;
    await update(ref(db, `userChats/${user.uid}/${partnerId}`), { id: partnerId, ...fields });
  };

  const updateChatMeta = async (preview) => {
    const now = Date.now();
    try {
      if (isGroupChat) {
        await update(ref(db, `groups/${groupIdFromChat}`), { lastMessage: preview, lastSenderId: user.uid, lastUpdated: now });
        return;
      }
      await patchMyUserChat(userId, {
        partnerName: partnerProfile?.name || 'User',
        partnerAvatar: partnerProfile?.avatar || '',
        lastMessage: preview,
        lastSenderId: user.uid,
        lastUpdated: now,
        unreadCount: 0,
      });
      await runTransaction(ref(db, `userChats/${userId}/${user.uid}`), (cur) => {
        if (cur === null) {
          return {
            id: user.uid,
            partnerName: currentUserProfile?.name || 'User',
            partnerAvatar: currentUserProfile?.avatar || '',
            lastMessage: preview,
            lastSenderId: user.uid,
            lastUpdated: now,
            unreadCount: 1,
          };
        }
        cur.unreadCount = (cur.unreadCount || 0) + 1;
        cur.lastMessage = preview;
        cur.lastSenderId = user.uid;
        cur.lastUpdated = now;
        return cur;
      });
    } catch (err) {
      console.warn('Chat meta update failed:', err);
    }
  };

  const buildMessageBase = (type, extra) => ({
    senderId: user.uid,
    receiverId: isGroupChat ? null : userId,
    type,
    timestamp: Date.now(),
    isRead: false,
    senderName: currentUserProfile?.name || user.displayName || 'User',
    senderAvatar: currentUserProfile?.avatar || '',
    senderIsPlus: !!isEchoPlus,
    senderChatStyle: myChatStyle || '',
    ...extra,
  });

  const handleSendText = async (e) => {
    e?.preventDefault?.();
    const textToSend = (typeof e === 'string' ? e : newMessage).trim();
    if (!textToSend) return;
    if (!user?.uid || !userId || !msgRoot) {
      showToast('Not signed in yet. Please try again.', 'error');
      return;
    }
    if (blockedByMe) return;

    triggerSendRipple();
    hapticSend();
    clearMyTyping();

    const noteCtx = replyToNote;
    const replyCtx = replyTo;
    setNewMessage('');
    setReplyTo(null);
    setReplyToNote(null);
    setShowEmojiPicker(false);

    const newMsgRef = push(ref(db, msgRoot));
    const id = newMsgRef.key;
    const payload = buildMessageBase('text', { text: textToSend });
    if (replyCtx) payload.replyTo = { ...replyCtx };
    if (noteCtx) payload.replyToNote = { ...noteCtx };
    const safePayload = clean(payload);

    upsertLocal({ ...safePayload, id, pending: true });
    try {
      await set(newMsgRef, safePayload);
    } catch (err) {
      console.error('Send failed:', err);
      removeLocal(id);
      setNewMessage(textToSend);
      showToast(`Message not sent${err?.code ? ` (${err.code})` : ''}`, 'error');
      return;
    }
    removeLocal(id);
    playSendSound();
    await updateChatMeta(textToSend);
    clearMessageCache(chatKey);
  };

  const uploadToCloudinary = (file, onProgress) => new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, true);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) onProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        try { resolve(JSON.parse(xhr.responseText).secure_url); } catch (err) { reject(err); }
      } else {
        reject(new Error('Upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });

  const sendMedia = async ({ file, mediaType, caption = '', duration, replyCtx, noteCtx, existingId }) => {
    if (!file || !user?.uid || !msgRoot) return;
    const msgRef = existingId ? ref(db, `${msgRoot}/${existingId}`) : push(ref(db, msgRoot));
    const id = msgRef.key;
    const blobUrl = URL.createObjectURL(file);

    const extra = { mediaType, caption: (caption || '').trim() };
    if (duration != null) extra.duration = duration;
    const payload = buildMessageBase('media', extra);
    if (replyCtx) payload.replyTo = { ...replyCtx };
    if (noteCtx) payload.replyToNote = { ...noteCtx };
    const safePayload = clean(payload);

    upsertLocal({
      ...safePayload, id, mediaUrl: blobUrl, isUploading: true, uploadProgress: 0, uploadFailed: false, _file: file,
    });

    try {
      const url = await uploadToCloudinary(file, (p) => patchLocal(id, { uploadProgress: p }));
      await set(msgRef, { ...safePayload, mediaUrl: url });
      removeLocal(id);
      playSendSound();
      const label = mediaType === 'video' ? '🎬 Video' : mediaType === 'audio' ? '🎤 Voice note' : '📷 Image';
      await updateChatMeta(label);
      clearMessageCache(chatKey);
    } catch (err) {
      console.error('Media send failed:', err);
      patchLocal(id, { isUploading: false, uploadFailed: true, uploadProgress: 0 });
    }
  };

  const retryMedia = (msg) => {
    if (!msg?._file) return;
    sendMedia({
      file: msg._file,
      mediaType: msg.mediaType,
      caption: msg.caption,
      duration: msg.duration,
      replyCtx: msg.replyTo,
      noteCtx: msg.replyToNote,
      existingId: msg.id,
    });
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { setFileSizeError(true); return; }
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      showToast('Only images and videos are supported', 'error');
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setCaptionText('');
  };

  const cancelFileSelection = () => { setSelectedFile(null); setPreviewUrl(null); setCaptionText(''); };

  const sendSelectedFile = () => {
    if (!selectedFile) return;
    hapticSend();
    const file = selectedFile;
    const caption = captionText;
    const replyCtx = replyTo;
    const noteCtx = replyToNote;
    cancelFileSelection();
    setReplyTo(null);
    setReplyToNote(null);
    sendMedia({
      file,
      mediaType: file.type.startsWith('video/') ? 'video' : 'image',
      caption,
      replyCtx,
      noteCtx,
    });
  };

  const handleVoiceSend = async (audioBlob, duration) => {
    setShowVoiceRecorder(false);
    if (!audioBlob) return;
    sendMedia({ file: audioBlob, mediaType: 'audio', duration });
  };

  /* ---------------- message actions ---------------- */
  const handleReply = (msg) => {
    const own = String(msg.senderId || '') === String(user?.uid || '');
    const senderName = own
      ? currentUserProfile?.name || 'You'
      : isGroupChat ? msg.senderName || 'Member' : partnerProfile?.name || 'User';
    const textSnippet = msg.type === 'media'
      ? msg.caption || (msg.mediaType === 'video' ? '🎬 Video' : msg.mediaType === 'audio' ? '🎤 Voice note' : '📷 Image')
      : msg.text || 'Message';
    setReplyTo({ messageId: msg.id, senderName, messageType: msg.type || 'text', textSnippet });
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const handleReactionSelect = async (emojiKey, msg) => {
    if (!msg || msg._local || !msgRoot) return;
    hapticLight();
    const reactionRef = ref(db, `${msgRoot}/${msg.id}/reactions/${user.uid}`);
    try {
      if (msg.reactions?.[user.uid] === emojiKey) await remove(reactionRef);
      else await set(reactionRef, emojiKey);
    } catch (err) {
      console.warn('Reaction error:', err);
    }
  };

  const handleDoubleTap = (msg) => {
    if (msg._local || !REACTION_EMOJIS[0]) return;
    handleReactionSelect(REACTION_EMOJIS[0].key, msg);
  };

  const handleCopy = async (msg) => {
    try {
      await navigator.clipboard.writeText(msg.text || msg.caption || msg.mediaUrl || '');
      showToast('Copied');
    } catch (_) {
      showToast('Could not copy', 'error');
    }
  };

  const handlePinMessage = async (msg) => {
    if (!chatKey) return;
    try {
      await set(ref(db, `chats/${chatKey}/pinnedMessageId`), pinnedMessageId === msg.id ? null : msg.id);
    } catch (_) {
      showToast('Could not pin message', 'error');
    }
  };

  const saveMessageToArchive = async (msg) => {
    try {
      const { _local, _file, ...rest } = msg;
      await saveToEchoArchive(user.uid, rest);
      setBookmarkedIds((prev) => ({ ...prev, [msg.id]: true }));
      showToast('Saved');
    } catch (_) {
      showToast('Could not save', 'error');
    }
  };

  const handleEditMessage = (msg) => {
    if (msg.senderId !== user?.uid) return;
    if (msg.type === 'media') setEditingMediaMessage(msg);
    else setEditingMessage(msg);
  };

  const saveEditedMessage = async (newText) => {
    if (!editingMessage || !msgRoot) return;
    const text = (newText || '').trim();
    if (!text) return;
    try {
      await update(ref(db, `${msgRoot}/${editingMessage.id}`), { text, isEdited: true });
    } catch (_) {
      showToast('Edit failed', 'error');
    }
    setEditingMessage(null);
  };

  const saveEditedCaption = async (caption) => {
    if (!editingMediaMessage || !msgRoot) return;
    try {
      await update(ref(db, `${msgRoot}/${editingMediaMessage.id}`), { caption: (caption || '').trim(), isEdited: true });
    } catch (_) {
      showToast('Edit failed', 'error');
    }
    setEditingMediaMessage(null);
  };

  /* ---------------- selection mode ---------------- */
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };
  const enterSelectMode = (msg) => { setSelectMode(true); setSelectedIds(new Set(msg ? [msg.id] : [])); };
  const toggleSelect = (msg) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(msg.id)) n.delete(msg.id); else n.add(msg.id);
      return n;
    });
  };

  const confirmDelete = (targets) => {
    if (!targets.length || !msgRoot) return;
    if (targets.some((m) => m.senderId !== user?.uid)) return;
    const n = targets.length;
    openConfirmModal({
      title: n > 1 ? `Delete ${n} messages` : 'Delete message',
      message: 'This cannot be undone.',
      confirmText: 'Delete',
      onConfirm: async () => {
        closeConfirmModal();
        const upd = {};
        targets.forEach((m) => {
          if (m._local) removeLocal(m.id);
          else upd[`${msgRoot}/${m.id}`] = null;
        });
        try {
          if (Object.keys(upd).length) await update(ref(db), upd);
          clearMessageCache(chatKey);
        } catch (_) {
          showToast('Delete failed', 'error');
        }
        exitSelectMode();
      },
    });
  };

  const selectedMessages = useMemo(
    () => displayMessages.filter((m) => selectedIds.has(m.id)),
    [displayMessages, selectedIds]
  );
  const canDeleteSelected = selectedMessages.length > 0 && selectedMessages.every((m) => m.senderId === user?.uid);

  const copySelected = async () => {
    const text = selectedMessages.map((m) => m.text || m.caption || '').filter(Boolean).join('\n');
    if (!text) { showToast('Nothing to copy', 'error'); return; }
    try { await navigator.clipboard.writeText(text); showToast('Copied'); } catch (_) { showToast('Could not copy', 'error'); }
    exitSelectMode();
  };

  /* ---------------- long-press menu ---------------- */
  const getAppliedStyle = (msg, isOwn) => {
    const senderIsPlus = msg.senderIsPlus || (isOwn && isEchoPlus);
    return isOwn ? myChatStyle || '' : senderIsPlus ? msg.senderChatStyle || '' : '';
  };

  const openMenu = (msg, rect) => {
    if (selectMode) return;
    if (msg.isUploading || msg.pending) return;
    hapticLight();
    setMenu({ msg, rect, isOwn: String(msg.senderId || '') === String(user?.uid || '') });
  };

  const buildMenuItems = (msg, isOwn) => {
    if (msg.uploadFailed) {
      return [
        { key: 'retry', label: 'Retry upload', icon: 'fa-redo', onPress: () => retryMedia(msg) },
        { key: 'discard', label: 'Discard', icon: 'fa-trash', danger: true, onPress: () => removeLocal(msg.id) },
      ];
    }
    const items = [{ key: 'reply', label: 'Reply', icon: 'fa-reply', onPress: () => handleReply(msg) }];
    if (msg.text || msg.caption || msg.mediaUrl) items.push({ key: 'copy', label: 'Copy', icon: 'fa-copy', onPress: () => handleCopy(msg) });
    items.push({
      key: 'pin',
      label: pinnedMessageId === msg.id ? 'Unpin' : 'Pin',
      icon: 'fa-thumbtack',
      onPress: () => handlePinMessage(msg),
    });
    items.push({ key: 'save', label: 'Save', icon: 'fa-bookmark', onPress: () => saveMessageToArchive(msg) });
    if (isOwn && !(msg.type === 'media' && msg.mediaType === 'audio')) {
      items.push({ key: 'edit', label: 'Edit', icon: 'fa-pen', onPress: () => handleEditMessage(msg) });
    }
    items.push({ key: 'select', label: 'Select', icon: 'fa-check-circle', onPress: () => enterSelectMode(msg) });
    if (isOwn) items.push({ key: 'delete', label: 'Delete', icon: 'fa-trash', danger: true, onPress: () => confirmDelete([msg]) });
    return items;
  };

  /* ---------------- wallpaper / mute / block ---------------- */
  const handleWallpaperSelect = async (id) => {
    setWallpaperId(id);
    if (!chatKey) return;
    try { await update(ref(db, `chats/${chatKey}`), { wallpaper: id }); } catch (_) { /* ignore */ }
  };

  const handleCustomWallpaperSelect = async (url) => {
    setCustomWallpaper(url);
    setWallpaperId('__custom__');
    if (!chatKey) return;
    try { await update(ref(db, `chats/${chatKey}`), { wallpaper: '__custom__', customWallpaper: url }); } catch (_) { /* ignore */ }
  };

  const handleToggleMute = async () => {
    if (!user?.uid || !userId || !isGroupChat) return;
    hapticLight();
    const next = !isMuted;
    try {
      await update(ref(db, `userChats/${user.uid}/${userId}`), { muted: next });
      setIsMuted(next);
      showToast(next ? 'Group muted' : 'Group unmuted');
    } catch (_) {
      showToast('Could not update', 'error');
    }
  };

  const handleUnblock = async () => {
    try {
      await unblockUser(user.uid, userId);
      setBlockedByMe(false);
      showToast('User unblocked');
    } catch (_) {
      showToast('Could not unblock', 'error');
    }
  };

  /* ---------------- derived UI values ---------------- */
  const displayName = isGroupChat
    ? groupData?.name || 'Group'
    : sanitizeName(location.state?.userName || partnerProfile?.name, userId);

  const wallpaperStyle = useMemo(() => {
    const fallback = { background: 'transparent' };
    if (wallpaperId === '__custom__' && customWallpaper) {
      return { backgroundImage: `url(${customWallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    }
    if (!wallpaperId || wallpaperId === 'default') return fallback;
    let wp = null;
    try { wp = getWallpaperById(wallpaperId); } catch (_) { wp = null; }
    if (!wp) return fallback;
    if (typeof wp === 'string') return { background: wp };
    if (wp.style && typeof wp.style === 'object') return wp.style;
    const bg = wp.css || wp.background || wp.value || wp.gradient;
    if (bg) return { background: bg };
    const img = wp.url || wp.image;
    if (img) return { backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    return fallback;
  }, [wallpaperId, customWallpaper]);

  const pinnedMessage = useMemo(
    () => (pinnedMessageId ? displayMessages.find((m) => m.id === pinnedMessageId) : null),
    [pinnedMessageId, displayMessages]
  );

  const hasText = !!newMessage.trim();

  /* ---------------- rendering ---------------- */
  const renderNoteQuote = (note) => (
    <div className="cv-note-quote">
      <div className="cv-note-quote-name">{note.authorName || 'Note'} · Note</div>
      <div className="cv-note-quote-text">{note.text || (note.song ? '🎵 Song' : '')}</div>
    </div>
  );

  const renderReactions = (msg, isOwn) => {
    if (!msg.reactions) return null;
    const groups = {};
    Object.entries(msg.reactions).forEach(([uid, emoji]) => {
      if (!groups[emoji]) groups[emoji] = [];
      groups[emoji].push(uid);
    });
    return (
      <div className={`cv-reactions ${isOwn ? 'own' : 'partner'}`}>
        {Object.entries(groups).map(([emojiKey, uids]) => (
          <button
            type="button"
            key={emojiKey}
            className={`cv-reaction${uids.includes(user?.uid) ? ' mine' : ''}`}
            onClick={() => handleReactionSelect(emojiKey, msg)}
          >
            <span>{REACTION_LABELS[emojiKey] || emojiKey}</span>
            {uids.length > 1 && <span className="cv-reaction-count">{uids.length > 99 ? '99+' : uids.length}</span>}
          </button>
        ))}
      </div>
    );
  };

  const renderBubbleBody = (msg) => {
    const quote = msg.replyTo && (
      <div className="cv-reply-hit" onClick={(e) => { e.stopPropagation(); scrollToMessage(msg.replyTo.messageId); }}>
        <RepliedMessage replyTo={msg.replyTo} />
      </div>
    );
    if (msg.type === 'media') {
      const openMedia = () => {
        if (selectMode || msg.isUploading || msg.uploadFailed) return;
        if (msg.mediaType === 'video') setVideoPreview({ src: msg.mediaUrl });
        else setMediaPreview({ src: msg.mediaUrl, type: 'image' });
      };
      return (
        <>
          {quote}
          {msg.replyToNote && renderNoteQuote(msg.replyToNote)}
          {msg.mediaType === 'audio' ? (
            <AudioPlayer src={msg.mediaUrl} />
          ) : (
            <div className="chat-media-wrapper" onClick={openMedia}>
              <ChatMediaMessage message={msg} isUploading={msg.isUploading} uploadProgress={msg.uploadProgress} />
            </div>
          )}
          {msg.uploadFailed && (
            <button type="button" className="cv-retry" onClick={() => retryMedia(msg)}>
              <i className="fas fa-redo" /> Upload failed · Tap to retry
            </button>
          )}
          {msg.caption && (
            <div className="message-text">{linkify(msg.caption)}{msg.isEdited && <span className="message-edited-badge">edited</span>}</div>
          )}
        </>
      );
    }
    return (
      <>
        {quote}
        {msg.replyToNote && renderNoteQuote(msg.replyToNote)}
        <div className={`message-text${isEmojiOnly(msg.text) ? ' cv-emoji-only' : ''}`}>
          {linkify(msg.text)}
          {msg.isEdited && <span className="message-edited-badge">edited</span>}
        </div>
      </>
    );
  };

  const renderCloneBubble = (msg, isOwn) => {
    let body;
    if (msg.type === 'media') {
      let media;
      if (msg.mediaType === 'audio') media = <div className="cv-clone-audio"><i className="fas fa-microphone" /> Voice note</div>;
      else if (msg.mediaType === 'video') media = <video className="cv-clone-media" src={msg.mediaUrl} muted playsInline preload="metadata" />;
      else media = <img className="cv-clone-media" src={msg.mediaUrl} alt="" />;
      body = (
        <>
          {media}
          {msg.caption && <div className="message-text">{linkify(msg.caption)}</div>}
        </>
      );
    } else {
      body = <div className={`message-text${isEmojiOnly(msg.text) ? ' cv-emoji-only' : ''}`}>{linkify(msg.text)}</div>;
    }
    return (
      <div className={`message-bubble ${isOwn ? 'own' : 'partner'} ${getAppliedStyle(msg, isOwn)}`}>
        {body}
        <div className="message-meta-time">{formatMsgClock(msg)}</div>
      </div>
    );
  };

  const renderMessage = (entry) => {
    const { msg, groupTop, groupBottom, isSystem } = entry;
    if (isSystem) {
      return <div key={msg.id} className="message-bubble system">{msg.text}</div>;
    }
    const isOwn = String(msg.senderId || '') === String(user?.uid || '');
    const isPinned = pinnedMessageId === msg.id;
    const showSenderName = isGroupChat && !isOwn && groupTop;
    const appliedStyle = getAppliedStyle(msg, isOwn);
    const rowClass = [
      'message-row',
      isOwn ? 'own' : 'partner',
      groupTop ? 'group-top' : 'group-mid',
      groupBottom ? 'group-bottom' : 'group-mid',
      selectMode ? 'select-mode' : '',
      selectedIds.has(msg.id) ? 'selected' : '',
      menu?.msg?.id === msg.id ? 'cv-source-hidden' : '',
    ].filter(Boolean).join(' ');

    return (
      <Fragment key={msg.id}>
        {entry.showDateSeparator && (
          <div className="chat-date-separator"><span>{entry.dateLabel}</span></div>
        )}
        <MessageRow
          msg={msg}
          isOwn={isOwn}
          rowClass={rowClass}
          selectMode={selectMode}
          selected={selectedIds.has(msg.id)}
          canReply={!msg._local && !msg.isUploading && !blockedByMe}
          onLongPress={openMenu}
          onReply={handleReply}
          onDoubleTap={handleDoubleTap}
          onToggleSelect={toggleSelect}
          registerRef={registerRef}
        >
          {showSenderName && (
            <div className="group-sender-name" style={{ color: senderColor(msg.senderId) }}>{msg.senderName || 'Member'}</div>
          )}
          <div
            className={[
              'message-bubble', isOwn ? 'own' : 'partner', appliedStyle,
              isPinned ? 'pinned' : '',
              msg.pending ? 'pending' : '',
              highlightId === msg.id ? 'highlight-flash' : '',
            ].filter(Boolean).join(' ')}
          >
            {isPinned && <span className="message-pin-badge"><i className="fas fa-thumbtack" style={{ fontSize: 9 }} /></span>}
            {renderBubbleBody(msg)}
            <div className="message-meta-time">
              {formatMsgClock(msg)} <MessageReceipt msg={msg} isMe={isOwn} group={isGroupChat} />
            </div>
                    </div>
          {renderReactions(msg, isOwn)}
        </MessageRow>
      </Fragment>
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && enterToSend && !e.nativeEvent?.isComposing) {
      e.preventDefault();
      handleSendText(e);
    }
  };

  return (
    <>
      <SEO title={`Chat with ${displayName}`} description={`Chat with ${displayName} on ECHO.`} />
      <div className="chat-view" style={{ '--cv-msg-font': FONT_SIZE_MAP[fontSize] || FONT_SIZE_MAP.md }}>
        {selectMode && (
          <div className="select-top-bar">
            <button type="button" className="select-top-btn" onClick={exitSelectMode}>Cancel</button>
            <div className="select-top-title">{selectedIds.size ? `${selectedIds.size} selected` : 'Select messages'}</div>
          </div>
        )}

        <VideoAudioProvider>
          <div
            className="messages-container"
            ref={messagesContainerRef}
            onScroll={handleScroll}
            style={wallpaperStyle}
          >
            {pinnedMessage && !selectMode && (
              <div className="pinned-banner" onClick={() => scrollToMessage(pinnedMessage.id)}>
                <span className="pinned-banner-icon"><i className="fas fa-thumbtack" /></span>
                <div className="pinned-banner-body">
                  <span className="pinned-banner-label">Pinned message</span>
                  <span className="pinned-banner-text">
                    {pinnedMessage.text || pinnedMessage.caption || (pinnedMessage.mediaType === 'audio' ? '🎤 Voice note' : pinnedMessage.mediaType === 'video' ? '🎬 Video' : '📷 Image')}
                  </span>
                </div>
                <button
                  type="button"
                  className="pinned-banner-close"
                  onClick={(e) => { e.stopPropagation(); handlePinMessage(pinnedMessage); }}
                  aria-label="Unpin"
                >
                  <i className="fas fa-times" />
                </button>
              </div>
            )}

            {loadingMessages && displayMessages.length === 0 ? (
              <div className="chat-skeleton-list"><SkeletonMessage /><SkeletonMessage /><SkeletonMessage /></div>
            ) : displayMessages.length === 0 ? (
              <div className="empty-chat-state">
                <i className="fas fa-paper-plane empty-icon" />
                <p>No messages yet. Say hello!</p>
              </div>
            ) : (
              entries.map(renderMessage)
            )}

            {partnerIsTyping && !isGroupChat && (
              <div className="message-row partner group-top">
                <div className="message-stack partner">
                  <div className="message-bubble partner">
                    <div className="typing-indicator"><span /><span /><span /></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </VideoAudioProvider>

        {!isNearBottom && (
          <button type="button" className="chat-scroll-fab" onClick={() => scrollToBottom(true)} aria-label="Scroll to latest">
            <i className="fas fa-chevron-down" />
            {unreadWhileScrolled > 0 && <span>{unreadWhileScrolled > 99 ? '99+' : unreadWhileScrolled} new</span>}
          </button>
        )}

        {showEmojiPicker && (
          <ChatEmojiPicker
            onClose={() => setShowEmojiPicker(false)}
            onSelect={(emoji) => setNewMessage((prev) => prev + emoji)}
            excludeRefs={[inputContainerRef]}
          />
        )}

        {selectMode ? (
          <div className="select-bottom-bar">
            <button type="button" className="select-action" onClick={copySelected} disabled={!selectedMessages.length}>
              <i className="fas fa-copy" style={{ fontSize: 18 }} /><span>Copy</span>
            </button>
            <button
              type="button"
              className="select-action danger"
              onClick={() => confirmDelete(selectedMessages)}
              disabled={!canDeleteSelected}
            >
              <i className="fas fa-trash" style={{ fontSize: 18 }} /><span>Delete</span>
            </button>
          </div>
        ) : blockedByMe && !isGroupChat ? (
          <div className="blocked-composer-bar">
            <span>You blocked this user.</span>
            <button type="button" className="blocked-composer-unblock" onClick={handleUnblock}>Unblock</button>
          </div>
        ) : (
          <form className="chat-input-container" onSubmit={handleSendText} ref={inputContainerRef}>
            {replyTo && <ReplyPreview replyTo={replyTo} onCancel={() => setReplyTo(null)} />}
            {replyToNote && (
              <div className="cv-note-reply-bar">
                <div className="cv-note-reply-text">
                  <strong>Replying to {replyToNote.authorName}’s note</strong>
                  <span>{replyToNote.text || (replyToNote.song ? '🎵 Song' : '')}</span>
                </div>
                <button type="button" className="chat-more-btn" onClick={() => setReplyToNote(null)} aria-label="Cancel reply">
                  <i className="fas fa-times" />
                </button>
              </div>
            )}
            <div className="chat-input-row">
              <div className="chat-more-wrapper" ref={moreOptionsRef}>
                <button type="button" className="chat-more-btn" onClick={() => setShowMoreOptions((v) => !v)} aria-label="More">
                  <i className="fas fa-ellipsis-h" />
                </button>
                {showMoreOptions && (
                  <div className="chat-more-options-popup">
                    <button type="button" className="chat-more-option" onClick={() => { setShowMoreOptions(false); fileInputRef.current?.click(); }}>
                      <i className="fas fa-paperclip" /><span>Photo or video</span>
                    </button>
                    <button type="button" className="chat-more-option" onClick={() => { setShowMoreOptions(false); setShowWallpaperPicker(true); }}>
                      <i className="fas fa-image" /><span>Wallpaper</span>
                    </button>
                    <button type="button" className="chat-more-option" onClick={() => { setShowMoreOptions(false); enterSelectMode(null); }}>
                      <i className="fas fa-check-circle" /><span>Select messages</span>
                    </button>
                    {isGroupChat && (
                      <button type="button" className="chat-more-option" onClick={() => { setShowMoreOptions(false); handleToggleMute(); }}>
                        <i className={`fas ${isMuted ? 'fa-bell' : 'fa-bell-slash'}`} /><span>{isMuted ? 'Unmute' : 'Mute'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
              <input type="file" ref={fileInputRef} accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFileSelect} />

              <button type="button" className="chat-emoji-btn" onClick={() => setShowEmojiPicker((v) => !v)} aria-label="Emoji">
                <i className="fas fa-smile" />
              </button>

              <div className="chat-input-wrapper">
                <textarea
                  ref={inputRef}
                  className="chat-input"
                  placeholder={`Message ${displayName}...`}
                  value={newMessage}
                  onChange={(e) => { setNewMessage(e.target.value); if (e.target.value) handleTyping(); }}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
              </div>

              {hasText ? (
                <button ref={sendButtonRef} type="submit" className="chat-send-btn cv-swap-in" aria-label="Send">
                  <i className="fas fa-paper-plane" />
                </button>
              ) : (
                <button type="button" className="chat-voice-btn cv-swap-in" onClick={() => setShowVoiceRecorder(true)} aria-label="Record voice note">
                  <i className="fas fa-microphone" />
                </button>
              )}
            </div>
          </form>
        )}

        {menu && (
          <MessageMenu
            menu={menu}
            items={buildMenuItems(menu.msg, menu.isOwn)}
            myReaction={menu.msg.reactions?.[user?.uid]}
            onReact={(key) => handleReactionSelect(key, menu.msg)}
            onClose={() => setMenu(null)}
          >
            {renderCloneBubble(menu.msg, menu.isOwn)}
          </MessageMenu>
        )}

        {selectedFile && previewUrl && createPortal(
          <div className="media-preview-overlay">
            <div className="media-preview-content">
              <button type="button" className="media-preview-close" onClick={cancelFileSelection} aria-label="Cancel">
                <i className="fas fa-times" />
              </button>
              <div className="media-preview-media">
                {selectedFile.type.startsWith('video/')
                  ? <video className="media-preview-video" src={previewUrl} controls playsInline />
                  : <img className="media-preview-image" src={previewUrl} alt="" />}
              </div>
              <div className="media-preview-caption-row">
                <textarea
                  className="media-preview-caption"
                  placeholder="Add a caption…"
                  rows={1}
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendSelectedFile(); } }}
                />
              </div>
              <button type="button" className="media-preview-send" onClick={sendSelectedFile}>Send</button>
            </div>
          </div>,
          document.body
        )}

        {showVoiceRecorder && <VoiceRecorder onSend={handleVoiceSend} onCancel={() => setShowVoiceRecorder(false)} />}

        <EditMessageModal
          isOpen={!!editingMessage}
          onClose={() => setEditingMessage(null)}
          messageText={editingMessage?.text || ''}
          onSave={saveEditedMessage}
        />
        <EditMediaCaptionModal
          isOpen={!!editingMediaMessage}
          onClose={() => setEditingMediaMessage(null)}
          caption={editingMediaMessage?.caption || ''}
          messageText={editingMediaMessage?.caption || ''}
          onSave={saveEditedCaption}
        />

        {showWallpaperPicker && (
          <WallpaperPicker
            isOpen={showWallpaperPicker}
            onClose={() => setShowWallpaperPicker(false)}
            currentWallpaper={wallpaperId}
            selectedId={wallpaperId}
            customWallpaper={customWallpaper}
            onSelect={handleWallpaperSelect}
            onCustomSelect={handleCustomWallpaperSelect}
          />
        )}

        {mediaPreview && <MediaPreview src={mediaPreview.src} type={mediaPreview.type} alt="" onClose={() => setMediaPreview(null)} />}
        {videoPreview && <CustomVideoPlayer src={videoPreview.src} onClose={() => setVideoPreview(null)} />}
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
          message="The file exceeds the 20 MB limit."
          type="error"
        />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </>
  );
};

export default ChatView;
