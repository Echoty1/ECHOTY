// src/components/pages/Chat/EchoAI.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../../services/firebase';
import {
  ref,
  onValue,
  push,
  set,
  update,
  get,
  remove,
  serverTimestamp,
} from 'firebase/database';
import { useAuth } from '../../../hooks/useAuth';
import { sortMessages } from '../../../utils/sortMessages';
import { SkeletonMessage } from '../../common/SkeletonLoader';
import { getCache, setCache } from '../../../services/cacheService';
import { clearMessageCache } from '../../../services/messageCache';
import ChatMediaMessage from './ChatMediaMessage';
import AudioPlayer from './AudioPlayer';
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
import {
  loadMessagesFromCache,
  upsertMessageInCache,
  deleteMessageFromCache,
  saveMessagesToCache,
} from '../../../services/messageStorage';
import { cacheMedia } from '../../../utils/mediaCache';
import { cleanCachedMessagesForChat } from '../../../services/messageCleanup';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Toast from '../../Toast/Toast';
import { apiUrl } from '../../../utils/api';
import './ChatView.css';
import './ChatThinking.css';
import './EchoAI.css';

const ECHO_AI_AVATAR = '/videos/library/Artificial Intelligence Ai GIF by Abdi Slick.gif';
const ECHO_AI_ID = 'echo_ai_assistant';

const SUGGESTIONS = [
  { icon: 'fa-lightbulb', text: 'Tell me about ECHO' },
  { icon: 'fa-pen-fancy', text: 'Help me write something' },
  { icon: 'fa-code', text: 'Explain a code concept' },
  { icon: 'fa-face-smile', text: 'Tell me a joke' },
];

const postChat = async (payload, signal) => {
  const token = await auth.currentUser?.getIdToken?.();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = apiUrl('/api/chat');
  console.log('[ECHO AI] POST', url, { hasToken: !!token, payload });

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal,
  });

  // Log status + body so we can debug from the browser console
  const cloned = response.clone();
  cloned
    .text()
    .then((body) => {
      console.log('[ECHO AI] Response status:', response.status, 'body:', body);
    })
    .catch(() => {});

  return response;
};

