// src/services/adminService.js
import { db, auth } from './firebase';
import { ref, get, set, update, remove } from 'firebase/database';

const SUPPORT_UID = 'hD7tJzPVI1VSorhok8GToBC6VDy1';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export const checkIsSupport = (uid) => uid === SUPPORT_UID;

// ─── Check if user exists ──────────────────────────────────────
export const userExists = async (uid) => {
  if (!uid) return false;
  const profileRef = ref(db, `profiles/${uid}`);
  const snap = await get(profileRef);
  return snap.exists();
};

// ─── Check user coins ──────────────────────────────────────────
export const getUserCoins = async (uid) => {
  if (!uid) throw new Error('UID is required');
  if (!(await userExists(uid))) throw new Error('User not found');
  const snap = await get(ref(db, `userSkins/${uid}/coins`));
  return snap.exists() ? snap.val() : 0;
};

// ─── Add coins to user ─────────────────────────────────────────
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

// ─── Wipe user data (database only) ────────────────────────────
export const wipeUserData = async (uid) => {
  if (!uid) throw new Error('UID is required');
  if (!(await userExists(uid))) throw new Error('User not found');
  const nodes = ['profiles', 'userSkins', 'userChats'];
  await Promise.all(nodes.map(node => remove(ref(db, `${node}/${uid}`))));
  return true;
};

// ─── Force logout user ─────────────────────────────────────────
export const forceLogoutUser = async (uid) => {
  if (!uid) throw new Error('UID is required');
  if (!(await userExists(uid))) throw new Error('User not found');
  await set(ref(db, `accounts/${uid}/forceLogout`), true);
  return true;
};

// ─── Clear force logout flag ──────────────────────────────────
export const clearForceLogout = async (uid) => {
  if (!uid) return;
  await remove(ref(db, `accounts/${uid}/forceLogout`));
};

// ─── Delete user account (auth + database) ─────────────────────
export const deleteUserAccount = async (targetUid) => {
  if (!targetUid) throw new Error('UID is required');
  if (!(await userExists(targetUid))) throw new Error('User not found');
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const idToken = await user.getIdToken();
  const response = await fetch(`${API_URL}/api/admin/delete-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ targetUid }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Failed to delete user');
  return data;
};

// ─── Ban user ──────────────────────────────────────────────────
export const banUser = async (uid, reason = 'Banned by admin') => {
  if (!uid) throw new Error('UID is required');
  if (!(await userExists(uid))) throw new Error('User not found');
  await set(ref(db, `accounts/${uid}/banned`), true);
  await set(ref(db, `accounts/${uid}/banReason`), reason);
  await set(ref(db, `accounts/${uid}/bannedAt`), Date.now());
  return true;
};

// ─── Unban user ────────────────────────────────────────────────
export const unbanUser = async (uid) => {
  if (!uid) throw new Error('UID is required');
  if (!(await userExists(uid))) throw new Error('User not found');
  await remove(ref(db, `accounts/${uid}/banned`));
  await remove(ref(db, `accounts/${uid}/banReason`));
  await remove(ref(db, `accounts/${uid}/bannedAt`));
  return true;
};

// ─── Check if user is banned ──────────────────────────────────
export const isUserBanned = async (uid) => {
  if (!uid) return false;
  if (!(await userExists(uid))) return false;
  const snap = await get(ref(db, `accounts/${uid}/banned`));
  return snap.val() === true;
};

// ─── Get user ban status (full info) ─────────────────────────
export const getUserBanStatus = async (uid) => {
  if (!uid) return { isBanned: false, reason: '', bannedAt: null };
  if (!(await userExists(uid))) return { isBanned: false, reason: '', bannedAt: null, notFound: true };
  const snap = await get(ref(db, `accounts/${uid}`));
  const data = snap.val() || {};
  return {
    isBanned: data.banned === true,
    reason: data.banReason || '',
    bannedAt: data.bannedAt || null,
    notFound: false,
  };
};