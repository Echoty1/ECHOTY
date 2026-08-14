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
import { VideoAudioProvider } from '../../../contexts/VideoAudioContext';
import './ChatView.css';

const ECHO_AI_AVATAR = '/videos/library/Artificial Intelligence Ai GIF by Abdi Slick.gif';

const CLOUDINARY_CLOUD_NAME = 'rjlscgan';
const CLOUDINARY_UPLOAD_PRESET = 'echo_uploads';

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

const ChatView = () => {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [deletingMessageId, setDeletingMessageId] = useState(null);

  const isEchoAi = userId === 'echo_ai_assistant';

  const [partnerProfile, setPartnerProfile] = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(true);

  // ── Media attachment state ──────────────────────────────────
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [captionText, setCaptionText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const captionInputRef = useRef(null);
  const inputRef = useRef(null);

  // ── Voice recorder state ────────────────────────────────────
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);

  const messagesEndRef = useRef(null);
  const chatId = useRef(null);

  const cacheKey = `messages_${user?.uid}_${userId}`;
  const isMounted = useRef(true);
  const [replyTo, setReplyTo] = useState(null);
  const messageRefs = useRef({});

  // ─── Helper: Mark all messages as read ──────────────────────
  const markMessagesAsRead = async () => {
    if (!user?.uid || !userId || isEchoAi) return;
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

      const msgs = Object.entries(data).map(([key, val]) => ({ key, ...val }));
      msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      const latest = msgs[msgs.length - 1];
      if (latest) {
        if (latest.type === 'media') {
          latestMsg = latest.mediaType === 'video' ? '🎬 Video' : '📷 Image';
        } else {
          latestMsg = latest.text || '';
        }
        latestSender = latest.senderId || '';
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
        partnerName: location.state?.userName || partnerProfile?.name || 'User',
        partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '',
        lastMessage: latestMsg,
        lastSenderId: latestSender,
        lastUpdated: Date.now(),
        unreadCount: 0,
      });

      // Dispatch event to instantly clear unread badge in Chats list
      window.dispatchEvent(new CustomEvent('chat-read', { detail: { userId } }));

      clearMessageCache(cId);
    } catch (err) {
      console.warn('markMessagesAsRead error:', err);
    }
  };

  // ─── Start a reply ──────────────────────────────────────────
  const handleReply = (msg) => {
    if (msg.senderId === user?.uid) return;

    const senderName = partnerProfile?.name || 'User';
    let textSnippet;
    if (msg.type === 'media') {
      if (msg.mediaType === 'video') textSnippet = '🎬 Video';
      else if (msg.mediaType === 'audio') textSnippet = '🎤 Voice note';
      else textSnippet = '📷 Image';
    } else {
      textSnippet = msg.text || 'Message';
    }

    setReplyTo({
      messageId: msg.id,
      senderName: senderName,
      messageType: msg.type || 'text',
      textSnippet: textSnippet,
    });

    // Clear text input when replying (user will type or record)
    setNewMessage('');

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  };

  // ─── Cancel reply ───────────────────────────────────────────
  const cancelReply = () => {
    setReplyTo(null);
  };

  // ─── Scroll to original message ─────────────────────────────
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

  // ─── Delete a message ──────────────────────────────────────
  const handleDeleteMessage = async (messageId) => {
    if (!user?.uid || !userId || isEchoAi) return;

    setDeletingMessageId(messageId);
    await new Promise(resolve => setTimeout(resolve, 300));

    const cId = [user.uid, userId].sort().join('_');

    try {
      await remove(ref(db, `chats/${cId}/messages/${messageId}`));

      const messagesRef = ref(db, `chats/${cId}/messages`);
      const snapshot = await get(messagesRef);
      let latestMsg = '';
      let latestSender = '';
      if (snapshot.exists()) {
        const data = snapshot.val();
        const msgs = Object.entries(data).map(([key, val]) => ({ key, ...val }));
        msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        const latest = msgs[msgs.length - 1];
        if (latest) {
          if (latest.type === 'media') {
            latestMsg = latest.mediaType === 'video' ? '🎬 Video' : '📷 Image';
          } else {
            latestMsg = latest.text || '';
          }
          latestSender = latest.senderId || '';
        }
      }

      const myChatRef = ref(db, `userChats/${user.uid}/${userId}`);
      await set(myChatRef, {
        id: userId,
        partnerName: location.state?.userName || partnerProfile?.name || 'User',
        partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '',
        lastMessage: latestMsg,
        lastSenderId: latestSender,
        lastUpdated: Date.now(),
        unreadCount: 0,
      });

      const partnerChatRef = ref(db, `userChats/${userId}/${user.uid}`);
      const partnerSnapshot = await get(partnerChatRef);
      if (partnerSnapshot.exists()) {
        const partnerData = partnerSnapshot.val();
        await set(partnerChatRef, {
          ...partnerData,
          lastMessage: latestMsg,
          lastSenderId: latestSender,
          lastUpdated: Date.now(),
        });
      }

      clearMessageCache(cId);
    } catch (err) {
      console.error('Failed to delete message:', err);
      alert('Failed to delete message. Please try again.');
    } finally {
      setDeletingMessageId(null);
    }
  };

  // ─── Scroll to bottom ──────────────────────────────────────
  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
    }
  };

  // ─── Real‑time listener for messages ──────────────────────
  useEffect(() => {
    if (!user?.uid || !userId) return;
    isMounted.current = true;

    const cached = getCache(cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      setMessages(cached);
      setLoadingMessages(false);
      setTimeout(() => scrollToBottom(false), 50);
    }

    const cId = [user.uid, userId].sort().join('_');
    chatId.current = cId;
    const messagesRef = ref(db, `chats/${cId}/messages`);

    const unsubscribe = onValue(messagesRef, (snapshot) => {
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
      // Silently cache – ignore quota errors
      try {
        setCache(cacheKey, newMessages);
      } catch (e) {
        // ignore
      }
      clearMessageCache(cId);

      setTimeout(() => scrollToBottom(true), 100);

      const latest = newMessages[newMessages.length - 1];
      if (
        latest &&
        latest.receiverId === user.uid &&
        latest.isRead === false
      ) {
        const msgRef = ref(db, `chats/${cId}/messages/${latest.id}`);
        try {
          const promise = set(msgRef, { ...latest, isRead: true });
          if (promise && typeof promise.then === 'function') {
            promise
              .then(() => {
                const myChatRef = ref(db, `userChats/${user.uid}/${userId}`);
                const mediaIcon = latest.type === 'media'
                  ? (latest.mediaType === 'video' ? '🎬 Video' : '📷 Image')
                  : latest.text || '';
                return set(myChatRef, {
                  id: userId,
                  partnerName: location.state?.userName || partnerProfile?.name || 'User',
                  partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '',
                  lastMessage: mediaIcon,
                  lastSenderId: latest.senderId,
                  lastUpdated: Date.now(),
                  unreadCount: 0,
                });
              })
              .catch((err) => console.warn('Auto‑mark read error:', err));
          }
        } catch (err) {
          console.warn('Auto‑mark read exception:', err);
        }
      }
    });

    return () => {
      isMounted.current = false;
      unsubscribe();
    };
  }, [user?.uid, userId, cacheKey]);

  // ─── Mark as read on mount ──────────────────────────────────
  useEffect(() => {
    if (!user?.uid || !userId || isEchoAi) return;
    markMessagesAsRead().then(() => {
      setTimeout(() => scrollToBottom(false), 100);
    });
  }, [user?.uid, userId, isEchoAi]);

  // ─── Fetch profiles ──────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const myProfileRef = ref(db, `profiles/${user.uid}`);
    get(myProfileRef)
      .then((snap) => {
        if (snap.exists()) setCurrentUserProfile(snap.val());
      })
      .catch(console.error);
  }, [user?.uid]);

  useEffect(() => {
    if (isEchoAi) {
      setPartnerProfile({
        name: 'ECHO AI',
        avatar: ECHO_AI_AVATAR,
        mood: 'happy',
        isAi: true,
      });
      return;
    }
    if (userId) {
      const pRef = ref(db, `profiles/${userId}`);
      get(pRef)
        .then((snap) => {
          if (snap.exists()) setPartnerProfile(snap.val());
        })
        .catch(console.error);
    }
  }, [userId, isEchoAi]);

  // ─── File selection handler ─────────────────────────────────
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

  // ─── Cloudinary Upload ──────────────────────────────────────
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

  // ─── Send media message ─────────────────────────────────────
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
      isMediaReady: false,
    };

    // ── If replying, include reply metadata ──────────────────
    const currentReply = replyTo;
    if (currentReply) {
      optimisticMsg.replyTo = {
        messageId: currentReply.messageId,
        senderName: currentReply.senderName,
        messageType: currentReply.messageType,
        textSnippet: currentReply.textSnippet,
      };
      // Clear reply immediately
      setReplyTo(null);
    }

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom(true), 100);

    setPreviewUrl(null);
    setSelectedFile(null);
    setCaptionText('');

    try {
      const downloadURL = await uploadToCloudinary(selectedFile, (progress) => {
        setUploadProgress(progress);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, uploadProgress: progress } : m
          )
        );
      });

      // Preload the real media
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

      // Write to database
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

      // Update optimistic
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? {
                ...m,
                realUrl: downloadURL,
                mediaUrl: downloadURL,
                isUploading: false,
                uploadProgress: 100,
                isMediaReady: true,
                id: newMsgRef.key,
              }
            : m
        )
      );
      setTimeout(() => scrollToBottom(true), 100);

      URL.revokeObjectURL(blobUrl);

      // Update userChats
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
      alert('Upload failed: ' + (err.message || 'Please try again.'));
    }
  };

  // ─── Send voice note ────────────────────────────────────────
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

    // ── If replying, include reply metadata ──────────────────
    const currentReply = replyTo;
    if (currentReply) {
      optimisticMsg.replyTo = {
        messageId: currentReply.messageId,
        senderName: currentReply.senderName,
        messageType: currentReply.messageType,
        textSnippet: currentReply.textSnippet,
      };
      // Clear reply immediately
      setReplyTo(null);
    }

    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom(true), 100);

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
            prev.map((m) =>
              m.id === tempId ? { ...m, uploadProgress: progress } : m
            )
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

      // Write to database
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

      // Update userChats
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
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Voice upload failed:', err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      alert('Voice note upload failed. Please try again.');
    }
  };

  // ─── Cancel media preview ────────────────────────────────────
  const cancelMediaPreview = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaptionText('');
    setIsUploading(false);
    setUploadProgress(0);
  };

  // ─── Send text message ──────────────────────────────────────
  const handleSendText = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user?.uid || !userId) return;

    const textToSend = newMessage.trim();
    setNewMessage('');

    if (isEchoAi || userId === 'echo_ai_assistant') {
      const userMsg = {
        id: Date.now().toString(),
        senderId: user.uid,
        text: textToSend,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setTimeout(() => scrollToBottom(true), 100);
      setTimeout(() => {
        const aiMsg = {
          id: (Date.now() + 1).toString(),
          senderId: 'echo_ai_assistant',
          text: 'I am currently under Production',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        setTimeout(() => scrollToBottom(true), 100);
      }, 600);
      return;
    }

    try {
      const cId = [user.uid, userId].sort().join('_');
      const timestamp = Date.now();

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

      const currentReply = replyTo;
      if (currentReply) {
        msgData.replyTo = {
          messageId: currentReply.messageId,
          senderName: currentReply.senderName,
          messageType: currentReply.messageType,
          textSnippet: currentReply.textSnippet,
        };
        setReplyTo(null);
      }

      await set(newMsgRef, msgData);

      clearMessageCache(cId);

      const myChatRef = ref(db, `userChats/${user.uid}/${userId}`);
      await set(myChatRef, {
        id: userId,
        partnerName: location.state?.userName || partnerProfile?.name || 'User',
        partnerAvatar: partnerProfile?.avatar || location.state?.userAvatar || '',
        lastMessage: textToSend,
        lastSenderId: user.uid,
        lastUpdated: timestamp,
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
            lastUpdated: timestamp,
            unreadCount: 1,
          };
        } else {
          currentData.unreadCount = (currentData.unreadCount || 0) + 1;
          currentData.lastMessage = textToSend;
          currentData.lastSenderId = user.uid;
          currentData.lastUpdated = timestamp;
          return currentData;
        }
      });
      setTimeout(() => scrollToBottom(true), 100);
    } catch (err) {
      console.error('Failed to send text:', err);
    }
  };

  const displayName = isEchoAi
    ? 'ECHO AI'
    : sanitizeName(location.state?.userName || partnerProfile?.name, userId);

  // ─── Render message bubble ──────────────────────────────────
  const renderMessage = (msg) => {
    const isOwn = msg.senderId === user?.uid;
    const isDeleting = msg.id === deletingMessageId;

    const replyToDisplay = msg.replyTo ? {
      ...msg.replyTo,
      senderName: msg.replyTo.senderName || 'User',
    } : null;

    const showReply = !isOwn && !isEchoAi;

    if (msg.type === 'media') {
      let content;

      // For audio messages, use AudioPlayer (with upload spinner if uploading)
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
        // For images and videos, use ChatMediaMessage (handles upload state internally)
        content = <ChatMediaMessage message={msg} isUploading={msg.isUploading} uploadProgress={msg.uploadProgress} />;
      }

      return (
        <div
          className={`message-bubble ${isOwn ? 'own' : 'partner'} ${isDeleting ? 'deleting' : ''}`}
          ref={(el) => { if (el) messageRefs.current[msg.id] = el; }}
        >
          <MessageMenu
            isOwn={isOwn}
            onDelete={() => handleDeleteMessage(msg.id)}
            onReply={showReply ? () => handleReply(msg) : null}
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
      );
    }

    // text message
    return (
      <div
        className={`message-bubble ${isOwn ? 'own' : 'partner'} ${isDeleting ? 'deleting' : ''}`}
        ref={(el) => { if (el) messageRefs.current[msg.id] = el; }}
      >
        <MessageMenu
          isOwn={isOwn}
          onDelete={() => handleDeleteMessage(msg.id)}
          onReply={showReply ? () => handleReply(msg) : null}
        >
          {replyToDisplay && (
            <RepliedMessage
              replyTo={replyToDisplay}
              onTap={() => scrollToMessage(replyToDisplay.messageId)}
            />
          )}
          <div className="message-text">{msg.text}</div>
        </MessageMenu>
      </div>
    );
  };

  // ─── Media Preview Overlay ────────────────────────────────────
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
          />
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

  return (
    <div className="chat-view">
      <VideoAudioProvider>
        <div className="messages-container">
          {loadingMessages && messages.length === 0 ? (
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
            messages.map((msg) => (
              <React.Fragment key={msg.id}>{renderMessage(msg)}</React.Fragment>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </VideoAudioProvider>

      {/* ─── Input Bar ──────────────────────────────────────────── */}
      <form className="chat-input-container" onSubmit={handleSendText}>
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
            className="chat-voice-btn"
            onClick={() => setShowVoiceRecorder(true)}
            title="Voice note"
          >
            <i className="fas fa-microphone" />
          </button>
          <input
            ref={inputRef}
            type="text"
            className="chat-input"
            placeholder={`Message ${displayName}...`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendText(e);
              }
            }}
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

      {/* ─── Voice Recorder Overlay ─────────────────────────────── */}
      {showVoiceRecorder && (
        <VoiceRecorder
          onSend={handleVoiceSend}
          onCancel={() => setShowVoiceRecorder(false)}
        />
      )}

      {renderPreviewOverlay()}
    </div>
  );
};

export default ChatView;