// src/services/searchService.js
import { db } from './firebase';
import { ref, query, orderByChild, startAt, endAt, limitToFirst, get } from 'firebase/database';
import { getCache, setCache } from './cacheService';
import { getKeys, removeItem } from './storageService';

const SEARCH_TIMEOUT = 5000;
const SEARCH_CACHE_TTL = 5 * 60; // 5 minutes

// ─── Local memory cache for profiles (fallback) ─────────────
let allProfilesCache = null;
let allProfilesCacheTime = 0;
const ALL_PROFILES_TTL = 60 * 60; // 1 hour

/**
 * Helper to fetch all profiles as a fallback option when indexed query fails
 */
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

/**
 * Search profiles with pagination support and 2-character threshold
 * @param {string} queryText - The search term (min 2 characters)
 * @param {string} currentUserId - UID of the logged-in user
 * @param {number} limit - Max results per page (default 20)
 * @param {number} offset - Number of results to skip (default 0)
 * @param {number} timeoutMs - Timeout in milliseconds (default 5000)
 * @returns {Promise<{results: Array, total: number, hasMore: boolean}>}
 */
export const searchProfiles = async (
  queryText,
  currentUserId,
  limit = 20,
  offset = 0,
  timeoutMs = SEARCH_TIMEOUT
) => {
  const trimmed = queryText.trim().toLowerCase();
  if (trimmed.length < 2) {
    return { results: [], total: 0, hasMore: false };
  }

  const cacheKey = `search_users_${trimmed}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    const filtered = cached.filter(user => user.id !== currentUserId);
    const paginated = filtered.slice(offset, offset + limit);
    return {
      results: paginated,
      total: filtered.length,
      hasMore: offset + limit < filtered.length,
    };
  }

  // ─── Try the indexed Firebase query first ──────────────
  try {
    const profilesRef = ref(db, 'profiles');
    const q = query(
      profilesRef,
      orderByChild('searchName'),
      startAt(trimmed),
      endAt(trimmed + '\uf8ff'),
      limitToFirst(limit + offset)
    );

    const snapshot = await Promise.race([
      get(q),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Search timeout')), timeoutMs)
      ),
    ]);

    const data = snapshot.val();
    if (data) {
      const allResults = Object.entries(data)
        .map(([uid, profile]) => ({
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
        }))
        .filter(u => u.id !== currentUserId);

      if (allResults.length > 0) {
        await setCache(cacheKey, allResults, SEARCH_CACHE_TTL);
      }

      const paginated = allResults.slice(offset, offset + limit);
      return {
        results: paginated,
        total: allResults.length,
        hasMore: offset + limit < allResults.length,
      };
    }
  } catch (err) {
    console.warn(`⚠️ Indexed query failed: ${err.message}. Falling back to local search.`);
  }

  // ─── Fallback: local search over all profiles ──────────────
  const allProfiles = await fetchAllProfiles();
  if (!allProfiles.length) {
    return { results: [], total: 0, hasMore: false };
  }

  const filtered = allProfiles
    .filter(p => p.searchName && p.searchName.startsWith(trimmed))
    .filter(p => p.id !== currentUserId);

  if (filtered.length > 0) {
    await setCache(cacheKey, filtered, SEARCH_CACHE_TTL);
  }

  const paginated = filtered.slice(offset, offset + limit);
  return {
    results: paginated,
    total: filtered.length,
    hasMore: offset + limit < filtered.length,
  };
};

/**
 * Searches users or messages with a strict minimum 2-character limit
 * and layered cache for sub-millisecond repeated responses.
 * @param {string} queryTerm - Search input
 * @param {string} type - Search domain ('users' | 'messages')
 * @param {string} currentUserId - Current logged-in user ID
 */
export const searchEntities = async (queryTerm, type = 'users', currentUserId = null) => {
  const trimmed = queryTerm.trim();

  // 1. Minimum 2-character threshold check
  if (!trimmed || trimmed.length < 2) {
    return [];
  }

  const cacheKey = `search_${type}_${trimmed.toLowerCase()}`;

  // 2. Instant Memory/Storage Cache Check
  const cachedResults = await getCache(cacheKey);
  if (cachedResults) {
    return cachedResults;
  }

  // 3. Execution flow
  try {
    if (type === 'users') {
      const response = await searchProfiles(trimmed, currentUserId);
      return response.results;
    }
    
    // Default or unhandled search types return empty set
    return [];
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
};

/**
 * Clears search cache entries from device storage
 */
export const clearSearchCache = async () => {
  try {
    const keys = await getKeys();
    for (const key of keys) {
      if (key.includes('search_')) {
        await removeItem(key);
      }
    }
  } catch (error) {
    console.error('Clear search cache error:', error);
  }
};