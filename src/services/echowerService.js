// src/services/echowerService.js
import { ref, get, update, remove, onValue, push, set } from 'firebase/database';
import { db } from './firebase';

// Follow a user (Updates both sides correctly)
export const followUser = async (currentUserId, targetUserId) => {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) return;

  // Add to "Who I am following" list
  await update(ref(db, `following/${currentUserId}/${targetUserId}`), {
    followedAt: Date.now(),
  });

  // Add to "Who is following me" list
  await update(ref(db, `followers/${targetUserId}/${currentUserId}`), {
    followedByAt: Date.now(),
  });

  // Send notification
  const notifRef = push(ref(db, `notifications/${targetUserId}`));
  await set(notifRef, {
    type: 'echower',
    fromUserId: currentUserId,
    message: 'started echowing you!',
    timestamp: Date.now(),
    read: false,
  });
};

// Unfollow a user
export const unfollowUser = async (currentUserId, targetUserId) => {
  if (!currentUserId || !targetUserId) return;

  // Remove from "Who I am following"
  await remove(ref(db, `following/${currentUserId}/${targetUserId}`));

  // Remove from "Who is following me"
  await remove(ref(db, `followers/${targetUserId}/${currentUserId}`));
};

// Check if you are currently Echowing someone
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

// Listen to people FOLLOWING ME
export const listenToMyEchowerCount = (targetUserId, callback) => {
  const refPath = ref(db, `followers/${targetUserId}`);
  return onValue(refPath, (snap) => {
    const data = snap.val() || {};
    callback(Object.keys(data));
  });
};

// Listen to real-time notifications for a user
export const listenToNotifications = (userId, callback) => {
  const notifRef = ref(db, `notifications/${userId}`);
  return onValue(notifRef, (snap) => {
    const data = snap.val() || {};
    const notifications = Object.values(data).sort((a, b) => b.timestamp - a.timestamp);
    callback(notifications);
  });
};

// Mark a single notification as read
export const markNotificationAsRead = async (userId, notificationId) => {
  await update(ref(db, `notifications/${userId}/${notificationId}`), {
    read: true,
  });
};

// Mark ALL notifications as read
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
