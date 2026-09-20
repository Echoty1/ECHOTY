// src/services/receiptService.js
import { db } from './firebase';
import { ref, update, get, query, orderByChild, endAt } from 'firebase/database';

/**
 * Mark a specific message as read by this user.
 */
export const markMessageRead = async (chatId, messageId) => {
  if (!chatId || !messageId) return;
  try {
    await update(ref(db, `messages/${chatId}/${messageId}`), {
      readAt: Date.now(),
    });
  } catch (err) {
    console.warn('mark read failed', err);
  }
};

/**
 * Mark ALL messages in a chat as read that were sent TO this user.
 */
export const markAllRead = async (chatId, myUid) => {
  if (!chatId || !myUid) return;
  try {
    const msgsRef = ref(db, `messages/${chatId}`);
    const snap = await get(msgsRef);
    if (!snap.exists()) return;
    const updates = {};
    const now = Date.now();
    snap.forEach((child) => {
      const m = child.val();
      // Only mark incoming messages as read
      if (m.receiverId === myUid && !m.readAt) {
        updates[`messages/${chatId}/${child.key}/readAt`] = now;
      }
    });
    if (Object.keys(updates).length > 0) {
      await update(ref(db), updates);
    }
  } catch (err) {
    console.warn('mark all read failed', err);
  }
};

/**
 * Get an icon for a message based on its state.
 *   - sent      → ✓
 *   - delivered → ✓✓
 *   - read      → ✓✓ (blue)
 */
export const getReceiptStatus = (message) => {
  if (!message) return 'sent';
  if (message.readAt) return 'read';
  if (message.deliveredAt) return 'delivered';
  return 'sent';
};