// src/services/searchService.js
import { db } from './firebase';
import { ref, query, orderByChild, startAt, endAt, limitToFirst, get } from 'firebase/database';
import { getCache, setCache } from './cacheService';
import { getKeys, removeItem } from './storageService';

const SEARCH_TIMEOUT = 3000;
const SEARCH_CACHE_TTL = 5 * 60; // 5 minutes

let fullIndexCache = null;

/**
 * Fast pre-fetches profile search index as soon as user opens the app or website
 */
export const prefetchProfilesIndex = async (currentUserId) => {
  try {
    const cached = await getCache('search_full_index');
    if (cached) {
      fullIndexCache = cached;
      return;
    }

    const profilesRef = ref(db, 'profiles');
    const q = query(profilesRef, orderByChild('searchName'), limitToFirst(150));
    const snapshot = await get(q);
    const data = snapshot.val();

    if (data) {
      const parsed = Object.entries(data)
        .map(([id, p]) => ({
          id,
          name: p.name || p.displayName || p.username || 'Unknown User',
          username: p.username || '',
          displayName: p.displayName || '',
          country: p.country || '',
          city: p.city || '',
          interests: p.interests || [],
          skills: p.skills || [],
          status: p.status || 'Active',
          lastActive: p.lastActive || 'Just now',
          bio: p.bio || '',
          avatar: p.avatar || '',
          mood: p.mood || 'neutral',
          activeSkin: p.activeSkin || null,
          searchName: p.searchName || (p.name ? p.name.toLowerCase() : ''),
        }))
        .filter((p) => p.id !== currentUserId);

      fullIndexCache = parsed;
      await setCache('search_full_index', parsed, SEARCH_CACHE_TTL);
    }
  } catch (err) {
    console.warn('⚡ Fast prefetch skipped or offline:', err.message);
  }
};

/**
 * Ultra-fast profile search with memory pre-fetch, 1-char threshold & caching
 */
export const searchProfiles = async (
  queryText,
  currentUserId,
  limit = 20,
  offset = 0,
  timeoutMs = SEARCH_TIMEOUT
) => {
  const trimmed = queryText.trim().toLowerCase();
  if (!trimmed) {
    return { results: [], total: 0, hasMore: false };
  }

  const cacheKey = `search_users_${trimmed}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    const filtered = cached.filter((user) => user.id !== currentUserId);
    const paginated = filtered.slice(offset, offset + limit);
    return {
      results: paginated,
      total: filtered.length,
      hasMore: offset + limit < filtered.length,
    };
  }

  // Check pre-fetched local memory cache first for instant sub-millisecond return
  if (fullIndexCache && fullIndexCache.length > 0) {
    const matched = fullIndexCache.filter(
      (u) =>
        u.id !== currentUserId &&
        (u.name?.toLowerCase().includes(trimmed) ||
          u.searchName?.toLowerCase().includes(trimmed) ||
          u.username?.toLowerCase().includes(trimmed))
    );
    if (matched.length > 0) {
      await setCache(cacheKey, matched, SEARCH_CACHE_TTL);
      const paginated = matched.slice(offset, offset + limit);
      return {
        results: paginated,
        total: matched.length,
        hasMore: offset + limit < matched.length,
      };
    }
  }

  // Firebase Realtime DB Query Fallback
  try {
    const profilesRef = ref(db, 'profiles');
    const q = query(
      profilesRef,
      orderByChild('searchName'),
      startAt(trimmed),
      endAt(trimmed + '\uf8ff'),
      limitToFirst(limit + offset + 5)
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
        .filter((u) => u.id !== currentUserId);

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
    console.warn(`⚠️ Indexed query fallback: ${err.message}`);
  }

  return { results: [], total: 0, hasMore: false };
};

/**
 * Searches users or messages with instant cache
 */
export const searchEntities = async (queryTerm, type = 'users', currentUserId = null) => {
  const trimmed = queryTerm.trim();
  if (!trimmed) return [];

  const cacheKey = `search_${type}_${trimmed.toLowerCase()}`;
  const cachedResults = await getCache(cacheKey);
  if (cachedResults) return cachedResults;

  try {
    if (type === 'users') {
      const response = await searchProfiles(trimmed, currentUserId);
      return response.results;
    }
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