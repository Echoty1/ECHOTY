// src/services/notesService.js
import { db } from './firebase';
import { ref, set, remove, get, onValue } from 'firebase/database';
import { apiUrl } from '../utils/api';

export const NOTE_MAX_LENGTH = 60;
export const NOTE_TTL_MS = 24 * 60 * 60 * 1000;

// ─── Song attachment limits ────────────────────────────────────
export const SONG_MAX_TITLE = 80;
export const SONG_MAX_ARTIST = 80;

// ─── Core note operations ──────────────────────────────────────
export const saveNote = async (uid, text, song = null) => {
  if (!uid) throw new Error('Missing uid');
  const trimmed = String(text || '').trim().slice(0, NOTE_MAX_LENGTH);

  // A note is valid if it has text OR a song
  if (!trimmed && !song) {
    await removeNote(uid);
    return null;
  }

  const now = Date.now();
  const payload = {
    text: trimmed || '',
    createdAt: now,
    expiresAt: now + NOTE_TTL_MS,
  };

  if (song && song.title && song.sourceUrl) {
    payload.song = {
      provider: String(song.provider || 'unknown').slice(0, 16),
      title: String(song.title).slice(0, SONG_MAX_TITLE),
      artist: String(song.artist || '').slice(0, SONG_MAX_ARTIST),
      artwork: String(song.artwork || '').slice(0, 500),
      sourceUrl: String(song.sourceUrl).slice(0, 500),
    };
  }

  await set(ref(db, `notes/${uid}`), payload);
  return payload;
};

export const removeNote = async (uid) => {
  if (!uid) return;
  await remove(ref(db, `notes/${uid}`));
};

export const fetchLiveNotes = async (filterUids = null) => {
  try {
    const snap = await get(ref(db, 'notes'));
    if (!snap.exists()) return [];
    const now = Date.now();
    const all = Object.entries(snap.val())
      .map(([uid, data]) => ({ uid, ...data }))
      .filter((n) => n && n.expiresAt && n.expiresAt > now && (n.text || n.song));
    const filtered = filterUids
      ? all.filter((n) => filterUids.includes(n.uid))
      : all;
    return filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (err) {
    console.warn('fetchLiveNotes failed', err);
    return [];
  }
};

export const subscribeToNote = (uid, callback) => {
  if (!uid) return () => {};
  const noteRef = ref(db, `notes/${uid}`);
  return onValue(noteRef, (snap) => {
    const data = snap.val();
    if (
      !data ||
      (!data.text && !data.song) ||
      (data.expiresAt && data.expiresAt < Date.now())
    ) {
      callback(null);
    } else {
      callback(data);
    }
  });
};

export const subscribeToAllNotes = (callback) => {
  const notesRef = ref(db, 'notes');
  return onValue(
    notesRef,
    (snap) => {
      const now = Date.now();
      const data = snap.val() || {};
      const live = Object.entries(data)
        .map(([uid, v]) => ({ uid, ...v }))
        .filter((n) => n && (n.text || n.song) && n.expiresAt && n.expiresAt > now)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(live);
    },
    () => callback([])
  );
};

// ─── Reactions ─────────────────────────────────────────────────
export const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👍'];

export const setNoteReaction = async (noteOwnerUid, reactorUid, emoji) => {
  if (!noteOwnerUid || !reactorUid || !emoji) return;
  if (noteOwnerUid === reactorUid) return;
  try {
    await set(ref(db, `notes/${noteOwnerUid}/reactions/${reactorUid}`), emoji);
  } catch (err) {
    console.warn('setNoteReaction failed', err);
  }
};

export const removeNoteReaction = async (noteOwnerUid, reactorUid) => {
  if (!noteOwnerUid || !reactorUid) return;
  try {
    await remove(ref(db, `notes/${noteOwnerUid}/reactions/${reactorUid}`));
  } catch (err) {
    console.warn('removeNoteReaction failed', err);
  }
};

// ─── Seen / viewer tracking ────────────────────────────────────
export const markNoteSeen = async (noteOwnerUid, viewerUid) => {
  if (!noteOwnerUid || !viewerUid) return;
  if (noteOwnerUid === viewerUid) return;
  try {
    await set(
      ref(db, `notes/${noteOwnerUid}/viewers/${viewerUid}`),
      Date.now()
    );
  } catch (err) {
    console.warn('markNoteSeen failed', err);
  }
};

export const subscribeToNoteViewers = (noteOwnerUid, callback) => {
  if (!noteOwnerUid) return () => {};
  const viewersRef = ref(db, `notes/${noteOwnerUid}/viewers`);
  return onValue(
    viewersRef,
    (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .map(([uid, ts]) => ({ uid, seenAt: ts }))
        .sort((a, b) => (b.seenAt || 0) - (a.seenAt || 0));
      callback(list);
    },
    () => callback([])
  );
};

// ─── Emoji-only detection ──────────────────────────────────────
const EMOJI_ONLY_REGEX =
  /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\uFE0F|\u200D|\s)+$/u;

export const isEmojiOnly = (text) => {
  if (!text) return false;
  const trimmed = String(text).trim();
  if (!trimmed) return false;
  if (/^[\d#*]+$/.test(trimmed)) return false;
  return EMOJI_ONLY_REGEX.test(trimmed);
};

export const isSingleEmoji = (text) => {
  if (!text) return false;
  const trimmed = String(text).trim();
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
      const graphemes = [...seg.segment(trimmed)].map((s) => s.segment);
      return graphemes.length === 1 && isEmojiOnly(trimmed);
    } catch {
      /* fall through */
    }
  }
  return isEmojiOnly(trimmed) && [...trimmed].length <= 2;
};

// ─── NEW: Music link lookup via backend proxy ──────────────────
export const lookupSongLink = async (url) => {
  if (!url || typeof url !== 'string') return null;
  try {
    const res = await fetch(apiUrl('/api/oembed'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.title) return null;
    return {
      provider: data.provider,
      title: String(data.title).slice(0, SONG_MAX_TITLE),
      artist: String(data.artist || '').slice(0, SONG_MAX_ARTIST),
      artwork: data.artwork || '',
      sourceUrl: data.sourceUrl || url,
    };
  } catch (err) {
    console.warn('lookupSongLink failed', err);
    return null;
  }
};
