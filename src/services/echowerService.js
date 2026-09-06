// src/services/echowerService.js
import { ref, get, update, remove, onValue, push, set } from 'firebase/database';
import { db } from './firebase';

// ─────────────────────────────────────────────
// FOLLOW / UNFOLLOW LOGIC
// ─────────────────────────────────────────────
export const followUser = async (currentUserId, targetUserId) => {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) return;

  // 1. Add to "Who I am following" list
  await update(ref(db, `following/${currentUserId}/${targetUserId}`), {
    followedAt: Date.now(),
  });

  // 2. Add to "Who is following me" list
  await update(ref(db, `followers/${targetUserId}/${currentUserId}`), {
    followedByAt: Date.now(),
  });

  // 3. Update my "Echowing" count
  const myProfileRef = ref(db, `profiles/${currentUserId}`);
  const mySnap = await get(myProfileRef);
  const myData = mySnap.val() || {};
  const myNewCount = (myData.echowingCount || 0) + 1;
  await update(myProfileRef, { echowingCount: myNewCount });

  // 4. Update their "Echower" count
  const targetProfileRef = ref(db, `profiles/${targetUserId}`);
  const targetSnap = await get(targetProfileRef);
  const targetData = targetSnap.val() || {};
  const targetNewCount = (targetData.echowerCount || 0) + 1;
  await update(targetProfileRef, { echowerCount: targetNewCount });

  // 5. Send notification
  const notifRef = push(ref(db, `notifications/${targetUserId}`));
  await set(notifRef, {
    type: 'echower',
    fromUserId: currentUserId,
    message: 'started echowing you!',
    timestamp: Date.now(),
    read: false,
  });
};

export const unfollowUser = async (currentUserId, targetUserId) => {
  if (!currentUserId || !targetUserId) return;

  // 1. Remove from "Who I am following"
  await remove(ref(db, `following/${currentUserId}/${targetUserId}`));

  // 2. Remove from "Who is following me"
  await remove(ref(db, `followers/${targetUserId}/${currentUserId}`));

  // 3. Decrease my count
  const myProfileRef = ref(db, `profiles/${currentUserId}`);
  const mySnap = await get(myProfileRef);
  const myData = mySnap.val() || {};
  const myNewCount = Math.max(0, (myData.echowingCount || 0) - 1);
  await update(myProfileRef, { echowingCount: myNewCount });

  // 4. Decrease their count
  const targetProfileRef = ref(db, `profiles/${targetUserId}`);
  const targetSnap = await get(targetProfileRef);
  const targetData = targetSnap.val() || {};
  const targetNewCount = Math.max(0, (targetData.echowerCount || 0) - 1);
  await update(targetProfileRef, { echowerCount: targetNewCount });
};

// ─────────────────────────────────────────────
// CHECKING & LISTENERS
// ─────────────────────────────────────────────
export const isEchowing = async (currentUserId, targetUserId) => {
  const snap = await get(ref(db, `following/${currentUserId}/${targetUserId}`));
  return snap.exists();
};

// Listen to people I am FOLLOWING
export const listenToMyEchowers = (currentUserId, callback) => {
  const refPath = ref(db, `following/${currentUserId}`);
  return onValue(refPath, (snap) => {
    const data = snap.val() || {};
    callback(Object.keys(data));
  });
};

// Listen to people FOLLOWING ME (My Followers)
export const listenToMyEchowerCount = (targetUserId, callback) => {
  const refPath = ref(db, `followers/${targetUserId}`);
  return onValue(refPath, (snap) => {
    const data = snap.val() || {};
    callback(Object.keys(data));
  });
};

// Listen to my Echowing count
export const listenToMyEchowingCount = (currentUserId, callback) => {
  const refPath = ref(db, `profiles/${currentUserId}/echowingCount`);
  return onValue(refPath, (snap) => {
    callback(snap.val() || 0);
  });
};

// ─────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────
export const listenToNotifications = (userId, callback) => {
  const notifRef = ref(db, `notifications/${userId}`);
  return onValue(notifRef, (snap) => {
    const data = snap.val() || {};
    const notifications = Object.values(data).sort((a, b) => b.timestamp - a.timestamp);
    callback(notifications);
  });
};

export const markNotificationAsRead = async (userId, notificationId) => {
  await update(ref(db, `notifications/${userId}/${notificationId}`), {
    read: true,
  });
};

export const markAllNotificationsAsRead = async (userId) => {
  const snap = await get(ref(db, `notifications/${userId}`));
  const data = snap.val() || {};
  
  const updates = {};
  Object.keys(data).forEach((id) => {
    updates[`${id}/read`] = true;
  });
  
  if (Object.keys(updates).length > 0) {
    await update(ref(db, `notifications/${userId}`), updates);
  }
};
