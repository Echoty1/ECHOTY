// src/services/messageStorage.js
import { getChatMessages, storeChatMessages } from './indexedDBService';

/**
 * Load all messages for a chat from IndexedDB
 * @param {string} chatId - The composite chat ID (sorted UIDs joined by '_')
 * @returns {Promise<Array>} Array of message objects
 */
export const loadMessagesFromCache = async (chatId) => {
  if (!chatId) return [];
  try {
    const messages = await getChatMessages(chatId);
    return messages || [];
  } catch (err) {
    console.warn('Failed to load cached messages:', err);
    return [];
  }
};

/**
 * Save or update an entire chat's message list in IndexedDB
 * @param {string} chatId
 * @param {Array} messages - Full array of message objects
 */
export const saveMessagesToCache = async (chatId, messages) => {
  if (!chatId) return;
  try {
    // Sort by timestamp to be safe
    const sorted = messages.slice().sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    await storeChatMessages(chatId, sorted);
  } catch (err) {
    console.warn('Failed to save messages to cache:', err);
  }
};

/**
 * Add or update a single message in the cache for a chat
 * (Fetches current list, merges, and saves back)
 * @param {string} chatId
 * @param {Object} message - Message object with at least an `id` property
 */
export const upsertMessageInCache = async (chatId, message) => {
  if (!chatId || !message || !message.id) return;
  try {
    let messages = await getChatMessages(chatId);
    if (!messages) messages = [];
    const index = messages.findIndex(m => m.id === message.id);
    if (index !== -1) {
      // Update existing message (preserve other fields)
      messages[index] = { ...messages[index], ...message };
    } else {
      messages.push(message);
    }
    // Sort by timestamp
    messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    await storeChatMessages(chatId, messages);
  } catch (err) {
    console.warn('Failed to upsert message in cache:', err);
  }
};

/**
 * Delete a message from the cache for a chat
 * @param {string} chatId
 * @param {string} messageId
 */
export const deleteMessageFromCache = async (chatId, messageId) => {
  if (!chatId || !messageId) return;
  try {
    let messages = await getChatMessages(chatId);
    if (!messages) return;
    messages = messages.filter(m => m.id !== messageId);
    await storeChatMessages(chatId, messages);
  } catch (err) {
    console.warn('Failed to delete message from cache:', err);
  }
};

/**
 * Remove all messages for a chat (e.g., when user clears chat)
 * @param {string} chatId
 */
export const clearMessagesCache = async (chatId) => {
  if (!chatId) return;
  try {
    await storeChatMessages(chatId, []);
  } catch (err) {
    console.warn('Failed to clear message cache:', err);
  }
};