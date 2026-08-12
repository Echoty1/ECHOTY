// src/services/storageService.js
import { Preferences } from '@capacitor/preferences';

// Detect if running in a native app (Capacitor) or web browser
export const isNativeApp = () => {
  return (
    typeof window !== 'undefined' &&
    window.hasOwnProperty('Capacitor') &&
    window.Capacitor.isNative
  );
};

// ─── Get an item ──────────────────────────────────────────────
export const getItem = async (key) => {
  try {
    if (isNativeApp()) {
      const { value } = await Preferences.get({ key });
      return value;
    } else {
      return localStorage.getItem(key);
    }
  } catch (error) {
    console.error(`Error getting ${key}:`, error);
    return null;
  }
};

// ─── Set an item (With QuotaExceeded Protection & Auto-Cleanup) ───
export const setItem = async (key, value) => {
  const stringVal = String(value);

  // 1. Native Mobile App (Capacitor Preferences)
  if (isNativeApp()) {
    try {
      await Preferences.set({ key, value: stringVal });
      return true;
    } catch (error) {
      console.error(`Native storage error setting ${key}:`, error);
      return false;
    }
  }

  // 2. Web Browser (localStorage)
  try {
    localStorage.setItem(key, stringVal);
    return true;
  } catch (error) {
    // Detect LocalStorage Quota Exceeded
    if (
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014
    ) {
      console.warn('⚠️ LocalStorage quota exceeded. Evicting old echo cache entries...');

      try {
        // Collect and remove all echo_cache keys to free space
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('echo_cache_')) {
            keysToRemove.push(k);
          }
        }

        keysToRemove.forEach((k) => localStorage.removeItem(k));

        // Retry saving after cleanup
        localStorage.setItem(key, stringVal);
        console.log(`✅ Successfully saved ${key} after clearing cache.`);
        return true;
      } catch (retryError) {
        console.error('❌ Failed to save item even after clearing cache:', retryError);
      }
    } else {
      console.error(`Error setting ${key}:`, error);
    }
    return false;
  }
};

// ─── Remove an item ──────────────────────────────────────────
export const removeItem = async (key) => {
  try {
    if (isNativeApp()) {
      await Preferences.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
    return true;
  } catch (error) {
    console.error(`Error removing ${key}:`, error);
    return false;
  }
};

// ─── Clear all ──────────────────────────────────────────────
export const clearStorage = async () => {
  try {
    if (isNativeApp()) {
      await Preferences.clear();
    } else {
      localStorage.clear();
    }
    return true;
  } catch (error) {
    console.error('Error clearing storage:', error);
    return false;
  }
};

// ─── Get all keys ──────────────────────────────────────────────
export const getKeys = async () => {
  try {
    if (isNativeApp()) {
      const { keys } = await Preferences.keys();
      return keys;
    } else {
      return Object.keys(localStorage);
    }
  } catch (error) {
    console.error('Error getting keys:', error);
    return [];
  }
};