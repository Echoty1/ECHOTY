// src/services/statusService.js
import { ref, push, set, update, onValue, off, serverTimestamp, remove, get } from 'firebase/database';
import { db } from './firebase';

const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// CHANGED: Now accepts imageUrl instead of audioUrl and duration
export const createImageStatus = async (userId, { imageUrl, caption = '' }) => {
  const statusRef = push(ref(db, `statuses/${userId}`));
  const statusId = statusRef.key;

  const data = {
    id: statusId,
    userId,
    type: 'image', // Changed from 'voice'
    imageUrl,      // Changed from 'audioUrl'
    caption,
    createdAt: serverTimestamp(),
    expiresAt: Date.now() + EXPIRY_MS,
    views: {},
    reactions: {},
  };

  await set(statusRef, data);

  // Update owner index
  await update(ref(db, `statusOwners/${userId}`), {
    lastStatusAt: serverTimestamp(),
    lastStatusId: statusId,
  });

  return statusId;
};

export const markStatusViewed = async (ownerId, statusId, viewerId) => {
  if (!ownerId || !statusId || !viewerId) return;
  if (ownerId === viewerId) return;

  // Mark this specific status as viewed by this user
  await update(ref(db, `statuses/${ownerId}/${statusId}/views`), {
    [viewerId]: serverTimestamp(),
  });

  // Also mark in a per-user viewed list for fast filtering on StatusBar
  await update(ref(db, `viewedStatuses/${viewerId}`), {
    [`${ownerId}_${statusId}`]: true,
  });
};

export const addReaction = (ownerId, statusId, emoji, userId) => {
  return update(ref(db, `statuses/${ownerId}/${statusId}/reactions/${emoji}`), {
    [userId]: true,
  });
};

export const deleteStatus = async (userId, statusId) => {
  await remove(ref(db, `statuses/${userId}/${statusId}`));

  const snap = await get(ref(db, `statuses/${userId}`));
  const remaining = snap.val() || {};
  const stillHas = Object.values(remaining).some((s) => s.expiresAt > Date.now());

  if (!stillHas) {
    await remove(ref(db, `statusOwners/${userId}`));
  }
};

export const listenToStatusOwners = (callback) => {
  const ownersRef = ref(db, 'statusOwners');
  onValue(ownersRef, (snap) => {
    callback(snap.val() || {});
  });
  return () => off(ownersRef);
};

export const listenToUserStatuses = (userId, callback) => {
  const statusesRef = ref(db, `statuses/${userId}`);
  onValue(statusesRef, (snap) => {
    const data = snap.val() || {};
    const now = Date.now();
    const valid = Object.values(data)
      .filter((s) => s.expiresAt > now)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(valid);
  });
  return () => off(statusesRef);
};

// New: listen to what the current user has already viewed
export const listenToViewedStatuses = (viewerId, callback) => {
  const viewedRef = ref(db, `viewedStatuses/${viewerId}`);
  onValue(viewedRef, (snap) => {
    callback(snap.val() || {});
  });
  return () => off(viewedRef);
};
