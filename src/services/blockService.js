// src/services/blockService.js
import { ref, set, remove, get, push, serverTimestamp } from 'firebase/database';
import { db } from './firebase';

/**
 * Block a user. Creates a two-way link:
 *   users/{myUid}/blocked/{targetUid}   = true
 *   users/{targetUid}/blockedBy/{myUid} = true
 * This lets either side cheaply check "am I blocked by them?" without
 * scanning a list.
 */
export const blockUser = async (myUid, targetUid) => {
  if (!myUid || !targetUid || myUid === targetUid) return;
  await Promise.all([
    set(ref(db, `users/${myUid}/blocked/${targetUid}`), true),
    set(ref(db, `users/${targetUid}/blockedBy/${myUid}`), true),
  ]);
};

export const unblockUser = async (myUid, targetUid) => {
  if (!myUid || !targetUid) return;
  await Promise.all([
    remove(ref(db, `users/${myUid}/blocked/${targetUid}`)),
    remove(ref(db, `users/${targetUid}/blockedBy/${myUid}`)),
  ]);
};

/** Does myUid block targetUid? */
export const isBlocked = async (myUid, targetUid) => {
  if (!myUid || !targetUid) return false;
  try {
    const snap = await get(ref(db, `users/${myUid}/blocked/${targetUid}`));
    return snap.exists() && snap.val() === true;
  } catch (_) {
    return false;
  }
};

/** Is myUid blocked BY targetUid? (they blocked me) */
export const isBlockedBy = async (myUid, targetUid) => {
  if (!myUid || !targetUid) return false;
  try {
    const snap = await get(ref(db, `users/${targetUid}/blocked/${myUid}`));
    return snap.exists() && snap.val() === true;
  } catch (_) {
    return false;
  }
};

/** Either direction of the block. */
export const isBlockedEitherWay = async (myUid, targetUid) => {
  const [a, b] = await Promise.all([
    isBlocked(myUid, targetUid),
    isBlockedBy(myUid, targetUid),
  ]);
  return a || b;
};

export const reportUser = async ({ reporterUid, targetUid, reason, note, chatId }) => {
  const r = push(ref(db, 'reports'));
  await set(r, {
    reporterUid,
    targetUid,
    reason: reason || 'other',
    note: note || '',
    chatId: chatId || null,
    at: serverTimestamp(),
  });
  return r.key;
};

export const listBlocked = async (myUid) => {
  if (!myUid) return [];
  try {
    const snap = await get(ref(db, `users/${myUid}/blocked`));
    return snap.exists() ? Object.keys(snap.val()) : [];
  } catch (_) {
    return [];
  }
};
