// src/services/gifLibraryService.js
import { ref, get } from 'firebase/database';
import { db } from './firebase';
import { getCache, setCache } from './cacheService';

const CACHE_KEY = 'gif_library';
const CACHE_TTL = 60 * 60; // 1 hour

export const fetchGifLibrary = async (forceRefresh = false) => {
  if (!forceRefresh) {
    const cached = await getCache(CACHE_KEY);
    if (cached) return cached;
  }

  try {
    const snapshot = await get(ref(db, 'gifLibrary'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      // Convert object to array
      const library = Object.entries(data).map(([id, item]) => ({
        id,
        ...item,
      }));
      await setCache(CACHE_KEY, library, CACHE_TTL);
      return library;
    }
    return [];
  } catch (err) {
    console.error('Failed to fetch GIF library:', err);
    // Return cached data even if expired, as fallback
    const cached = await getCache(CACHE_KEY);
    return cached || [];
  }
};

export const getGifById = async (id) => {
  const library = await fetchGifLibrary();
  return library.find(item => item.id === id) || null;
};