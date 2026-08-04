import Dexie from 'dexie';
import { ref, onValue, set, push, update, remove, serverTimestamp } from 'firebase/database';
import { db } from './firebase'; // 👈 import your local database instance

// ------------------------------------------------------------
// 1. IndexedDB Schema
// ------------------------------------------------------------
class EchoDatabase extends Dexie {
  constructor() {
    super('EchoDB');
    this.version(1).stores({
      users: 'id, username, online, lastSeen',
      messages: 'id, chatId, timestamp, userId',
      pendingMessages: '++id, chatId, userId, message, timestamp, status',
    });
  }
}

export const localDB = new EchoDatabase();

// ------------------------------------------------------------
// 2. Sync users from Firebase to IndexedDB
// ------------------------------------------------------------
export function syncUsers() {
  const usersRef = ref(db, 'users'); // now db is the local instance
  onValue(usersRef, async (snapshot) => {
    const data = snapshot.val();
    if (!data) return;
    const entries = Object.entries(data).map(([id, user]) => ({ ...user, id }));
    await localDB.users.bulkPut(entries);
  });
}

// ------------------------------------------------------------
// 3. Sync messages for a specific chat
// ------------------------------------------------------------
export function syncMessages(chatId) {
  if (!chatId) return;
  const messagesRef = ref(db, `chats/${chatId}`);
  return onValue(messagesRef, async (snapshot) => {
    const data = snapshot.val();
    if (!data) return;
    const entries = Object.entries(data).map(([id, msg]) => ({ ...msg, id, chatId }));
    await localDB.messages.bulkPut(entries);
  });
}

// ------------------------------------------------------------
// 4. Offline message queue
// ------------------------------------------------------------
export async function queueMessage({ chatId, userId, username, message, replyTo, image, voice }) {
  const pending = {
    chatId,
    userId,
    username,
    message: message || '',
    replyTo: replyTo || null,
    image: image || null,
    voice: voice || null,
    timestamp: Date.now(),
    status: 'pending',
  };
  const id = await localDB.pendingMessages.add(pending);
  return id;
}

export async function processPendingMessages() {
  const pending = await localDB.pendingMessages.where('status').equals('pending').toArray();
  for (const item of pending) {
    try {
      const chatRef = ref(db, `chats/${item.chatId}`);
      const msgData = {
        userId: item.userId,
        username: item.username,
        message: item.message || '',
        timestamp: item.timestamp,
      };
      if (item.replyTo) msgData.replyTo = item.replyTo;
      if (item.image) msgData.image = item.image;
      if (item.voice) msgData.voice = item.voice;

      await push(chatRef, msgData);
      await localDB.pendingMessages.update(item.id, { status: 'sent' });
      // Optionally delete after sent:
      // await localDB.pendingMessages.delete(item.id);
    } catch (err) {
      await localDB.pendingMessages.update(item.id, { status: 'failed' });
      console.error('Failed to send pending message:', err);
    }
  }
}

// ------------------------------------------------------------
// 5. Start offline sync – call this after user logs in
// ------------------------------------------------------------
let syncUnsubscribe = null;

export function startOfflineSync(userId) {
  if (!userId) return;

  // Sync users once
  syncUsers();

  // Listen to Firebase connection state
  const connectedRef = ref(db, '.info/connected');
  const unsub = onValue(connectedRef, (snap) => {
    const connected = snap.val();
    if (connected) {
      console.log('✅ Online – syncing pending messages...');
      processPendingMessages();
    } else {
      console.log('🔴 Offline – using local cache');
    }
  });

  // Also listen to browser online/offline events
  const handleOnline = () => {
    console.log('🌐 Browser online – checking sync...');
    processPendingMessages();
  };
  window.addEventListener('online', handleOnline);

  // Store cleanup function
  syncUnsubscribe = () => {
    unsub();
    window.removeEventListener('online', handleOnline);
  };

  return syncUnsubscribe;
}

// ------------------------------------------------------------
// 6. Load cached users (for instant display)
// ------------------------------------------------------------
export async function getCachedUsers() {
  return await localDB.users.toArray();
}

export async function getCachedMessages(chatId) {
  return await localDB.messages.where('chatId').equals(chatId).toArray();
}