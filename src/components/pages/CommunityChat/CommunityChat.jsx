// src/components/pages/CommunityChat/CommunityChat.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../../../services/firebase';
import {  ref, onValue, push, get, remove, set , update } from 'firebase/database';
import { useAuth } from '../../../hooks/useAuth';
import { sortMessages, msgTime } from '../../../utils/sortMessages';
import { useCommunity } from '../../../contexts/CommunityContext';
import { useProfile } from '../../../contexts/ProfileContext';
import Avatar from '../../common/Avatar';
import ECHOMOJI from '../../UI/ECHOMOJI';
import { getSkinById } from '../../../constants/echomoji';
import ChatEmojiPicker from '../Chat/ChatEmojiPicker';
import MessageMenu from '../Chat/MessageMenu';
import { saveToEchoArchive, listEchoArchive, removeEchoArchive } from '../../../services/echoArchive';
import { communityExpiresAt, isTideExpired, tideProgress, formatTideLeft, COMMUNITY_TTL_MS } from '../../../utils/echoTides';
import ReplyPreview from '../Chat/ReplyPreview';
import RepliedMessage from '../Chat/RepliedMessage';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import ReactDOM from 'react-dom';
import CommunityWall from './CommunityWall';
import {
  loadMessagesFromCache,
  saveMessagesToCache,
} from '../../../services/messageStorage';
import { getCache, setCache } from '../../../services/cacheService';
import './CommunityChat.css';

const CLOUDINARY_CLOUD_NAME = 'rjlscgan';
const CLOUDINARY_UPLOAD_PRESET = 'echo_uploads';

const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '👎'];

const formatReactionCount = (count) => {
  if (count < 1000) return String(count);
  if (count < 1000000) {
    const k = count / 1000;
    return k >= 10 ? Math.round(k) + 'K' : k.toFixed(1) + 'K';
  }
  const m = count / 1000000;
  return m >= 10 ? Math.round(m) + 'M' : m.toFixed(1) + 'M';
};

