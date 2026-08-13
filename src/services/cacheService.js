// src/services/cacheService.js
const CACHE_PREFIX = 'echocache_';
const CACHE_VERSION = 'v2';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

// ─── In‑memory cache (fastest) ────────────────────────────────
const memoryCache = new Map();

const getFullKey = (key) => `${CACHE_PREFIX}${CACHE_VERSION}_${key}`;

/**
 * Get cached data (memory first, then localStorage)
 */
export const getCache = (key) => {
  const fullKey = getFullKey(key);

  // 1. Check memory cache
  if (memoryCache.has(fullKey)) {
    const entry = memoryCache.get(fullKey);
    if (Date.now() < entry.expires) {
      return entry.data;
    } else {
      memoryCache.delete(fullKey);
    }
  }

  // 2. Check localStorage
  try {
    const raw = localStorage.getItem(fullKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.expiry && Date.now() < parsed.expiry) {
      memoryCache.set(fullKey, {
        data: parsed.data,
        expires: parsed.expiry,
      });
      return parsed.data;
    } else {
      localStorage.removeItem(fullKey);
      return null;
    }
  } catch (error) {
    console.warn('Cache get error:', error);
    return null;
  }
};

/**
 * Store data in cache
 */
export const setCache = (key, data, ttlSeconds = 300) => {
  const fullKey = getFullKey(key);
  const expiry = Date.now() + (ttlSeconds * 1000);

  memoryCache.set(fullKey, { data, expires: expiry });

  try {
    const cacheData = {
      data,
      expiry,
      version: CACHE_VERSION,
    };
    localStorage.setItem(fullKey, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Cache set error:', error);
  }
};

/**
 * Remove a specific cache entry
 */
export const clearCache = (key) => {
  const fullKey = getFullKey(key);
  memoryCache.delete(fullKey);
  try {
    localStorage.removeItem(fullKey);
  } catch (error) {
    console.warn('Clear cache error:', error);
  }
};

/**
 * Clear all echo cache
 */
export const clearAllCache = () => {
  memoryCache.clear();
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn('Clear all cache error:', error);
  }
};

// ─── Media cache (Base64) ──────────────────────────────────────
const MEDIA_PREFIX = 'echomedia_';

/**
 * Get cached media (Base64 string)
 */
export const getMediaCache = (url) => {
  if (!url) return null;
  try {
    const key = `${MEDIA_PREFIX}${url}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const item = JSON.parse(raw);
    return item.data || null;
  } catch (e) {
    return null;
  }
};

/**
 * Store media as Base64 in cache
 */
export const setMediaCache = (url, base64) => {
  if (!url || !base64) return;
  try {
    const key = `${MEDIA_PREFIX}${url}`;
    localStorage.setItem(key, JSON.stringify({ data: base64 }));
  } catch (e) {
    console.warn('Media cache error:', e);
  }
};