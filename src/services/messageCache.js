// src/services/messageCache.js
import { ref, get, query, orderByKey, limitToLast } from 'firebase/database';
import { db } from './firebase';

const messageCache = new Map();

/**
 * Fetch the latest message from a chat, with a short cache TTL (2 seconds).
 * Returns { text, senderId, timestamp }
 */
export const fetchLatestMessage = async (chatId) => {
  const cached = messageCache.get(chatId);
  if (cached && Date.now() - cached.timestamp < 2000) {
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
        timestamp: Date.now(),
      };
      messageCache.set(chatId, result);
      return result;
    }
  } catch (err) {
    console.warn(`⚠️ Could not fetch latest message for ${chatId}:`, err);
  }
  const fallback = { text: 'Start chatting...', senderId: '', timestamp: Date.now() };
  messageCache.set(chatId, fallback);
  return fallback;
};

/**
 * Clear the cached latest message for a specific chat.
 * Call this whenever a new message is sent or received.
 */
export const clearMessageCache = (chatId) => {
  if (chatId) messageCache.delete(chatId);
};