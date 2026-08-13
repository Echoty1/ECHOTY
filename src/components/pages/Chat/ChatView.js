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
  serverTimestamp,
  runTransaction,
} from 'firebase/database';
import { useAuth } from '../../../hooks/useAuth';
import { SkeletonMessage } from '../../common/SkeletonLoader';
import { getCache, setCache } from '../../../services/cacheService';
import { clearMessageCache } from '../../../services/messageCache';
import ChatMediaMessage from './ChatMediaMessage';
import './ChatView.css';

const ECHO_AI_AVATAR = '/videos/library/Artificial Intelligence Ai GIF by Abdi Slick.gif';

// ─── Cloudinary Configuration ────────────────────────────────────
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

  const messagesEndRef = useRef(null);
  const chatId = useRef(null);

  const cacheKey = `messages_${user?.uid}_${userId}`;
  const isMounted = useRef(true);

  // ─── Helper: Mark all messages as read for this chat ──────
  const markMessagesAsRead = async () => {
    if (!user?.uid || !userId || isEchoAi) return;
    const cId = [user.uid, userId].sort().join('_');

    try {
      // 1. Mark all messages as read
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

      // 2. Reset unreadCount and update lastMessage in userChats
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
    } catch (err) {
      console.warn('markMessagesAsRead error:', err);
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
      setCache(cacheKey, newMessages);
      clearMessageCache(cId);

      // Auto‑mark read for incoming messages if we are the receiver
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

  // ─── Mark as read on mount and when userId changes ──────────
  useEffect(() => {
    if (!user?.uid || !userId || isEchoAi) return;
    markMessagesAsRead();
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    // ── 1. Optimistic message (local) ──
    const tempId = `temp_${Date.now()}`;
    const mediaType = selectedFile.type.startsWith('video/') ? 'video' : 'image';
    const mediaIcon = mediaType === 'video' ? '🎬 Video' : '📷 Image';
    const optimisticMsg = {
      id: tempId,
      senderId: user.uid,
      receiverId: userId,
      type: 'media',
      mediaType,
      mediaUrl: previewUrl,
      caption: captionText.trim(),
      timestamp: Date.now(),
      isRead: false,
      isUploading: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    // ── Close preview overlay immediately ──
    setPreviewUrl(null);
    setSelectedFile(null);
    setCaptionText('');

    try {
      // ── 2. Upload to Cloudinary ──
      const downloadURL = await uploadToCloudinary(selectedFile, (progress) => {
        setUploadProgress(progress);
      });

      // ── 3. Write to database with real URL ──
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
      await set(newMsgRef, realMsg);

      // Update optimistic message with real data
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...realMsg, id: newMsgRef.key, isUploading: false }
            : m
        )
      );

      // Update userChats with media icon
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
          currentData.partnerName = currentUserProfile?.name || currentData.partnerName || 'User';
          currentData.partnerAvatar = currentUserProfile?.avatar || currentData.partnerAvatar || '';
          return currentData;
        }
      });

      // Clear cache
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
      setTimeout(() => {
        const aiMsg = {
          id: (Date.now() + 1).toString(),
          senderId: 'echo_ai_assistant',
          text: 'I am currently under Production',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      }, 600);
      return;
    }

    try {
      const cId = [user.uid, userId].sort().join('_');
      const timestamp = Date.now();

      const messagesRef = ref(db, `chats/${cId}/messages`);
      const newMsgRef = push(messagesRef);
      await set(newMsgRef, {
        senderId: user.uid,
        receiverId: userId,
        type: 'text',
        text: textToSend,
        timestamp: serverTimestamp(),
        isRead: false,
      });

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
          currentData.partnerName = currentUserProfile?.name || currentData.partnerName || 'User';
          currentData.partnerAvatar = currentUserProfile?.avatar || currentData.partnerAvatar || '';
          return currentData;
        }
      });
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

    if (msg.type === 'media') {
      return (
        <div className={`message-bubble ${isOwn ? 'own' : 'partner'}`}>
          {msg.isUploading ? (
            <div className="media-upload-loading">
              <div className="upload-spinner">
                <svg className="spinner-ring" viewBox="0 0 50 50">
                  <circle className="spinner-path" cx="25" cy="25" r="20" fill="none" strokeWidth="4" />
                </svg>
                <span className="upload-progress-text">{Math.round(uploadProgress)}%</span>
              </div>
            </div>
          ) : (
            <ChatMediaMessage message={msg} />
          )}
        </div>
      );
    }

    // text message
    return (
      <div className={`message-bubble ${isOwn ? 'own' : 'partner'}`}>
        <div className="message-text">{msg.text}</div>
      </div>
    );
  };

  // ─── Media Preview Overlay (portal) ────────────────────────────
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

      {/* ─── Input Bar ──────────────────────────────────────────── */}
      <form className="chat-input-container" onSubmit={handleSendText}>
        <button
          type="button"
          className="chat-attach-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Attach image or video"
        >
          <i className="fas fa-paperclip" />
        </button>
        <input
          type="text"
          className="chat-input"
          placeholder={`Message ${displayName}...`}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
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
      </form>

      {renderPreviewOverlay()}
    </div>
  );
};

export default ChatView;