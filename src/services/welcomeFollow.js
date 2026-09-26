// src/services/welcomeFollow.js
import { db } from './firebase';
import { ref, get, update } from 'firebase/database';

const WELCOME_ACCOUNT_UID = 'TMMx1najgiM1WUhSpc74DoIS83E3';

export const applyWelcomeFollow = async (newUserUid) => {
  if (!newUserUid) return false;
  if (newUserUid === WELCOME_ACCOUNT_UID) return false;

  try {
    const profileRef = ref(db, `profiles/${newUserUid}`);
    const snap = await get(profileRef);
    const data = snap.exists() ? snap.val() : {};

    if (data.welcomedAt) return false;

    const now = Date.now();
    const updates = {};
    updates[`followers/${WELCOME_ACCOUNT_UID}/${newUserUid}`] = true;
    updates[`following/${newUserUid}/${WELCOME_ACCOUNT_UID}`] = true;
    updates[`profiles/${newUserUid}/welcomedAt`] = now;

    await update(ref(db), updates);
    return true;
  } catch (err) {
    console.warn('applyWelcomeFollow failed:', err);
    return false;
  }
};
