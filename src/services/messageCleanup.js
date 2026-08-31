// src/services/messageCleanup.js
import { db } from './firebase';
import { ref, get } from 'firebase/database';
import { getChatMessages, storeChatMessages } from './indexedDBService';

/**
 * Cleans up cached messages for a specific chat by comparing with Firebase.
 * Removes any message IDs that no longer exist in the database.
 * @param {string} chatId - The composite chat ID (sorted UIDs joined by '_')
 * @returns {Promise<number>} Number of messages removed from cache
 */
export const cleanCachedMessagesForChat = async (chatId) => {
  if (!chatId) return 0;

  try {
    // 1. Get cached messages from IndexedDB
    const cachedMessages = await getChatMessages(chatId);
    if (!cachedMessages || cachedMessages.length === 0) return 0;

    // 2. Get all message IDs from Firebase
    const messagesRef = ref(db, `chats/${chatId}/messages`);
    const snapshot = await get(messagesRef);
    const firebaseData = snapshot.val();

    if (!firebaseData) {
      // If Firebase has no messages, clear the entire cache
      await storeChatMessages(chatId, []);
      console.log(`🧹 Cleared all cached messages for ${chatId} (none in Firebase)`);
      return cachedMessages.length;
    }

    const firebaseIds = new Set(Object.keys(firebaseData));

    // 3. Filter out cached messages whose IDs are not in Firebase
    const filteredMessages = cachedMessages.filter(msg => firebaseIds.has(msg.id));
    const removedCount = cachedMessages.length - filteredMessages.length;

    if (removedCount > 0) {
      // Save the filtered list back to IndexedDB
      await storeChatMessages(chatId, filteredMessages);
      console.log(`🧹 Removed ${removedCount} stale messages from cache for ${chatId}`);
    }

    return removedCount;
  } catch (err) {
    console.warn(`⚠️ Failed to clean messages for ${chatId}:`, err.message);
    return 0;
  }
};

/**
 * Cleans cached messages for all chats that the user is involved in.
 * @param {string} uid - The user's UID
 * @param {Array} chatList - The user's chat list (from userChats)
 * @returns {Promise<number>} Total messages removed across all chats
 */
export const cleanAllCachedMessages = async (uid, chatList) => {
  if (!uid || !chatList || chatList.length === 0) return 0;

  let totalRemoved = 0;
  for (const chat of chatList) {
    const chatId = [uid, chat.id].sort().join('_');
    const removed = await cleanCachedMessagesForChat(chatId);
    totalRemoved += removed;
  }
  return totalRemoved;
};