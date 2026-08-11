// src/services/storageService.js
import { Preferences } from '@capacitor/preferences';

// Detect if we're running in a native app (Capacitor) or web
export const isNativeApp = () => {
  return typeof window !== 'undefined' &&
         window.hasOwnProperty('Capacitor') &&
         window.Capacitor.isNative;
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

// ─── Set an item ──────────────────────────────────────────────
export const setItem = async (key, value) => {
  try {
    if (isNativeApp()) {
      await Preferences.set({ key, value: String(value) });
    } else {
      localStorage.setItem(key, value);
    }
    return true;
  } catch (error) {
    console.error(`Error setting ${key}:`, error);
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