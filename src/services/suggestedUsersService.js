// src/services/suggestedUsersService.js
import { ref, get, query, orderByChild, limitToLast } from 'firebase/database';
import { db } from './firebase';

/**
 * Fetch suggested users for a brand-new account.
 *
 * Priority:
 *   1. Verified / creator accounts (isCreator, verified, or badge === 'creator')
 *   2. Friends-of-friends (people followed by people I follow)
 *   3. Most-followed fallback
 *
 * Excludes:
 *   - myself
 *   - ECHO AI assistant
 *   - users I already follow
 *   - users already followed in this session
 *
 * @param {string} myUid
 * @param {number} limit  default 20
 * @returns {Promise<Array<{uid, name, username, avatar, bio, followers, isVerified, isCreator}>>}
 */
export async function getSuggestedUsers(myUid, limit = 20) {
  if (!myUid) return [];

  const exclude = new Set([myUid, 'echo_ai_assistant']);
  const suggestedMap = new Map();

  // ─── 1. Load who I already follow (usually empty for new users) ───
  try {
    const followingSnap = await get(ref(db, `following/${myUid}`));
    if (followingSnap.exists()) {
      Object.keys(followingSnap.val()).forEach((uid) => exclude.add(uid));
    }
  } catch (_) {}

  // ─── 2. Creators / verified accounts ───────────────────────────
  try {
    const profilesSnap = await get(ref(db, 'profiles'));
    if (profilesSnap.exists()) {
      const profiles = profilesSnap.val();
      Object.entries(profiles).forEach(([uid, p]) => {
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
            followers: Number(p.followersCount || 0),
            isVerified: p.verified === true,
            isCreator: true,
          });
        }
      });
    }
  } catch (_) {}

  // ─── 3. Friends-of-friends ─────────────────────────────────────
  try {
    const myFollowingSnap = await get(ref(db, `following/${myUid}`));
    const myFollowing = myFollowingSnap.exists() ? Object.keys(myFollowingSnap.val()) : [];

    const fofCounts = new Map();
    await Promise.all(
      myFollowing.slice(0, 30).map(async (friendUid) => {
        try {
          const theirFollowingSnap = await get(ref(db, `following/${friendUid}`));
          if (!theirFollowingSnap.exists()) return;
          Object.keys(theirFollowingSnap.val()).forEach((candidateUid) => {
            if (exclude.has(candidateUid)) return;
            if (suggestedMap.has(candidateUid)) return;
            fofCounts.set(candidateUid, (fofCounts.get(candidateUid) || 0) + 1);
          });
        } catch (_) {}
      })
    );

    // Pick top FOF by mutual count
    const topFof = [...fofCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([uid]) => uid);

    for (const uid of topFof) {
      if (suggestedMap.has(uid)) continue;
      try {
        const snap = await get(ref(db, `profiles/${uid}`));
        if (!snap.exists()) continue;
        const p = snap.val();
        suggestedMap.set(uid, {
          uid,
          name: p.name || p.displayName || 'User',
          username: p.username || '',
          avatar: p.avatar || '',
          bio: p.bio || '',
          followers: Number(p.followersCount || 0),
          isVerified: p.verified === true,
          isCreator: false,
        });
      } catch (_) {}
    }
  } catch (_) {}

  // ─── 4. Fill remaining slots with most-followed users ──────────
  if (suggestedMap.size < limit) {
    try {
      const profilesSnap = await get(ref(db, 'profiles'));
      if (profilesSnap.exists()) {
        const all = Object.entries(profilesSnap.val())
          .filter(([uid, p]) => p && !exclude.has(uid) && !suggestedMap.has(uid))
          .map(([uid, p]) => ({
            uid,
            name: p.name || p.displayName || 'User',
            username: p.username || '',
            avatar: p.avatar || '',
            bio: p.bio || '',
            followers: Number(p.followersCount || 0),
            isVerified: p.verified === true,
            isCreator: false,
          }))
          .sort((a, b) => b.followers - a.followers)
          .slice(0, limit - suggestedMap.size);

        all.forEach((u) => suggestedMap.set(u.uid, u));
      }
    } catch (_) {}
  }

  // ─── 5. Final sort: creators first, then by followers ──────────
  const list = [...suggestedMap.values()].sort((a, b) => {
    if (a.isCreator !== b.isCreator) return a.isCreator ? -1 : 1;
    return b.followers - a.followers;
  });

  return list.slice(0, limit);
}
