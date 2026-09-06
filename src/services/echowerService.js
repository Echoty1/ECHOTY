// src/services/echowerService.js
import { ref, get, update, remove, onValue } from 'firebase/database';
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

  // 3. Update my count (since I am now following someone)
  const myProfileRef = ref(db, `profiles/${currentUserId}`);
  const mySnap = await get(myProfileRef);
  const myData = mySnap.val() || {};
  const myNewCount = (myData.echowingCount || 0) + 1;
  await update(myProfileRef, { echowingCount: myNewCount });

  // 4. Update their count (they gained a follower)
  const targetProfileRef = ref(db, `profiles/${targetUserId}`);
  const targetSnap = await get(targetProfileRef);
  const targetData = targetSnap.val() || {};
  const targetNewCount = (targetData.echowerCount || 0) + 1;
  await update(targetProfileRef, { echowerCount: targetNewCount });
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
    // This returns the IDs of the users who are following me!
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
