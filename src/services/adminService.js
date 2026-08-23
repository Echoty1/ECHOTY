// src/services/adminService.js
import { db } from './firebase';
import { ref, get, set, remove } from 'firebase/database';
import { USER_DATA_PATHS } from '../utils/userIntegrity';

const SUPPORT_UID = 'hD7tJzPVI1VSorhok8GToBC6VDy1';

export const checkIsSupport = (uid) => uid === SUPPORT_UID;

export const userExists = async (uid) => {
  if (!uid) return false;
  const snap = await get(ref(db, `profiles/${uid}`));
  return snap.exists();
};

export const getUserCoins = async (uid) => {
  if (!uid) throw new Error('UID is required');
  if (!(await userExists(uid))) throw new Error('User not found');
  const snap = await get(ref(db, `userSkins/${uid}/coins`));
  return snap.exists() ? snap.val() : 0;
};

export const addUserCoins = async (uid, amount) => {
  if (!uid) throw new Error('UID is required');
  if (!(await userExists(uid))) throw new Error('User not found');
  if (!amount || amount <= 0) throw new Error('Amount must be positive');
  const coinsRef = ref(db, `userSkins/${uid}/coins`);
  const snap = await get(coinsRef);
  const current = snap.exists() ? snap.val() : 0;
  const newCoins = current + amount;
  await set(coinsRef, newCoins);
  return newCoins;
};

export const subtractUserCoins = async (uid, amount) => {
  if (!uid) throw new Error('UID is required');
  if (!(await userExists(uid))) throw new Error('User not found');
  if (!amount || amount <= 0) throw new Error('Amount must be positive');
  const coinsRef = ref(db, `userSkins/${uid}/coins`);
  const snap = await get(coinsRef);
  const current = snap.exists() ? snap.val() : 0;
  if (current < amount) throw new Error('Insufficient coins');
  const newCoins = current - amount;
  await set(coinsRef, newCoins);
  return newCoins;
};

/**
 * Force logout FIRST, then wipe all user nodes including presence.
 * Always force-logout so the client signs out and stops writing presence.
 */
export const wipeUserData = async (uid) => {
  if (!uid) throw new Error('UID is required');

  // 1) Force logout so their open apps sign out (stops presence heartbeats)
  await set(ref(db, `accounts/${uid}/forceLogout`), true);

  // 2) Clear presence / live / peer immediately so they disappear from Home
  await Promise.allSettled([
    remove(ref(db, `presence/online/${uid}`)),
    remove(ref(db, `live/${uid}`)),
    remove(ref(db, `peerIds/${uid}`)),
    remove(ref(db, `busy/${uid}`)),
  ]);

  // 3) Wipe profile + app data
  const paths = [
    `profiles/${uid}`,
    `userSkins/${uid}`,
    `userChats/${uid}`,
    `userDailyLogins/${uid}`,
    `adminNotifications/${uid}`,
  ];
  await Promise.allSettled(paths.map((p) => remove(ref(db, p))));

  // 4) Clear any calls they still own under their uid
  await remove(ref(db, `calls/${uid}`)).catch(() => {});

  return true;
};

export const forceLogoutUser = async (uid) => {
  if (!uid) throw new Error('UID is required');
  await set(ref(db, `accounts/${uid}/forceLogout`), true);
  // Also clear presence so they vanish from Home even before the client reacts
  await Promise.allSettled([
    remove(ref(db, `presence/online/${uid}`)),
    remove(ref(db, `live/${uid}`)),
    remove(ref(db, `busy/${uid}`)),
  ]);
  return true;
};

export const clearForceLogout = async (uid) => {
  if (!uid) return;
  await remove(ref(db, `accounts/${uid}/forceLogout`));
};

export const deleteUserAccount = async (targetUid) => {
  if (!targetUid) throw new Error('UID is required');
  // Force logout + wipe DB; Auth user delete needs backend Admin SDK
  await wipeUserData(targetUid);
  await remove(ref(db, `accounts/${targetUid}`)).catch(() => {});
  return true;
};

export const banUser = async (uid, reason = 'Banned by admin') => {
  if (!uid) throw new Error('UID is required');
  await set(ref(db, `accounts/${uid}/banned`), true);
  await set(ref(db, `accounts/${uid}/banReason`), reason);
  await set(ref(db, `accounts/${uid}/bannedAt`), Date.now());
  await forceLogoutUser(uid);
  return true;
};

export const unbanUser = async (uid) => {
  if (!uid) throw new Error('UID is required');
  await remove(ref(db, `accounts/${uid}/banned`));
  await remove(ref(db, `accounts/${uid}/banReason`));
  await remove(ref(db, `accounts/${uid}/bannedAt`));
  return true;
};

export const isUserBanned = async (uid) => {
  if (!uid) return false;
  const snap = await get(ref(db, `accounts/${uid}/banned`));
  return snap.val() === true;
};

export const getUserBanStatus = async (uid) => {
  if (!uid) return { isBanned: false, reason: '', bannedAt: null };
  const snap = await get(ref(db, `accounts/${uid}`));
  if (!snap.exists()) {
    return { isBanned: false, reason: '', bannedAt: null, notFound: true };
  }
  const data = snap.val() || {};
  return {
    isBanned: data.banned === true,
    reason: data.banReason || '',
    bannedAt: data.bannedAt || null,
    notFound: false,
  };
};

/**
 * Remove online ghosts: UIDs in presence with no real profile.
 * Call from Admin "Clean ghosts" button if you add one.
 */
export const cleanPresenceGhosts = async () => {
  const presenceSnap = await get(ref(db, 'presence/online'));
  const presence = presenceSnap.val() || {};
  const uids = Object.keys(presence);
  let removed = 0;
  for (const uid of uids) {
    const prof = await get(ref(db, `profiles/${uid}`));
    if (!prof.exists()) {
      await remove(ref(db, `presence/online/${uid}`));
      await remove(ref(db, `live/${uid}`)).catch(() => {});
      removed += 1;
    } else {
      const name = (prof.val() || {}).name;
      const { isRealDisplayName } = await import('../utils/userIntegrity');
      if (!isRealDisplayName(name)) {
        await remove(ref(db, `presence/online/${uid}`));
        removed += 1;
      }
    }
  }
  return removed;
};
