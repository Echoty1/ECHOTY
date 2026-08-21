// src/components/pages/Chat/ChatView.js (with scroll fix v2)
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
import { clearMessageCache, storeMessageInCache } from '../../../services/messageCache';
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
  // Remove trailing slash from base
  base = base.replace(/\/+$/, '');
  // Ensure path starts with a slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
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

  // ─── Cooldown for scroll to prevent multiple triggers ──────
  const scrollCooldownRef = useRef(false);

  const clearUnreadInstantly = () => {
    if (!userId) return;
    sessionStorage.setItem(`chat_read_${userId}`, 'true');
    window.dispatchEvent(new CustomEvent('chat-read', { detail: { userId } }));
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

      const msgs = Object.entries(data).map(([key, val]) => ({ key, ...val }));
      msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
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
      const myChatRef = ref(db, `userChats/${user.uid}/${userId}`);
      await set(myChatRef, {
        id: userId,
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
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    loadingTimerRef.current = setTimeout(() => {
      setMinLoadingTimePassed(true);
    }, 300);
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
        const msgs = Object.entries(data).map(([key, val]) => ({ key, ...val }));
        msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
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
      const myChatRef = ref(db, `userChats/${user.uid}/${userId}`);
      await set(myChatRef, {
        id: userId,
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
      await saveMessagesToCache(cId, newMessages);
      const messagesRef = ref(db, `chats/${cId}/messages`);
      const snapshot = await get(messagesRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const msgs = Object.entries(data).map(([key, val]) => ({ key, ...val }));
        msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        const latest = msgs[msgs.length - 1];
        if (latest && latest.key === messageId) {
          const myChatRef = ref(db, `userChats/${user.uid}/${userId}`);
          await set(myChatRef, {
            id: userId,
            partnerName: partnerProfile?.name || location.state?.userName || 'User',
            partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '',
            lastMessage: newText,
            lastSenderId: user.uid,
            lastUpdated: Date.now(),
            unreadCount: 0,
          });
          const partnerChatRef = ref(db, `userChats/${userId}/${user.uid}`);
          const partnerSnapshot = await get(partnerChatRef);
          if (partnerSnapshot.exists()) {
            const partnerData = partnerSnapshot.val();
            await set(partnerChatRef, {
              ...partnerData,
              lastMessage: newText,
              lastSenderId: user.uid,
              lastUpdated: Date.now(),
            });
          }
        }
      }
      clearMessageCache(cId);
      setEditingMessage(null);
      // Scroll to the edited message if near bottom
      if (isNearBottom && !scrollCooldownRef.current) {
        scrollCooldownRef.current = true;
        setTimeout(() => {
          scrollCooldownRef.current = false;
        }, 500);
        setTimeout(() => scrollToBottom(true), 100);
      }
    } catch (err) {
      console.error('Failed to edit message:', err);
      alert('Failed to edit message. Please try again.');
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
      const updatedMsg = { ...editingMediaMessage, caption: newCaption, isEdited: true };
      await upsertMessageInCache(cId, updatedMsg);
      await saveMessagesToCache(cId, newMessages);
      const messagesRef = ref(db, `chats/${cId}/messages`);
      const snapshot = await get(messagesRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const msgs = Object.entries(data).map(([key, val]) => ({ key, ...val }));
        msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        const latest = msgs[msgs.length - 1];
        if (latest && latest.key === messageId) {
          const mediaIcon = editingMediaMessage.mediaType === 'video' ? '🎬 Video' : '📷 Image';
          const displayText = newCaption ? `${mediaIcon}: ${newCaption}` : mediaIcon;
          const myChatRef = ref(db, `userChats/${user.uid}/${userId}`);
          await set(myChatRef, {
            id: userId,
            partnerName: partnerProfile?.name || location.state?.userName || 'User',
            partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '',
            lastMessage: displayText,
            lastSenderId: user.uid,
            lastUpdated: Date.now(),
            unreadCount: 0,
          });
          const partnerChatRef = ref(db, `userChats/${userId}/${user.uid}`);
          const partnerSnapshot = await get(partnerChatRef);
          if (partnerSnapshot.exists()) {
            const partnerData = partnerSnapshot.val();
            await set(partnerChatRef, {
              ...partnerData,
              lastMessage: displayText,
              lastSenderId: user.uid,
              lastUpdated: Date.now(),
            });
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
    const threshold = 15; // much smaller – only when truly at bottom
    const isNear = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    setIsNearBottom(isNear);
  };

  // ─── Real‑time listener ──────────────────────────────────────
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
        setMessages(cachedMessages);
        setLoadingMessages(false);
        // Initial scroll – always go to bottom when opening chat
        setTimeout(() => scrollToBottom(false), 50);
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
          newMessages = Object.entries(data)
            .map(([id, val]) => ({ id, ...val }))
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        }
        setMessages(newMessages);
        setLoadingMessages(false);

        // ─── Only scroll if near bottom and cooldown not active ──
        if (isNearBottom && !scrollCooldownRef.current) {
          scrollCooldownRef.current = true;
          setTimeout(() => {
            scrollCooldownRef.current = false;
          }, 500);
          setTimeout(() => scrollToBottom(true), 100);
        }

        for (const msg of newMessages) {
          await upsertMessageInCache(cId, msg);
          await saveMessagesToCache(cId, newMessages);
          if (msg.type === 'media' && msg.mediaUrl && msg.mediaUrl.startsWith('http')) {
            cacheMedia(msg.mediaUrl);
          }
        }
        setCache(cacheKey, newMessages).catch(() => {});
        clearMessageCache(cId);
        const hasUnread = newMessages.some(msg => msg.receiverId === user.uid && msg.isRead === false);
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

  // ─── Partner profile loading ──────────────────────────────────
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

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setCaptionText('');
    e.target.value = '';
    setTimeout(() => captionInputRef.current?.focus(), 100);
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
    // No scroll here – will be handled by listener
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
        timestamp: serverTimestamp(),
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
      const myChatRef = ref(db, `userChats/${user.uid}/${userId}`);
      await set(myChatRef, {
        id: userId,
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
    // No scroll here – will be handled by listener
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
        timestamp: serverTimestamp(),
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
      const myChatRef = ref(db, `userChats/${user.uid}/${userId}`);
      await set(myChatRef, {
        id: userId,
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

    let userMessageText = textToSend;
    let currentReply = replyTo;
    if (currentReply && currentReply.originalMessage) {
      const originalText = currentReply.originalMessage.text ||
                        (currentReply.originalMessage.type === 'media' ? '📎 Media' : '');
      userMessageText = `In reply to: "${originalText}"\n\n${textToSend}`;
    }

    setNewMessage('');
    const replyToSave = currentReply;
    setReplyTo(null);

    const cId = [user.uid, userId].sort().join('_');
    const messagesRef = ref(db, `chats/${cId}/messages`);
    const newMsgRef = push(messagesRef);
    const msgData = {
      senderId: user.uid,
      receiverId: userId,
      type: 'text',
      text: textToSend,
      timestamp: serverTimestamp(),
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
    await set(newMsgRef, msgData);

    const myChatRef = ref(db, `userChats/${user.uid}/${userId}`);
    await set(myChatRef, {
      id: userId,
      partnerName: location.state?.userName || partnerProfile?.name || 'User',
      partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '',
      lastMessage: textToSend,
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
    // No scroll here – listener will handle it
  };

  const displayName = sanitizeName(location.state?.userName || partnerProfile?.name, userId);

  const renderMessage = (msg) => {
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

    if (msg.type === 'echomoji') {
      const skinObj = msg.skinId ? getSkinById(msg.skinId) : null;
      return (
        <div
          className={`message-bubble ${isOwn ? 'own' : 'partner'} ${isDeleting ? 'deleting' : ''}`}
          ref={(el) => { if (el) messageRefs.current[msg.id] = el; }}
        >
          <MessageMenu
            isOwn={isOwn}
            canDelete={allowDelete}
            onDelete={() => handleDeleteMessage(msg.id)}
            onReply={showReply ? () => handleReply(msg) : null}
            onEdit={null}
            copyText={null}
          >
            {replyToDisplay && (
              <RepliedMessage replyTo={replyToDisplay} onTap={() => scrollToMessage(replyToDisplay.messageId)} />
            )}
            <ECHOMOJI mood={msg.mood || 'neutral'} skin={skinObj} size={56} interactive={false} animated={true} />
          </MessageMenu>
        </div>
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
        } else {
          content = <AudioPlayer src={msg.mediaUrl} />;
        }
      } else {
        content = <ChatMediaMessage message={msg} isUploading={msg.isUploading} uploadProgress={msg.uploadProgress} />;
      }
      return (
        <div
          className={`message-bubble ${isOwn ? 'own' : 'partner'} ${isDeleting ? 'deleting' : ''}`}
          ref={(el) => { if (el) messageRefs.current[msg.id] = el; }}
        >
          <MessageMenu
            isOwn={isOwn}
            canDelete={allowDelete}
            onDelete={() => handleDeleteMessage(msg.id)}
            onReply={showReply ? () => handleReply(msg) : null}
            onEdit={allowEdit ? () => handleEditMessage(msg) : null}
            copyText={null}
          >
            {replyToDisplay && (
              <RepliedMessage replyTo={replyToDisplay} onTap={() => scrollToMessage(replyToDisplay.messageId)} />
            )}
            {content}
          </MessageMenu>
        </div>
      );
    }

    const messageContent = (
      <div className="message-text" style={{ whiteSpace: 'pre-wrap' }}>
        {msg.text}
        {msg.isEdited && <span className="message-edited-badge">(edited)</span>}
      </div>
    );

    return (
      <div
        className={`message-bubble ${isOwn ? 'own' : 'partner'} ${isDeleting ? 'deleting' : ''}`}
        ref={(el) => { if (el) messageRefs.current[msg.id] = el; }}
      >
        <MessageMenu
          isOwn={isOwn}
          canDelete={allowDelete}
          onDelete={() => handleDeleteMessage(msg.id)}
          onReply={showReply ? () => handleReply(msg) : null}
          onEdit={allowEdit ? () => handleEditMessage(msg) : null}
          copyText={copyText}
        >
          {replyToDisplay && (
            <RepliedMessage replyTo={replyToDisplay} onTap={() => scrollToMessage(replyToDisplay.messageId)} />
          )}
          {messageContent}
        </MessageMenu>
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText(e);
    }
  };

  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [newMessage]);

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
              messages.map((msg) => <React.Fragment key={msg.id}>{renderMessage(msg)}</React.Fragment>)
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
              className="chat-attach-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Attach image or video"
            >
              <i className="fas fa-paperclip" />
            </button>
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
                color: 'var(--text-primary)',  // ✅ changed from '#fff'
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={() => { focusedField.current = 'main'; }}
              onBlur={() => { /* keep last known focus */ }}
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
      </div>
    </>
  );
};

export default ChatView;