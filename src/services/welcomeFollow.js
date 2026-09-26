// src/services/welcomeFollow.js
import { db } from './firebase';
import { ref, get, update } from 'firebase/database';

const WELCOME_ACCOUNT_UID = 'TMMx1najgiM1WUhSpc74DoIS83E3';

/**
 * Follow the welcome account for a single user.
 * Safe to call multiple times — the `welcomedAt` guard prevents duplicates.
 */
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

/**
 * One-time backfill: applies the welcome follow to every existing user
 * who hasn't received it yet.
 *
 * Returns { processed, followed, skipped, failed } counts.
 *
 * ⚠️ This reads the entire `profiles` node. Only call it from a trusted
 * context (admin panel, dev console, or a one-off button you remove after).
 */
export const backfillWelcomeFollows = async () => {
  const stats = { processed: 0, followed: 0, skipped: 0, failed: 0 };

  try {
    const profilesSnap = await get(ref(db, 'profiles'));
    if (!profilesSnap.exists()) return stats;

    const allProfiles = profilesSnap.val();
    const uids = Object.keys(allProfiles);

    for (const uid of uids) {
      stats.processed += 1;

      // Skip the welcome account itself
      if (uid === WELCOME_ACCOUNT_UID) {
        stats.skipped += 1;
        continue;
      }

      // Skip if already welcomed
      const profile = allProfiles[uid] || {};
      if (profile.welcomedAt) {
        stats.skipped += 1;
        continue;
      }

      const success = await applyWelcomeFollow(uid);
      if (success) stats.followed += 1;
      else stats.failed += 1;

      // Be gentle with Firebase — small delay between writes
      await new Promise((r) => setTimeout(r, 60));
    }

    console.log('[backfill] done', stats);
    return stats;
  } catch (err) {
    console.error('[backfill] error', err);
    return stats;
  }
};
