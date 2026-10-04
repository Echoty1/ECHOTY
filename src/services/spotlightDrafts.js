// src/services/spotlightDrafts.js

const DB_NAME = 'echo_spotlight_drafts';
const DB_VERSION = 1;
const STORE = 'drafts';

let dbPromise = null;

const openDB = () => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
};

const tx = async (mode, fn) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    try {
      result = fn(store);
    } catch (err) {
      reject(err);
      return;
    }
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
};

/**
 * Save a draft. `blob` is the raw video/image Blob.
 * `meta` may contain: mediaType, caption, duration, width, height, posterBlob.
 */
export const saveDraft = async (blob, meta = {}) => {
  if (!blob) return null;
  const id = meta.id || `draft_${Date.now()}`;
  const record = {
    id,
    blob,
    mediaType: meta.mediaType || 'video',
    caption: meta.caption || '',
    duration: meta.duration || 0,
    width: meta.width || 0,
    height: meta.height || 0,
    posterBlob: meta.posterBlob || null,
    savedAt: Date.now(),
  };
  await tx('readwrite', (store) => store.put(record));
  return id;
};

export const getDraft = async (id) => {
  if (!id) return null;
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const t = db.transaction(STORE, 'readonly');
      const store = t.objectStore(STORE);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
};

export const listDrafts = async () => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const t = db.transaction(STORE, 'readonly');
      const store = t.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []).sort((a, b) => b.savedAt - a.savedAt);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
};

export const deleteDraft = async (id) => {
  if (!id) return;
  await tx('readwrite', (store) => store.delete(id));
};

export const clearAllDrafts = async () => {
  await tx('readwrite', (store) => store.clear());
};
