// src/components/pages/Chats/Chats.jsx
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../../../services/firebase';
import { useDeletedAccountCheck } from '../../../hooks/useDeletedAccountCheck';
import {
  ref, onValue, get, query, orderByKey, limitToLast, endAt,
} from 'firebase/database';
import ECHOMOJI from '../../UI/ECHOMOJI';
import { getSkinById } from '../../../constants/echomoji';
import './Chats.css';
import { getCache, setCache, setProfile } from '../../../services/cacheService';
import { searchProfiles } from '../../../services/searchService';
import { useInfiniteScroll } from '../../../hooks/useInfiniteScroll';
import { SkeletonChatItem } from '../../common/SkeletonLoader';
import { preloadMedia } from '../../../utils/mediaCache';
import { fetchLatestMessage } from '../../../services/messageCache';
import { useProfile } from '../../../contexts/ProfileContext';
import { getChatList, storeChatList } from '../../../services/indexedDBService';
import { getMyGroups, subscribeToMyGroups } from '../../../services/groupService';
import { groupIdToChatId } from '../../../utils/groupId';
import Avatar from '../../common/Avatar';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import ChatPreviewPopup from './ChatPreviewPopup';
import NotesStrip from './NotesStrip';
import NewGroupModal from './NewGroupModal';
import PlusBadge from '../../common/PlusBadge'; // <-- NEW: Import Premium Badge

const CHAT_CHUNK_SIZE = 20;
const TYPING_FRESHNESS_MS = 4000;

const DEMO_UID = 'k9Cs6QPfDRNTputzic7V3xRUof63';
const SUPPORT_UID = '5cSplOLz30d8dgM3wvXUcDmL2QK2';

const ECHO_AI_USER = {
  id: 'echo_ai_assistant',
  name: 'ECHO AI',
  isAi: true,
  online: true,
  mood: 'happy',
  avatar: '/videos/library/Artificial Intelligence Ai GIF by Abdi Slick.gif',
  lastMessage: 'Your AI assistant is ready to help!',
  unreadCount: 0,
};

const timeAgo = (timestamp) => {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
};

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

const loadPartnerData = async (partnerId) => {
  try {
    const [profileSnap, skinSnap] = await Promise.all([
      get(ref(db, `profiles/${partnerId}`)),
      get(ref(db, `userSkins/${partnerId}/activeSkin`)),
    ]);

    const profile = profileSnap.exists() ? profileSnap.val() : {};
    const activeSkin = skinSnap.exists() ? skinSnap.val() : null;

    const fullProfile = {
      ...profile,
      activeSkin: activeSkin || profile.activeSkin || null,
    };

    await setProfile(partnerId, fullProfile);
    return fullProfile;
  } catch (error) {
    console.warn(`⚠️ Error loading partner data: ${partnerId}`, error);
    return null;
  }
};

