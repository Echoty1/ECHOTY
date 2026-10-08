// src/services/usernameService.js
import {
  ref, get, set, update, remove, runTransaction, query,
  orderByChild, equalTo, limitToFirst, serverTimestamp,
} from 'firebase/database';
import { db } from './firebase';
import {
  validateUsername,
  RESERVED_USERNAMES,
} from '../utils/usernameValidation';

const USERNAME_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_CHANGES_PER_COOLDOWN = 2;

/**
 * Check if a username is available. Returns:
 *   { available: true }
 *   { available: false, reason: 'taken' | 'reserved' | 'invalid' | 'error' }
 */
export const checkUsernameAvailability = async (rawUsername) => {
  const validation = validateUsername(rawUsername);
  if (!validation.valid) {
    return { available: false, reason: 'invalid', error: validation.error };
  }

  try {
    const snap = await get(ref(db, `usernames/${validation.normalized}`));
    if (snap.exists()) {
      return { available: false, reason: 'taken' };
    }
    return { available: true, normalized: validation.normalized };
  } catch (err) {
    console.error('Username availability check failed:', err);
    return { available: false, reason: 'error', error: err.message };
  }
};

/**
 * Claims a username for the given uid. Atomically reserves the
 * /usernames/{handle} slot so no two users can collide.
 *
 * Returns:
 *   { ok: true, username }
 *   { ok: false, error }
 */
export const claimUsername = async (uid, rawUsername) => {
  if (!uid) return { ok: false, error: 'Not logged in' };

  const validation = validateUsername(rawUsername);
  if (!validation.valid) {
    return { ok: false, error: validation.error };
  }

  const username = validation.normalized;

  try {
    // Check cooldown
    const profileSnap = await get(ref(db, `profiles/${uid}`));
    const profile = profileSnap.exists() ? profileSnap.val() : {};
    const currentUsername = profile.username;
    const lastChangedAt = profile.usernameUpdatedAt || 0;
    const changeCount = profile.usernameChangeCount || 0;

    if (currentUsername === username) {
      return { ok: true, username, unchanged: true };
    }

    if (currentUsername) {
      const now = Date.now();
      const timeSinceChange = now - lastChangedAt;
      if (timeSinceChange < USERNAME_CHANGE_COOLDOWN_MS && changeCount >= MAX_CHANGES_PER_COOLDOWN) {
        const daysLeft = Math.ceil((USERNAME_CHANGE_COOLDOWN_MS - timeSinceChange) / (24 * 60 * 60 * 1000));
        return {
          ok: false,
          error: `You can change your username again in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
        };
      }
    }

    // Atomic reservation of the handle
    const handleRef = ref(db, `usernames/${username}`);
    const result = await runTransaction(handleRef, (current) => {
      if (current === null) {
        return { uid, createdAt: Date.now() };
      }
      return; // abort — someone else got it
    });

    if (!result.committed) {
      return { ok: false, error: 'Username was just taken. Please choose another.' };
    }

    // Release old handle if one existed
    if (currentUsername && currentUsername !== username) {
      await remove(ref(db, `usernames/${currentUsername}`)).catch(() => {});
    }

    // Update profile
    const updates = {
      username,
      displayName: profile.name || profile.displayName || username,
      usernameUpdatedAt: Date.now(),
      usernameChangeCount: (changeCount || 0) + 1,
    };
    await update(ref(db, `profiles/${uid}`), updates);

    return { ok: true, username };
  } catch (err) {
    console.error('claimUsername failed:', err);
    return { ok: false, error: err.message || 'Failed to claim username' };
  }
};

/**
 * Fetch a user's public profile by handle.
 */
export const getProfileByUsername = async (rawHandle) => {
  const validation = validateUsername(rawHandle);
  if (!validation.valid) return null;

  try {
    const handleSnap = await get(ref(db, `usernames/${validation.normalized}`));
    if (!handleSnap.exists()) return null;

    const { uid } = handleSnap.val();
    const profileSnap = await get(ref(db, `profiles/${uid}`));
    if (!profileSnap.exists()) return null;

    return { uid, ...profileSnap.val() };
  } catch (err) {
    console.error('getProfileByUsername failed:', err);
    return null;
  }
};

/**
 * Search users whose username starts with the given prefix.
 * Simple prefix match (Firebase can't do substring search efficiently).
 */
export const searchUsernames = async (prefix, maxResults = 10) => {
  if (!prefix || prefix.length < 2) return [];

  const clean = prefix.toLowerCase().replace(/^@/, '').trim();
  if (!clean) return [];

  try {
    // Use a range query: [clean, clean + '\uf8ff')
    const usernamesRef = ref(db, 'usernames');
    const q = query(
      usernamesRef,
      orderByKey(),
      // Firebase doesn't support startAt/endAt via query() helper directly
      // We'll fetch and filter as fallback
    );

    const snap = await get(ref(db, 'usernames'));
    if (!snap.exists()) return [];

    const all = snap.val();
    const results = [];
    for (const [handle, data] of Object.entries(all)) {
      if (handle.startsWith(clean)) {
        results.push({ handle, uid: data.uid });
        if (results.length >= maxResults) break;
      }
    }
    return results;
  } catch (err) {
    console.error('searchUsernames failed:', err);
    return [];
  }
};

/**
 * Get the current user's username (cached in profile).
 */
export const getMyUsername = async (uid) => {
  if (!uid) return null;
  try {
    const snap = await get(ref(db, `profiles/${uid}/username`));
    return snap.exists() ? snap.val() : null;
  } catch (err) {
    console.error('getMyUsername failed:', err);
    return null;
  }
};
