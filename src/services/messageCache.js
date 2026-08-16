// src/services/messageCache.js
import { getMessagesForChat, storeMessage, clearMessagesForChat } from './indexedDBService';
import { ref, get, query, orderByKey, limitToLast } from 'firebase/database';
import { db } from './firebase';

let memoryCache = new Map();

export const fetchLatestMessage = async (chatId) => {
  // Check memory first
  if (memoryCache.has(chatId)) {
    return memoryCache.get(chatId);
  }

  // Check IndexedDB
  const messages = await getMessagesForChat(chatId);
  if (messages.length > 0) {
    const latest = messages[messages.length - 1];
    const result = {
      text: latest.text || 'Start chatting...',
      senderId: latest.senderId || '',
      type: latest.type || 'text',
      mediaType: latest.mediaType || null,
      timestamp: latest.timestamp || Date.now(),
    };
    memoryCache.set(chatId, result);
    return result;
  }

  // Fallback to Firebase
  try {
    const messagesRef = ref(db, `chats/${chatId}/messages`);
    const snapshot = await get(query(messagesRef, orderByKey(), limitToLast(1)));
    if (snapshot.exists()) {
      const data = snapshot.val();
      const [key, msg] = Object.entries(data)[0];
      const result = {
        text: msg.text || 'Start chatting...',
        senderId: msg.senderId || '',
        type: msg.type || 'text',
        mediaType: msg.mediaType || null,
        timestamp: msg.timestamp || Date.now(),
      };
      memoryCache.set(chatId, result);
      return result;
    }
  } catch (err) {
    console.warn(`⚠️ Could not fetch latest message for ${chatId}:`, err);
  }

  const fallback = { text: 'Start chatting...', senderId: '', type: 'text', mediaType: null, timestamp: Date.now() };
  memoryCache.set(chatId, fallback);
  return fallback;
};

export const storeMessageInCache = async (chatId, message) => {
  const msgWithChat = { ...message, chatId };
  await storeMessage(msgWithChat);
  memoryCache.delete(chatId); // invalidate memory cache
};

export const clearMessageCache = async (chatId) => {
  memoryCache.delete(chatId);
  await clearMessagesForChat(chatId);
};