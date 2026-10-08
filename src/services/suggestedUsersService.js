// src/services/suggestedUsersService.js
import { ref, get } from 'firebase/database';
import { db } from './firebase';

const ECHO_AI_ID = 'echo_ai_assistant';

/**
 * Suggest accounts for a brand-new user.
 *
 * Priority:
 *   1. Verified / creator accounts
 *   2. Friends-of-friends (people echowed by people I echow)
 *   3. Most-echowered users (fallback)
 *
 * Excludes: myself, ECHO AI, anyone I already echow.
 *
 * @param {string} myUid
 * @param {number} limit  default 20
 */
export async function getSuggestedUsers(myUid, limit = 20) {
  if (!myUid) return [];

  const exclude = new Set([myUid, ECHO_AI_ID]);
  const suggestedMap = new Map();

  // ─── 1. Who I already echow (usually empty for new users) ─────
  const myEchowing = new Set();
  try {
    const snap = await get(ref(db, `echowers/${myUid}`));
    if (snap.exists()) {
      Object.keys(snap.val()).forEach((uid) => {
        exclude.add(uid);
        myEchowing.add(uid);
      });
    }
  } catch (_) {}

  // ─── 2. Load all profiles once (single read for perf) ─────────
  let allProfiles = {};
  try {
    const snap = await get(ref(db, 'profiles'));
    if (snap.exists()) allProfiles = snap.val() || {};
  } catch (_) {}

  // ─── 3. Creators / verified first ─────────────────────────────
  Object.entries(allProfiles).forEach(([uid, p]) => {
    if (!p || exclude.has(uid)) return;
    const isCreator =
      p.isCreator === true ||
      p.verified === true ||
      p.badge === 'creator' ||
      p.role === 'creator';
    if (isCreator) {
      suggestedMap.set(uid, {
        uid,
        name: p.name || p.displayName || 'User',
        username: p.username || '',
        avatar: p.avatar || '',
        bio: p.bio || '',
        echowerCount: Number(p.echowerCount || 0),
        isVerified: p.verified === true,
        isCreator: true,
      });
    }
  });

  // ─── 4. Friends-of-friends ────────────────────────────────────
  if (myEchowing.size > 0 && suggestedMap.size < limit) {
    const fofCounts = new Map();
    const myEchowingArr = [...myEchowing].slice(0, 30);

    await Promise.all(
      myEchowingArr.map(async (friendUid) => {
        try {
          const snap = await get(ref(db, `echowers/${friendUid}`));
          if (!snap.exists()) return;
          Object.keys(snap.val()).forEach((candidateUid) => {
            if (exclude.has(candidateUid)) return;
            if (suggestedMap.has(candidateUid)) return;
            fofCounts.set(candidateUid, (fofCounts.get(candidateUid) || 0) + 1);
          });
        } catch (_) {}
      })
    );

    const topFof = [...fofCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit - suggestedMap.size)
      .map(([uid]) => uid);

    topFof.forEach((uid) => {
      const p = allProfiles[uid];
      if (!p || suggestedMap.has(uid)) return;
      suggestedMap.set(uid, {
        uid,
        name: p.name || p.displayName || 'User',
        username: p.username || '',
        avatar: p.avatar || '',
        bio: p.bio || '',
        echowerCount: Number(p.echowerCount || 0),
        isVerified: p.verified === true,
        isCreator: false,
      });
    });
  }

  // ─── 5. Fallback: most-echowered users ────────────────────────
  if (suggestedMap.size < limit) {
    const pool = Object.entries(allProfiles)
      .filter(([uid, p]) => p && !exclude.has(uid) && !suggestedMap.has(uid))
      .map(([uid, p]) => ({
        uid,
        name: p.name || p.displayName || 'User',
        username: p.username || '',
        avatar: p.avatar || '',
        bio: p.bio || '',
        echowerCount: Number(p.echowerCount || 0),
        isVerified: p.verified === true,
        isCreator: false,
      }))
      .sort((a, b) => b.echowerCount - a.echowerCount)
      .slice(0, limit - suggestedMap.size);

    pool.forEach((u) => suggestedMap.set(u.uid, u));
  }

  // ─── 6. Final sort: creators first, then by echowerCount ──────
  return [...suggestedMap.values()]
    .sort((a, b) => {
      if (a.isCreator !== b.isCreator) return a.isCreator ? -1 : 1;
      return b.echowerCount - a.echowerCount;
    })
    .slice(0, limit);
}