const CommunityChat = () => {
  const { communityId, tab } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentCommunity, setCurrentCommunity } = useCommunity();
  const { getProfile, fetchProfile } = useProfile();

  const [messages, setMessages] = useState([]);
  const [bookmarkedIds, setBookmarkedIds] = useState({});
  const stampedLegacyTides = useRef(false);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [community, setCommunity] = useState(currentCommunity || null);
  const [isMember, setIsMember] = useState(false);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [captionText, setCaptionText] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [showCaptionEmoji, setShowCaptionEmoji] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingMessageId, setDeletingMessageId] = useState(null);

  const [reactingMessageId, setReactingMessageId] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionViewer, setReactionViewer] = useState(null);

  // ─── Active tab from URL ────────────────────────────────────────
  const activeTab = tab === 'members' ? 'wall' : (tab || 'wall');

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const captionInputRef = useRef(null);
  const inputContainerRef = useRef(null);
  const captionPreviewRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const initialScrollRef = useRef(false);
  const msgRefs = useRef({});
  const cacheKey = communityId ? `community_${communityId}` : null;
  const membershipCacheKey = user?.uid ? `membership_${user.uid}_${communityId}` : null;
  const isMounted = useRef(true);
  const lastPushedCommunityId = useRef(null);
  const lastPushedCount = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [newMessage]);

  // Load from cache
  useEffect(() => {
    if (!communityId) return;
    const loadCached = async () => {
      try {
        const cachedCommunity = await getCache(`community_meta_${communityId}`);
        if (cachedCommunity) {
          setCommunity(cachedCommunity);
          setLoading(false);
        }
        const cachedMembership = await getCache(`membership_${user?.uid}_${communityId}`);
        if (cachedMembership !== null && cachedMembership !== undefined) {
          setIsMember(cachedMembership);
          setMembershipLoading(false);
        }
      } catch (_) {}
    };
    loadCached();
  }, [communityId, user?.uid]);

  // Community meta realtime
  useEffect(() => {
    if (!communityId) return;
    if (currentCommunity?.id === communityId) {
      setCommunity(currentCommunity);
    }
    const unsub = onValue(ref(db, `communities/${communityId}`), (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const next = {
          id: communityId,
          name: data.name || 'Community',
          description: data.description || '',
          image: data.image || '/images/communities/default.png',
          memberCount: Number(data.memberCount || 0),
        };
        setCommunity(next);
        setCache(`community_meta_${communityId}`, next, 3600).catch(() => {});
        const effective = (isMember ? next.memberCount + 1 : next.memberCount) || 1;
        if (
          setCurrentCommunity &&
          (lastPushedCommunityId.current !== communityId || lastPushedCount.current !== effective)
        ) {
          lastPushedCommunityId.current = communityId;
          lastPushedCount.current = effective;
          setCurrentCommunity({
            ...next,
            memberCount: effective,
          });
        }
      } else if (!currentCommunity || currentCommunity.id !== communityId) {
        setCommunity(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [communityId, currentCommunity, setCurrentCommunity, isMember]);

  // Membership realtime
  useEffect(() => {
    if (!user?.uid || !communityId) {
      setIsMember(false);
      setMembershipLoading(false);
      return;
    }
    const membershipRef = ref(db, `userCommunities/${user.uid}/${communityId}`);
    const unsub = onValue(membershipRef, (snap) => {
      const val = snap.val() === true;
      setIsMember(val);
      setMembershipLoading(false);
      setCache(membershipCacheKey, val, 3600).catch(() => {});
      if (community && setCurrentCommunity) {
        const effective = val ? (community.memberCount || 0) + 1 : (community.memberCount || 0) || 1;
        if (lastPushedCommunityId.current !== communityId || lastPushedCount.current !== effective) {
          lastPushedCommunityId.current = communityId;
          lastPushedCount.current = effective;
          setCurrentCommunity({
            ...community,
            memberCount: effective,
          });
        }
      }
    });
    return () => unsub();
  }, [user?.uid, communityId, membershipCacheKey, community, setCurrentCommunity, communityId]);

  // User name
  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const snap = await get(ref(db, `profiles/${user.uid}`));
        const data = snap.exists() ? snap.val() : {};
        setUserName(data.name || user.displayName || user.email?.split('@')[0] || 'User');
      } catch {
        setUserName(user.displayName || user.email?.split('@')[0] || 'User');
      }
    })();
  }, [user]);

  // Messages listener (only for chat tab)
  useEffect(() => {
    if (!communityId || !cacheKey || activeTab !== 'chat') {
      if (activeTab !== 'chat') setMessages([]);
      return;
    }
    initialScrollRef.current = false;
    isNearBottomRef.current = true;

    loadMessagesFromCache(cacheKey).then((cached) => {
      if (cached?.length) {
        setMessages(sortMessages(cached));
        setLoading(false);
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
          initialScrollRef.current = true;
        });
      }
    });

    const unsub = onValue(
      ref(db, `communityChats/${communityId}/messages`),
      (snapshot) => {
        const data = snapshot.val();
        const list = data
          ? sortMessages(Object.entries(data).map(([id, msg]) => ({ id, ...msg })))
          : [];
        setMessages((prev) => {
          const pending = (prev || []).filter(
            (m) =>
              m.pending &&
              !list.some(
                (v) =>
                  v.senderId === m.senderId &&
                  v.text === m.text &&
                  Math.abs(msgTime(v) - msgTime(m)) < 8000
              )
          );
          const next = sortMessages([...list, ...pending].filter((m) => !isTideExpired(m) || Date.now() - Number(m.expiresAt || 0) < 700));
          if (!stampedLegacyTides.current && list.length) {
            stampedLegacyTides.current = true;
            const stamp = {};
            const start = communityExpiresAt();
            list.forEach((m) => {
              if (m.id && !m.expiresAt) stamp[`communityChats/${communityId}/messages/${m.id}/expiresAt`] = start;
            });
            if (Object.keys(stamp).length) update(ref(db), stamp).catch(() => {});
          }
          return next;
        });
        setLoading(false);
        saveMessagesToCache(cacheKey, list).catch(() => {});
        const seen = new Set();
        list.forEach((m) => {
          if (m.senderId && m.type !== 'system' && !seen.has(m.senderId)) {
            seen.add(m.senderId);
            try {
              fetchProfile?.(m.senderId);
            } catch (_) {}
          }
        });
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [communityId, cacheKey, fetchProfile, activeTab]);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  useEffect(() => {
    if (!messagesEndRef.current || activeTab !== 'chat') return;
    if (!initialScrollRef.current) {
      initialScrollRef.current = true;
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
      return;
    }
    if (isNearBottomRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 0);

  // Cloudinary upload
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

  // Send text message
  const handleSend = async (e) => {
    e?.preventDefault?.();
    const text = newMessage.trim();
    if (!text || !user?.uid || !communityId || sending || !isMember || activeTab !== 'chat') return;

    setSending(true);
    const sentAt = Date.now();
    const tempId = `temp_${sentAt}`;
    const payload = {
      senderId: user.uid,
      text,
      timestamp: sentAt,
      type: 'text',
      expiresAt: communityExpiresAt(sentAt),
    };
    if (replyTo) {
      payload.replyTo = {
        messageId: replyTo.messageId,
        senderName: replyTo.senderName,
        textSnippet: (replyTo.textSnippet || '').slice(0, 120),
      };
    }

    setMessages((prev) =>
      sortMessages([...prev, { id: tempId, ...payload, pending: true, senderName: userName }])
    );
    setNewMessage('');
    setReplyTo(null);
    isNearBottomRef.current = true;
    focusInput();

    try {
      await push(ref(db, `communityChats/${communityId}/messages`), payload);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      alert('Failed to send message.');
    } finally {
      setSending(false);
      focusInput();
    }
  };

  // Media preview
  const openMediaPreview = (file) => {
    if (!file || !isMember) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setCaptionText('');
    setShowCaptionEmoji(false);
    setTimeout(() => captionInputRef.current?.focus(), 80);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    openMediaPreview(file);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) openMediaPreview(file);
        return;
      }
    }
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

  const sendMediaMessage = async () => {
    if (!selectedFile || !user?.uid || !communityId || sending || activeTab !== 'chat') return;
    const file = selectedFile;
    const localPreview = previewUrl;
    const caption = captionText.trim();
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
    const sentAt = Date.now();
    const tempId = `temp_media_${sentAt}`;

    setSending(true);
    setIsUploading(true);
    setUploadProgress(0);

    const optimisticMsg = {
      id: tempId,
      senderId: user.uid,
      type: 'media',
      mediaType,
      mediaUrl: localPreview,
      text: caption || (mediaType === 'video' ? 'Video' : 'Image'),
      caption,
      timestamp: sentAt,
      expiresAt: communityExpiresAt(sentAt),
      pending: true,
      senderName: userName,
      isUploading: true,
      uploadProgress: 0,
    };
    setMessages((prev) => sortMessages([...prev, optimisticMsg]));
    cancelMediaPreview();
    isNearBottomRef.current = true;
    focusInput();

    try {
      const downloadURL = await uploadToCloudinary(file, (progress) => {
        setUploadProgress(progress);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, uploadProgress: progress } : m
          )
        );
      });
      const payload = {
        senderId: user.uid,
        text: caption || (mediaType === 'video' ? 'Video' : 'Image'),
        timestamp: Date.now(),
        type: 'media',
        mediaType,
        mediaUrl: downloadURL,
      };
      if (caption) payload.caption = caption;
      await push(ref(db, `communityChats/${communityId}/messages`), payload);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      alert(
        /PERMISSION/i.test(String(err?.message || err))
          ? 'Permission denied. Update communityChats Firebase rules for media fields.'
          : 'Failed to upload media.'
      );
    } finally {
      setSending(false);
      setIsUploading(false);
      setUploadProgress(0);
      focusInput();
    }
  };

  // Emoji picker
  const handleEmojiSelect = (emoji) => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? newMessage.length;
      const end = input.selectionEnd ?? newMessage.length;
      const next = newMessage.slice(0, start) + emoji + newMessage.slice(end);
      setNewMessage(next);
      setTimeout(() => {
        input.focus();
        try {
          input.setSelectionRange(start + emoji.length, start + emoji.length);
        } catch (_) {}
      }, 0);
    } else setNewMessage((p) => p + emoji);
  };

  // Reply
  const handleReply = (msg) => {
    if (activeTab !== 'chat') return;
    setReplyTo({
      messageId: msg.id,
      senderName:
        getProfile?.(msg.senderId)?.name ||
        msg.senderName ||
        (msg.senderId === user?.uid ? 'You' : 'User'),
      textSnippet:
        msg.type === 'media'
          ? msg.caption || (msg.mediaType === 'video' ? 'Video' : 'Image')
          : (msg.text || '').slice(0, 80),
      originalMessage: msg,
    });
    focusInput();
  };

  // Copy
  const handleCopy = async (msg) => {
    const text =
      msg.type === 'media' ? msg.mediaUrl || msg.caption || '' : msg.text || '';
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Delete
  const handleDelete = async (msg) => {
    if (!msg?.id || msg.senderId !== user?.uid || String(msg.id).startsWith('temp_')) return;
    setDeletingMessageId(msg.id);
    try {
      await remove(ref(db, `communityChats/${communityId}/messages/${msg.id}`));
      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== msg.id);
        saveMessagesToCache(cacheKey, next.filter((m) => !m.pending)).catch(() => {});
        return next;
      });
    } catch (err) {
      alert('Could not delete message.');
    } finally {
      setDeletingMessageId(null);
    }
  };

  // Jump to replied message
  const jumpToMessage = (messageId) => {
    if (!messageId || activeTab !== 'chat') return;
    const el = msgRefs.current[messageId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightId(messageId);
      setTimeout(() => setHighlightId(null), 2000);
    }
  };

  // Open private chat from sender
  const openUserChat = (senderId) => {
    if (!senderId || senderId === user?.uid || senderId === 'system') return;
    const profile = getProfile?.(senderId);
    navigate(`/chat/${senderId}`, {
      state: {
        fromCommunity: communityId,
        userName: profile?.name || 'User',
        userAvatar: profile?.avatar || '',
      },
    });
  };

  // Keydown
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  // Format timestamp
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

  // Reactions
  const handleReact = (msg) => {
    if (activeTab !== 'chat') return;
    setReactingMessageId(msg.id);
    setShowReactionPicker(true);
  };

  const handleReactionSelect = async (emoji) => {
    setShowReactionPicker(false);
    if (!reactingMessageId || !user?.uid || !communityId || activeTab !== 'chat') return;
    const reactionRef = ref(db, `communityChats/${communityId}/messages/${reactingMessageId}/reactions/${user.uid}`);
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
      if (!err.message.includes('PERMISSION_DENIED')) {
        alert('Failed to react. Please try again.');
      }
    }
  };

  const closeReactionPicker = () => {
    setShowReactionPicker(false);
    setReactingMessageId(null);
  };

  const handleRemoveReaction = async (messageId, emoji) => {
    if (!user?.uid || !communityId || activeTab !== 'chat') return;
    const reactionRef = ref(db, `communityChats/${communityId}/messages/${messageId}/reactions/${user.uid}`);
    try {
      await remove(reactionRef);
      if (reactionViewer && reactionViewer.emoji === emoji) {
        setReactionViewer(null);
      }
    } catch (err) {
      console.warn('Remove reaction error:', err);
      if (!err.message.includes('PERMISSION_DENIED')) {
        alert('Failed to remove reaction.');
      }
    }
  };

  const openReactionViewer = (emoji, reactions, messageId) => {
    if (!reactions || typeof reactions !== 'object' || activeTab !== 'chat') return;
    const userIds = Object.keys(reactions).filter(uid => reactions[uid] === emoji);
    if (userIds.length === 0) return;
    setReactionViewer({ emoji, userIds, messageId });
  };

  const closeReactionViewer = () => {
    setReactionViewer(null);
  };

  const renderReactionViewer = () => {
    if (!reactionViewer) return null;
    const { emoji, userIds, messageId } = reactionViewer;

    return ReactDOM.createPortal(
      <div className="reaction-viewer-overlay" onClick={closeReactionViewer}>
        <div className="reaction-viewer-modal" onClick={(e) => e.stopPropagation()}>
          <div className="reaction-viewer-header">
            <span className="reaction-viewer-emoji">{emoji}</span>
            <span className="reaction-viewer-count">{userIds.length} reaction{userIds.length !== 1 ? 's' : ''}</span>
            <button className="reaction-viewer-close" onClick={closeReactionViewer}>
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="reaction-viewer-list">
            {userIds.map((uid) => {
              const profile = getProfile(uid);
              const isCurrentUser = uid === user?.uid;
              const displayName = isCurrentUser ? 'You' : (profile?.name || 'User');
              const avatar = profile?.avatar || '';
              return (
                <div key={uid} className="reaction-viewer-item">
                  <Avatar src={avatar} name={displayName} size={36} />
                  <span className="reaction-viewer-name">{displayName}</span>
                  {isCurrentUser && (
                    <>
                      <span className="reaction-viewer-you">(You)</span>
                      <button
                        className="reaction-viewer-remove-btn"
                        onClick={() => handleRemoveReaction(messageId, emoji)}
                        title="Remove your reaction"
                      >
                        <i className="fas fa-times" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const renderReactions = (reactions, messageId) => {
    if (!reactions || typeof reactions !== 'object' || activeTab !== 'chat') return null;
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
          <span
            key={emoji}
            className="reaction-badge clickable"
            onClick={() => openReactionViewer(emoji, reactions, messageId)}
            title={`${uids.length} reaction${uids.length !== 1 ? 's' : ''}`}
          >
            {emoji}
            {uids.length > 1 && (
              <span className="reaction-count">{formatReactionCount(uids.length)}</span>
            )}
          </span>
        ))}
      </div>
    );
  };

  // Render individual message
  useEffect(() => {
    if (!user?.uid) return;
    listEchoArchive(user.uid).then((rows) => {
      const map = {};
      rows.forEach((row) => { if (row.message?.id) map[row.message.id] = row.archiveId; });
      setBookmarkedIds(map);
    }).catch(() => {});
  }, [user?.uid]);

  useEffect(() => {
    const focusId = new URLSearchParams(location.search || '').get('focus');
    if (!focusId || !messages.length) return;
    const el = msgRefs.current[focusId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [location.search, messages.length]);

  const saveCommunityArchive = async (msg) => {
    try {
      if (bookmarkedIds[msg.id]) {
        await removeEchoArchive(bookmarkedIds[msg.id]);
        await update(ref(db, `communityChats/${communityId}/messages/${msg.id}`), { pinned: null }).catch(() => {});
        setBookmarkedIds((prev) => { const n = { ...prev }; delete n[msg.id]; return n; });
        return;
      }
      const senderProfile = getProfile?.(msg.senderId);
      const result = await saveToEchoArchive(user.uid, {
        ...msg,
        senderName: senderProfile?.name || msg.senderName || 'User',
        senderAvatar: senderProfile?.avatar || '',
      }, { chatId: communityId, source: 'community', communityId, senderName: senderProfile?.name, senderAvatar: senderProfile?.avatar });
      if (result?.ok !== false) {
        await update(ref(db, `communityChats/${communityId}/messages/${msg.id}`), { pinned: true }).catch(() => {});
        const rows = await listEchoArchive(user.uid);
        const map = {};
        rows.forEach((row) => { if (row.message?.id) map[row.message.id] = row.archiveId; });
        setBookmarkedIds(map);
      }
    } catch (_) {}
  };

  const renderMessage = (msg) => {
    if (isTideExpired(msg) && !msg.pinned && !bookmarkedIds[msg.id]) return null;
    const isOwn = msg.senderId === user?.uid;
    const isSystem = msg.type === 'system' || msg.system === true;
    const isDeleting = msg.id === deletingMessageId;
    const senderProfile = getProfile?.(msg.senderId);
    const senderName =
      senderProfile?.name || msg.senderName || (isOwn ? userName : 'User');
    const senderAvatar = senderProfile?.avatar || '';

    if (isSystem) {
      return (
        <div className="message-bubble system" key={msg.id}>
          {msg.text}
        </div>
      );
    }

    const replyToDisplay = msg.replyTo
      ? { ...msg.replyTo, senderName: msg.replyTo.senderName || 'User' }
      : null;

    const showReply = true;
    const allowDelete = isOwn;
    const copyText =
      msg.type === 'media'
        ? msg.mediaUrl || msg.caption || ''
        : msg.text || '';
    const reactions = msg.reactions || {};

    return (
      <div
        key={msg.id}
        className={`message-row ${isOwn ? 'own' : 'partner'} ${isDeleting ? 'deleting' : ''} ${Date.now() - (msg.timestamp || 0) < 1600 ? (isOwn ? 'just-sent' : 'just-received') : ''} ${isTideExpired(msg) ? 'tide-leaving' : ''} ${
          highlightId === msg.id ? 'highlight-flash' : ''
        }`}
        ref={(el) => {
          if (el) msgRefs.current[msg.id] = el;
        }}
        style={msg.pending ? { opacity: 0.75 } : undefined}
      >
        {!isOwn && (
          <div className="message-sender-info">
            <button
              type="button"
              className="message-sender-link"
              onClick={() => openUserChat(msg.senderId)}
              title={`Chat with ${senderName}`}
            >
              <Avatar src={senderAvatar} name={senderName} size={24} />
              <span className="message-sender-name">{senderName}</span>
            </button>
          </div>
        )}

        <div className={`message-bubble ${isOwn ? 'own' : 'partner'}`}>
          <MessageMenu
            isOwn={isOwn}
            canDelete={allowDelete}
            onDelete={() => handleDelete(msg)}
            onReply={showReply ? () => handleReply(msg) : null}
            onEdit={null}
            onReact={() => handleReact(msg)}
            onSave={() => saveCommunityArchive(msg)}
            saved={!!bookmarkedIds[msg.id]}
            copyText={copyText}
          >
            {replyToDisplay && (
              <RepliedMessage replyTo={replyToDisplay} onTap={() => jumpToMessage(replyToDisplay.messageId)} />
            )}
            {msg.type === 'media' ? (
              <div className="chat-media-wrapper">
                {msg.mediaType === 'video' ? (
                  <video src={msg.mediaUrl} controls className="chat-media-video" playsInline />
                ) : (
                  <img src={msg.mediaUrl} alt="" className="chat-media-image" />
                )}
                {msg.caption && <div className="chat-media-caption">{msg.caption}</div>}
              </div>
            ) : (
              <div className="message-text">{msg.text}</div>
            )}
          </MessageMenu>
        </div>
        {renderReactions(reactions, msg.id)}
        <div className="message-time">{formatTime(msg.timestamp)}</div>
        {!(msg.pinned || bookmarkedIds[msg.id]) && (
        <span className="echo-tide-chip" title="ECHO Tide">
          <i className="fas fa-water" aria-hidden="true" />
          {formatTideLeft({ ...msg, expiresAt: msg.expiresAt || (Number(msg.timestamp) || Date.now()) + COMMUNITY_TTL_MS })}
        </span>
        )}
      </div>
    );
  };

  // ─── Chat render function ──────────────────────────────────────
  const renderChat = () => (
    <div className="community-chat-panel">
      <div
        className="messages-container"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {loading && messages.length === 0 ? (
          <div className="empty-chat-state">
            <div className="loading-spinner" />
            <p>Loading messages…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-chat-state">
            <i className="fas fa-comments empty-icon" />
            <p>Be the first to chat in this community!</p>
            <span className="empty-sub">Say hello and start the conversation 👋</span>
          </div>
        ) : (
          <>
            {sortMessages(messages).map((msg) => renderMessage(msg))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <form className="chat-input-container" onSubmit={handleSend} ref={inputContainerRef}>
        {membershipLoading ? (
          <div className="chat-input" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            Checking membership…
          </div>
        ) : !isMember ? (
          <button
            type="button"
            className="chat-send-btn wide"
            onClick={() => navigate('/communities')}
          >
            Join to chat
          </button>
        ) : (
          <>
            {replyTo && (
              <ReplyPreview replyTo={replyTo} onCancel={() => setReplyTo(null)} />
            )}
            <div className="chat-input-row">
              <button
                type="button"
                className="chat-emoji-btn"
                onClick={() => setShowEmojiPicker((v) => !v)}
                title="Emoji"
              >
                <i className="fas fa-smile" />
              </button>
              <button
                type="button"
                className="chat-attach-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                title="Photo or video"
              >
                <i className="fas fa-paperclip" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <textarea
                ref={inputRef}
                className="chat-input"
                placeholder={`Message #${titleName}...`}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                disabled={sending}
                maxLength={1000}
                rows={1}
              />
              <button
                type="submit"
                className="chat-send-btn"
                disabled={!newMessage.trim() || sending}
                aria-label="Send"
              >
                {sending ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-paper-plane" />}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );

  // ─── Preview overlay for media ──────────────────────────────────
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
            />
            <button
              type="button"
              className="media-preview-emoji-btn"
              onClick={() => setShowCaptionEmoji((v) => !v)}
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

  const titleName = community?.name || 'Community';

  if (!loading && !community) {
    return (
      <div className="community-chat-not-found">
        <h2>Community not found</h2>
        <button type="button" onClick={() => navigate('/communities')}>
          Back to Communities
        </button>
      </div>
    );
  }

  return (
    <>
      <SEO title={`${titleName} – Community Chat`} description={`Chat in ${titleName} on ECHO.`} />
      <StructuredData />

      <div className="community-chat">
        <div className="echo-rings-bg is-active" aria-hidden="true">
          <span className="echo-bg-ring r1" />
          <span className="echo-bg-ring r2" />
          <span className="echo-bg-ring r3" />
        </div>

        <div className="community-content">
          {activeTab === 'wall' && (
            <CommunityWall communityId={communityId} isMember={isMember} />
          )}
          {activeTab === 'chat' && renderChat()}
        </div>

        {showEmojiPicker && (
          <div className="community-emoji-wrap" onMouseDown={(e) => e.preventDefault()}>
            <ChatEmojiPicker
              onClose={() => setShowEmojiPicker(false)}
              onSelect={handleEmojiSelect}
              excludeRefs={[inputContainerRef, captionPreviewRef]}
            />
          </div>
        )}

        {renderPreviewOverlay()}
      </div>

      {showReactionPicker && (
        <div className="reaction-picker-overlay" onClick={closeReactionPicker}>
          <div className="reaction-quick-picker" onClick={(e) => e.stopPropagation()}>
            {REACTION_EMOJIS.map(emoji => (
              <button
                key={emoji}
                className="reaction-emoji-btn"
                onClick={() => handleReactionSelect(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {renderReactionViewer()}
    </>
  );
};

export default CommunityChat;
