// src/services/echowerService.js — add these exports if missing
import { ref, update, remove, get, runTransaction } from 'firebase/database';
import { db } from './firebase';

/**
 * Follow (echow) a user — updates both sides + counter.
 */
export async function followUser(myUid, targetUid) {
  if (!myUid || !targetUid || myUid === targetUid) return { ok: false };

  const now = Date.now();
  const updates = {};
  updates[`echowers/${myUid}/${targetUid}`] = { echowedAt: now };
  updates[`followers/${targetUid}/${myUid}`] = { followedAt: now };
  updates[`following/${myUid}/${targetUid}`] = { followedAt: now };
  await update(ref(db), updates);

  try {
    await runTransaction(ref(db, `profiles/${targetUid}/echowerCount`), (n) => (n || 0) + 1);
    await runTransaction(ref(db, `profiles/${myUid}/echowingCount`), (n) => (n || 0) + 1);
  } catch (_) {}

  return { ok: true };
}

export async function unfollowUser(myUid, targetUid) {
  if (!myUid || !targetUid || myUid === targetUid) return { ok: false };
  await remove(ref(db, `echowers/${myUid}/${targetUid}`));
  await remove(ref(db, `followers/${targetUid}/${myUid}`));
  await remove(ref(db, `following/${myUid}/${targetUid}`));
  try {
    await runTransaction(ref(db, `profiles/${targetUid}/echowerCount`), (n) => Math.max(0, (n || 0) - 1));
    await runTransaction(ref(db, `profiles/${myUid}/echowingCount`), (n) => Math.max(0, (n || 0) - 1));
  } catch (_) {}
  return { ok: true };
}

export async function isFollowing(myUid, targetUid) {
  if (!myUid || !targetUid) return false;
  const snap = await get(ref(db, `echowers/${myUid}/${targetUid}`));
  return snap.exists();
}
