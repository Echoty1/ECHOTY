// src/services/echowerService.js
import { ref, get, update, remove, onValue, push, set } from 'firebase/database';
import { db } from './firebase';

// Follow a user (Updates both sides)
export const followUser = async (currentUserId, targetUserId) => {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) return;

  // 1. Add targetUser to "My Following" list
  await update(ref(db, `echowers/${currentUserId}/${targetUserId}`), {
    followedAt: Date.now(),
  });

  // 2. Add currentUser to "Their Followers" list (Crucial fix!)
  await update(ref(db, `echowers/${targetUserId}/${currentUserId}`), {
    followedByAt: Date.now(),
  });

  // 3. Update my count
  const myProfileRef = ref(db, `profiles/${currentUserId}`);
  const mySnap = await get(myProfileRef);
  const myData = mySnap.val() || {};
  const myNewCount = (myData.echowingCount || 0) + 1;
  await update(myProfileRef, { echowingCount: myNewCount });

  // 4. Update their count
  const targetProfileRef = ref(db, `profiles/${targetUserId}`);
  const targetSnap = await get(targetProfileRef);
  const targetData = targetSnap.val() || {};
  const targetNewCount = (targetData.echowerCount || 0) + 1;
  await update(targetProfileRef, { echowerCount: targetNewCount });

  // 5. Send a notification to the target user!
  // We create a new notification entry under their 'notifications' node.
  const notifRef = push(ref(db, `notifications/${targetUserId}`));
  await set(notifRef, {
    type: 'echower',
    fromUserId: currentUserId,
    message: 'started echowing you!',
    timestamp: Date.now(),
    read: false,
  });
};

// Unfollow a user (Updates both sides)
export const unfollowUser = async (currentUserId, targetUserId) => {
  if (!currentUserId || !targetUserId) return;

  // 1. Remove targetUser from "My Following" list
  await remove(ref(db, `echowers/${currentUserId}/${targetUserId}`));

  // 2. Remove currentUser from "Their Followers" list
  await remove(ref(db, `echowers/${targetUserId}/${currentUserId}`));

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

// Check if you are currently Echowing someone
export const isEchowing = async (currentUserId, targetUserId) => {
  const snap = await get(ref(db, `echowers/${currentUserId}/${targetUserId}`));
  return snap.exists();
};

// Get ALL user IDs who are FOLLOWING ME (My Followers)
export const listenToMyEchowerCount = (targetUserId, callback) => {
  const refPath = ref(db, `echowers/${targetUserId}`);
  return onValue(refPath, (snap) => {
    const data = snap.val() || {};
    callback(Object.keys(data));
  });
};

// Get ALL user IDs I am FOLLOWING
export const listenToMyEchowers = (currentUserId, callback) => {
  const refPath = ref(db, `echowers/${currentUserId}`);
  return onValue(refPath, (snap) => {
    const data = snap.val() || {};
    callback(Object.keys(data));
  });
};

// NEW: Listen to real-time notifications for a user
export const listenToNotifications = (userId, callback) => {
  const notifRef = ref(db, `notifications/${userId}`);
  return onValue(notifRef, (snap) => {
    const data = snap.val() || {};
    // Sort by newest first
    const notifications = Object.values(data).sort((a, b) => b.timestamp - a.timestamp);
    callback(notifications);
  });
};

// NEW: Mark a single notification as read
export const markNotificationAsRead = async (userId, notificationId) => {
  await update(ref(db, `notifications/${userId}/${notificationId}`), {
    read: true,
  });
};

// NEW: Mark ALL notifications as read
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
