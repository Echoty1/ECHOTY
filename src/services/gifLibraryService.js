// src/services/gifLibraryService.js
import { ref, get } from 'firebase/database';
import { db } from './firebase';
import { getCache, setCache } from './cacheService';
import { resolveAssetUrl } from '../utils/assetUrl';

const CACHE_KEY = 'gif_library';
const CACHE_TTL = 60 * 60;

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
        url: resolveAssetUrl(item.url),
      }));
      await setCache(CACHE_KEY, library, CACHE_TTL);
      return library;
    }
    return [];
  } catch {
    const cached = await getCache(CACHE_KEY);
    return cached || [];
  }
};

export const getGifById = async (id) => {
  const library = await fetchGifLibrary();
  return library.find((item) => item.id === id) || null;
};
