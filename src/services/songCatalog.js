// src/services/songCatalog.js
import { db } from './firebase';
import { ref, onValue, get } from 'firebase/database';
import { apiUrl } from '../utils/api';

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

export const searchCatalog = (catalog, query) => {
  if (!query || !query.trim()) return catalog;
  const q = query.toLowerCase().trim();
  return catalog.filter(
    (s) =>
      (s.title || '').toLowerCase().includes(q) ||
      (s.artist || '').toLowerCase().includes(q)
  );
};

export const findCatalogTrack = (catalog, trackId) => {
  if (!trackId) return null;
  return catalog.find((s) => s.trackId === trackId) || null;
};

export const extractSpotifyTrackId = (url) => {
  if (!url) return null;
  const m = String(url).match(/open\.spotify\.com\/track\/([A-Za-z0-9]{22})/);
  return m ? m[1] : null;
};

/**
 * Look up a song by URL via the backend. Returns the song object with preview
 * if available, or { error } on failure.
 */
export const lookupSongByUrl = async (url) => {
  try {
    const res = await fetch(apiUrl('/api/song-lookup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() }),
    });
    if (!res.ok) {
      let msg = 'Could not read that link.';
      try {
        const body = await res.json();
        if (body?.error) msg = body.error;
      } catch (_) {}
      return { error: msg };
    }
    const data = await res.json();
    if (!data?.song) return { error: 'Song not found.' };
    return data.song;
  } catch (err) {
    console.warn('lookupSongByUrl failed', err);
    return { error: 'Network error. Try again.' };
  }
};
