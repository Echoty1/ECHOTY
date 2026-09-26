// src/services/welcomeFollow.js
import { db } from './firebase';
import { ref, get, set, update } from 'firebase/database';

// The account everyone auto-follows on signup.
// Change this to any UID you want — it's the ECHO team account.
const WELCOME_ACCOUNT_UID = 'TMMx1najgiM1WUhSpc74DoIS83E3';

/**
 * Auto-follow the welcome account for a new user.
 * Safe to call multiple times — it will only write once per user
 * because we mark the user as "welcomed" in their profile.
 */
export const applyWelcomeFollow = async (newUserUid) => {
  if (!newUserUid) return false;
  if (newUserUid === WELCOME_ACCOUNT_UID) return false; // don't follow self

  try {
    // Check if this user has already been welcomed
    const profileRef = ref(db, `profiles/${newUserUid}`);
    const snap = await get(profileRef);
    const data = snap.exists() ? snap.val() : {};

    if (data.welcomedAt) {
      // Already done — skip
      return false;
    }

    // Fetch the welcome account's profile so we can cache it for chat lists
    let welcomeProfile = {};
    try {
      const wp = await get(ref(db, `profiles/${WELCOME_ACCOUNT_UID}`));
      welcomeProfile = wp.exists() ? wp.val() : {};
    } catch (_) {}

    const now = Date.now();

    // Write all 4 nodes in one atomic update
    const updates = {};

    // 1. Add newUser to followers of the welcome account
    updates[`followers/${WELCOME_ACCOUNT_UID}/${newUserUid}`] = true;

    // 2. Add welcome account to following of the new user
    updates[`following/${newUserUid}/${WELCOME_ACCOUNT_UID}`] = true;

    // 3. Increment the welcome account's echowerCount
    const currentCount = Number(welcomeProfile.echowerCount) || 0;
    updates[`profiles/${WELCOME_ACCOUNT_UID}/echowerCount`] = currentCount + 1;

    // 4. Increment the new user's echowingCount
    const myCurrentCount = Number(data.echowingCount) || 0;
    updates[`profiles/${newUserUid}/echowingCount`] = myCurrentCount + 1;

    // 5. Mark this user as welcomed so we don't do this again
    updates[`profiles/${newUserUid}/welcomedAt`] = now;

    await update(ref(db), updates);

    console.log(`✅ Auto-followed welcome account for user ${newUserUid}`);
    return true;
  } catch (err) {
    console.warn('⚠️ applyWelcomeFollow failed:', err);
    return false;
  }
};
