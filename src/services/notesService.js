// src/services/notesService.js
import { db } from './firebase';
import { ref, set, remove, get, onValue } from 'firebase/database';

export const NOTE_MAX_LENGTH = 60;
export const NOTE_TTL_MS = 24 * 60 * 60 * 1000;

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
  return onValue(notesRef, (snap) => {
    const now = Date.now();
    const data = snap.val() || {};
    const live = Object.entries(data)
      .map(([uid, v]) => ({ uid, ...v }))
      .filter((n) => n && n.text && n.expiresAt && n.expiresAt > now)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(live);
  }, () => callback([]));
};