// src/services/searchService.js
import { db } from './firebase';
import { ref, get } from 'firebase/database';
import { getCache, setCache, getProfile as getCachedProfile } from './cacheService';
import { getKeys, removeItem } from './storageService';

const SEARCH_TIMEOUT = 3000;
const SEARCH_CACHE_TTL = 5 * 60; // 5 minutes

let fullIndexCache = null;

const DEMO_UID = 'k9Cs6QPfDRNTputzic7V3xRUof63';
const SUPPORT_UID = 'hD7tJzPVI1VSorhok8GToBC6VDy1';

export const prefetchProfilesIndex = async (currentUserId) => {
  if (currentUserId === DEMO_UID) {
    console.log('🚫 Skipping profile prefetch for demo user.');
    return;
  }

  try {
    const cached = await getCache('search_full_index');
    if (cached) {
      fullIndexCache = cached;
      return;
    }

    const profilesRef = ref(db, 'profiles');
    const snapshot = await get(profilesRef);
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

  // ─── Demo: only return support if the query matches support's name ──
  if (currentUserId === DEMO_UID) {
    let supportProfile = getCachedProfile(SUPPORT_UID);
    if (!supportProfile) {
      try {
        const snap = await get(ref(db, `profiles/${SUPPORT_UID}`));
        supportProfile = snap.exists() ? snap.val() : null;
      } catch (_) {
        supportProfile = null;
      }
    }
    if (supportProfile) {
      const supportName = (supportProfile.name || '').toLowerCase();
      const supportUsername = (supportProfile.username || '').toLowerCase();
      const supportSearchName = (supportProfile.searchName || '').toLowerCase();
      // Check if query matches support's name or username
      if (supportName.includes(trimmed) || supportUsername.includes(trimmed) || supportSearchName.includes(trimmed)) {
        return {
          results: [{ id: SUPPORT_UID, ...supportProfile, name: supportProfile.name || 'ECHO Support' }],
          total: 1,
          hasMore: false,
        };
      } else {
        // No match: return empty (UI will show custom message)
        return { results: [], total: 0, hasMore: false };
      }
    }
    return { results: [], total: 0, hasMore: false };
  }

  // ─── Normal search flow ──────────────────────────────────────
  const cacheKey = `search_users_${trimmed}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    let filtered = cached.filter((user) => user.id !== currentUserId);
    if (currentUserId !== SUPPORT_UID) {
      filtered = filtered.filter(u => u.id !== DEMO_UID);
    }
    const paginated = filtered.slice(offset, offset + limit);
    return {
      results: paginated,
      total: filtered.length,
      hasMore: offset + limit < filtered.length,
    };
  }

  // ─── Fallback: fetch all profiles and filter client‑side ──
  try {
    const profilesRef = ref(db, 'profiles');
    const snapshot = await Promise.race([
      get(profilesRef),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Search timeout')), timeoutMs)),
    ]);

    const data = snapshot.val();
    if (!data) return { results: [], total: 0, hasMore: false };

    let allResults = Object.entries(data)
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
      .filter((u) => {
        if (u.id === currentUserId) return false;
        if (currentUserId !== SUPPORT_UID && u.id === DEMO_UID) return false;

        const name = (u.name || '').toLowerCase();
        const username = (u.username || '').toLowerCase();
        const searchName = (u.searchName || '').toLowerCase();
        return name.includes(trimmed) || username.includes(trimmed) || searchName.includes(trimmed);
      });

    allResults.sort((a, b) => {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      const aStartsWith = aName.startsWith(trimmed);
      const bStartsWith = bName.startsWith(trimmed);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      return aName.localeCompare(bName);
    });

    if (allResults.length > 0) {
      await setCache(cacheKey, allResults, SEARCH_CACHE_TTL);
    }

    const paginated = allResults.slice(offset, offset + limit);
    return {
      results: paginated,
      total: allResults.length,
      hasMore: offset + limit < allResults.length,
    };
  } catch (err) {
    console.warn(`⚠️ Search failed: ${err.message}`);
  }

  return { results: [], total: 0, hasMore: false };
};

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