// src/components/pages/Chat/ChatView.js
import React, { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ref, onValue, push, set, update, get, remove } from 'firebase/database';
import { useAuth } from '../../../hooks/useAuth';
import { sortMessages as sortMessagesByTime } from '../../../utils/sortMessages';
import { useProfile } from '../../../contexts/ProfileContext';
import { db } from '../../../services/firebase';
import { VideoAudioProvider } from '../../../contexts/VideoAudioContext';
import SEO from '../../common/SEO';
import ChatMediaMessage from './ChatMediaMessage';
import { saveToEchoArchive } from '../../../services/echoArchive';
import { isTideExpired } from '../../../utils/echoTides';
import ReplyPreview from './ReplyPreview';
import RepliedMessage from './RepliedMessage';
import EditMessageModal from './EditMessageModal';
import EditMediaCaptionModal from './EditMediaCaptionModal';
import PremiumEmojiPicker from './PremiumEmojiPicker';
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
import { REACTION_EMOJIS } from './ReactionEmoji';
import { useUserSettings } from '../../../hooks/useUserSettings';
import { isBlocked as checkIsBlocked, unblockUser } from '../../../services/blockService';
import { hapticSend, hapticLight } from '../../../utils/haptics';
import { isGroupChatId, chatIdToGroupId } from '../../../utils/groupId';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import Avatar from '../../common/Avatar';
import Lottie from 'lottie-react';
import catJson from '../../../assets/premium-emoji/cat.json';
import { PREMIUM_STICKERS, renderPremiumSticker, isPremiumSticker } from './PremiumStickers';
import PlusCheckout from '../../common/PlusCheckout';
import './ChatView.css';
import './ChatViewLiquid.css';

// 🔥 1. PUSH NOTIFICATION HELPER FUNCTION
const ONESIGNAL_REST_API_KEY = "os_v2_app_owfyx4wh4rbdbiexo4pa23thf5jvk32mkfuugw4gd5azq6av2qf45zlvika6cwh5nr7bdjpxcebiwn7xvjscsoi7n2izk4jjc2x7mni"; 
const ONESIGNAL_APP_ID = "758b8bf2-c7e4-4230-a097-771e0d6e672f";

const sendPushNotification = async (targetUserId, senderName, messageText, senderPhoto) => {
  if (!targetUserId) return;
  const body = {
    app_id: ONESIGNAL_APP_ID,
    include_aliases: { external_id: [targetUserId] },
    target_channel: "push",
    headings: { en: senderName || "New Message" },
    contents: { en: messageText || "You received a new message" },
    chrome_web_icon: senderPhoto || "https://echoty.xyz/logo.png",
    url: `https://echoty.xyz/chat/${targetUserId}`
  };
  try {
    await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error("Failed to send push:", err);
  }
};
// 🔥 END HELPER FUNCTION

const CLOUDINARY_CLOUD_NAME = 'rjlscgan';
const CLOUDINARY_UPLOAD_PRESET = 'echo_uploads';
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const GROUP_WINDOW_MS = 2 * 60 * 1000;
const FONT_SIZE_MAP = { sm: '13px', md: '15px', lg: '17px' };
const LONG_PRESS_MS = 380;
const SWIPE_THRESHOLD = 56;
const SWIPE_MAX = 84;
const MENU_W = 236;

const RANDOM_SVGS = [
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/></svg>,
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>,
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
];

const getRandomSvg = (uid) => {
  if (!uid) return RANDOM_SVGS[0];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  return RANDOM_SVGS[Math.abs(hash) % RANDOM_SVGS.length];
};

const RandomAvatar = ({ uid, size = 40 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', padding: size * 0.2, flexShrink: 0,
    boxShadow: '0 4px 12px rgba(108,60,225,0.3)'
  }}>
    {React.cloneElement(getRandomSvg(uid), { style: { width: '100%', height: '100%' } })}
  </div>
);

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
  try { return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  catch { return ''; }
};

const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); };

const formatDayLabel = (ts) => {
  const today = startOfDay(Date.now());
  const yesterday = today - 86400000;
  const day = startOfDay(ts);
  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';
  const d = new Date(ts);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { month: 'long', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
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
  if (Array.isArray(obj)) return obj.map(clean).filter(v => v !== undefined);
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
  const n = Array.from(t.replace(/\s/g, '')).filter(ch => /\p{Extended_Pictographic}/u.test(ch)).length;
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
          <a href={cleanUrl} target="_blank" rel="noopener noreferrer" className="cv-link" onClick={e => e.stopPropagation()}>{cleanUrl}</a>
          {tail}
        </Fragment>
      );
    }
    if (/^@[A-Za-z0-9_.]+$/.test(p)) return <span key={i} className="mention">{p}</span>;
    return <Fragment key={i}>{p}</Fragment>;
  });
};

const isMessageExpired = (m) => {
  if (m.expiresAt && Date.now() > m.expiresAt) return true;
  const hasTideExpiry = m.tideExpiresAt != null || m.expireAt != null;
  if (!hasTideExpiry) return false;
  try { return !!isTideExpired(m); } catch { return false; }
};

