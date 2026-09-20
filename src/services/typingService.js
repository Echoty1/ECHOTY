// src/services/typingService.js
import { db } from './firebase';
import { ref, set, remove, onDisconnect, serverTimestamp } from 'firebase/database';

const TYPING_TIMEOUT_MS = 3000;

/**
 * Signal that the user is typing in a chat.
 * Auto-clears after 3s of no updates, and on disconnect.
 */
export const signalTyping = async (chatId, uid) => {
  if (!chatId || !uid) return;
  const typingRef = ref(db, `typing/${chatId}/${uid}`);
  try {
    await set(typingRef, {
      isTyping: true,
      updatedAt: serverTimestamp(),
    });
    // Auto-clean on network drop
    onDisconnect(typingRef).remove();
  } catch (err) {
    console.warn('typing signal failed', err);
  }
};

/**
 * Clear the typing flag manually (when user sends or blurs).
 */
export const clearTyping = async (chatId, uid) => {
  if (!chatId || !uid) return;
  try {
    await remove(ref(db, `typing/${chatId}/${uid}`));
  } catch (err) {
    console.warn('typing clear failed', err);
  }
};

/**
 * Auto-typing controller — call this on every keystroke.
 * It debounces the "stop typing" signal.
 */
let typingTimer = null;
export const handleTypingActivity = (chatId, uid) => {
  if (!chatId || !uid) return;
  signalTyping(chatId, uid);
  if (typingTimer) clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    clearTyping(chatId, uid);
  }, TYPING_TIMEOUT_MS);
};

export const stopTyping = (chatId, uid) => {
  if (typingTimer) clearTimeout(typingTimer);
  clearTyping(chatId, uid);
};