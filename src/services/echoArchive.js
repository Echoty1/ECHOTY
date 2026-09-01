import { ref, update } from 'firebase/database';
import { db } from './firebase';
import { privateExpiresAt, communityExpiresAt } from '../utils/echoTides';
import { openDB } from 'idb';

const DB_NAME = 'echo-db';
const MAX_SAVED = 10;

const getArchiveDB = async () => {
  return openDB(DB_NAME, 4, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('echoArchive')) {
        db.createObjectStore('echoArchive', { keyPath: 'archiveId' });
      }
    },
  });
};

export const saveToEchoArchive = async (uid, message, meta = {}) => {
  if (!uid || !message) return { ok: false, reason: 'missing' };
  const db = await getArchiveDB();
  const archiveId = `${uid}_${message.id || Date.now()}`;
  const existing = await db.get('echoArchive', archiveId);
  const mine = (await db.getAll('echoArchive')).filter((row) => row.uid === uid);
  if (!existing && mine.length >= MAX_SAVED) {
    const oldest = mine.sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0))[0];
    if (oldest) await db.delete('echoArchive', oldest.archiveId);
  }
  await db.put('echoArchive', {
    archiveId,
    uid,
    savedAt: Date.now(),
    chatId: meta.chatId || '',
    source: meta.source || 'chat',
    partnerId: meta.partnerId || '',
    communityId: meta.communityId || '',
    message: {
      id: message.id,
      senderId: message.senderId,
      senderName: message.senderName || meta.senderName || '',
      senderAvatar: message.senderAvatar || meta.senderAvatar || '',
      text: message.text || message.caption || '',
      type: message.type || 'text',
      mediaUrl: message.mediaUrl || '',
      mediaType: message.mediaType || '',
      timestamp: message.timestamp || Date.now(),
    },
  });
  return { ok: true };
};

export const listEchoArchive = async (uid) => {
  if (!uid) return [];
  const db = await getArchiveDB();
  const all = await db.getAll('echoArchive');
  return (all || [])
    .filter((row) => row.uid === uid)
    .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
    .slice(0, MAX_SAVED);
};

export const removeEchoArchive = async (archiveId) => {
  const db = await getArchiveDB();
  await db.delete('echoArchive', archiveId);
};



export const unpinBookmarkedMessage = async (row) => {
  if (!row?.message?.id) return;
  const id = row.message.id;
  if (row.source === 'community') {
    const cid = row.communityId || row.chatId;
    if (!cid) return;
    await update(ref(db, `communityChats/${cid}/messages/${id}`), {
      pinned: null,
      expiresAt: communityExpiresAt(),
    }).catch(() => {});
    return;
  }
  const chatId = row.chatId;
  if (!chatId) return;
  await update(ref(db, `chats/${chatId}/messages/${id}`), {
    pinned: null,
    expiresAt: privateExpiresAt(),
  }).catch(() => {});
};
