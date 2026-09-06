// src/services/echowerService.js
import { ref, get, update, remove, onValue } from 'firebase/database';
import { db } from './firebase';

// Follow a user and update counts
export const followUser = async (currentUserId, targetUserId) => {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) return;

  await update(ref(db, `echowers/${currentUserId}/${targetUserId}`), {
    followedAt: Date.now(),
  });

  const targetProfileRef = ref(db, `profiles/${targetUserId}`);
  const snap = await get(targetProfileRef);
  const data = snap.val() || {};
  const newCount = (data.echowerCount || 0) + 1;
  await update(targetProfileRef, { echowerCount: newCount });
};

// Unfollow a user and update counts
export const unfollowUser = async (currentUserId, targetUserId) => {
  if (!currentUserId || !targetUserId) return;

  await remove(ref(db, `echowers/${currentUserId}/${targetUserId}`));

  const targetProfileRef = ref(db, `profiles/${targetUserId}`);
  const snap = await get(targetProfileRef);
  const data = snap.val() || {};
  const newCount = Math.max(0, (data.echowerCount || 0) - 1);
  await update(targetProfileRef, { echowerCount: newCount });
};

// Check if you are currently Echowing someone
export const isEchowing = async (currentUserId, targetUserId) => {
  const snap = await get(ref(db, `echowers/${currentUserId}/${targetUserId}`));
  return snap.exists();
};

// Get all user IDs you are Echowing
export const getMyEchowers = async (currentUserId) => {
  const snap = await get(ref(db, `echowers/${currentUserId}`));
  return snap.val() ? Object.keys(snap.val()) : [];
};

// Listen to your list in real-time
export const listenToMyEchowers = (currentUserId, callback) => {
  const refPath = ref(db, `echowers/${currentUserId}`);
  return onValue(refPath, (snap) => {
    const data = snap.val() || {};
    callback(Object.keys(data));
  });
};

// Listen to your Echower Count
export const listenToMyEchowerCount = (targetUserId, callback) => {
  const refPath = ref(db, `profiles/${targetUserId}/echowerCount`);
  return onValue(refPath, (snap) => {
    callback(snap.val() || 0);
  });
};
