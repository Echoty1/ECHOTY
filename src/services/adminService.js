// src/services/adminService.js
import { db } from './firebase';
import { ref, get, set, remove, update } from 'firebase/database';

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
  await set(coinsRef, current + amount);
  return current + amount;
};

export const subtractUserCoins = async (uid, amount) => {
  if (!uid) throw new Error('UID is required');
  if (!(await userExists(uid))) throw new Error('User not found');
  if (!amount || amount <= 0) throw new Error('Amount must be positive');
  const coinsRef = ref(db, `userSkins/${uid}/coins`);
  const snap = await get(coinsRef);
  const current = snap.exists() ? snap.val() : 0;
  if (current < amount) throw new Error('Insufficient coins');
  await set(coinsRef, current - amount);
  return current - amount;
};

/** Clear presence-related nodes (requires admin write in rules for live/busy) */
const clearPresence = async (uid) => {
  const paths = [
    `presence/online/${uid}`,
    `live/${uid}`,
    `busy/${uid}`,
    `peerIds/${uid}`,
  ];
  await Promise.allSettled(paths.map((p) => remove(ref(db, p))));
};

export const wipeUserData = async (uid) => {
  return purgeUserCompletely(uid);
};

export const forceLogoutUser = async (uid) => {
  if (!uid) throw new Error('UID is required');
  await set(ref(db, `accounts/${uid}/forceLogout`), true);
  await clearPresence(uid);
  return true;
};

export const clearForceLogout = async (uid) => {
  if (!uid) return;
  await remove(ref(db, `accounts/${uid}/forceLogout`));
};

export const deleteUserAccount = async (targetUid) => {
  if (!targetUid) throw new Error('UID is required');
  await wipeUserData(targetUid);
  await remove(ref(db, `accounts/${targetUid}`)).catch(() => {});
  return true;
};

export const banUser = async (uid, reason = 'Banned by admin') => {
  if (!uid) throw new Error('UID is required');

  await set(ref(db, `accounts/${uid}/banned`), true);
  await set(ref(db, `accounts/${uid}/banReason`), reason);
  await set(ref(db, `accounts/${uid}/bannedAt`), Date.now());
  await set(ref(db, `accounts/${uid}/forceLogout`), true);
  await clearPresence(uid);
  return true;
};

export const unbanUser = async (uid) => {
  if (!uid) throw new Error('UID is required');
  await remove(ref(db, `accounts/${uid}/banned`));
  await remove(ref(db, `accounts/${uid}/banReason`));
  await remove(ref(db, `accounts/${uid}/bannedAt`));
  await remove(ref(db, `accounts/${uid}/forceLogout`));
  return true;
};

export const isUserBanned = async (uid) => {
  if (!uid) return false;
  const snap = await get(ref(db, `accounts/${uid}/banned`));
  return snap.val() === true;
};

export const getUserBanStatus = async (uid) => {
  if (!uid) return { isBanned: false, reason: '', bannedAt: null, notFound: true };
  const snap = await get(ref(db, `accounts/${uid}`));
  if (!snap.exists()) {
    const hasProfile = await userExists(uid);
    return { isBanned: false, reason: '', bannedAt: null, notFound: !hasProfile };
  }
  const data = snap.val() || {};
  return {
    isBanned: data.banned === true,
    reason: data.banReason || '',
    bannedAt: data.bannedAt || null,
    notFound: false,
  };
};

export const cleanPresenceGhosts = async () => {
  const presenceSnap = await get(ref(db, 'presence/online'));
  const presence = presenceSnap.val() || {};
  let removed = 0;
  for (const uid of Object.keys(presence)) {
    const banned = (await get(ref(db, `accounts/${uid}/banned`))).val() === true;
    if (banned) {
      await clearPresence(uid);
      removed += 1;
      continue;
    }
    const prof = await get(ref(db, `profiles/${uid}`));
    if (!prof.exists()) {
      await clearPresence(uid);
      removed += 1;
      continue;
    }
    const name = ((prof.val() || {}).name || '').trim();
    if (!name || name.toLowerCase() === 'user') {
      await clearPresence(uid);
      removed += 1;
    }
  }
  return removed;
};

export const purgeUserCompletely = async (uid) => {
  if (!uid) throw new Error('UID is required');

  await set(ref(db, `accounts/${uid}/forceLogout`), true).catch(() => {});
  await clearPresence(uid).catch(() => {});

  const directPaths = [
    `profiles/${uid}`,
    `userSkins/${uid}`,
    `userChats/${uid}`,
    `userDailyLogins/${uid}`,
    `adminNotifications/${uid}`,
    `notifications/${uid}`,
    `calls/${uid}`,
    `live/${uid}`,
    `liveChat/${uid}`,
    `busy/${uid}`,
    `peerIds/${uid}`,
    `presence/online/${uid}`,
    `userMemories/${uid}`,
    `aiConversations/${uid}`,
    `channelMemberships/${uid}`,
    `userCommunities/${uid}`,
    `accounts/${uid}`,
  ];
  for (const path of directPaths) {
    await remove(ref(db, path)).catch(() => {});
  }

  const updates = {};

  const profilesSnap = await get(ref(db, 'profiles')).catch(() => null);
  const allUids = profilesSnap?.exists() ? Object.keys(profilesSnap.val()) : [];
  for (const other of allUids) {
    if (other === uid) continue;
    updates[`userChats/${other}/${uid}`] = null;
    updates[`chats/${[other, uid].sort().join('_')}`] = null;
  }

  const communitiesSnap = await get(ref(db, 'communities')).catch(() => null);
  if (communitiesSnap?.exists()) {
    const communities = communitiesSnap.val() || {};
    for (const [cid, community] of Object.entries(communities)) {
      if (community?.members && community.members[uid]) {
        updates[`communities/${cid}/members/${uid}`] = null;
        const count = Number(community.memberCount || 0);
        updates[`communities/${cid}/memberCount`] = Math.max(0, count - 1);
      }
      if (community?.createdBy === uid) {
        updates[`communities/${cid}/createdBy`] = 'removed';
      }
    }
  }

  const userComms = await get(ref(db, `userCommunities/${uid}`)).catch(() => null);
  // already removed node, but other indexes
  const memberships = await get(ref(db, 'userCommunities')).catch(() => null);
  // skip

  if (Object.keys(updates).length) {
    await update(ref(db), updates);
  }

  return true;
};
