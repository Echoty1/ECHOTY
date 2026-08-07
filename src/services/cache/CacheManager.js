// src/services/cache/CacheManager.js
// Simple in‑memory cache with localStorage fallback

const CACHE_KEY = 'echo_v2_profiles';
let memoryCache = new Map();

// Load from localStorage on init
export const loadCache = () => {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      data.forEach(item => memoryCache.set(item.id, item));
    }
    return Promise.resolve(memoryCache);
  } catch (e) {
    return Promise.resolve(memoryCache);
  }
};

export const getProfile = (uid) => memoryCache.get(uid) || null;

export const setProfile = (uid, data) => {
  memoryCache.set(uid, data);
  // persist to localStorage
  try {
    const all = Array.from(memoryCache.values());
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch (e) { /* ignore */ }
};

export const getAllProfiles = () => Array.from(memoryCache.values());

export const clearCache = () => {
  memoryCache.clear();
  localStorage.removeItem(CACHE_KEY);
};