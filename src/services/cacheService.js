// src/services/cacheService.js
import { getItem, setItem, removeItem, getKeys } from './storageService';

const CACHE_PREFIX = 'echo_cache_';
const CACHE_VERSION = 'v2';

// ─── In-memory cache (fastest) ────────────────────────────────
const memoryCache = new Map();

/**
 * Get cached data (memory first, then storage)
 */
export const getCache = async (key) => {
  const fullKey = `${CACHE_PREFIX}${CACHE_VERSION}_${key}`;
  
  // 1. Check memory cache (fastest)
  if (memoryCache.has(fullKey)) {
    const entry = memoryCache.get(fullKey);
    if (Date.now() < entry.expires) {
      return entry.data;
    } else {
      memoryCache.delete(fullKey);
    }
  }

  // 2. Check storage (localStorage / Capacitor)
  try {
    const raw = await getItem(fullKey);
    if (!raw) return null;
    
    const parsed = JSON.parse(raw);
    if (parsed.expiry && Date.now() < parsed.expiry) {
      // Store in memory for next time
      memoryCache.set(fullKey, { 
        data: parsed.data, 
        expires: parsed.expiry 
      });
      return parsed.data;
    } else {
      // Expired – clean up
      await removeItem(fullKey);
      return null;
    }
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
};

/**
 * Store data in cache
 */
export const setCache = async (key, data, ttlSeconds = 300) => {
  const fullKey = `${CACHE_PREFIX}${CACHE_VERSION}_${key}`;
  const expiry = Date.now() + (ttlSeconds * 1000);
  
  // Store in memory
  memoryCache.set(fullKey, { data, expires: expiry });
  
  // Store in persistent storage (async background task)
  const cacheData = {
    data,
    expiry,
    version: CACHE_VERSION,
  };

  setItem(fullKey, JSON.stringify(cacheData)).catch((error) => {
    console.error('Cache set error:', error);
  });
};

/**
 * Remove a specific cache entry
 */
export const clearCache = async (key) => {
  const fullKey = `${CACHE_PREFIX}${CACHE_VERSION}_${key}`;
  memoryCache.delete(fullKey);
  try {
    await removeItem(fullKey);
  } catch (error) {
    console.error('Clear cache error:', error);
  }
};

/**
 * Clear all echo cache
 */
export const clearAllCache = async () => {
  memoryCache.clear();
  try {
    const keys = await getKeys();
    for (const key of keys) {
      if (key.startsWith(CACHE_PREFIX)) {
        await removeItem(key);
      }
    }
  } catch (error) {
    console.error('Clear all cache error:', error);
  }
};

/**
 * Check if cache is valid (version matches)
 */
export const isCacheValid = async (key) => {
  const fullKey = `${CACHE_PREFIX}${CACHE_VERSION}_${key}`;
  
  if (memoryCache.has(fullKey)) {
    const entry = memoryCache.get(fullKey);
    return Date.now() < entry.expires;
  }

  try {
    const raw = await getItem(fullKey);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return data.version === CACHE_VERSION && Date.now() < data.expiry;
  } catch {
    return false;
  }
};