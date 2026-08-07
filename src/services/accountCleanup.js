// src/services/accountCleanup.js
import { db } from './firebase';
import { ref, get, remove, update } from 'firebase/database';

export const userExists = async (uid) => {
  if (!uid) return false;
  try {
    const profileRef = ref(db, `profiles/${uid}`);
    const snapshot = await get(profileRef);
    return snapshot.exists();
  } catch (err) {
    console.error('Error checking user existence:', err);
    return false;
  }
};

export const removeChat = async (userId, partnerId) => {
  if (!userId || !partnerId) return;
  try {
    const chatRef = ref(db, `userChats/${userId}/${partnerId}`);
    await remove(chatRef);
    console.log(`🗑️ Removed chat with ${partnerId} for user ${userId}`);
  } catch (err) {
    console.error('Error removing chat:', err);
  }
};

/**
 * Clean deleted chats for a specific user, but skip chats marked as kept.
 */
export const cleanDeletedChats = async (userId) => {
  if (!userId) return 0;
  try {
    const userChatsRef = ref(db, `userChats/${userId}`);
    const snapshot = await get(userChatsRef);
    const data = snapshot.val();
    if (!data) return 0;

    const partnerIds = Object.keys(data);
    let removedCount = 0;

    for (const partnerId of partnerIds) {
      // Skip if the chat is marked as kept (partnerDeleted: true)
      if (data[partnerId]?.partnerDeleted === true) continue;

      const exists = await userExists(partnerId);
      if (!exists) {
        await removeChat(userId, partnerId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`🧹 Cleaned ${removedCount} deleted chats for user ${userId}`);
    }
    return removedCount;
  } catch (err) {
    console.error('Error cleaning deleted chats:', err);
    return 0;
  }
};

/**
 * Global cleanup – skip kept chats (partnerDeleted === true).
 */
export const cleanAllDeletedChats = async () => {
  try {
    const profilesSnap = await get(ref(db, 'profiles'));
    const existingUids = profilesSnap.val() ? Object.keys(profilesSnap.val()) : [];

    if (existingUids.length === 0) {
      console.log('ℹ️ No profiles found, skipping global cleanup.');
      return 0;
    }

    const userChatsSnap = await get(ref(db, 'userChats'));
    const allChats = userChatsSnap.val() || {};

    let removedCount = 0;
    const updates = {};

    for (const [uid, chats] of Object.entries(allChats)) {
      if (!chats) continue;
      for (const [partnerId, chatData] of Object.entries(chats)) {
        // Skip if marked as kept
        if (chatData?.partnerDeleted === true) continue;
        if (!existingUids.includes(partnerId)) {
          updates[`${uid}/${partnerId}`] = null;
          removedCount++;
        }
      }
    }

    if (removedCount > 0) {
      await update(ref(db, 'userChats'), updates);
      console.log(`🌍 Global cleanup: removed ${removedCount} stale chat references.`);
    } else {
      console.log('🌍 Global cleanup: no stale chats found.');
    }
    return removedCount;
  } catch (err) {
    console.error('❌ Global cleanup error:', err);
    return 0;
  }
};

/**
 * Remove all references to a deleted user (used during account deletion).
 * Does NOT skip anything – we want to remove all traces.
 */
export const removeAllReferencesToUser = async (deletedUid) => {
  if (!deletedUid) return 0;
  try {
    const profilesSnap = await get(ref(db, 'profiles'));
    const allUids = profilesSnap.val() ? Object.keys(profilesSnap.val()) : [];

    const updates = {};
    for (const uid of allUids) {
      if (uid === deletedUid) continue;
      updates[`${uid}/${deletedUid}`] = null;
    }

    if (Object.keys(updates).length === 0) return 0;

    await update(ref(db, 'userChats'), updates);
    const removedCount = Object.keys(updates).length;
    console.log(`🗑️ Removed ${removedCount} references to deleted user ${deletedUid}`);
    return removedCount;
  } catch (err) {
    console.error('❌ Error removing references to deleted user:', err);
    return 0;
  }
};

/**
 * Mark a chat as "kept" (read-only) when the partner account is deleted.
 */
export const markChatAsKept = async (userId, partnerId, partnerName) => {
  if (!userId || !partnerId) return;
  try {
    const chatRef = ref(db, `userChats/${userId}/${partnerId}`);
    await update(chatRef, {
      partnerDeleted: true,
      partnerName: partnerName || 'Deleted Account',
    });
    console.log(`📌 Marked chat with ${partnerId} as kept for user ${userId}`);
  } catch (err) {
    console.error('Error marking chat as kept:', err);
  }
};