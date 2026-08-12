// src/services/gifLibraryService.js
import { ref, get } from 'firebase/database';
import { db } from './firebase';
import { getCache, setCache } from './cacheService';

const CACHE_KEY = 'gif_library';
const CACHE_TTL = 60 * 60; // 1 hour

// src/services/gifLibraryService.js
const resolveUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // In development: http://localhost:3000/videos/library/...
  // In production: https://your-app.com/videos/library/...
  return window.location.origin + (url.startsWith('/') ? url : '/' + url);
};

export const fetchGifLibrary = async (forceRefresh = false) => {
  if (!forceRefresh) {
    const cached = await getCache(CACHE_KEY);
    if (cached) return cached;
  }

  try {
    const snapshot = await get(ref(db, 'gifLibrary'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      const library = Object.entries(data).map(([id, item]) => ({
        id,
        ...item,
        url: resolveUrl(item.url), // ensure absolute URL
      }));
      await setCache(CACHE_KEY, library, CACHE_TTL);
      return library;
    }
    return [];
  } catch (err) {
    console.error('Failed to fetch GIF library:', err);
    const cached = await getCache(CACHE_KEY);
    return cached || [];
  }
};

export const getGifById = async (id) => {
  const library = await fetchGifLibrary();
  return library.find(item => item.id === id) || null;
};