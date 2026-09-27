// src/services/notesService.js
import { db } from './firebase';
import { ref, set, remove, get, onValue } from 'firebase/database';

export const NOTE_MAX_LENGTH = 60;
export const NOTE_TTL_MS = 24 * 60 * 60 * 1000;

// ─── Core note operations ──────────────────────────────────────
export const saveNote = async (uid, text) => {
  if (!uid) throw new Error('Missing uid');
  const trimmed = String(text || '').trim().slice(0, NOTE_MAX_LENGTH);
  if (!trimmed) {
    await removeNote(uid);
    return null;
  }
  const now = Date.now();
  const payload = {
    text: trimmed,
    createdAt: now,
    expiresAt: now + NOTE_TTL_MS,
  };
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
      .filter((n) => n && n.expiresAt && n.expiresAt > now && n.text);
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
    if (!data || !data.text || (data.expiresAt && data.expiresAt < Date.now())) {
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
        .filter((n) => n && n.text && n.expiresAt && n.expiresAt > now)
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
