// src/services/searchService.js
import { db } from './firebase';
import { ref, query, orderByChild, startAt, endAt, limitToFirst, get } from 'firebase/database';
import { getCache, setCache } from './cacheService';

const SEARCH_TIMEOUT = 5000;
const SEARCH_CACHE_TTL = 5 * 60;

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

  try {
    // ─── Use searchName (lowercase) index ───────────────────
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
    if (!data) return [];

    const results = Object.entries(data)
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
      }))
      .filter((user) => user.id !== currentUserId);

    if (results.length > 0) {
      setCache(cacheKey, results, SEARCH_CACHE_TTL);
    }
    return results;
  } catch (error) {
    console.error('❌ [searchService] Search error:', error);
    const fallback = getCache(cacheKey);
    if (fallback) return fallback.filter(user => user.id !== currentUserId);
    return [];
  }
};

export const clearSearchCache = () => {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith('echo_cache_search_')) {
      localStorage.removeItem(key);
    }
  });
};