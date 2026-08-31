// src/services/cache/CacheManager.js
// Simple in‑memory cache with storage fallback
import { getItem, setItem, removeItem } from '../storageService';

const CACHE_KEY = 'echo_v2_profiles';
let memoryCache = new Map();

// Load from storage on init
export const loadCache = async () => {
  try {
    const stored = await getItem(CACHE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      data.forEach(item => memoryCache.set(item.id, item));
    }
    return memoryCache;
  } catch (e) {
    console.warn('Failed to load cache:', e);
    return memoryCache;
  }
};

export const getProfile = (uid) => memoryCache.get(uid) || null;

export const setProfile = async (uid, data) => {
  memoryCache.set(uid, data);
  // persist to storage
  try {
    const all = Array.from(memoryCache.values());
    await setItem(CACHE_KEY, JSON.stringify(all));
  } catch (e) { /* ignore */ }
};

export const getAllProfiles = () => Array.from(memoryCache.values());

export const clearCache = async () => {
  memoryCache.clear();
  try {
    await removeItem(CACHE_KEY);
  } catch (e) { /* ignore */ }
};