// ─── Process a single chat item ─────────────────────────────────
const processChatItem = async (chat, user, onlineUsers) => {
  try {
    const profile = await loadPartnerData(chat.id);

    let partnerName;
    let isDeleted = false;

    if (chat.partnerDeleted === true) {
      partnerName = sanitizeName(chat.partnerName, chat.id) || 'Deleted Account';
      isDeleted = true;
    } else {
      partnerName = sanitizeName(
        profile?.name || profile?.displayName || profile?.username || chat.partnerName || chat.name,
        chat.id
      );
    }

    const rawAvatar = profile?.avatar || chat.partnerAvatar || '';
    if (rawAvatar) preloadMedia(rawAvatar);

    let lastSenderId = chat.lastSenderId || '';
    const isSender = lastSenderId === user.uid;
    let rawLastMessage = chat.lastMessage || 'Start chatting...';
    let displayMessage = rawLastMessage;

    if (displayMessage && displayMessage !== 'Start chatting...') {
      const alreadyPrefixed =
        displayMessage.startsWith('You:') ||
        displayMessage.startsWith('😊') ||
        displayMessage.startsWith('📷') ||
        displayMessage.startsWith('🎬') ||
        displayMessage.startsWith('🎤');
      if (!alreadyPrefixed) {
        displayMessage = isSender ? `You: ${displayMessage}` : `${partnerName}: ${displayMessage}`;
      }
      if (displayMessage.length > 36) {
        displayMessage = displayMessage.substring(0, 36) + '...';
      }
    }

    let unreadCount = chat.unreadCount || 0;
    const readFlagKey = `chat_read_${chat.id}`;
    if (sessionStorage.getItem(readFlagKey) === 'true') {
      unreadCount = 0;
      sessionStorage.removeItem(readFlagKey);
    }

    const isOnline = !!onlineUsers[chat.id];

    return {
      id: chat.id,
      name: partnerName,
      avatar: rawAvatar,
      mood: profile?.mood || chat.mood || 'neutral',
      activeSkin: profile?.activeSkin || chat.activeSkin || null,
      location:
        profile?.location ||
        [profile?.city, profile?.country].filter(Boolean).join(', ') ||
        '',
      lastMessage: displayMessage,
      timestamp: chat.lastUpdated || chat.timestamp || Date.now(),
      lastSenderId: lastSenderId,
      unreadCount: unreadCount,
      isDeleted,
      online: isOnline,
      ended: chat.ended === true,
      isGroup: false,
      isEchoPlus: profile?.isEchoPlus || false, // <-- NEW: Pull Premium Status
      premiumRingStyle: profile?.premiumRingStyle || 'gold', // <-- NEW
    };
  } catch (err) {
    let unreadCount = chat.unreadCount || 0;
    const readFlagKey = `chat_read_${chat.id}`;
    if (sessionStorage.getItem(readFlagKey) === 'true') {
      unreadCount = 0;
      sessionStorage.removeItem(readFlagKey);
    }
    return {
      id: chat.id,
      name: sanitizeName(chat.partnerName || chat.name, chat.id),
      avatar: chat.partnerAvatar || '',
      lastMessage: chat.lastMessage || 'Start chatting...',
      timestamp: chat.lastUpdated || Date.now(),
      lastSenderId: chat.lastSenderId || '',
      unreadCount: unreadCount,
      isDeleted: false,
      online: !!onlineUsers[chat.id],
      ended: chat.ended === true,
      isGroup: false,
      isEchoPlus: false,
      premiumRingStyle: 'gold',
    };
  }
};

// ─── Process a group item ───────────────────────────────────────
const processGroupItem = async (group, user) => {
  try {
    // Fetch fresh group metadata
    const groupSnap = await get(ref(db, `groups/${group.groupId}`));
    if (!groupSnap.exists()) return null;

    const groupData = groupSnap.val();
    const chatId = groupIdToChatId(group.groupId);

    // Fetch last message info from userChats if exists
    let lastMessage = groupData.lastMessage || 'Group created';
    let lastSenderId = groupData.lastSenderId || '';
    let lastUpdated = groupData.lastUpdated || groupData.createdAt || Date.now();
    let unreadCount = 0;

    const userChatSnap = await get(ref(db, `userChats/${user.uid}/${chatId}`));
    if (userChatSnap.exists()) {
      const uc = userChatSnap.val();
      lastMessage = uc.lastMessage || lastMessage;
      lastSenderId = uc.lastSenderId || lastSenderId;
      lastUpdated = uc.lastUpdated || lastUpdated;
      unreadCount = uc.unreadCount || 0;
    }

    let displayMessage = lastMessage;
    const isSender = lastSenderId === user.uid;
    if (displayMessage && displayMessage !== 'Group created') {
      const alreadyPrefixed =
        displayMessage.startsWith('You:') ||
        displayMessage.startsWith('😊') ||
        displayMessage.startsWith('📷') ||
        displayMessage.startsWith('🎬') ||
        displayMessage.startsWith('🎤');
      if (!alreadyPrefixed) {
        displayMessage = isSender
          ? `You: ${displayMessage}`
          : `${groupData.name || 'Group'}: ${displayMessage}`;
      }
      if (displayMessage.length > 36) {
        displayMessage = displayMessage.substring(0, 36) + '...';
      }
    }

    return {
      id: chatId,
      groupId: group.groupId,
      name: groupData.name || 'Untitled Group',
      emoji: groupData.emoji || '👥',
      avatar: null,
      memberCount: groupData.memberCount || Object.keys(groupData.members || {}).length,
      lastMessage: displayMessage,
      timestamp: lastUpdated,
      lastSenderId,
      unreadCount,
      isGroup: true,
      online: false,
      isDeleted: false,
      ended: false,
      isEchoPlus: false,
      premiumRingStyle: 'gold',
    };
  } catch (err) {
    console.warn('processGroupItem failed:', err);
    return null;
  }
};