const EchoAI = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = ECHO_AI_ID;

  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [partnerProfile, setPartnerProfile] = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [toast, setToast] = useState(null);
  const [pendingRetryText, setPendingRetryText] = useState(null);
  const [lastError, setLastError] = useState(null);

  const abortRef = useRef(null);

  const streamingRef = useRef({
    active: false,
    messageId: null,
    fullText: '',
    currentIndex: 0,
    interval: null,
  });

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const chatId = useRef(null);
  const hasLoadedFromCache = useRef(false);
  const cacheKey = `messages_${user?.uid}_${userId}`;
  const isMounted = useRef(true);
  const [replyTo, setReplyTo] = useState(null);
  const messageRefs = useRef({});
  const markReadTimeout = useRef(null);

  const scrollCooldownRef = useRef(false);

  const inputRef = useRef(null);
  const inputContainerRef = useRef(null);
  const captionPreviewRef = useRef(null);
  const captionInputRef = useRef(null);
  const focusedField = useRef('main');
  const [captionText, setCaptionText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editingMediaMessage, setEditingMediaMessage] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Clear AI memory ──────────────────────────────────────────
  const clearAIMemory = async (conversationId) => {
    if (!conversationId) return;
    try {
      await remove(ref(db, `aiConversations/${conversationId}`));
    } catch (err) {
      console.warn('Failed to clear AI memory:', err);
    }
  };

  // ─── Delete AI conversation ──────────────────────────────────
  const deleteAIConversation = async (userMessageId, aiMessageId, conversationId) => {
    if (!user?.uid) return;
    const cId = [user.uid, userId].sort().join('_');

    if (userMessageId) {
      await remove(ref(db, `chats/${cId}/messages/${userMessageId}`));
      await deleteMessageFromCache(cId, userMessageId);
    }
    if (aiMessageId) {
      await remove(ref(db, `chats/${cId}/messages/${aiMessageId}`));
      await deleteMessageFromCache(cId, aiMessageId);
    }
    if (conversationId) {
      await clearAIMemory(conversationId);
    }

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
    }

    await set(ref(db, `userChats/${user.uid}/${userId}`), {
      id: userId,
      partnerName: 'ECHO AI',
      partnerAvatar: ECHO_AI_AVATAR,
      lastMessage: latestMsg,
      lastSenderId: latestSender,
      lastUpdated: latestTimestamp,
      unreadCount: 0,
    });

    clearMessageCache(cId);
    await cleanCachedMessagesForChat(cId);
  };

  // ─── Delete message ──────────────────────────────────────────
  const handleDeleteMessage = async (messageId) => {
    if (!user?.uid) return;
    const cId = [user.uid, userId].sort().join('_');
    setDeletingMessageId(messageId);
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      const msgToDelete = messages.find((m) => m.id === messageId);
      if (!msgToDelete) return;

      if (msgToDelete.senderId === ECHO_AI_ID) {
        const userMsg = messages.find((m) => m.id === msgToDelete.replyTo?.messageId);
        await deleteAIConversation(userMsg?.id, messageId, currentConversationId);
      } else if (msgToDelete.senderId === user.uid) {
        const aiResponse = messages.find(
          (m) => m.senderId === ECHO_AI_ID && m.replyTo === messageId
        );
        await deleteAIConversation(messageId, aiResponse?.id, currentConversationId);
      }
      setDeletingMessageId(null);
    } catch (err) {
      console.warn('Delete failed:', err.message);
      setDeletingMessageId(null);
    }
  };

  // ─── Edit message (restricted to last user message) ──────────
  const handleEditMessage = (msg) => {
    if (msg.senderId !== user?.uid) return;

    const userMessages = messages.filter((m) => m.senderId === user.uid);
    const lastUserMsg = userMessages[userMessages.length - 1];
    if (lastUserMsg && lastUserMsg.id !== msg.id) {
      showToast('You can only edit the last message you sent.', 'info');
      return;
    }

    if (msg.type === 'media' && msg.mediaType === 'audio') return;
    if (msg.type === 'media') {
      setEditingMediaMessage(msg);
      return;
    }
    setEditingMessage(msg);
  };

  const saveEditedMessage = async (newText) => {
    if (!editingMessage || !user?.uid) return;
    const cId = [user.uid, userId].sort().join('_');
    const messageId = editingMessage.id;

    try {
      const aiResponse = messages.find(
        (m) => m.senderId === ECHO_AI_ID && m.replyTo === messageId
      );
      if (aiResponse) {
        await remove(ref(db, `chats/${cId}/messages/${aiResponse.id}`));
        await deleteMessageFromCache(cId, aiResponse.id);
      }
      if (currentConversationId) {
        await clearAIMemory(currentConversationId);
      }
      await update(ref(db, `chats/${cId}/messages/${messageId}`), {
        text: newText,
        isEdited: true,
        lastEditedAt: serverTimestamp(),
      });
      const updatedMsg = { ...editingMessage, text: newText, isEdited: true };
      await upsertMessageInCache(cId, updatedMsg);

      const response = await postChat({
        message: newText,
        userId: user.uid,
        conversationId: currentConversationId,
        isEdit: true,
        editMessageId: messageId,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'AI request failed');
      if (result.conversationId) setCurrentConversationId(result.conversationId);

      clearMessageCache(cId);
      setEditingMessage(null);
      if (isNearBottom && !scrollCooldownRef.current) {
        scrollCooldownRef.current = true;
        setTimeout(() => {
          scrollCooldownRef.current = false;
        }, 500);
        setTimeout(() => scrollToBottom(true), 100);
      }
    } catch (err) {
      console.error('Failed to edit message:', err);
      showToast('Failed to edit message. Please try again.', 'error');
    }
  };

  const saveMediaCaption = async (newCaption) => {
    if (!editingMediaMessage || !user?.uid) return;
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
      clearMessageCache(cId);
      setEditingMediaMessage(null);
    } catch (err) {
      console.error('Failed to edit media caption:', err);
      showToast('Failed to edit caption. Please try again.', 'error');
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
    const threshold = 15;
    const isNear =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    setIsNearBottom(isNear);
  };

  // ─── Adaptive word-by-word streaming ─────────────────────────
  const startStreaming = (messageId, fullText) => {
    if (streamingRef.current.interval) {
      clearInterval(streamingRef.current.interval);
      streamingRef.current.interval = null;
    }

    streamingRef.current.active = true;
    streamingRef.current.messageId = messageId;
    streamingRef.current.fullText = fullText;
    streamingRef.current.currentIndex = 0;

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? { ...msg, _streamingText: '', _isStreaming: true, _fullText: fullText }
          : msg
      )
    );

    const len = Math.max(1, fullText.length);
    const stepSize = Math.max(1, Math.ceil(len / 100));
    const tickMs = 25;

    const interval = setInterval(() => {
      if (!isMounted.current) {
        clearInterval(interval);
        return;
      }
      const { currentIndex, fullText: full, messageId: streamMsgId } = streamingRef.current;
      const nextIndex = Math.min(full.length, currentIndex + stepSize);
      const newText = full.slice(0, nextIndex);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === streamMsgId ? { ...msg, _streamingText: newText, _isStreaming: true } : msg
        )
      );

      if (isNearBottom && !scrollCooldownRef.current) {
        scrollCooldownRef.current = true;
        setTimeout(() => {
          scrollCooldownRef.current = false;
        }, 500);
        setTimeout(() => scrollToBottom(true), 50);
      }
      streamingRef.current.currentIndex = nextIndex;

      if (nextIndex >= full.length) {
        clearInterval(interval);
        streamingRef.current.interval = null;
        streamingRef.current.active = false;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === streamMsgId
              ? { ...msg, _streamingText: full, _isStreaming: false }
              : msg
          )
        );
        if (isNearBottom) setTimeout(() => scrollToBottom(true), 50);
      }
    }, tickMs);

    streamingRef.current.interval = interval;
  };

  const stopStreaming = () => {
    if (streamingRef.current.interval) {
      clearInterval(streamingRef.current.interval);
      streamingRef.current.interval = null;
    }
    streamingRef.current.active = false;
    if (streamingRef.current.messageId) {
      const id = streamingRef.current.messageId;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === id
            ? {
                ...msg,
                _streamingText: streamingRef.current.fullText,
                _isStreaming: false,
              }
            : msg
        )
      );
    }
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch (_) {}
      abortRef.current = null;
    }
    setIsAILoading(false);
  };

  // ─── Real-time listener ──────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) {
      setLoadingMessages(false);
      return;
    }
    isMounted.current = true;
    const cId = [user.uid, userId].sort().join('_');
    chatId.current = cId;

    loadMessagesFromCache(cId).then((cachedMessages) => {
      if (isMounted.current) {
        hasLoadedFromCache.current = true;
        if (cachedMessages.length > 0) setMessages(cachedMessages);
        setLoadingMessages(false);
        if (cachedMessages.length > 0) {
          setTimeout(() => scrollToBottom(false), 50);
        }
      }
    });

    const messagesRef = ref(db, `chats/${cId}/messages`);
    const unsubscribe = onValue(
      messagesRef,
      async (snapshot) => {
        if (!isMounted.current) return;
        const data = snapshot.val();
        if (!data) {
          setLoadingMessages(false);
          return;
        }
        const newMessages = Object.entries(data)
          .map(([id, val]) => ({ id, ...val }))
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        setMessages((prev) => {
          const prevMap = new Map(prev.map((m) => [m.id, m]));
          return newMessages.map((msg) => {
            const existing = prevMap.get(msg.id);
            if (existing && existing._isStreaming) {
              return {
                ...msg,
                _streamingText: existing._streamingText,
                _isStreaming: true,
                _fullText: existing._fullText,
              };
            }
            return { ...msg, _streamingText: msg.text || '', _isStreaming: false };
          });
        });
        setLoadingMessages(false);

        const prevMessages = messages;
        const newAIMessages = newMessages.filter(
          (msg) =>
            msg.senderId === ECHO_AI_ID && !prevMessages.some((p) => p.id === msg.id)
        );
        if (newAIMessages.length > 0) {
          setIsAILoading(false);
          setPendingRetryText(null);
          setLastError(null);
          newAIMessages.forEach((aiMsg) => {
            if (aiMsg.text && !streamingRef.current.active) {
              if (streamingRef.current.interval) {
                clearInterval(streamingRef.current.interval);
                streamingRef.current.interval = null;
              }
              startStreaming(aiMsg.id, aiMsg.text);
            }
          });
        }

        if (isNearBottom && !scrollCooldownRef.current && !streamingRef.current.active) {
          scrollCooldownRef.current = true;
          setTimeout(() => {
            scrollCooldownRef.current = false;
          }, 500);
          setTimeout(() => scrollToBottom(true), 100);
        }

        await clearMessageCache(cId);
        for (const msg of newMessages) {
          await upsertMessageInCache(cId, msg);
          if (msg.type === 'media' && msg.mediaUrl && msg.mediaUrl.startsWith('http')) {
            cacheMedia(msg.mediaUrl);
          }
        }
        await saveMessagesToCache(cId, newMessages);
        setCache(cacheKey, newMessages).catch(() => {});
      },
      (error) => {
        console.error('❌ [EchoAI] Firebase listener error:', error);
        setLoadingMessages(false);
        setIsAILoading(false);
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
      if (streamingRef.current.interval) {
        clearInterval(streamingRef.current.interval);
        streamingRef.current.interval = null;
      }
    };
  }, [user?.uid, cacheKey, isNearBottom]);

  useEffect(() => {
    setPartnerProfile({
      name: 'ECHO AI',
      avatar: ECHO_AI_AVATAR,
      mood: 'happy',
      isAi: true,
    });
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const myProfileRef = ref(db, `profiles/${user.uid}`);
    get(myProfileRef)
      .then((snap) => {
        if (snap.exists()) setCurrentUserProfile(snap.val());
      })
      .catch(console.error);
  }, [user?.uid]);

  const handleAttachClick = () => {
    showToast('📎 Images and videos are not supported in AI chat yet.', 'info');
  };
  const handleVoiceClick = () => {
    showToast('🎤 Voice notes are not supported in AI chat yet.', 'info');
  };

  // ─── Send text message ──────────────────────────────────────
  const handleSendText = async (e, overrideText = null) => {
    e?.preventDefault?.();
    const rawText = overrideText != null ? overrideText : newMessage;
    const textToSend = String(rawText).trim();
    if (!textToSend || !user?.uid) return;

    let userMessageText = textToSend;
    const currentReply = replyTo;
    if (currentReply && currentReply.originalMessage) {
      const originalText =
        currentReply.originalMessage.text ||
        (currentReply.originalMessage.type === 'media' ? '📎 Media' : '');
      userMessageText = `In reply to: "${originalText}"\n\n${textToSend}`;
    }

    setNewMessage('');
    const replyToSave = currentReply;
    setReplyTo(null);
    setPendingRetryText(null);
    setLastError(null);

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

    await set(ref(db, `userChats/${user.uid}/${userId}`), {
      id: userId,
      partnerName: 'ECHO AI',
      partnerAvatar: ECHO_AI_AVATAR,
      lastMessage: textToSend,
      lastSenderId: user.uid,
      lastUpdated: Date.now(),
      unreadCount: 0,
    });

    setIsAILoading(true);
    if (isNearBottom && !scrollCooldownRef.current) {
      scrollCooldownRef.current = true;
      setTimeout(() => {
        scrollCooldownRef.current = false;
      }, 500);
      setTimeout(() => scrollToBottom(true), 50);
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await postChat(
        {
          message: userMessageText,
          userId: user.uid,
          conversationId: currentConversationId,
        },
        controller.signal
      );

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(
          `Server returned non-JSON (${response.status}): ${text.substring(0, 120)}`
        );
      }

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Request failed (${response.status})`);
      }
      if (result.conversationId) setCurrentConversationId(result.conversationId);
      setIsAILoading(false);
    } catch (err) {
      if (err.name === 'AbortError') {
        setIsAILoading(false);
        return;
      }
      console.error('AI error:', err);
      setIsAILoading(false);
      setPendingRetryText(textToSend);

      setLastError({
        message:
          'ECHO AI could not reply right now. Check your connection and try again.',
        detail: err?.message || null,
      });
    } finally {
      abortRef.current = null;
    }
  };

  const handleRetry = () => {
    if (!pendingRetryText) return;
    setLastError(null);
    handleSendText(null, pendingRetryText);
  };

  const handleRegenerate = (aiMsgId) => {
    const aiMsg = messages.find((m) => m.id === aiMsgId);
    if (!aiMsg) return;
    const userMsg = messages.find((m) => m.id === aiMsg.replyTo?.messageId);
    if (!userMsg) return;
    handleSendText(null, userMsg.text);
  };

  const handleCopyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied', 'success');
    } catch (_) {
      showToast('Copy failed', 'error');
    }
  };

  // ─── Render message ──────────────────────────────────────────
  const renderMessage = (msg, isLastAIMessage) => {
    const isOwn = msg.senderId === user?.uid;
    const isDeleting = msg.id === deletingMessageId;
    const isAi = msg.senderId === ECHO_AI_ID;
    const replyToDisplay = msg.replyTo
      ? { ...msg.replyTo, senderName: msg.replyTo.senderName || 'User' }
      : null;

    let allowEdit = false;
    if (isOwn) {
      const userMessages = messages.filter((m) => m.senderId === user.uid);
      const lastUserMsg = userMessages[userMessages.length - 1];
      if (lastUserMsg && lastUserMsg.id === msg.id) {
        if (msg.type === 'text' || (msg.type === 'media' && msg.mediaType !== 'audio')) {
          allowEdit = true;
        }
      }
    }

    const allowDelete = isOwn || isAi;

    if (msg.type === 'echomoji') {
      const skinObj = msg.skinId ? getSkinById(msg.skinId) : null;
      return (
        <div
          key={msg.id}
          className={`message-bubble ${isOwn ? 'own' : 'partner'} ${isDeleting ? 'deleting' : ''}`}
          ref={(el) => {
            if (el) messageRefs.current[msg.id] = el;
          }}
        >
          <MessageMenu
            isOwn={isOwn}
            canDelete={allowDelete}
            onDelete={() => handleDeleteMessage(msg.id)}
            onReply={null}
            onEdit={null}
            copyText={null}
          >
            {replyToDisplay && <RepliedMessage replyTo={replyToDisplay} onTap={() => {}} />}
            <ECHOMOJI
              mood={msg.mood || 'neutral'}
              skin={skinObj}
              size={56}
              interactive={false}
              animated={true}
            />
          </MessageMenu>
        </div>
      );
    }

    if (msg.type === 'media') {
      let content;
      if (msg.mediaType === 'audio') {
        content = msg.isUploading ? (
          <div className="media-upload-overlay">
            <div className="upload-spinner">
              <svg className="spinner-ring" viewBox="0 0 50 50">
                <circle
                  className="spinner-path"
                  cx="25"
                  cy="25"
                  r="20"
                  fill="none"
                  strokeWidth="4"
                />
              </svg>
            </div>
          </div>
        ) : (
          <AudioPlayer src={msg.mediaUrl} />
        );
      } else {
        content = (
          <ChatMediaMessage
            message={msg}
            isUploading={msg.isUploading}
            uploadProgress={msg.uploadProgress}
          />
        );
      }
      return (
        <div
          key={msg.id}
          className={`message-bubble ${isOwn ? 'own' : 'partner'} ${isDeleting ? 'deleting' : ''}`}
          ref={(el) => {
            if (el) messageRefs.current[msg.id] = el;
          }}
        >
          <MessageMenu
            isOwn={isOwn}
            canDelete={allowDelete}
            onDelete={() => handleDeleteMessage(msg.id)}
            onReply={null}
            onEdit={allowEdit ? () => handleEditMessage(msg) : null}
            copyText={null}
          >
            {replyToDisplay && <RepliedMessage replyTo={replyToDisplay} onTap={() => {}} />}
            {content}
          </MessageMenu>
        </div>
      );
    }

    const displayText =
      msg._isStreaming && msg._streamingText !== undefined
        ? msg._streamingText
        : msg.text || '';

    const messageContent = isAi ? (
      <div className="markdown-body">
        <Markdown remarkPlugins={[remarkGfm]}>{String(displayText).trim()}</Markdown>
        {msg._isStreaming && <span className="echo-ai-cursor" />}
      </div>
    ) : (
      <div className="message-text" style={{ whiteSpace: 'pre-wrap' }}>
        {msg.text}
        {msg.isEdited && <span className="message-edited-badge">(edited)</span>}
      </div>
    );

    return (
      <div
        key={msg.id}
        className={`message-bubble ${isOwn ? 'own' : 'partner'} ${isDeleting ? 'deleting' : ''} ${
          isAi ? 'echo-ai-bubble' : ''
        }`}
        ref={(el) => {
          if (el) messageRefs.current[msg.id] = el;
        }}
      >
        <MessageMenu
          isOwn={isOwn}
          canDelete={allowDelete}
          onDelete={() => handleDeleteMessage(msg.id)}
          onReply={null}
          onEdit={allowEdit ? () => handleEditMessage(msg) : null}
          copyText={isAi ? displayText : null}
        >
          {replyToDisplay && <RepliedMessage replyTo={replyToDisplay} onTap={() => {}} />}
          {messageContent}
        </MessageMenu>

        {isAi && !msg._isStreaming && displayText && (
          <div className="echo-ai-message-actions">
            <button
              type="button"
              className="echo-ai-action-btn"
              onClick={() => handleCopyText(displayText)}
              title="Copy"
              aria-label="Copy response"
            >
              <i className="fas fa-copy" />
            </button>
            {isLastAIMessage && (
              <button
                type="button"
                className="echo-ai-action-btn"
                onClick={() => handleRegenerate(msg.id)}
                title="Regenerate"
                aria-label="Regenerate response"
              >
                <i className="fas fa-rotate-right" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText(e);
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
        e.preventDefault();
        showToast('📎 Pasting images or videos is not supported in AI chat yet.', 'info');
        return;
      }
    }
  };

  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [newMessage]);

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

  const sorted = sortMessages(messages);
  const lastAIMessageId = [...sorted]
    .reverse()
    .find((m) => m.senderId === ECHO_AI_ID)?.id;
  const isFirstOpen = sorted.length === 0;

  return (
    <div className="chat-view echo-ai-chat">
      <VideoAudioProvider>
        <div
          className="messages-container"
          ref={messagesContainerRef}
          onScroll={handleScroll}
        >
          {loadingMessages && messages.length === 0 ? (
            <div className="chat-skeleton-list">
              <SkeletonMessage isOwn={false} />
              <SkeletonMessage isOwn={true} />
              <SkeletonMessage isOwn={false} />
            </div>
          ) : isFirstOpen ? (
            <div className="echo-ai-empty">
              <div className="echo-ai-empty-avatar">
                <img src={ECHO_AI_AVATAR} alt="ECHO AI" />
              </div>
              <h2 className="echo-ai-empty-title">
                Hi{currentUserProfile?.name ? ` ${currentUserProfile.name.split(' ')[0]}` : ''} 👋
              </h2>
              <p className="echo-ai-empty-sub">
                I'm ECHO AI. Ask me anything — I can write, code, brainstorm, and more.
              </p>
              <div className="echo-ai-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.text}
                    type="button"
                    className="echo-ai-chip"
                    onClick={() => handleSendText(null, s.text)}
                  >
                    <i className={`fas ${s.icon}`} />
                    <span>{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            sorted.map((msg) => renderMessage(msg, msg.id === lastAIMessageId))
          )}

          {lastError && (
            <div className="echo-ai-error-row">
              <div className="echo-ai-error-bubble">
                <div className="echo-ai-error-icon">
                  <i className="fas fa-circle-exclamation" />
                </div>
                <div className="echo-ai-error-body">
                  <span className="echo-ai-error-text">{lastError.message}</span>
                  {lastError.detail && (
                    <span className="echo-ai-error-detail">{lastError.detail}</span>
                  )}
                  {pendingRetryText && (
                    <button
                      type="button"
                      className="echo-ai-retry-btn"
                      onClick={handleRetry}
                    >
                      <i className="fas fa-rotate-right" />
                      <span>Retry</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {isAILoading && (
            <div className="message-row partner ai-thinking-row">
              <div className="message-bubble partner ai-thinking">
                <div className="typing-indicator" aria-hidden="true">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span className="ai-thinking-label">ECHO AI is thinking</span>
                <button
                  type="button"
                  className="echo-ai-stop-btn"
                  onClick={stopStreaming}
                  title="Stop"
                >
                  Stop
                </button>
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

      <form
        className="chat-input-container"
        onSubmit={handleSendText}
        ref={inputContainerRef}
      >
        {replyTo && <ReplyPreview replyTo={replyTo} onCancel={() => setReplyTo(null)} />}
        <div className="chat-input-row">
          <button
            type="button"
            className="chat-attach-btn"
            onClick={handleAttachClick}
            title="Attach (coming soon)"
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
            onClick={handleVoiceClick}
            title="Voice (coming soon)"
          >
            <i className="fas fa-microphone" />
          </button>
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="Message ECHO AI..."
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
            onFocus={() => {
              focusedField.current = 'main';
            }}
            onBlur={() => {}}
          />
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*,video/*"
            style={{ display: 'none' }}
            onChange={() => {
              showToast('📎 Images and videos are not supported yet.', 'info');
              fileInputRef.current.value = '';
            }}
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

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default EchoAI;
