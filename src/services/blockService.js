// src/services/blockService.js
import { ref, set, remove, get, push, serverTimestamp } from 'firebase/database';
import { db } from './firebase';

export const blockUser = async (myUid, targetUid) => {
  if (!myUid || !targetUid || myUid === targetUid) return;
  await set(ref(db, `users/${myUid}/blocked/${targetUid}`), true);
  await set(ref(db, `users/${targetUid}/blockedBy/${myUid}`), true);
};

export const unblockUser = async (myUid, targetUid) => {
  if (!myUid || !targetUid) return;
  await remove(ref(db, `users/${myUid}/blocked/${targetUid}`));
  await remove(ref(db, `users/${targetUid}/blockedBy/${myUid}`));
};

export const isBlocked = async (myUid, targetUid) => {
  if (!myUid || !targetUid) return false;
  const snap = await get(ref(db, `users/${myUid}/blocked/${targetUid}`));
  return snap.exists() && snap.val() === true;
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
  const snap = await get(ref(db, `users/${myUid}/blocked`));
  return snap.exists() ? Object.keys(snap.val()) : [];
};
