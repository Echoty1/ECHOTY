// src/services/cacheService.js
import {
  storeProfile,
  getProfile as getProfileFromDB,
  getAllProfiles,
  clearProfiles,
  storeChatList,
  getChatList,
  clearChatList,
} from './indexedDBService';
import { getItem, setItem, removeItem } from './storageService';

// ─── Constants ────────────────────────────────────────────────────
const CACHE_PREFIX = 'echo_small_';
const CACHE_VERSION = 'v2';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

// ─── In‑memory cache for speed ──────────────────────────────────
let memoryCache = new Map();
let cacheLoaded = false;

// ─── Profile cache ──────────────────────────────────────────────
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

// ─── Small cache helpers (localStorage) ──────────────────────
const getSmallKey = (key) => `${CACHE_PREFIX}${CACHE_VERSION}_${key}`;

export const getCache = (key) => {
  const fullKey = getSmallKey(key);
  if (memoryCache.has(fullKey)) {
    const entry = memoryCache.get(fullKey);
    if (Date.now() < entry.expires) {
      return entry.data;
    } else {
      memoryCache.delete(fullKey);
    }
  }
  try {
    const raw = localStorage.getItem(fullKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.expiry && Date.now() < parsed.expiry) {
      memoryCache.set(fullKey, { data: parsed.data, expires: parsed.expiry });
      return parsed.data;
    } else {
      localStorage.removeItem(fullKey);
      return null;
    }
  } catch (error) {
    console.warn('Small cache get error:', error);
    return null;
  }
};

export const setCache = (key, data, ttlSeconds = 300) => {
  const fullKey = getSmallKey(key);
  const expiry = Date.now() + (ttlSeconds * 1000);
  memoryCache.set(fullKey, { data, expires: expiry });
  try {
    localStorage.setItem(fullKey, JSON.stringify({ data, expiry, version: CACHE_VERSION }));
  } catch (error) {
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      console.warn('⚠️ Small cache quota exceeded. Cleaning up...');
      try {
        const keys = Object.keys(localStorage)
          .filter(k => k.startsWith(CACHE_PREFIX))
          .sort();
        const toRemove = keys.slice(0, Math.floor(keys.length / 2) || keys.length);
        toRemove.forEach(k => localStorage.removeItem(k));
        localStorage.setItem(fullKey, JSON.stringify({ data, expiry, version: CACHE_VERSION }));
      } catch (retryError) {
        console.error('Failed to store small cache after cleanup:', retryError);
      }
    } else {
      console.warn('Small cache set error:', error);
    }
  }
};

export const clearCacheEntry = (key) => {
  const fullKey = getSmallKey(key);
  memoryCache.delete(fullKey);
  try {
    localStorage.removeItem(fullKey);
  } catch (error) {
    console.warn('Clear small cache error:', error);
  }
};

export const clearAllCache = () => {
  const keysToDelete = [];
  memoryCache.forEach((_, key) => {
    if (key.startsWith(CACHE_PREFIX)) keysToDelete.push(key);
  });
  keysToDelete.forEach(key => memoryCache.delete(key));
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn('Clear all small cache error:', error);
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