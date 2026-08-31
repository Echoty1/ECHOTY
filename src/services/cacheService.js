// src/services/cacheService.js
import {
  storeProfile,
  getProfile as getProfileFromDB,
  getAllProfiles,
  clearProfiles,
  storeChatList,
  getChatList,
  clearChatList,
  getCacheItem,
  setCacheItem,
  deleteCacheItem,
  clearCacheStore,
} from './indexedDBService';
import { getItem, setItem, removeItem } from './storageService';

// ─── Constants ────────────────────────────────────────────────────
const CACHE_PREFIX = 'echo_cache_'; // Only used for memory cache keys
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

// ─── In‑memory cache for speed ──────────────────────────────────
let memoryCache = new Map();
let cacheLoaded = false;

// ─── Profile cache (IndexedDB) ──────────────────────────────────
export const loadCache = async () => {
  if (cacheLoaded) return memoryCache;
  try {
    const profiles = await getAllProfiles();
    profiles.forEach(p => memoryCache.set(p.uid, p));
    cacheLoaded = true;
  } catch (err) {
    console.warn('Failed to load profiles into cache:', err);
  }
  return memoryCache;
};

export const getProfile = (uid) => {
  if (!uid) return null;
  return memoryCache.get(uid) || null;
};

export const setProfile = async (uid, data) => {
  if (!uid || !data) return;
  memoryCache.set(uid, data);
  await storeProfile(uid, data);
};

export const getAllProfilesFromCache = () => Array.from(memoryCache.values());

export const clearCache = async () => {
  memoryCache.clear();
  cacheLoaded = false;
  await clearProfiles();
};

// ─── Chat list cache (IndexedDB) ──────────────────────────────
export const getChatListFromCache = async (uid) => {
  if (!uid) return null;
  return await getChatList(uid);
};

export const setChatListCache = async (uid, chatList) => {
  if (!uid) return;
  await storeChatList(uid, chatList);
};

export const clearChatListCache = async (uid) => {
  if (!uid) return;
  await clearChatList(uid);
};

// ─── Generic cache (IndexedDB) for search, etc. ──────────────
export const getCache = async (key) => {
  const fullKey = `${CACHE_PREFIX}${key}`;
  // Check memory cache first
  if (memoryCache.has(fullKey)) {
    const entry = memoryCache.get(fullKey);
    if (Date.now() < entry.expires) {
      return entry.data;
    } else {
      memoryCache.delete(fullKey);
    }
  }
  // Check IndexedDB
  try {
    const cached = await getCacheItem(fullKey);
    if (cached && cached.expiry && Date.now() < cached.expiry) {
      memoryCache.set(fullKey, { data: cached.value, expires: cached.expiry });
      return cached.value;
    } else if (cached) {
      // Expired, remove
      await deleteCacheItem(fullKey);
      return null;
    }
  } catch (error) {
    console.warn('Cache get error:', error);
    return null;
  }
  return null;
};

export const setCache = async (key, data, ttlSeconds = 300) => {
  const fullKey = `${CACHE_PREFIX}${key}`;
  const expiry = Date.now() + (ttlSeconds * 1000);
  memoryCache.set(fullKey, { data, expires: expiry });
  try {
    await setCacheItem(fullKey, data, expiry);
  } catch (error) {
    console.warn('Cache set error:', error);
  }
};

export const clearCacheEntry = async (key) => {
  const fullKey = `${CACHE_PREFIX}${key}`;
  memoryCache.delete(fullKey);
  try {
    await deleteCacheItem(fullKey);
  } catch (error) {
    console.warn('Clear cache error:', error);
  }
};

export const clearAllCache = async () => {
  const keysToDelete = [];
  memoryCache.forEach((_, key) => {
    if (key.startsWith(CACHE_PREFIX)) keysToDelete.push(key);
  });
  keysToDelete.forEach(key => memoryCache.delete(key));
  try {
    await clearCacheStore();
  } catch (error) {
    console.warn('Clear all cache error:', error);
  }
};

// ─── Recovery flag (localStorage) ──────────────────────────────
export const getRecoveryFlag = (uid) => {
  if (!uid) return false;
  try {
    const flag = localStorage.getItem(`echo_has_recovered_${uid}`);
    return flag === 'true';
  } catch { return false; }
};

export const setRecoveryFlag = (uid, value) => {
  if (!uid) return;
  try {
    localStorage.setItem(`echo_has_recovered_${uid}`, String(value));
  } catch {}
};

// ─── Media cache (IndexedDB) re‑export ──────────────────────────
export { getMedia, storeMedia, clearMediaCache } from './indexedDBService';