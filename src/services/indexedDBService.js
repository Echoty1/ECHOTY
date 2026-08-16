// src/services/indexedDBService.js
import { openDB } from 'idb';

const DB_NAME = 'echo-db';
const DB_VERSION = 2; // Incremented from 1 to add 'chatList' store

let dbPromise = null;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Profiles store
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'uid' });
        }
        // Chat messages store (per chat)
        if (!db.objectStoreNames.contains('chatMessages')) {
          db.createObjectStore('chatMessages', { keyPath: 'chatId' });
        }
        // Media cache store (blobs)
        if (!db.objectStoreNames.contains('mediaCache')) {
          db.createObjectStore('mediaCache', { keyPath: 'url' });
        }
        // Individual message cache store
        if (!db.objectStoreNames.contains('messageCache')) {
          db.createObjectStore('messageCache', { keyPath: 'id' });
        }
        // ✅ New store for chat list (per user)
        if (!db.objectStoreNames.contains('chatList')) {
          db.createObjectStore('chatList', { keyPath: 'uid' });
        }
      },
    });
  }
  return dbPromise;
};

// ─── Profiles ────────────────────────────────────────────────────
export const storeProfile = async (uid, profile) => {
  const db = await getDB();
  const tx = db.transaction('profiles', 'readwrite');
  await tx.store.put({ uid, ...profile });
  await tx.done;
};

export const getProfile = async (uid) => {
  const db = await getDB();
  const tx = db.transaction('profiles', 'readonly');
  const profile = await tx.store.get(uid);
  await tx.done;
  return profile || null;
};

export const getAllProfiles = async () => {
  const db = await getDB();
  const tx = db.transaction('profiles', 'readonly');
  const profiles = await tx.store.getAll();
  await tx.done;
  return profiles;
};

export const clearProfiles = async () => {
  const db = await getDB();
  const tx = db.transaction('profiles', 'readwrite');
  await tx.store.clear();
  await tx.done;
};

// ─── Chat Messages (full chat history) ──────────────────────────
export const storeChatMessages = async (chatId, messages) => {
  const db = await getDB();
  const tx = db.transaction('chatMessages', 'readwrite');
  await tx.store.put({ chatId, messages });
  await tx.done;
};

export const getChatMessages = async (chatId) => {
  const db = await getDB();
  const tx = db.transaction('chatMessages', 'readonly');
  const entry = await tx.store.get(chatId);
  await tx.done;
  return entry ? entry.messages : [];
};

// ─── Individual Message Cache ──────────────────────────────────
export const storeMessage = async (message) => {
  const db = await getDB();
  const tx = db.transaction('messageCache', 'readwrite');
  await tx.store.put(message);
  await tx.done;
};

export const getMessagesForChat = async (chatId) => {
  const db = await getDB();
  const tx = db.transaction('messageCache', 'readonly');
  const all = await tx.store.getAll();
  const filtered = all.filter(msg => msg.chatId === chatId);
  await tx.done;
  return filtered.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
};

export const clearMessagesForChat = async (chatId) => {
  const db = await getDB();
  const tx = db.transaction('messageCache', 'readwrite');
  const all = await tx.store.getAll();
  const toDelete = all.filter(msg => msg.chatId === chatId);
  for (const msg of toDelete) {
    await tx.store.delete(msg.id);
  }
  await tx.done;
};

// ─── Media Cache ─────────────────────────────────────────────────
export const storeMedia = async (url, blob) => {
  const db = await getDB();
  const tx = db.transaction('mediaCache', 'readwrite');
  await tx.store.put({ url, blob });
  await tx.done;
};

export const getMedia = async (url) => {
  const db = await getDB();
  const tx = db.transaction('mediaCache', 'readonly');
  const entry = await tx.store.get(url);
  await tx.done;
  return entry ? entry.blob : null;
};

export const clearMediaCache = async () => {
  const db = await getDB();
  const tx = db.transaction('mediaCache', 'readwrite');
  await tx.store.clear();
  await tx.done;
};

// ─── Chat List (for each user) ──────────────────────────────────
export const storeChatList = async (uid, chatList) => {
  const db = await getDB();
  const tx = db.transaction('chatList', 'readwrite');
  await tx.store.put({ uid, chatList });
  await tx.done;
};

export const getChatList = async (uid) => {
  const db = await getDB();
  const tx = db.transaction('chatList', 'readonly');
  const entry = await tx.store.get(uid);
  await tx.done;
  return entry ? entry.chatList : null;
};

export const clearChatList = async (uid) => {
  const db = await getDB();
  const tx = db.transaction('chatList', 'readwrite');
  await tx.store.delete(uid);
  await tx.done;
};

// ─── Clear everything ────────────────────────────────────────────
export const clearAllIndexedDB = async () => {
  const db = await getDB();
  const stores = ['profiles', 'chatMessages', 'mediaCache', 'messageCache', 'chatList'];
  const tx = db.transaction(stores, 'readwrite');
  for (const storeName of stores) {
    await tx.objectStore(storeName).clear();
  }
  await tx.done;
};