// ─── Sorting function ──────────────────────────────────────────
const sortNonAIChats = (chats) => {
  const online = chats.filter((c) => c.online === true);
  const offline = chats.filter((c) => c.online === false);
  const onlineSorted = online.sort((a, b) => b.timestamp - a.timestamp);
  const offlineSorted = offline.sort((a, b) => b.timestamp - a.timestamp);
  return [...onlineSorted, ...offlineSorted];
};

// ─── Chat Item (1-1) ───────────────────────────────────────────
const ChatItem = memo(
  ({ chat, onStartChat, onLongPressStart, onLongPressEnd, onLongPressCancel, partnerIsTyping }) => {
    const { profiles } = useProfile();
    const navigate = useNavigate();
    const profile = profiles[chat.id] || {};
    const isOnline = chat.online;
    const hasUnread = chat.unreadCount > 0;
    const skinId = chat.activeSkin || profile.activeSkin || null;
    const skin = skinId ? getSkinById(skinId) : null;
    const mood = profile.mood || chat.mood || 'neutral';

    // NEW: Apply premium ring
    const isPlus = chat.isEchoPlus;
    const ringStyle = chat.premiumRingStyle || 'gold';

    return (
      <div
        className="chat-item regular-chat-item"
        onClick={() => onStartChat(chat)}
        onMouseDown={(e) => onLongPressStart(e, chat)}
        onMouseUp={() => onLongPressEnd(chat)}
        onMouseLeave={onLongPressCancel}
        onTouchStart={(e) => onLongPressStart(e, chat)}
        onTouchEnd={() => onLongPressEnd(chat)}
        onTouchCancel={onLongPressCancel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
      >
        {/* Apply Plus ring to the container if they are Plus */}
        <div
          className={`chat-avatar ${isPlus ? `plus-avatar-ring ${ringStyle}` : ''}`}
          onClick={(e) => { e.stopPropagation(); navigate(`/user/${chat.id}`); }}
          style={isPlus ? { padding: '2px', borderRadius: '50%' } : {}} // Slight padding to show the ring
        >
          <Avatar key={chat.avatar} src={chat.avatar} name={chat.name} size={48} />
          <span className={`presence-dot ${isOnline ? 'online' : 'offline'}`} />
          {hasUnread && <span className="unread-badge">{chat.unreadCount}</span>}
          {chat.isDeleted && (
            <span className="archived-badge" title="Account deleted – archived">📁</span>
          )}

          {partnerIsTyping && (
            <span className="avatar-typing-overlay" aria-hidden="true">
              <span className="avatar-typing-ring" />
              <span className="avatar-typing-dots">
                <span className="avatar-typing-dot" />
                <span className="avatar-typing-dot" />
                <span className="avatar-typing-dot" />
              </span>
            </span>
          )}
        </div>
        <div className="chat-info">
          <div className="chat-title-row">
            <span className="chat-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {chat.name}
              {isPlus && <PlusBadge size={14} />} {/* <-- NEW: Show Badge next to name */}
              {chat.isDeleted && <span className="archived-label"> (archived)</span>}
              {chat.ended && <span className="ended-badge">Ended</span>}
            </span>
          </div>
          <div className="chat-last" style={{ fontWeight: hasUnread ? 700 : 400 }}>
            {partnerIsTyping ? <span className="typing-status-text">typing…</span> : (chat.lastMessage || 'Start chatting...')}
          </div>
        </div>
        <div className="chat-echomoji-middle">
          <div className={`echomoji-holder ${partnerIsTyping ? 'is-typing' : ''}`}>
            <ECHOMOJI mood={mood} skin={skin} size={38} interactive={false} animated={!partnerIsTyping} />
          </div>
        </div>
        <div className="chat-time">{timeAgo(chat.timestamp)}</div>
      </div>
    );
  }
);

// ─── Group Chat Item ───────────────────────────────────────────
const GroupChatItem = memo(({ chat, onStartChat }) => {
  const hasUnread = chat.unreadCount > 0;
  return (
    <div className="chat-item group-chat-item" onClick={() => onStartChat(chat)}>
      <div className="chat-avatar group-avatar">
        <div className="group-avatar-emoji">{chat.emoji || '👥'}</div>
        {hasUnread && <span className="unread-badge">{chat.unreadCount}</span>}
      </div>
      <div className="chat-info">
        <div className="chat-title-row">
          <span className="chat-name">{chat.name}</span>
          <span className="group-badge">{chat.memberCount || 0}</span>
        </div>
        <div className="chat-last" style={{ fontWeight: hasUnread ? 700 : 400 }}>
          {chat.lastMessage || 'Group created'}
        </div>
      </div>
      <div className="chat-time">{timeAgo(chat.timestamp)}</div>
    </div>
  );
});

// ─── Error Boundary ────────────────────────────────────────────
class NotesBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error('[NotesStrip Error]', error, info); }
  render() { return this.state.hasError ? null : this.props.children; }
}

