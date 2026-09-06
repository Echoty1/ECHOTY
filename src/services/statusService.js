// src/services/statusService.js
import { ref, push, set, update, onValue, off, serverTimestamp, remove, get } from 'firebase/database';
import { db } from './firebase';

const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export const createImageStatus = async (userId, { imageUrl, caption = '' }) => {
  const statusRef = push(ref(db, `statuses/${userId}`));
  const statusId = statusRef.key;

  const data = {
    id: statusId,
    userId,
    type: 'image',
    imageUrl,
    caption,
    createdAt: serverTimestamp(),
    expiresAt: Date.now() + EXPIRY_MS,
    views: {},
    reactions: {},
  };

  await set(statusRef, data);

  await update(ref(db, `statusOwners/${userId}`), {
    lastStatusAt: serverTimestamp(),
    lastStatusId: statusId,
  });

  return statusId;
};

export const markStatusViewed = async (ownerId, statusId, viewerId) => {
  if (!ownerId || !statusId || !viewerId) return;
  if (ownerId === viewerId) return;

  await update(ref(db, `statuses/${ownerId}/${statusId}/views`), {
    [viewerId]: serverTimestamp(),
  });

  await update(ref(db, `viewedStatuses/${viewerId}`), {
    [`${ownerId}_${statusId}`]: true,
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

// Get ALL statuses for "Memories" (including the newly snapped ones)
export const getUserMemories = async (userId) => {
  const snap = await get(ref(db, `statuses/${userId}`));
  const data = snap.val() || {};
  // Sort by newest first, show everything regardless of expiry
  return Object.values(data).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
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

    Object.values(data)
      .filter((s) => s.expiresAt <= now)
      .forEach((s) => {
        remove(ref(db, `statuses/${userId}/${s.id}`)).catch(() => {});
      });

    callback(valid);
  });
  return () => off(statusesRef);
};

export const listenToViewedStatuses = (viewerId, callback) => {
  const viewedRef = ref(db, `viewedStatuses/${viewerId}`);
  onValue(viewedRef, (snap) => {
    callback(snap.val() || {});
  });
  return () => off(viewedRef);
};
