// src/services/songCatalog.js
import { db } from './firebase';
import { ref, onValue, get } from 'firebase/database';

/**
 * Subscribe to the full catalog. Callback receives an array sorted by addedAt desc.
 */
export const subscribeToSongCatalog = (callback) => {
  const catalogRef = ref(db, 'songCatalog');
  return onValue(
    catalogRef,
    (snap) => {
      const data = snap.val() || {};
      const list = Object.values(data).sort(
        (a, b) => (b.addedAt || 0) - (a.addedAt || 0)
      );
      callback(list);
    },
    () => callback([])
  );
};

/**
 * One-shot fetch of the catalog.
 */
export const fetchSongCatalog = async () => {
  try {
    const snap = await get(ref(db, 'songCatalog'));
    const data = snap.val() || {};
    return Object.values(data).sort(
      (a, b) => (b.addedAt || 0) - (a.addedAt || 0)
    );
  } catch (err) {
    console.warn('fetchSongCatalog failed', err);
    return [];
  }
};

/**
 * Case-insensitive search across title + artist.
 */
export const searchCatalog = (catalog, query) => {
  if (!query || !query.trim()) return catalog;
  const q = query.toLowerCase().trim();
  return catalog.filter(
    (s) =>
      (s.title || '').toLowerCase().includes(q) ||
      (s.artist || '').toLowerCase().includes(q)
  );
};

/**
 * Check if a track ID exists in the catalog.
 */
export const findCatalogTrack = (catalog, trackId) => {
  if (!trackId) return null;
  return catalog.find((s) => s.trackId === trackId) || null;
};

/**
 * Extract a 22-char Spotify track ID from a URL.
 */
export const extractSpotifyTrackId = (url) => {
  if (!url) return null;
  const m = String(url).match(/open\.spotify\.com\/track\/([A-Za-z0-9]{22})/);
  return m ? m[1] : null;
};
