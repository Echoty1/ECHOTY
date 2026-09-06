import { ref, push, set, update, onValue, off, serverTimestamp } from 'firebase/database';
import { db } from './firebase';

const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export const createVoiceStatus = async (userId, { audioUrl, duration, caption = '', filter = 'normal' }) => {
  const statusRef = push(ref(db, `statuses/${userId}`));
  const statusId = statusRef.key;

  const data = {
    id: statusId,
    userId,
    type: 'voice',
    audioUrl,
    duration,
    caption,
    filter,
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

export const markStatusViewed = (ownerId, statusId, viewerId) => {
  return update(ref(db, `statuses/${ownerId}/${statusId}/views`), {
    [viewerId]: true,
  });
};

export const addReaction = (ownerId, statusId, emoji, userId) => {
  return update(ref(db, `statuses/${ownerId}/${statusId}/reactions/${emoji}`), {
    [userId]: true,
  });
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
