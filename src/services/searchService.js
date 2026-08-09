// src/services/searchService.js
import { db } from './firebase';
import { ref, query, orderByChild, startAt, endAt, limitToFirst, get } from 'firebase/database';
import { getCache, setCache } from './cacheService';

const SEARCH_TIMEOUT = 5000; // Keep it reasonable
const SEARCH_CACHE_TTL = 5 * 60;

// ─── Local cache for all profiles (used as fallback) ──────
let allProfilesCache = null;
let allProfilesCacheTime = 0;
const ALL_PROFILES_TTL = 60 * 60; // 1 hour

const fetchAllProfiles = async () => {
  const now = Date.now();
  if (allProfilesCache && (now - allProfilesCacheTime) < ALL_PROFILES_TTL * 1000) {
    return allProfilesCache;
  }

  try {
    const snapshot = await get(ref(db, 'profiles'));
    const data = snapshot.val();
    if (!data) return [];

    const profiles = Object.entries(data).map(([uid, profile]) => ({
      id: uid,
      name: profile.name || profile.displayName || profile.username || 'Unknown User',
      username: profile.username || '',
      displayName: profile.displayName || '',
      country: profile.country || '',
      city: profile.city || '',
      interests: profile.interests || [],
      skills: profile.skills || [],
      status: profile.status || 'Active',
      lastActive: profile.lastActive || 'Just now',
      bio: profile.bio || '',
      avatar: profile.avatar || '',
      mood: profile.mood || 'neutral',
      activeSkin: profile.activeSkin || null,
      searchName: profile.searchName || '',
    }));

    allProfilesCache = profiles;
    allProfilesCacheTime = now;
    return profiles;
  } catch (err) {
    console.error('❌ Failed to fetch all profiles:', err);
    return [];
  }
};

export const searchProfiles = async (
  queryText,
  currentUserId,
  limit = 20,
  timeoutMs = SEARCH_TIMEOUT
) => {
  const trimmed = queryText.trim().toLowerCase();
  if (trimmed.length < 2) return [];

  const cacheKey = `search_${trimmed}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return cached.filter(user => user.id !== currentUserId);
  }

  // ─── Try the indexed Firebase query first ──────────────
  try {
    const profilesRef = ref(db, 'profiles');
    const q = query(
      profilesRef,
      orderByChild('searchName'),
      startAt(trimmed),
      endAt(trimmed + '\uf8ff'),
      limitToFirst(limit)
    );

    const snapshot = await Promise.race([
      get(q),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Search timeout')), timeoutMs)
      ),
    ]);

    const data = snapshot.val();
    if (data) {
      const results = Object.entries(data)
        .map(([uid, profile]) => ({
          id: uid,
          name: profile.name || 'Unknown',
          // ... other fields (same as above)
        }))
        .filter(u => u.id !== currentUserId);

      if (results.length > 0) setCache(cacheKey, results, SEARCH_CACHE_TTL);
      return results;
    }
  } catch (err) {
    console.warn(`⚠️ Indexed query failed: ${err.message}. Falling back to local search.`);
  }

  // ─── Fallback: local search over all profiles ──────────────
  const allProfiles = await fetchAllProfiles();
  if (!allProfiles.length) return [];

  const results = allProfiles
    .filter(p => p.searchName && p.searchName.startsWith(trimmed))
    .filter(p => p.id !== currentUserId)
    .slice(0, limit);

  if (results.length > 0) {
    setCache(cacheKey, results, SEARCH_CACHE_TTL);
  }
  return results;
};

export const clearSearchCache = () => {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith('echo_cache_search_')) {
      localStorage.removeItem(key);
    }
  });
};