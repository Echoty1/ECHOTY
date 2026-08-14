// src/services/messageCache.js
import { ref, get, query, orderByKey, limitToLast } from 'firebase/database';
import { db } from './firebase';

const messageCache = new Map();

export const fetchLatestMessage = async (chatId) => {
  const cached = messageCache.get(chatId);
  if (cached && Date.now() - cached.timestamp < 500) {
    return cached;
  }
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
        timestamp: Date.now(),
      };
      messageCache.set(chatId, result);
      return result;
    }
  } catch (err) {
    console.warn(`⚠️ Could not fetch latest message for ${chatId}:`, err);
  }
  const fallback = { text: 'Start chatting...', senderId: '', type: 'text', mediaType: null, timestamp: Date.now() };
  messageCache.set(chatId, fallback);
  return fallback;
};

export const clearMessageCache = (chatId) => {
  if (chatId) messageCache.delete(chatId);
};