const useVisualViewport = () => {
  useEffect(() => {
    const root = document.documentElement;
    const isTouch = window.matchMedia?.('(hover: none)').matches || window.matchMedia?.('(pointer: coarse)').matches;
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

  if (msg.pending || msg.isUploading) {
    return (
      <span className="message-receipt pending" title="Sending...">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </span>
    );
  }

  if (msg.uploadFailed) {
    return (
      <span className="message-receipt failed" title="Failed to send">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </span>
    );
  }

  if (group) {
    return (
      <span className="message-receipt sent" title="Sent">
        <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    );
  }

  const read = !!msg.readAt || msg.isRead === true;
  const delivered = !!msg.deliveredAt || msg.received === true;

  if (read) {
    return (
      <span className="message-receipt read" title="Read">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 6 7 17 2 12" />
          <polyline points="22 6 11 17" />
        </svg>
      </span>
    );
  }

  if (delivered) {
    return (
      <span className="message-receipt delivered" title="Delivered">
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 6 7 17 2 12" />
          <polyline points="22 6 11 17" />
        </svg>
      </span>
    );
  }

  return (
    <span className="message-receipt sent" title="Sent">
      <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
};

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
    swipeActive: false,
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
      st.style.transition = animate ? 'transform .3s cubic-bezier(.2,.9,.3,1.2)' : 'none';
      st.style.transform = '';
    }
    const ic = iconRef.current;
    if (ic) {
      ic.style.transition = animate ? 'opacity .2s, transform .25s' : 'none';
      ic.style.opacity = '0';
      ic.style.transform = 'translateY(-50%) scale(.4)';
      ic.classList.remove('armed');
    }
    g.current.swipeActive = false;
  };

  const fireLong = () => {
    const s = g.current;
    if (s.longFired) return;
    s.longFired = true;
    s.mode = 'long';
    clearTimers();
    hapticLight();
    const bubble = rowRef.current?.querySelector('.message-bubble');
    const rect = (bubble || rowRef.current)?.getBoundingClientRect();
    if (rect) onLongPress(msg, rect);
  };

  const swipeStart = (clientX, clientY, target) => {
    const s = g.current;
    s.x = clientX; s.y = clientY;
    s.mode = null; s.longFired = false; s.passed = false; s.swipeActive = false;
    s.noSwipe = !!target.closest?.('input, [role="slider"], a, button, .chat-media-wrapper, .cv-reply-hit, audio');
    clearTimers();
    if (selectMode) return;
    s.pressTimer = setTimeout(() => rowRef.current?.classList.add('pressed'), 110);
    s.timer = setTimeout(() => fireLong(), LONG_PRESS_MS);
  };

  const swipeMove = (clientX, clientY) => {
    const s = g.current;
    if (s.mode === 'long' || s.longFired) return;
    const dx = clientX - s.x;
    const dy = clientY - s.y;

    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      if (s.timer) { clearTimeout(s.timer); s.timer = null; }
    }

    if (s.mode === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      clearTimers();
      
      const isHorizontalSwipe =
        canReply &&
        !selectMode &&
        !s.noSwipe &&
        dx < 0 &&
        Math.abs(dx) > Math.abs(dy) * 1.2;

      if (isHorizontalSwipe) {
        s.mode = 'swipe';
        s.swipeActive = true;
        if (stackRef.current) stackRef.current.style.transition = 'none';
      } else {
        s.mode = 'scroll';
        return;
      }
    }

    if (s.mode !== 'swipe') return;

    const raw = Math.max(0, -dx);
    const eased = raw <= SWIPE_THRESHOLD
      ? raw
      : Math.min(SWIPE_MAX, SWIPE_THRESHOLD + (raw - SWIPE_THRESHOLD) * 0.3);

    if (stackRef.current) {
      stackRef.current.style.transform = `translate3d(${-eased}px,0,0)`;
    }
    const p = Math.min(1, raw / SWIPE_THRESHOLD);
    const ic = iconRef.current;
    if (ic) {
      ic.style.transition = 'none';
      ic.style.opacity = String(p);
      ic.style.transform = `translateY(-50%) scale(${0.5 + 0.5 * p})`;
    }
    const armed = raw >= SWIPE_THRESHOLD;
    if (armed !== s.passed) {
      s.passed = armed;
      iconRef.current?.classList.toggle('armed', armed);
      if (armed) hapticLight();
    }
  };

  const swipeEnd = (cancelled) => {
    const s = g.current;
    clearTimers();
    if (s.longFired) { resetSwipe(false); return; }
    if (s.mode === 'swipe') {
      const doReply = s.passed && !cancelled;
      resetSwipe(true);
      s.mode = null;
      if (doReply) onReply(msg);
      return;
    }
    if (s.mode === null && !cancelled && !s.longFired) {
      if (selectMode) { onToggleSelect(msg); return; }
      const now = Date.now();
      if (now - s.lastTap < 300) { s.lastTap = 0; onDoubleTap(msg); }
      else { s.lastTap = now; }
    }
    s.mode = null;
  };

  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    swipeStart(t.clientX, t.clientY, e.target);
  };

  const onTouchMove = (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    swipeMove(t.clientX, t.clientY);
    if (g.current.mode === 'swipe' && e.cancelable) {
      e.preventDefault();
    }
  };

  const onTouchEnd = (e) => {
    if (g.current.swipeActive) {
      swipeEnd(false);
      return;
    }
    if (e.target.closest?.('a, button, .chat-media-wrapper, .cv-reply-hit, audio, input, .cv-retry')) {
      swipeEnd(false);
      return;
    }
    swipeEnd(false);
  };

  const onTouchCancel = () => {
    swipeEnd(true);
  };

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    swipeStart(e.clientX, e.clientY, e.target);
  };
  const onMouseMove = (e) => {
    if (!g.current.id && g.current.mode === null && g.current.x === 0 && g.current.y === 0) return;
    swipeMove(e.clientX, e.clientY);
  };
  const onMouseUp = () => {
    if (g.current.mode === null && g.current.x === 0) return;
    swipeEnd(false);
  };

  const onContextMenu = (e) => {
    e.preventDefault();
    if (selectMode) return;
    if (!g.current.longFired) fireLong();
  };

  return (
    <div
      ref={(el) => { rowRef.current = el; registerRef?.(msg.id, el); }}
      className={rowClass}
      data-msg-id={msg.id}
      style={{ touchAction: 'pan-y' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onContextMenu={onContextMenu}
    >
      {selectMode && <span className={`select-checkbox ${selected ? 'checked' : ''}`}><i className="fas fa-check" /></span>}
      <div className="cv-swipe-reply" ref={iconRef} aria-hidden="true"><i className="fas fa-reply" /></div>
      <div className={`message-stack ${isOwn ? 'own' : 'partner'}`} ref={stackRef}>{children}</div>
    </div>
  );
};

const computeMenuLayout = (rect, itemCount, isOwn, reactionCount) => {
  const vh = window.innerHeight; const vw = window.innerWidth;
  const REACT_H = 56; const ITEM_H = 46; const GAP = 10; const TOP = 70; const BOTTOM = 26; const EDGE = 12;
  const menuH = itemCount * ITEM_H + 12;
  const reactW = Math.min(vw - EDGE * 2, reactionCount * 46 + 20 + 40);
  let bubbleH = Math.min(rect.height, vh * 0.36);
  const avail = vh - TOP - BOTTOM - REACT_H - menuH - GAP * 2;
  if (bubbleH > avail) bubbleH = Math.max(48, avail);
  const minTop = TOP + REACT_H + GAP;
  const maxTop = vh - BOTTOM - menuH - GAP - bubbleH;
  const bubbleTop = Math.max(minTop, Math.min(rect.top, maxTop));
  const clampX = (x, w) => Math.max(EDGE, Math.min(x, vw - w - EDGE));
  return {
    bubbleH, bubbleTop, reactW,
    reactTop: bubbleTop - REACT_H - GAP,
    reactLeft: clampX(isOwn ? rect.right - reactW : rect.left, reactW),
    menuTop: bubbleTop + Math.min(rect.height, bubbleH) + GAP,
    menuLeft: clampX(isOwn ? rect.right - MENU_W : rect.left, MENU_W),
  };
};

const MessageMenu = ({ menu, items, myReaction, onReact, onClose, children }) => {
  const [closing, setClosing] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const closingRef = useRef(false);

  const close = useCallback((after) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(() => { onClose(); if (typeof after === 'function') after(); }, 180);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const onResize = () => close();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); };
  }, [close]);

  const L = useMemo(() => computeMenuLayout(menu.rect, items.length, menu.isOwn, REACTION_EMOJIS.length), [menu, items.length]);

  return createPortal(
    <div className={`cv-menu-root${closing ? ' closing' : ''}`} onClick={() => close()} onContextMenu={(e) => { e.preventDefault(); close(); }}>
      <div className="cv-menu-backdrop" />
      <div className="cv-menu-reactions cv-glass" style={{ top: L.reactTop, left: L.reactLeft, width: L.reactW, transformOrigin: `${menu.isOwn ? 'right' : 'left'} bottom`, overflowX: 'auto', overflowY: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        {!showPremium && REACTION_EMOJIS.map(({ key, Component }, i) => (
          <button type="button" key={key} className={`echo-reaction-emoji cv-react-btn${myReaction === key ? ' active' : ''}`} style={{ '--i': i }} onClick={() => close(() => onReact(key))}>
            <Component />
          </button>
        ))}
        {showPremium && PREMIUM_STICKERS.map(({ key, animation }, i) => (
          <button type="button" key={key} className={`echo-reaction-emoji cv-react-btn${myReaction === key ? ' active' : ''}`} style={{ '--i': i }} onClick={() => close(() => onReact(key))}>
            <div style={{ width: 48, height: 48 }}><Lottie animationData={animation} loop={true} /></div>
          </button>
        ))}
        <button type="button" className="echo-reaction-emoji cv-react-btn cv-premium-toggle" style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', marginLeft: '4px', paddingLeft: '8px', position: 'relative' }} onClick={() => setShowPremium(v => !v)}>
          {!showPremium && <div className="floating-echo-plus-text">ECHO Plus</div>}
          <div style={{ width: 24, height: 24, color: '#FFD700' }}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>
          </div>
        </button>
      </div>
      <div className="cv-menu-lift" style={{ top: L.bubbleTop, left: menu.rect.left, width: menu.rect.width, maxHeight: L.bubbleH, '--dy': `${menu.rect.top - L.bubbleTop}px` }}>
        {children}
      </div>
      <div className="cv-menu-list cv-glass" style={{ top: L.menuTop, left: L.menuLeft, width: MENU_W, transformOrigin: `${menu.isOwn ? 'right' : 'left'} top` }} onClick={(e) => e.stopPropagation()}>
        {items.map(it => (
          <button type="button" key={it.key} className={`cv-menu-item${it.danger ? ' danger' : ''}`} onClick={() => close(it.onPress)}>
            <span>{it.label}</span>
            <i className={`fas ${it.icon}`} />
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
};

const ChatView = () => {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { getProfile, fetchProfile } = useProfile();
  const { isPlus: isEchoPlus } = useSubscription();

  useVisualViewport();
  const { settings: userSettings } = useUserSettings(user?.uid);

  const enterToSend = userSettings?.chats?.enterToSend !== false;
  const showTyping = userSettings?.chats?.showTyping !== false;
  const sendReadReceipts = userSettings?.chats?.sendReadReceipts !== false;
  const fontSize = userSettings?.chats?.fontSize || 'md';
  const isGroupChat = isGroupChatId(userId);
  const groupIdFromChat = isGroupChat ? chatIdToGroupId(userId) : null;

  const chatKey = useMemo(() => { if (!user?.uid || !userId) return null; return isGroupChat ? userId : [user.uid, userId].sort().join('_'); }, [user?.uid, userId, isGroupChat]);
  const msgRoot = useMemo(() => { if (!chatKey) return null; return isGroupChat ? `groups/${groupIdFromChat}/messages` : `chats/${chatKey}/messages`; }, [chatKey, isGroupChat, groupIdFromChat]);

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
  const [showPlusCheckout, setShowPlusCheckout] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [ghostMode, setGhostMode] = useState(null);
  const [showGhostMenu, setShowGhostMenu] = useState(false);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', confirmText: 'Confirm', cancelText: 'Cancel', onConfirm: null });

  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const inputContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const sendButtonRef = useRef(null);
  const messageRefs = useRef({});
  const seenIdsRef = useRef(new Set());
  const isNearBottomRef = useRef(true);
  const initialScrollRef = useRef(false);
  const prevLastTimeRef = useRef(0);
  const typingTimeoutRef = useRef(null);
  const toastTimerRef = useRef(null);
  const lastMarkKeyRef = useRef(null);

  const sendingRef = useRef(false);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));
  const openConfirmModal = (config) => setConfirmModal({ isOpen: true, cancelText: 'Cancel', ...config });

  const registerRef = useCallback((id, el) => {
    if (el) messageRefs.current[id] = el;
    else delete messageRefs.current[id];
  }, []);

  const upsertLocal = useCallback((m) => {
    setLocalMsgs(prev => {
      const i = prev.findIndex(x => x.id === m.id);
      if (i < 0) return [...prev, m];
      const next = [...prev];
      next[i] = m;
      return next;
    });
  }, []);

  const patchLocal = useCallback((id, patch) => {
    setLocalMsgs(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x));
  }, []);

  const removeLocal = useCallback((id) => {
    setLocalMsgs(prev => {
      const found = prev.find(x => x.id === id);
      if (found?.mediaUrl && String(found.mediaUrl).startsWith('blob:')) {
        try { URL.revokeObjectURL(found.mediaUrl); } catch { }
      }
      return prev.filter(x => x.id !== id);
    });
  }, []);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    PREMIUM_STICKERS.forEach(sticker => { fetch(sticker.animation).catch(() => {}); });
  }, []);

  useEffect(() => {
    document.body.classList.add('echo-hide-bottom-nav');
    document.body.classList.add('hide-global-top-bar');
    return () => {
      document.body.classList.remove('echo-hide-bottom-nav');
      document.body.classList.remove('hide-global-top-bar');
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setLoadingMessages(false), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer.types && (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('application/x-moz-file'))) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) setIsDragging(false);
    };

    const handleDragOver = (e) => { e.preventDefault(); };

    const handleDrop = (e) => {
      e.preventDefault();
      setIsDragging(false);
      dragCounter = 0;

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.size > MAX_FILE_SIZE) {
          showToast('File too large (max 20MB)', 'error');
          return;
        }
        setIsDragging(false);
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setCaptionText('');
        setSelectedFile(file);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [showToast]);

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

  useEffect(() => {
    if (!user?.uid) return;
    get(ref(db, `profiles/${user.uid}`))
      .then((snap) => { if (snap.exists()) setCurrentUserProfile(snap.val()); })
      .catch(console.error);
  }, [user?.uid]);

  useEffect(() => {
    const state = location.state;
    if (!state) return;
    const focusEnd = (text) => {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          try { inputRef.current.setSelectionRange(text.length, text.length); } catch { }
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
      if (typeof state.prefilledNote === 'string' && state.prefilledNote.length > 0) {
        setNewMessage(state.prefilledNote);
        focusEnd(state.prefilledNote);
      }
    } else if (typeof state.prefilledText === 'string' && state.prefilledText.length > 0) {
      setNewMessage(state.prefilledText);
      focusEnd(state.prefilledText);
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  useEffect(() => {
    if (!user?.uid || !userId || isGroupChat) return undefined;
    let mounted = true;
    checkIsBlocked(user.uid, userId)
      .then((v) => { if (mounted) setBlockedByMe(!!v); })
      .catch(() => { });
    return () => { mounted = false; };
  }, [user?.uid, userId, isGroupChat]);

  useEffect(() => {
    if (!user?.uid || !chatKey) return undefined;
    const prefRef = ref(db, `users/${user.uid}/chatPrefs/${chatKey}`);
    const unsub = onValue(prefRef, (snap) => {
      const v = snap.val() || {};
      setIsMuted(!!v.muted);
      if (typeof v.wallpaperId === 'string') setWallpaperId(v.wallpaperId);
      setCustomWallpaper(v.customWallpaper || null);
      setPinnedMessageId(v.pinnedMessageId || null);
      setBookmarkedIds(v.bookmarks || {});
    });
    return () => unsub();
  }, [user?.uid, chatKey]);

  useEffect(() => {
    if (!msgRoot || !user?.uid) return undefined;
    setLoadingMessages(true);
    const msgsRef = ref(db, msgRoot);
    const unsub = onValue(msgsRef, (snap) => {
      const val = snap.val() || {};
      const arr = Object.entries(val).map(([id, m]) => ({ id, ...m })).filter(m => !isMessageExpired(m));
      setMessages(sortMessages(arr));
      setLoadingMessages(false);
    });
    return () => unsub();
  }, [msgRoot, user?.uid]);

  useEffect(() => {
    if (!messages.length) return;
    const t = setInterval(() => {
      setMessages(prev => sortMessages(prev.filter(m => !isMessageExpired(m))));
    }, 30000);
    return () => clearInterval(t);
  }, [messages.length]);

  useEffect(() => {
    if (!user?.uid || !userId || isGroupChat) return undefined;
    const otherTypingRef = ref(db, `typing/${chatKey}/${userId}`);
    const unsub = onValue(otherTypingRef, (snap) => {
      const v = snap.val();
      if (!v) { setPartnerIsTyping(false); return; }
      const ts = typeof v === 'number' ? v : v.ts || 0;
      setPartnerIsTyping(Date.now() - ts < 4000);
    });
    return () => unsub();
  }, [chatKey, userId, user?.uid, isGroupChat]);

  const allMessages = useMemo(() => {
    const serverIds = new Set(messages.map(m => m.id));
    const pending = localMsgs.filter(m => {
      if (serverIds.has(m.id)) return false;
      const dupe = messages.some(
        (srv) =>
          (srv.senderId || srv.uid) === (m.senderId || m.uid) &&
          (srv.text || '') === (m.text || '') &&
          Math.abs(msgTime(srv) - msgTime(m)) < 3000
      );
      return !dupe;
    });
    return sortMessages([...messages, ...pending]);
  }, [messages, localMsgs]);

  useEffect(() => {
    const list = allMessages;
    if (!list.length) return;
    const last = list[list.length - 1];
    const ts = msgTime(last);
    if (ts <= prevLastTimeRef.current) {
      prevLastTimeRef.current = ts;
      return;
    }
    prevLastTimeRef.current = ts;
    if (!seenIdsRef.current.has(last.id)) {
      seenIdsRef.current.add(last.id);
      const isOwn = last.senderId === user?.uid || last.uid === user?.uid;
      if (!isOwn && getSoundEnabled() && !isMuted) {
        try { playSentSound(); } catch { }
      }
      if (!isOwn && !isNearBottomRef.current) {
        setUnreadWhileScrolled(n => n + 1);
      }
    }
  }, [allMessages, user?.uid, isMuted]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    if (!initialScrollRef.current && allMessages.length) {
      initialScrollRef.current = true;
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; setIsNearBottom(true); });
      return;
    }
    if (isNearBottomRef.current) {
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
      setUnreadWhileScrolled(0);
    }
  }, [allMessages.length]);

  const onMessagesScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const near = dist < 120;
    isNearBottomRef.current = near;
    setIsNearBottom(near);
    if (near && unreadWhileScrolled > 0) setUnreadWhileScrolled(0);
  }, [unreadWhileScrolled]);

  const scrollToBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setIsNearBottom(true);
    setUnreadWhileScrolled(0);
  }, []);

  useEffect(() => {
    if (!msgRoot || !user?.uid || !sendReadReceipts) return;

    const unread = messages.filter(m => {
      const sender = m.senderId || m.uid;
      if (sender === user.uid) return false;
      return !(m.readAt || m.isRead === true);
    });

    if (!unread.length) return;

    if (!isGroupChat && userId) {
      const myChatRef = ref(db, `userChats/${user.uid}/${userId}`);
      update(myChatRef, { isRead: true, readAt: Date.now() }).catch(() => {});

      const partnerChatRef = ref(db, `userChats/${userId}/${user.uid}`);
      update(partnerChatRef, { isRead: true, readAt: Date.now() }).catch(() => {});
    }

    const key = `${msgRoot}:${unread.length}:${unread[unread.length - 1].id}`;
    if (lastMarkKeyRef.current === key) return;
    lastMarkKeyRef.current = key;

    const updates = {};
    unread.forEach(m => {
      updates[`${msgRoot}/${m.id}/readAt`] = Date.now();
      updates[`${msgRoot}/${m.id}/isRead`] = true;
    });
    update(ref(db), updates).catch(() => { });
  }, [messages, msgRoot, user?.uid, sendReadReceipts, userId, isGroupChat]);

  const broadcastTyping = useCallback(() => {
    if (!user?.uid || !chatKey || !showTyping) return;
    const typingRef = ref(db, `typing/${chatKey}/${user.uid}`);
    set(typingRef, { ts: Date.now() }).catch(() => { });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => { remove(typingRef).catch(() => { }); }, 3500);
  }, [user?.uid, chatKey, showTyping]);

  useEffect(() => () => { if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); }, []);

  const handleSendText = useCallback(async () => {
    if (sendingRef.current) return;

    const text = newMessage.trim();
    if (!text || !msgRoot || !user?.uid) return;

    sendingRef.current = true;

    const tempId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const expiresAt = ghostMode ? now + ghostMode : null;

    const replySnapshot = replyTo
      ? { id: replyTo.id, text: replyTo.text || '', senderId: replyTo.senderId || replyTo.uid || null, mediaType: replyTo.mediaType || null }
      : replyToNote || null;

    const senderPremiumStyle = userSettings?.chats?.bubbleStyle
      || currentUserProfile?.premiumChatStyle
      || null;

    const localMsg = {
      id: tempId,
      text,
      senderId: user.uid,
      uid: user.uid,
      timestamp: now,
      createdAt: now,
      replyTo: replySnapshot,
      senderPremiumStyle,
      expiresAt,
    };

    upsertLocal(localMsg);
    setNewMessage('');
    setReplyTo(null);
    setReplyToNote(null);
    hapticSend();

    if (sendButtonRef.current) {
      sendButtonRef.current.classList.add('rippling');
      setTimeout(() => sendButtonRef.current?.classList.remove('rippling'), 650);
    }

    try {
      const messagesRef = ref(db, msgRoot);
      const newRef = push(messagesRef);
      const payload = clean({
        text,
        senderId: user.uid,
        uid: user.uid,
        timestamp: now,
        createdAt: now,
        replyTo: replySnapshot,
        senderPremiumStyle,
        expiresAt,
      });
      await set(newRef, payload);

      if (!isGroupChat && userId) {
        const partnerChatRef = ref(db, `userChats/${userId}/${user.uid}`);
        update(partnerChatRef, {
          lastMessage: text,
          lastUpdated: now,
          lastSenderId: user.uid,
          isRead: false,
          readAt: null,
        }).catch(() => {});

        // 🔥 TRIGGER PUSH NOTIFICATION HERE
        const senderName = currentUserProfile?.displayName || currentUserProfile?.name || "New Message";
        const senderPic = currentUserProfile?.photoURL || null;
        sendPushNotification(userId, senderName, text, senderPic);
      }

      removeLocal(tempId);
      if (getSoundEnabled() && !isMuted) { try { playSentSound(); } catch { } }
    } catch (err) {
      console.error('Send failed', err);
      patchLocal(tempId, { pending: false, uploadFailed: true });
      showToast('Failed to send message', 'error');
    } finally {
      setTimeout(() => { sendingRef.current = false; }, 350);
    }
  }, [
    newMessage, msgRoot, user?.uid, replyTo, replyToNote,
    upsertLocal, removeLocal, patchLocal, showToast, isMuted,
    userId, isGroupChat, userSettings, currentUserProfile, ghostMode,
  ]);

  const uploadToCloudinary = useCallback(async (file) => {
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, { method: 'POST', body: form });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return { url: data.secure_url, publicId: data.public_id, resourceType: data.resource_type, format: data.format, duration: data.duration };
  }, []);

  const handleSendMedia = useCallback(async (payload) => {
    if (!msgRoot || !user?.uid || !payload?.file) return;
    const file = payload.file;
    if (file.size > MAX_FILE_SIZE) { showToast('File too large (max 20MB)', 'error'); return; }
    const tempId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const expiresAt = ghostMode ? now + ghostMode : null;
    const blobUrl = URL.createObjectURL(file);
    const mediaType = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image';

    const senderPremiumStyle = userSettings?.chats?.bubbleStyle
      || currentUserProfile?.premiumChatStyle
      || null;

    upsertLocal({
      id: tempId, text: payload.caption || '', caption: payload.caption || '',
      senderId: user.uid, uid: user.uid, timestamp: now, createdAt: now,
      pending: true, isUploading: true, mediaType, mediaUrl: blobUrl,
      replyTo: replyTo || replyToNote || null, senderPremiumStyle, expiresAt,
    });
    setReplyTo(null);
    setReplyToNote(null);
    hapticSend();
    try {
      const up = await uploadToCloudinary(file);
      const messagesRef = ref(db, msgRoot);
      const newRef = push(messagesRef);
      const payloadOut = clean({
        text: payload.caption || '', caption: payload.caption || '',
        senderId: user.uid, uid: user.uid, timestamp: now, createdAt: now,
        mediaType, mediaUrl: up.url, publicId: up.publicId, duration: up.duration || null,
        replyTo: replyTo || replyToNote || null, senderPremiumStyle, expiresAt,
      });
      await set(newRef, payloadOut);

      if (!isGroupChat && userId) {
        const partnerChatRef = ref(db, `userChats/${userId}/${user.uid}`);
        update(partnerChatRef, { lastMessage: mediaType === 'image' ? '📷 Photo' : '🎬 Video', lastUpdated: now, lastSenderId: user.uid }).catch(() => {});

        // 🔥 TRIGGER PUSH NOTIFICATION HERE
        const senderName = currentUserProfile?.displayName || currentUserProfile?.name || "New Message";
        const senderPic = currentUserProfile?.photoURL || null;
        const notificationText = mediaType === 'image' ? '📷 Sent a photo' : mediaType === 'video' ? '🎬 Sent a video' : '🎵 Sent an audio file';
        sendPushNotification(userId, senderName, notificationText, senderPic);
      }

      removeLocal(tempId);
      if (getSoundEnabled() && !isMuted) { try { playSentSound(); } catch { } }
    } catch (err) {
      console.error('Media send failed', err);
      patchLocal(tempId, { pending: false, isUploading: false, uploadFailed: true });
      showToast('Failed to send media', 'error');
    }
  }, [msgRoot, user?.uid, replyTo, replyToNote, uploadToCloudinary, upsertLocal, removeLocal, patchLocal, showToast, isMuted, userId, isGroupChat, userSettings, currentUserProfile, ghostMode]);

  const handleReact = useCallback(async (msg, key) => {
    if (!msgRoot || !user?.uid || !msg?.id) return;
    if (isPremiumSticker(key) && !isEchoPlus) { setShowPlusCheckout(true); return; }
    const reactionRef = ref(db, `${msgRoot}/${msg.id}/reactions/${user.uid}`);
    try {
      const cur = msg.reactions?.[user.uid];
      if (cur === key) { await remove(reactionRef); }
      else { await set(reactionRef, key); }
    } catch (err) { console.error('React failed', err); }
  }, [msgRoot, user?.uid, isEchoPlus]);

  const handleDeleteMessage = useCallback((msg) => {
    if (!msgRoot || !msg?.id) return;
    openConfirmModal({
      title: 'Delete message?',
      message: 'This will be removed for everyone.',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await remove(ref(db, `${msgRoot}/${msg.id}`));
          closeConfirmModal();
          showToast('Message deleted');
        } catch (err) { console.error('Delete failed', err); showToast('Failed to delete', 'error'); }
      },
    });
  }, [msgRoot, showToast]);

  const handleSaveEdit = useCallback(async (id, newText) => {
    if (!msgRoot || !id) return;
    try {
      await update(ref(db, `${msgRoot}/${id}`), { text: newText, editedAt: Date.now() });
      setEditingMessage(null);
      showToast('Message edited');
    } catch (err) { console.error('Edit failed', err); showToast('Failed to edit', 'error'); }
  }, [msgRoot, showToast]);

  const handleSaveMediaCaption = useCallback(async (id, newCaption) => {
    if (!msgRoot || !id) return;
    try {
      await update(ref(db, `${msgRoot}/${id}`), { caption: newCaption, text: newCaption, editedAt: Date.now() });
      setEditingMediaMessage(null);
      showToast('Caption updated');
    } catch (err) { console.error('Caption edit failed', err); showToast('Failed to update caption', 'error'); }
  }, [msgRoot, showToast]);

  const handlePinMessage = useCallback(async (msg) => {
    if (!user?.uid || !chatKey || !msg?.id) return;
    const next = pinnedMessageId === msg.id ? null : msg.id;
    try {
      await update(ref(db, `users/${user.uid}/chatPrefs/${chatKey}`), { pinnedMessageId: next });
      setPinnedMessageId(next);
      showToast(next ? 'Pinned' : 'Unpinned');
    } catch (err) { console.error('Pin failed', err); }
  }, [user?.uid, chatKey, pinnedMessageId, showToast]);

  const handleBookmarkMessage = useCallback(async (msg) => {
    if (!user?.uid || !chatKey || !msg?.id) return;
    const isSaved = !!bookmarkedIds[msg.id];
    try {
      if (isSaved) { await remove(ref(db, `users/${user.uid}/chatPrefs/${chatKey}/bookmarks/${msg.id}`)); }
      else { await set(ref(db, `users/${user.uid}/chatPrefs/${chatKey}/bookmarks/${msg.id}`), true); }
      showToast(isSaved ? 'Removed from saved' : 'Saved');
    } catch (err) { console.error('Bookmark failed', err); }
  }, [user?.uid, chatKey, bookmarkedIds, showToast]);

  const handleToggleSelect = useCallback((msg) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(msg.id)) next.delete(msg.id);
      else next.add(msg.id);
      return next;
    });
  }, []);

  const exitSelectMode = useCallback(() => { setSelectMode(false); setSelectedIds(new Set()); }, []);

  const handleCopySelected = useCallback(() => {
    const texts = allMessages.filter(m => selectedIds.has(m.id)).map(m => m.text || m.caption || '').filter(Boolean).join('\n');
    if (texts) {
      navigator.clipboard?.writeText(texts).then(() => showToast('Copied'), () => showToast('Copy failed', 'error'));
    }
    exitSelectMode();
  }, [allMessages, selectedIds, showToast, exitSelectMode]);

  const handleDeleteSelected = useCallback(() => {
    if (!msgRoot || selectedIds.size === 0) return;
    openConfirmModal({
      title: `Delete ${selectedIds.size} message(s)?`,
      message: 'This cannot be undone.',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          const updates = {};
          selectedIds.forEach(id => { updates[`${msgRoot}/${id}`] = null; });
          await update(ref(db), updates);
          exitSelectMode();
          closeConfirmModal();
          showToast('Deleted');
        } catch (err) { console.error('Bulk delete failed', err); showToast('Failed to delete', 'error'); }
      },
    });
  }, [msgRoot, selectedIds, showToast, exitSelectMode]);

  const handleArchive = useCallback(async (msg) => {
    if (!user?.uid) return;
    try { await saveToEchoArchive(user.uid, msg); showToast('Saved to ECHO Archive'); }
    catch (err) { console.error('Archive failed', err); showToast('Failed to archive', 'error'); }
  }, [user?.uid, showToast]);

  const focusComposer = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;

    try {
      if (el.readOnly) el.readOnly = false;
      el.focus({ preventScroll: true });
    } catch {
      try { el.focus(); } catch {}
    }

    Promise.resolve().then(() => {
      try {
        const e2 = inputRef.current;
        if (!e2) return;
        if (document.activeElement !== e2) {
          e2.focus({ preventScroll: true });
        }
      } catch {}
    });

    const len = (el.value || '').length;
    try { el.setSelectionRange(len, len); } catch {}

    requestAnimationFrame(() => {
      const c = messagesContainerRef.current;
      if (c) c.scrollTop = c.scrollHeight;
    });
    setTimeout(() => {
      const c = messagesContainerRef.current;
      if (c) c.scrollTop = c.scrollHeight;
    }, 320);
  }, []);

  const beginReply = useCallback((msg) => {
    setReplyTo(msg);
    focusComposer();
  }, [focusComposer]);

  const handleLongPress = useCallback((msg, rect) => {
    const isOwn = msg.senderId === user?.uid || msg.uid === user?.uid;
    setMenu({ msg, rect, isOwn });
    hapticLight();
  }, [user?.uid]);

  const closeMenu = useCallback(() => setMenu(null), []);

  const menuItems = useMemo(() => {
    if (!menu) return [];
    const msg = menu.msg;
    const isOwn = menu.isOwn;
    const items = [];

    items.push({ key: 'reply', label: 'Reply', icon: 'fa-reply', onPress: () => beginReply(msg) });
    if (msg.text || msg.caption) {
      items.push({ key: 'copy', label: 'Copy text', icon: 'fa-copy', onPress: () => { navigator.clipboard?.writeText(msg.text || msg.caption || '').then(() => showToast('Copied'), () => showToast('Copy failed', 'error')); } });
    }
    items.push({ key: 'bookmark', label: bookmarkedIds[msg.id] ? 'Remove saved' : 'Save message', icon: 'fa-bookmark', onPress: () => handleBookmarkMessage(msg) });
    items.push({ key: 'pin', label: pinnedMessageId === msg.id ? 'Unpin' : 'Pin message', icon: 'fa-thumbtack', onPress: () => handlePinMessage(msg) });
    items.push({ key: 'archive', label: 'Save to archive', icon: 'fa-box-archive', onPress: () => handleArchive(msg) });
    items.push({ key: 'select', label: 'Select', icon: 'fa-check-square', onPress: () => { setSelectMode(true); setSelectedIds(new Set([msg.id])); } });
    if (isOwn && (msg.text || msg.caption)) {
      items.push({ key: 'edit', label: 'Edit', icon: 'fa-pen', onPress: () => { if (msg.mediaType) setEditingMediaMessage(msg); else setEditingMessage(msg); } });
    }
    if (isOwn) {
      items.push({ key: 'delete', label: 'Delete', icon: 'fa-trash', danger: true, onPress: () => handleDeleteMessage(msg) });
    }
    return items;
  }, [menu, bookmarkedIds, pinnedMessageId, showToast, beginReply, handleBookmarkMessage, handlePinMessage, handleArchive, handleDeleteMessage]);

  const handleInputChange = (e) => { setNewMessage(e.target.value); broadcastTyping(); };
  const handleKeyDown = (e) => { if (enterToSend && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } };

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { setFileSizeError(true); showToast('File too large (max 20MB)', 'error'); return; }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setCaptionText('');
    e.target.value = '';
  };

  const closeMediaPreview = () => {
    if (previewUrl) { try { URL.revokeObjectURL(previewUrl); } catch { } }
    setSelectedFile(null); setPreviewUrl(null); setCaptionText(''); setFileSizeError(false);
  };

  const sendPreviewedMedia = async () => {
    if (!selectedFile) return;
    const file = selectedFile;
    const caption = captionText.trim();
    closeMediaPreview();
    await handleSendMedia({ file, caption });
  };

  const toggleVoiceRecorder = () => setShowVoiceRecorder(v => !v);

  const handleVoiceSend = async (blob, duration) => {
    setShowVoiceRecorder(false);
    if (!blob) return;
    const file = new File([blob], `voice_${Date.now()}.webm`, { type: blob.type || 'audio/webm' });
    await handleSendMedia({ file, caption: '' });
    if (duration) { }
  };

  const unblock = async () => {
    if (!user?.uid || !userId) return;
    try { await unblockUser(user.uid, userId); setBlockedByMe(false); showToast('Unblocked'); }
    catch (err) { console.error('Unblock failed', err); }
  };

  const setWallpaper = async (id) => {
    if (!user?.uid || !chatKey) return;
    try {
      await update(ref(db, `users/${user.uid}/chatPrefs/${chatKey}`), { wallpaperId: id });
      setWallpaperId(id);
      setShowWallpaperPicker(false);
    } catch (err) { console.error('Wallpaper set failed', err); }
  };

  const clearChat = () => {
    if (!msgRoot) return;
    openConfirmModal({
      title: 'Clear chat?',
      message: 'All messages in this chat will be permanently deleted.',
      confirmText: 'Clear',
      onConfirm: async () => {
        try { await remove(ref(db, msgRoot)); closeConfirmModal(); showToast('Chat cleared'); }
        catch (err) { console.error('Clear failed', err); showToast('Failed to clear chat', 'error'); }
      },
    });
  };

  const partnerName = isGroupChat ? groupData?.name || 'Group' : sanitizeName(partnerProfile?.displayName || partnerProfile?.name, userId);
  const partnerPhoto = isGroupChat ? groupData?.photoURL : partnerProfile?.photoURL || partnerProfile?.avatar;

  const wallpaper = useMemo(() => {
    if (customWallpaper) return { url: customWallpaper };
    try { return getWallpaperById(wallpaperId); } catch { return null; }
  }, [wallpaperId, customWallpaper]);

  const pinnedMessage = useMemo(() => allMessages.find(m => m.id === pinnedMessageId) || null, [allMessages, pinnedMessageId]);

  const renderedRows = useMemo(() => {
    const rows = [];
    let lastDay = null;
    let lastSender = null;
    let lastTime = 0;

    allMessages.forEach((msg, idx) => {
      const ts = msgTime(msg);
      const day = startOfDay(ts);
      if (day !== lastDay) {
        rows.push({ type: 'date', key: `day_${day}`, ts });
        lastDay = day; lastSender = null; lastTime = 0;
      }
      const sender = msg.senderId || msg.uid;
      const withinWindow = ts - lastTime < GROUP_WINDOW_MS;
      const sameSender = sender === lastSender && withinWindow;
      const next = allMessages[idx + 1];
      const nextTs = next ? msgTime(next) : 0;
      const nextSender = next ? (next.senderId || next.uid) : null;
      const nextSame = next && nextSender === sender && nextTs - ts < GROUP_WINDOW_MS;
      let group = 'single';
      if (sameSender && nextSame) group = 'top';
      else if (sameSender && !nextSame) group = 'bottom';
      else if (!sameSender && nextSame) group = 'mid';
      else group = 'single';
      rows.push({ type: 'message', key: msg.id, msg, group });
      lastSender = sender; lastTime = ts;
    });
    return rows;
  }, [allMessages]);

  const myUid = user?.uid;

  return (
    <VideoAudioProvider>
      <SEO title={`Chat with ${partnerName}`} />
      <div className="chat-view" style={wallpaper?.url ? { backgroundImage: `url(${wallpaper.url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
        {/* Header */}
        <div className="chat-header">
          <button type="button" className="chat-back-btn" onClick={() => navigate(-1)} aria-label="Back">
            <i className="fas fa-chevron-left" />
          </button>
          <button type="button" className="chat-header-profile" onClick={() => isGroupChat ? navigate(`/group/${groupIdFromChat}`) : navigate(`/profile/${userId}`)}>
            {partnerPhoto ? (
              <Avatar src={partnerPhoto} name={partnerName} size={38} />
            ) : (
              <RandomAvatar uid={userId} size={38} />
            )}
            <div className="chat-header-text">
              <span className="chat-header-name">{partnerName}</span>
              <span className="chat-header-status">
                {partnerIsTyping ? <em className="typing-text">typing…</em> : isGroupChat ? `${Object.keys(groupData?.members || {}).length} members` : 'Tap for info'}
              </span>
            </div>
          </button>
          <button type="button" className={`chat-header-mute-btn${isMuted ? ' muted' : ''}`} onClick={async () => { if (!user?.uid || !chatKey) return; try { await update(ref(db, `users/${user.uid}/chatPrefs/${chatKey}`), { muted: !isMuted }); setIsMuted(!isMuted); } catch (err) { console.error(err); } }} aria-label={isMuted ? 'Unmute' : 'Mute'}>
            <i className={`fas ${isMuted ? 'fa-bell-slash' : 'fa-bell'}`} />
          </button>
          <button type="button" className="chat-header-info-btn" onClick={() => setShowMoreOptions(v => !v)} aria-label="Chat options">
            <i className="fas fa-ellipsis-v" />
          </button>
        </div>

        {/* 👻 Ghost Mode Menu */}
        {showGhostMenu && (
          <div className="ghost-menu-backdrop" onClick={() => setShowGhostMenu(false)}>
            <div className="ghost-menu" onClick={e => e.stopPropagation()}>
              <div className="ghost-menu-title">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 2a9 9 0 0 0-9 9v8.5a1.5 1.5 0 0 0 2.561 1.061L7 19.121l1.439 1.44a1.5 1.5 0 0 0 2.122 0L12 19.121l1.439 1.44a1.5 1.5 0 0 0 2.122 0L17 19.121l1.439 1.44A1.5 1.5 0 0 0 21 19.5V11a9 9 0 0 0-9-9z"/>
                </svg>
                <span>Ghost Mode</span>
                <span className="ghost-plus-badge">PLUS</span>
              </div>
              <p className="ghost-menu-hint">
                New messages you send will automatically disappear.
              </p>
              <div className="ghost-options-grid">
                {[
                  { ms: null,     label: 'Off',       sub: 'Normal' },
                  { ms: 60000,    label: '1m',        sub: '1 minute' },
                  { ms: 300000,   label: '5m',        sub: '5 minutes' },
                  { ms: 600000,   label: '10m',       sub: '10 minutes' },
                  { ms: 1200000,  label: '20m',       sub: '20 minutes' },
                  { ms: 1800000,  label: '30m',       sub: '30 minutes' },
                  { ms: 2700000,  label: '45m',       sub: '45 minutes' },
                  { ms: 3600000,  label: '1h',        sub: '1 hour' },
                  { ms: 7200000,  label: '2h',        sub: '2 hours' },
                  { ms: 10800000, label: '3h',        sub: '3 hours' },
                  { ms: 18000000, label: '5h',        sub: '5 hours' },
                  { ms: 90000000, label: '25h',       sub: '25 hours' },
                ].map(opt => (
                  <button
                    key={String(opt.ms)}
                    type="button"
                    className={`ghost-option-grid-btn${ghostMode === opt.ms ? ' active' : ''}`}
                    onClick={() => { setGhostMode(opt.ms); setShowGhostMenu(false); }}
                  >
                    <span className="ghost-option-label">{opt.label}</span>
                    <span className="ghost-option-sub">{opt.sub}</span>
                    {ghostMode === opt.ms && <i className="fas fa-check" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* More options */}
        {showMoreOptions && (
          <div className="chat-more-dropdown" onClick={() => setShowMoreOptions(false)}>
            <div className="chat-more-dropdown-inner" onClick={e => e.stopPropagation()}>
              <button type="button" className="chat-more-option" onClick={() => { setShowWallpaperPicker(true); setShowMoreOptions(false); }}>
                <i className="fas fa-palette" /> Wallpaper
              </button>
              <button type="button" className="chat-more-option danger" onClick={() => { clearChat(); setShowMoreOptions(false); }}>
                <i className="fas fa-trash" /> Clear chat
              </button>
            </div>
          </div>
        )}

        {/* Pinned */}
        {pinnedMessage && (
          <button type="button" className="pinned-banner" onClick={() => { const el = messageRefs.current[pinnedMessage.id]; if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
            <div className="pinned-banner-icon"><i className="fas fa-thumbtack" /></div>
            <div className="pinned-banner-body">
              <span className="pinned-banner-label">Pinned</span>
              <span className="pinned-banner-text">{pinnedMessage.text || pinnedMessage.caption || '[media]'}</span>
            </div>
            <span className="pinned-banner-close" onClick={e => { e.stopPropagation(); handlePinMessage(pinnedMessage); }}><i className="fas fa-times" /></span>
          </button>
        )}

        {/* Messages */}
        <div className="messages-container" ref={messagesContainerRef} onScroll={onMessagesScroll}>
          {loadingMessages && (<><SkeletonMessage /><SkeletonMessage own /><SkeletonMessage /></>)}
          {!loadingMessages && allMessages.length === 0 && (
            <div className="telegram-empty-state">
              <div className="telegram-empty-card">
                <div className="telegram-empty-avatar">
                  <Lottie
                    animationData={catJson}
                    loop={true}
                    style={{ width: '100%', height: '100%', transform: 'scale(1.3)' }}
                  />
                </div>
                <div className="telegram-empty-name">{partnerName}</div>
                <div className="telegram-empty-text">
                  {isGroupChat ? 'This is the start of the group.' : `Say hi to ${partnerName}!`}
                </div>
                <button type="button" className="telegram-empty-action" onClick={() => inputRef.current?.focus()}>
                  Send a message
                </button>
              </div>
            </div>
          )}

          {renderedRows.map((row) => {
            if (row.type === 'date') {
              return (
                <div key={row.key} className="chat-date-separator">
                  <span>{formatDayLabel(row.ts)}</span>
                </div>
              );
            }
            const msg = row.msg;
            const isOwn = (msg.senderId || msg.uid) === myUid;
            const groupClass = row.group === 'top' ? 'group-top' : row.group === 'bottom' ? 'group-bottom' : row.group === 'mid' ? 'group-mid' : '';
            const selected = selectedIds.has(msg.id);
            const isPremium = isPremiumSticker(msg.text) && !msg.mediaType && !msg.mediaUrl;
            const isGhost = !!msg.expiresAt;

            const premiumStyle =
              msg.senderPremiumStyle ||
              (isOwn ? (userSettings?.chats?.bubbleStyle || currentUserProfile?.premiumChatStyle) : null);
            const premiumStyleClass = premiumStyle ? ` ${premiumStyle}` : '';

            if (isPremium && !msg.replyTo) {
              return (
                <MessageRow
                  key={msg.id}
                  msg={msg}
                  isOwn={isOwn}
                  rowClass={`message-row ${isOwn ? 'own' : 'partner'} ${groupClass} ${selectMode ? 'select-mode' : ''} ${selected ? 'selected' : ''} ${highlightId === msg.id ? 'highlight' : ''}`}
                  selectMode={selectMode}
                  selected={selected}
                  canReply={!selectMode}
                  onLongPress={handleLongPress}
                  onReply={(m) => beginReply(m)}
                  onDoubleTap={(m) => handleReact(m, 'heart')}
                  onToggleSelect={handleToggleSelect}
                  registerRef={registerRef}
                >
                  <div className="premium-sticker-message">
                    {renderPremiumSticker(msg.text, 200)}
                    <div className="message-meta-row" style={{ justifyContent: 'center', marginTop: '-5px' }}>
                      {isGhost && (
                        <span className="ghost-chip" title="Disappearing message">
                          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          <span>
                            {(() => {
                              const ms = msg.expiresAt - msgTime(msg);
                              if (ms >= 3600000) return `${Math.round(ms / 3600000)}h`;
                              if (ms >= 60000) return `${Math.round(ms / 60000)}m`;
                              return 'soon';
                            })()}
                          </span>
                        </span>
                      )}
                      <span className="message-meta-time" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{formatMsgClock(msg)}</span>
                      <MessageReceipt msg={msg} isMe={isOwn} group={isGroupChat} />
                    </div>
                  </div>
                </MessageRow>
              );
            }

            return (
              <MessageRow
                key={msg.id}
                msg={msg}
                isOwn={isOwn}
                rowClass={`message-row ${isOwn ? 'own' : 'partner'} ${groupClass} ${selectMode ? 'select-mode' : ''} ${selected ? 'selected' : ''} ${highlightId === msg.id ? 'highlight' : ''}`}
                selectMode={selectMode}
                selected={selected}
                canReply={!selectMode}
                onLongPress={handleLongPress}
                onReply={(m) => beginReply(m)}
                onDoubleTap={(m) => handleReact(m, 'heart')}
                onToggleSelect={handleToggleSelect}
                registerRef={registerRef}
              >
                <div 
                  className={`message-bubble ${isOwn ? 'own' : 'partner'}${premiumStyleClass} ${isPremium ? 'premium-lottie-bubble' : ''} ${msg.editedAt ? 'edited' : ''} ${isGhost ? 'ghost-liquid-bubble' : ''}`} 
                  style={{ fontSize: FONT_SIZE_MAP[fontSize] }}
                >
                  {isGhost && <div className="ghost-liquid-glow" />}
                  {!isOwn && isGroupChat && (
                    <div className="message-sender-name" style={{ color: senderColor(msg.senderId || msg.uid) }}>
                      {sanitizeName((groupData?.members?.[msg.senderId]?.displayName) || msg.senderName, msg.senderId || msg.uid)}
                    </div>
                  )}
                  {msg.replyTo && (
                    <RepliedMessage replyTo={msg.replyTo} onClick={() => { const el = messageRefs.current[msg.replyTo.id]; if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setHighlightId(msg.replyTo.id); setTimeout(() => setHighlightId(null), 1200); } }} />
                  )}
                  {isPremium ? (
                    <div className="premium-lottie-message">{renderPremiumSticker(msg.text, 80)}</div>
                  ) : msg.mediaType ? (
                    <ChatMediaMessage msg={msg} onOpenImage={(m) => setMediaPreview({ type: 'image', msg: m })} onOpenVideo={(m) => setMediaPreview({ type: 'video', msg: m })} />
                  ) : (
                    <div className="message-text">
                      {isEmojiOnly(msg.text) ? <span className="emoji-only" style={{ fontSize: '38px', lineHeight: 1.2 }}>{msg.text}</span> : linkify(msg.text)}
                    </div>
                  )}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="message-reactions-row">
                      {Object.entries(Object.values(msg.reactions).reduce((acc, key) => { acc[key] = (acc[key] || 0) + 1; return acc; }, {})).map(([key, count]) => {
                        const isMine = msg.reactions[myUid] === key;
                        if (isPremiumSticker(key)) {
                          return (
                            <button type="button" key={key} className={`reaction-pill premium${isMine ? ' mine' : ''}`} onClick={() => handleReact(msg, key)}>
                              {renderPremiumSticker(key, 20)}
                              {count > 1 && <span>{count}</span>}
                            </button>
                          );
                        }
                        const def = REACTION_EMOJIS.find(r => r.key === key);
                        if (!def) return null;
                        const Comp = def.Component;
                        return (
                          <button type="button" key={key} className={`reaction-pill${isMine ? ' mine' : ''}`} onClick={() => handleReact(msg, key)}>
                            <span className="reaction-svg-wrap"><Comp /></span>
                            {count > 1 && <span>{count}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="message-meta-row">
                    {isGhost && (
                      <span className="ghost-chip" title="Disappearing message">
                        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>
                          {(() => {
                            const ms = msg.expiresAt - msgTime(msg);
                            if (ms >= 3600000) return `${Math.round(ms / 3600000)}h`;
                            if (ms >= 60000) return `${Math.round(ms / 60000)}m`;
                            return 'soon';
                          })()}
                        </span>
                      </span>
                    )}
                    {msg.editedAt && <span className="message-edited-badge">edited</span>}
                    <span className="message-meta-time">{formatMsgClock(msg)}</span>
                    <MessageReceipt msg={msg} isMe={isOwn} group={isGroupChat} />
                  </div>
                </div>
              </MessageRow>
            );
          })}
        </div>

        {/* Scroll FAB */}
        {!isNearBottom && (
          <button type="button" className="chat-scroll-fab" onClick={scrollToBottom}>
            {unreadWhileScrolled > 0 && <span>{unreadWhileScrolled}</span>}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16L6 10h12z" /></svg>
          </button>
        )}

        {/* Reply preview */}
        {(replyTo || replyToNote) && (
          <ReplyPreview replyTo={replyTo || replyToNote} onClose={() => { setReplyTo(null); setReplyToNote(null); }} />
        )}

        {/* Composer */}
        {blockedByMe ? (
          <div className="blocked-composer-bar">
            <span>You blocked this user</span>
            <button type="button" className="blocked-composer-unblock" onClick={unblock}>Unblock</button>
          </div>
        ) : (
          <div className="chat-input-container" ref={inputContainerRef}>
            {showEmojiPicker && (
              <PremiumEmojiPicker
                isOpen={showEmojiPicker}
                isEchoPlus={isEchoPlus}
                onClose={() => setShowEmojiPicker(false)}
                onSelect={async (payload) => {
                  if (payload.type === 'UPGRADE') {
                    setShowPlusCheckout(true);
                    return;
                  }

                  setShowEmojiPicker(false);
                  const textToSend = payload.type === 'EMOJI' ? payload.value : payload.key;
                  if (!textToSend || !msgRoot || !user?.uid) return;

                  const tempId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                  const now = Date.now();
                  const expiresAt = ghostMode ? now + ghostMode : null;

                  const replySnapshot = replyTo
                    ? { id: replyTo.id, text: replyTo.text || '', senderId: replyTo.senderId || replyTo.uid || null, mediaType: replyTo.mediaType || null }
                    : replyToNote || null;

                  const senderPremiumStyle = userSettings?.chats?.bubbleStyle
                    || currentUserProfile?.premiumChatStyle
                    || null;

                  upsertLocal({
                    id: tempId,
                    text: textToSend,
                    senderId: user.uid,
                    uid: user.uid,
                    timestamp: now,
                    createdAt: now,
                    replyTo: replySnapshot,
                    senderPremiumStyle,
                    expiresAt,
                  });

                  setReplyTo(null);
                  setReplyToNote(null);
                  hapticSend();

                  try {
                    const messagesRef = ref(db, msgRoot);
                    const newRef = push(messagesRef);
                    await set(newRef, clean({
                      text: textToSend,
                      senderId: user.uid,
                      uid: user.uid,
                      timestamp: now,
                      createdAt: now,
                      replyTo: replySnapshot,
                      senderPremiumStyle,
                      expiresAt,
                    }));

                    if (!isGroupChat && userId) {
                      const partnerChatRef = ref(db, `userChats/${userId}/${user.uid}`);
                      update(partnerChatRef, {
                        lastMessage: textToSend,
                        lastUpdated: now,
                        lastSenderId: user.uid,
                        isRead: false,
                        readAt: null,
                      }).catch(() => {});

                      // 🔥 TRIGGER PUSH NOTIFICATION HERE
                      const senderName = currentUserProfile?.displayName || currentUserProfile?.name || "New Message";
                      const senderPic = currentUserProfile?.photoURL || null;
                      sendPushNotification(userId, senderName, textToSend, senderPic);
                    }

                    removeLocal(tempId);
                    if (getSoundEnabled() && !isMuted) { try { playSentSound(); } catch { } }
                  } catch (err) {
                    console.error('Send failed', err);
                    patchLocal(tempId, { pending: false, uploadFailed: true });
                    showToast('Failed to send', 'error');
                  }
                }}
              />
            )}
            {showVoiceRecorder && (<VoiceRecorder onSend={handleVoiceSend} onCancel={() => setShowVoiceRecorder(false)} />)}

            <div className="chat-input-row">
              <button type="button" className="chat-attach-btn" onClick={() => fileInputRef.current?.click()} aria-label="Attach">
                <i className="fas fa-paperclip" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" style={{ display: 'none' }} onChange={handleFilePick} />
              <button type="button" className="chat-emoji-btn" onClick={() => setShowEmojiPicker(v => !v)} aria-label="Emoji">
                <i className="far fa-smile" />
              </button>

              {/* 👻 Ghost Mode Button inside Input */}
              <div className="chat-input-inner-wrapper">
                <button 
                  type="button" 
                  className={`chat-ghost-inline-btn ${ghostMode ? 'active' : ''}`}
                  onClick={() => {
                    if (!isEchoPlus) {
                      setShowPlusCheckout(true);
                    } else {
                      setShowGhostMenu(true);
                    }
                  }}
                  aria-label="Ghost Mode Timer"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a9 9 0 0 0-9 9v8.5a1.5 1.5 0 0 0 2.561 1.061L7 19.121l1.439 1.44a1.5 1.5 0 0 0 2.122 0L12 19.121l1.439 1.44a1.5 1.5 0 0 0 2.122 0L17 19.121l1.439 1.44A1.5 1.5 0 0 0 21 19.5V11a9 9 0 0 0-9-9z"/>
                  </svg>
                </button>
                <textarea
                  ref={inputRef}
                  className="chat-input"
                  placeholder="Message…"
                  rows={1}
                  value={newMessage}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  style={{ resize: 'none' }}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>

              {newMessage.trim() ? (
                <button ref={sendButtonRef} type="button" className="chat-send-btn" onClick={handleSendText} aria-label="Send">
                  <i className="fas fa-paper-plane" />
                </button>
              ) : (
                <button type="button" className="chat-voice-btn" onClick={toggleVoiceRecorder} aria-label="Record voice">
                  <i className="fas fa-microphone" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Select bars */}
        {selectMode && (
          <>
            <div className="select-top-bar">
              <button type="button" className="select-top-btn" onClick={exitSelectMode} aria-label="Cancel"><i className="fas fa-times" /></button>
              <span className="select-top-title">{selectedIds.size} selected</span>
            </div>
            <div className="select-bottom-bar">
              <button type="button" className="select-action" onClick={handleCopySelected} disabled={selectedIds.size === 0}>
                <i className="fas fa-copy" /><span>Copy</span>
              </button>
              <button type="button" className="select-action danger" onClick={handleDeleteSelected} disabled={selectedIds.size === 0}>
                <i className="fas fa-trash" /><span>Delete</span>
              </button>
            </div>
          </>
        )}

        {/* Menu */}
        {menu && (
          <MessageMenu menu={menu} items={menuItems} myReaction={menu.msg?.reactions?.[myUid]} onReact={(key) => handleReact(menu.msg, key)} onClose={closeMenu}>
            <div className="cv-menu-bubble-mirror">{menu.msg?.text || menu.msg?.caption || '[media]'}</div>
          </MessageMenu>
        )}

        {/* Modals */}
        {editingMessage && (<EditMessageModal message={editingMessage} onSave={(text) => handleSaveEdit(editingMessage.id, text)} onClose={() => setEditingMessage(null)} />)}
        {editingMediaMessage && (<EditMediaCaptionModal message={editingMediaMessage} onSave={(caption) => handleSaveMediaCaption(editingMediaMessage.id, caption)} onClose={() => setEditingMediaMessage(null)} />)}
        {showWallpaperPicker && (<WallpaperPicker currentId={wallpaperId} onSelect={setWallpaper} onClose={() => setShowWallpaperPicker(false)} />)}
        {selectedFile && (<MediaPreview file={selectedFile} previewUrl={previewUrl} caption={captionText} onCaptionChange={setCaptionText} onSend={sendPreviewedMedia} onClose={closeMediaPreview} />)}
        {mediaPreview && (<Modal isOpen onClose={() => setMediaPreview(null)} size="fullscreen"><img src={mediaPreview.msg.mediaUrl} alt="media" className="media-lightbox-image" /></Modal>)}
        {videoPreview && (<Modal isOpen onClose={() => setVideoPreview(null)} size="fullscreen"><CustomVideoPlayer src={videoPreview.msg.mediaUrl} poster={videoPreview.msg.thumbnailUrl} autoPlay /></Modal>)}
        <ConfirmModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} confirmText={confirmModal.confirmText} cancelText={confirmModal.cancelText} onConfirm={confirmModal.onConfirm} onClose={closeConfirmModal} />
        {toast && <Toast message={toast.message} type={toast.type} />}
        <PlusCheckout isOpen={showPlusCheckout} onClose={() => setShowPlusCheckout(false)} />

        {/* 🟢 Drag & Drop Overlay */}
        {isDragging && !selectedFile && (
          <div className="drag-drop-overlay">
            <div className="drag-drop-content">
              <div className="drag-drop-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <h3>Drag files or images here to upload</h3>
              <p>Max 20MB per file.</p>
            </div>
          </div>
        )}
      </div>
    </VideoAudioProvider>
  );
};

export default ChatView;
