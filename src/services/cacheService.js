// src/services/cacheService.js

const CACHE_PREFIX = 'echo_cache_';
const CACHE_VERSION = 'v1';

/**
 * Get cached data by key.
 * Returns null if expired or not found.
 */
export const getCache = (key) => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Check expiration (optional)
    if (data.expires && Date.now() > data.expires) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return data.value;
  } catch {
    return null;
  }
};

/**
 * Store data in cache with optional TTL (in seconds).
 */
export const setCache = (key, value, ttl = 3600) => {
  try {
    const data = {
      value,
      expires: Date.now() + ttl * 1000,
      version: CACHE_VERSION,
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
  } catch (e) {
    // If quota exceeded, clear old caches
    clearAllCache();
  }
};

/**
 * Clear all echo cache.
 */
export const clearAllCache = () => {
  const keys = Object.keys(localStorage);
  keys.forEach(k => {
    if (k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
  });
};

/**
 * Check if cache is valid (version matches).
 */
export const isCacheValid = (key) => {
  const raw = localStorage.getItem(CACHE_PREFIX + key);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    return data.version === CACHE_VERSION && (!data.expires || Date.now() < data.expires);
  } catch {
    return false;
  }
};