// ─── Main Chats Component ──────────────────────────────────────
const Chats = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const routerLocation = useLocation();

  const initialQuery = () => {
    if (routerLocation.state?.searchQuery) return routerLocation.state.searchQuery;
    sessionStorage.removeItem('chats_search_query');
    return '';
  };

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(() => initialQuery().trim().length > 0);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [loadingChats, setLoadingChats] = useState(true);
  const [showNewGroup, setShowNewGroup] = useState(false);

  const [previewChat, setPreviewChat] = useState(null);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);

  const [typingPartners, setTypingPartners] = useState({});

  const inputRef = useRef(null);
  const searchTimeout = useRef(null);
  const presenceUnsubRef = useRef(null);
  const userChatsUnsubRef = useRef(null);
  const groupsUnsubRef = useRef(null);
  const typingUnsubsRef = useRef({});
  const typingCheckIntervalRef = useRef(null);
  const typingRawRef = useRef({});

  const cacheKey = `chats_${user?.uid}`;
  const [recentChats, setRecentChats] = useState([]);
  const [groupChats, setGroupChats] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [lastChatKey, setLastChatKey] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useDeletedAccountCheck();

  const isDemoUser = user?.uid === DEMO_UID;
  const isSupportUser = user?.uid === SUPPORT_UID;

  // Cache restore
  useEffect(() => {
    if (!user?.uid) return;
    const loadCached = async () => {
      try {
        const cached = await getChatList(user.uid);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          let filtered = cached;
          if (isDemoUser) {
            filtered = cached.filter((c) => c.id === SUPPORT_UID);
          } else {
            filtered = cached.filter((c) => {
              if (c.id === DEMO_UID && !isSupportUser) return false;
              return true;
            });
          }
          setRecentChats(filtered);
          setLoadingChats(false);
        }
      } catch (err) {
        console.warn('Failed to load cached chats:', err);
      }
    };
    loadCached();
  }, [user?.uid, isDemoUser, isSupportUser]);

  // Chat-read + unread-cleared + list-update events
  useEffect(() => {
    const handleChatRead = (event) => {
      const { userId } = event.detail;
      sessionStorage.setItem(`chat_read_${userId}`, 'true');
      setRecentChats((prev) => prev.map((chat) => chat.id === userId ? { ...chat, unreadCount: 0 } : chat));
      setGroupChats((prev) => prev.map((chat) => chat.id === userId ? { ...chat, unreadCount: 0 } : chat));
    };
    const handleUnreadCleared = (event) => {
      const { partnerId } = event.detail;
      setRecentChats((prev) => prev.map((chat) => chat.id === partnerId ? { ...chat, unreadCount: 0 } : chat));
      setGroupChats((prev) => prev.map((chat) => chat.id === partnerId ? { ...chat, unreadCount: 0 } : chat));
    };
    const handleListUpdate = (event) => {
      const { partnerId, patch } = event.detail || {};
      if (!partnerId || !patch) return;
      setRecentChats((prev) => {
        const idx = prev.findIndex((c) => c.id === partnerId);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        const [item] = next.splice(idx, 1);
        next.unshift(item);
        return next;
      });
    };
    window.addEventListener('chat-read', handleChatRead);
    window.addEventListener('chat-unread-cleared', handleUnreadCleared);
    window.addEventListener('chat-list-update', handleListUpdate);
    return () => {
      window.removeEventListener('chat-read', handleChatRead);
      window.removeEventListener('chat-unread-cleared', handleUnreadCleared);
      window.removeEventListener('chat-list-update', handleListUpdate);
    };
  }, []);

  // Presence
  useEffect(() => {
    if (!user) return;
    const presenceRef = ref(db, 'presence/online');
    presenceUnsubRef.current = onValue(
      presenceRef,
      (snapshot) => setOnlineUsers(snapshot.val() || {}),
      (error) => console.error('❌ Presence error:', error)
    );
    return () => {
      if (presenceUnsubRef.current) {
        presenceUnsubRef.current();
        presenceUnsubRef.current = null;
      }
    };
  }, [user]);

  // userChats listener
  useEffect(() => {
    if (!user?.uid) return;

    const userChatsRef = ref(db, `userChats/${user.uid}`);
    userChatsUnsubRef.current = onValue(
      userChatsRef,
      async (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          setRecentChats([]);
          setLoadingChats(false);
          storeChatList(user.uid, []).catch(() => {});
          return;
        }

        let chatList = Object.entries(data)
          .map(([partnerId, chat]) => ({ id: partnerId, ...chat }))
          .filter((c) => !c.id?.startsWith('group_'))
          .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));

        if (isDemoUser) {
          chatList = chatList.filter((c) => c.id === SUPPORT_UID);
        } else {
          chatList = chatList.filter((c) => {
            if (c.id === DEMO_UID && !isSupportUser) return false;
            return true;
          });
        }

        const loadedItems = await Promise.all(
          chatList.map((chat) => processChatItem(chat, user, onlineUsers))
        );

        const nonAIChats = loadedItems.filter((c) => c.id !== 'echo_ai_assistant');
        const sortedNonAI = sortNonAIChats(nonAIChats);

        setRecentChats(sortedNonAI);
        setLoadingChats(false);
        storeChatList(user.uid, sortedNonAI).catch(() => {});
        setCache(cacheKey, sortedNonAI);
      },
      (error) => {
        console.error('❌ userChats listener error:', error);
        setLoadingChats(false);
      }
    );

    return () => {
      if (userChatsUnsubRef.current) {
        userChatsUnsubRef.current();
        userChatsUnsubRef.current = null;
      }
    };
  }, [user?.uid, onlineUsers, cacheKey, isDemoUser, isSupportUser]);

  // Groups listener
  useEffect(() => {
    if (!user?.uid) return;

    groupsUnsubRef.current = subscribeToMyGroups(user.uid, async (groups) => {
      if (!groups || groups.length === 0) {
        setGroupChats([]);
        return;
      }
      const processed = await Promise.all(
        groups.map((g) => processGroupItem(g, user))
      );
      setGroupChats(processed.filter(Boolean));
    });

    return () => {
      if (groupsUnsubRef.current) {
        try { groupsUnsubRef.current(); } catch {}
        groupsUnsubRef.current = null;
      }
    };
  }, [user?.uid]);

  // Typing listeners
  useEffect(() => {
    if (!user?.uid || !recentChats.length) return;

    const activeIds = new Set(recentChats.map((c) => c.id));

    Object.keys(typingUnsubsRef.current).forEach((uid) => {
      if (!activeIds.has(uid)) {
        try { typingUnsubsRef.current[uid](); } catch {}
        delete typingUnsubsRef.current[uid];
        delete typingRawRef.current[uid];
      }
    });

    recentChats.forEach((chat) => {
      if (chat.id === 'echo_ai_assistant') return;
      if (chat.isGroup) return;
      if (typingUnsubsRef.current[chat.id]) return;

      const cId = [user.uid, chat.id].sort().join('_');
      const typingRef = ref(db, `chats/${cId}/typing/${chat.id}`);

      const unsub = onValue(
        typingRef,
        (snap) => {
          const data = snap.val();
          typingRawRef.current[chat.id] = data || null;
          const fresh = data && data.isTyping && Date.now() - (data.timestamp || 0) < TYPING_FRESHNESS_MS;
          setTypingPartners((prev) => prev[chat.id] === !!fresh ? prev : { ...prev, [chat.id]: !!fresh });
        },
        () => {}
      );

      typingUnsubsRef.current[chat.id] = unsub;
    });
  }, [user?.uid, recentChats]);

  useEffect(() => {
    if (typingCheckIntervalRef.current) clearInterval(typingCheckIntervalRef.current);
    typingCheckIntervalRef.current = setInterval(() => {
      const updates = {};
      let anyChanged = false;
      Object.entries(typingRawRef.current).forEach(([uid, data]) => {
        const fresh = data && data.isTyping && Date.now() - (data.timestamp || 0) < TYPING_FRESHNESS_MS;
        const next = !!fresh;
        if (typingPartners[uid] !== next) { updates[uid] = next; anyChanged = true; }
      });
      if (anyChanged) setTypingPartners((prev) => ({ ...prev, ...updates }));
    }, 2000);
    return () => {
      if (typingCheckIntervalRef.current) clearInterval(typingCheckIntervalRef.current);
    };
  }, [typingPartners]);

  useEffect(() => {
    return () => {
      Object.values(typingUnsubsRef.current).forEach((u) => { try { u(); } catch {} });
      typingUnsubsRef.current = {};
      typingRawRef.current = {};
    };
  }, []);

  // Long-press handlers
  const handleLongPressStart = useCallback((e, chat) => {
    if (chat.id === 'echo_ai_assistant') return;
    if (chat.isGroup) return;
    longPressTriggered.current = false;
    const clientX = e.touches?.[0]?.clientX ?? e.clientX ?? 0;
    const clientY = e.touches?.[0]?.clientY ?? e.clientY ?? 0;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setPreviewPosition({ x: clientX + 16, y: clientY + 16 });
      setPreviewChat(chat);
      if (navigator.vibrate) navigator.vibrate(30);
    }, 500);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleLongPressCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const startChat = (selectedUser) => {
    if (!selectedUser) return;

    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }

    if (selectedUser.isAi || selectedUser.id === 'echo_ai_assistant') {
      navigate('/chat/echo_ai_assistant');
      return;
    }

    if (selectedUser.isGroup) {
      navigate(`/chat/${selectedUser.id}`);
      return;
    }

    const safeUserName = sanitizeName(selectedUser.name, selectedUser.id);
    navigate(`/chat/${selectedUser.id}`, {
      state: {
        userName: safeUserName,
        userStatus: selectedUser.status,
        userInterests: selectedUser.interests,
        userAvatar: selectedUser.avatar,
        userMood: selectedUser.mood,
        userActiveSkin: selectedUser.activeSkin,
        searchQuery: searchQuery.trim(),
      },
    });
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setResults([]);
    sessionStorage.removeItem('chats_search_query');
    inputRef.current?.focus();
  };

  // Search
  const performSearch = async (queryText) => {
    const trimmed = queryText.trim().toLowerCase();
    if (trimmed.length < 1) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);

    const localHits = (recentChats || [])
      .filter((c) => {
        const n = (c.name || '').toLowerCase();
        const m = (c.lastMessage || '').toLowerCase();
        return n.includes(trimmed) || m.includes(trimmed);
      })
      .map((c) => ({
        id: c.id, name: c.name, avatar: c.avatar,
        mood: c.mood || 'happy', activeSkin: c.activeSkin || 'default',
        location: c.location || '',
        isOnline: !!onlineUsers[c.id], fromLocal: true,
        isEchoPlus: c.isEchoPlus, premiumRingStyle: c.premiumRingStyle // <-- Keep Premium Data in Search
      }));
    if (localHits.length) { setResults(localHits); setIsSearching(false); }

    try {
      const searchRes = await searchProfiles(trimmed, user.uid, 50);
      const rawResults = Array.isArray(searchRes)
        ? searchRes
        : Array.isArray(searchRes?.results) ? searchRes.results : [];
      const remote = rawResults
        .filter((u) => u && typeof u === 'object' && u.id)
        .filter((u) => !(u.id === DEMO_UID && !isSupportUser))
        .map((u) => ({
          ...u,
          id: u.id,
          name: sanitizeName(u.name || u.displayName || u.username, u.id),
          mood: u.mood || 'happy',
          activeSkin: u.activeSkin || 'default',
          location: u.location || [u.city, u.country].filter(Boolean).join(', ') || '',
          isOnline: !!onlineUsers[u.id],
          isEchoPlus: u.isEchoPlus || false,
          premiumRingStyle: u.premiumRingStyle || 'gold',
        }));

      const seen = new Set(localHits.map((x) => x.id));
      const merged = [...localHits];
      for (const r of remote) {
        if (!seen.has(r.id)) { seen.add(r.id); merged.push(r); }
      }
      setResults(merged);
    } catch (err) {
      console.error('❌ [Search] Search failed:', err);
      if (!localHits.length) setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    const queryStr = searchQuery.trim();
    if (queryStr.length === 0) {
      sessionStorage.removeItem('chats_search_query');
      setResults([]);
      setIsSearching(false);
      return;
    }
    sessionStorage.setItem('chats_search_query', queryStr);
    searchTimeout.current = setTimeout(() => { performSearch(queryStr); }, 120);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery, onlineUsers, isSupportUser, recentChats]);

  const safeRecentChats = Array.isArray(recentChats) ? recentChats : [];
  const safeGroupChats = Array.isArray(groupChats) ? groupChats : [];
  const safeResults = Array.isArray(results) ? results : [];
  const isSearchActive = searchQuery.trim().length > 0;

  // Merge groups + 1-1 for the recent list (groups first if recently active)
  const allChatsSorted = [...safeGroupChats, ...safeRecentChats]
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // Hero match
  const trimmedSearch = searchQuery.trim().toLowerCase();
  let topResult = null;
  let otherResults = safeResults;
  if (safeResults.length > 0 && trimmedSearch.length > 0) {
    const getCleanName = (p) => (p.name || '').trim().toLowerCase();
    const getCleanUsername = (p) => (p.username || '').trim().toLowerCase();
    let bestMatch = safeResults.find(
      (p) => getCleanName(p) === trimmedSearch || getCleanUsername(p) === trimmedSearch
    );
    if (!bestMatch) {
      bestMatch = safeResults.find(
        (p) => getCleanName(p).includes(trimmedSearch) || getCleanUsername(p).includes(trimmedSearch)
      );
    }
    if (bestMatch) {
      topResult = bestMatch;
      otherResults = safeResults.filter((p) => p.id !== bestMatch.id);
    }
  }

  const visibleUids = safeRecentChats.map((c) => c.id);

  return (
    <>
      <SEO title="Chats – Recent Conversations" description="View all your recent conversations on ECHO." />
      <StructuredData />
      <div className="chats-page">
        <div className="search-container">
          <div className="search-input-wrapper">
            <i className="fas fa-search search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="search-input"
              placeholder="Search people or locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear" onClick={handleClearSearch}>✕</button>
            )}
          </div>
          {!isSearchActive && (
            <button
              type="button"
              className="new-group-btn-top"
              onClick={() => setShowNewGroup(true)}
              title="New group"
            >
              <i className="fas fa-user-plus" />
              <span>New Group</span>
            </button>
          )}
        </div>

        {!isSearchActive && (
          <NotesBoundary>
            <NotesStrip visibleUids={visibleUids} />
          </NotesBoundary>
        )}

        {isSearchActive ? (
          <div className="recent-chats search-results-section">
            {!isSearching && topResult && (
              <div className="hero-result-card" onClick={() => startChat(topResult)}>
                <div className="hero-bg-glow" />
                <div className="hero-content">
                  <div className={`hero-avatar-wrapper ${topResult.isEchoPlus ? `plus-avatar-ring ${topResult.premiumRingStyle}` : ''}`}>
                    <Avatar src={topResult.avatar} name={topResult.name} size={90} />
                    {!!onlineUsers[topResult.id] && <span className="presence-dot online" />}
                  </div>
                  <div className="hero-info">
                    <h2 className="hero-name" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      {topResult.name}
                      {topResult.isEchoPlus && <PlusBadge size={18} />} {/* <-- Badge in Hero */}
                    </h2>
                    <div className="hero-meta">
                      <span className="hero-badge">{onlineUsers[topResult.id] ? '🟢 Online' : '⚫ Offline'}</span>
                      {topResult.location && <span className="hero-badge">📍 {topResult.location}</span>}
                    </div>
                    <p className="hero-bio">{topResult.bio || topResult.status || 'Available on ECHO'}</p>
                  </div>
                  <button
                    className="hero-action-btn"
                    onClick={(e) => { e.stopPropagation(); startChat(topResult); }}
                  >
                    Join the cheer 🎉
                  </button>
                </div>
              </div>
            )}

            <div className="section-header">
              <span>{topResult ? 'Other Results' : 'Search Results'} {!isSearching && `(${topResult ? otherResults.length : safeResults.length})`}</span>
            </div>

            {isSearching ? (
              <div className="search-skeleton-wrapper">
                <SkeletonChatItem /><SkeletonChatItem /><SkeletonChatItem />
              </div>
            ) : otherResults.length > 0 ? (
              otherResults.map((person) => {
                if (!person) return null;
                const isOnline = !!onlineUsers[person.id];
                const isPlus = person.isEchoPlus;
                return (
                  <div key={person.id} className="chat-item regular-chat-item" onClick={() => startChat(person)}>
                    <div 
                      className={`chat-avatar ${isPlus ? `plus-avatar-ring ${person.premiumRingStyle}` : ''}`}
                      onClick={(e) => { e.stopPropagation(); navigate(`/user/${person.id}`); }}
                      style={isPlus ? { padding: '2px', borderRadius: '50%' } : {}}
                    >
                      <Avatar src={person.avatar} name={person.name} size={48} />
                      <span className={`presence-dot ${isOnline ? 'online' : 'offline'}`} />
                    </div>
                    <div className="chat-info">
                      <div className="chat-title-row">
                        <span className="chat-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {person.name}
                          {isPlus && <PlusBadge size={14} />} {/* <-- Badge in Search */}
                        </span>
                        {person.location && <span className="chat-location-badge">📍 {person.location}</span>}
                      </div>
                      <div className="chat-last">{person.bio || person.status || 'Available on ECHO'}</div>
                    </div>
                    <div className="chat-echomoji-middle">
                      <ECHOMOJI
                        mood={person.mood || 'happy'}
                        skin={person.activeSkin ? getSkinById(person.activeSkin) : null}
                        size={38}
                        interactive={false}
                      />
                    </div>
                  </div>
                );
              })
            ) : !topResult && safeResults.length === 0 ? (
              isDemoUser ? (
                <div className="demo-search-empty">
                  <div className="demo-search-icon"><i className="fas fa-user-plus" /></div>
                  <p className="demo-search-title">Create an account to connect with others</p>
                  <span className="demo-search-subtitle">Sign up to chat with people around the world</span>
                </div>
              ) : (
                <div className="no-chats-premium">
                  <div className="no-chats-icon-wrapper"><i className="fas fa-user-slash" /></div>
                  <p className="no-chats-title">No matching users found</p>
                  <span className="no-chats-subtitle">Try searching for a different name, username, or location</span>
                </div>
              )
            ) : null}
          </div>
        ) : (
          <div className="recent-chats">
            <div className="section-header"><span>Recent Conversations</span></div>

            <div className="chat-item ai-item floating-ai-card" onClick={() => startChat(ECHO_AI_USER)}>
              <div className="chat-avatar">
                <img src={ECHO_AI_USER.avatar} alt="ECHO AI" className="user-profile-img" style={{ objectFit: 'cover' }} />
                <span className="presence-dot online" />
              </div>
              <div className="chat-info">
                <div className="chat-title-row">
                  <span className="chat-name">{ECHO_AI_USER.name}</span>
                  <span className="ai-badge">AI</span>
                </div>
                <div className="chat-last">{ECHO_AI_USER.lastMessage}</div>
              </div>
              <div className="chat-time">Always Active</div>
            </div>

            {loadingChats && allChatsSorted.length === 0 ? (
              <SkeletonChatItem />
            ) : allChatsSorted.length === 0 ? (
              <div className="no-chats-premium">
                <div className="no-chats-icon-wrapper"><i className="fas fa-comments" /></div>
                <p className="no-chats-title">No conversations yet</p>
                <span className="no-chats-subtitle">Search for people above or create a group to start chatting</span>
              </div>
            ) : (
              allChatsSorted.map((chat) => {
                if (chat.isGroup) {
                  return <GroupChatItem key={chat.id} chat={chat} onStartChat={startChat} />;
                }
                return (
                  <ChatItem
                    key={chat.id}
                    chat={chat}
                    onStartChat={startChat}
                    onLongPressStart={handleLongPressStart}
                    onLongPressEnd={handleLongPressEnd}
                    onLongPressCancel={handleLongPressCancel}
                    partnerIsTyping={!!typingPartners[chat.id]}
                  />
                );
              })
            )}
          </div>
        )}

        {previewChat && (
          <ChatPreviewPopup
            chat={{ ...previewChat, myUid: user?.uid }}
            position={previewPosition}
            onClose={() => setPreviewChat(null)}
            onOpenChat={(chatId) => navigate(`/chat/${chatId}`)}
          />
        )}

        <NewGroupModal
          isOpen={showNewGroup}
          onClose={() => setShowNewGroup(false)}
          onCreated={(groupId) => {
            navigate(`/chat/group_${groupId}`);
          }}
        />
      </div>
    </>
  );
};

export default Chats;
