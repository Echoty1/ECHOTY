// backend/server.js
require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin');
const webpush = require('web-push');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  perMessageDeflate: true,
});

app.use(cors());
app.use(express.json());

// ─── Health checks ──────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'online', version: 'v2' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ─── Firebase Admin ─────────────────────────────────────────────
try {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    credential = admin.credential.cert(serviceAccount);
  } else {
    credential = admin.credential.applicationDefault();
  }
  admin.initializeApp({
    credential,
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
  console.log('✅ Firebase Admin initialized');
} catch (err) {
  console.error('❌ Firebase Admin init failed:', err.message);
  process.exit(1);
}

const db = admin.database();

// ─── VAPID Keys ──────────────────────────────────────────────────
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@echoty.xyz',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  console.log('✅ VAPID keys configured');
} else {
  console.warn('⚠️ VAPID keys not set – push notifications disabled');
}

// ─── Socket.io ──────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('🟢 Socket connected:', socket.id);

  socket.on('typing', ({ chatId, userId, username }) => {
    socket.broadcast.emit('typing', { chatId, userId, username });
  });

  socket.on('chat-message', (data) => {
    io.emit('chat-message', data);
  });

  socket.on('disconnect', () => {
    console.log('🔴 Socket disconnected:', socket.id);
  });
});

// ─── Push Notification Listener ──────────────────────────────────
const chatsRef = db.ref('messages');
chatsRef.on('child_added', (chatSnapshot) => {
  const chatId = chatSnapshot.key;
  chatSnapshot.ref.on('child_added', async (msgSnapshot) => {
    const message = msgSnapshot.val();
    const messageId = msgSnapshot.key;
    const senderId = message.senderId;
    if (!senderId) return;

    const [uid1, uid2] = chatId.split('_');
    const recipientId = senderId === uid1 ? uid2 : uid1;
    if (recipientId === senderId) return;

    const subsSnapshot = await db.ref(`pushSubscriptions/${recipientId}`).once('value');
    const subs = subsSnapshot.val();
    if (!subs) return;

    const payload = JSON.stringify({
      title: message.senderName || 'User',
      body: message.text || 'New message',
      tag: chatId,
      chatId,
      messageId,
      url: `/chat/${senderId}`,
    });

    const promises = Object.values(subs).map((sub) =>
      webpush.sendNotification(sub, payload).catch((err) => {
        if (err.statusCode === 410) {
          db.ref(`pushSubscriptions/${recipientId}/${sub.endpoint}`).remove();
        }
        console.error('Push failed:', err.message);
      })
    );
    await Promise.all(promises);
  });
});
console.log('🔔 Push notification listener active');

// ─── Admin: Delete user account ─────────────────────────────────
app.post('/api/admin/delete-user', async (req, res) => {
  try {
    const { targetUid } = req.body;
    if (!targetUid) {
      return res.status(400).json({ error: 'Missing targetUid' });
    }

    // Verify the requesting user is the support account
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const decoded = await admin.auth().verifyIdToken(token);
    const requesterUid = decoded.uid;
    if (requesterUid !== 'hD7tJzPVI1VSorhok8GToBC6VDy1') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 1. Delete the user's Firebase Auth account
    await admin.auth().deleteUser(targetUid);

    // 2. Delete database nodes
    const nodesToDelete = ['profiles', 'userSkins', 'userChats'];
    await Promise.all(nodesToDelete.map(node => db.ref(`${node}/${targetUid}`).remove()));

    // 3. Remove from accounts
    await db.ref(`accounts/${targetUid}`).remove();

    // 4. Remove all references to this user in other userChats
    const profilesSnap = await db.ref('profiles').once('value');
    const allUids = profilesSnap.val() ? Object.keys(profilesSnap.val()) : [];
    const updates = {};
    for (const uid of allUids) {
      if (uid === targetUid) continue;
      updates[`userChats/${uid}/${targetUid}`] = null;
    }
    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }

    // 5. Also delete the chat messages (optional but clean)
    // Find all chat nodes containing this UID
    // For simplicity, we'll leave that; the messages will be orphaned but not accessible.

    res.json({ success: true, message: `User ${targetUid} deleted successfully` });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 ECHO backend running on port ${PORT}`);
});