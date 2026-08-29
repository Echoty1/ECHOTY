// backend/server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import admin from 'firebase-admin';
import webpush from 'web-push';
import Groq from 'groq-sdk';
import fetch from 'node-fetch';
import 'dotenv/config';
import { registerEchoAi } from './echoAi.js';

// ─── IMAP poller imports ────────────────────────────────────────
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

// ─── Constants ──────────────────────────────────────────────────
const ECHO_AI_AVATAR = '/videos/library/Artificial Intelligence Ai GIF by Abdi Slick.gif';
const ECHO_AI_ID = 'echo_ai_assistant';

// ─── Strip <think> tags ────────────────────────────────────────
function stripThinkTags(text) {
  if (!text) return text;
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// ─── Firebase Admin ─────────────────────────────────────────────
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
const db = admin.database();

// ─── Express & Socket.io ──────────────────────────────────────
const app = express();
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'https://echoty.xyz';
app.use(cors({ origin: [CLIENT_ORIGIN, 'http://localhost:3000'], methods: ['GET', 'POST'] }));
app.use(express.json());
registerEchoAi(app, db);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: [CLIENT_ORIGIN, 'http://localhost:3000'], methods: ['GET', 'POST'] },
  perMessageDeflate: true,
});

async function requireUser(req, res, next) {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    req.user = await admin.auth().verifyIdToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// ─── Health check ──────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'online', version: 'v2' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ─── VAPID keys (push) ──────────────────────────────────────────
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@echoty.xyz',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// ─── Socket.io events ──────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('🟢 Socket connected:', socket.id);
  socket.on('join-chat', (chatId) => {
    if (typeof chatId === 'string' && chatId.length < 128) {
      socket.join(chatId);
    }
  });
  socket.on('typing', ({ chatId, userId, username }) => {
    if (!chatId) return;
    socket.to(chatId).emit('typing', { chatId, userId, username });
  });
  socket.on('chat-message', (data) => {
    if (!data?.chatId) return;
    socket.to(data.chatId).emit('chat-message', data);
  });
  socket.on('disconnect', () => {
    console.log('🔴 Socket disconnected:', socket.id);
  });
});

// ─── Push notifications ────────────────────────────────────────
const chatsRef = db.ref('chats');
chatsRef.on('child_added', (chatSnapshot) => {
  chatSnapshot.child('messages').ref.on('child_added', async (msgSnapshot) => {
    const message = msgSnapshot.val() || {};
    const chatId = chatSnapshot.key;
    const senderId = message.senderId;
    if (!senderId || !chatId) return;
    const parts = String(chatId).split('_');
    const recipientId = parts.find((id) => id && id !== senderId);
    if (!recipientId || recipientId === senderId) return;
    const subsSnapshot = await db.ref(`pushSubscriptions/${recipientId}`).once('value');
    const subs = subsSnapshot.val();
    if (!subs) return;
    let title = message.senderName || 'User';
    let body = message.text || 'New message';
    let url = `/chat/${senderId}`;
    if (message.type === 'system' && message.endedBy) {
      title = 'ECHO ended';
      body = message.text || 'This ECHO was ended.';
      url = `/chat/${message.endedBy}`;
    }
    const payload = JSON.stringify({
      title,
      body,
      tag: chatId,
      chatId,
      messageId: msgSnapshot.key,
      url,
    });
    const promises = Object.values(subs).map((sub) =>
      webpush.sendNotification(sub, payload).catch((err) => {
        if (err.statusCode === 410) {
          db.ref(`pushSubscriptions/${recipientId}/${sub.endpoint}`).remove();
        }
      })
    );
    await Promise.all(promises);
  });
});

// ==========================================================================
//  🧠 ECHO AI – CHAT ENDPOINT
// ==========================================================================

// ─── Helpers ──────────────────────────────────────────────────────
async function getUserMemories(userId) {
  const snap = await db.ref(`userMemories/${userId}`).once('value');
  return snap.val() || {};
}

async function setUserMemory(userId, key, value) {
  await db.ref(`userMemories/${userId}/${key}`).set(value);
}

async function getConversationMessages(conversationId) {
  const snap = await db.ref(`aiConversations/${conversationId}/messages`).once('value');
  const data = snap.val();
  if (!data) return [];
  return Object.values(data).sort((a, b) => a.timestamp - b.timestamp);
}

async function saveMessage(conversationId, role, content) {
  const ref = db.ref(`aiConversations/${conversationId}/messages`).push();
  await ref.set({ role, content, timestamp: Date.now() });
}

async function createConversation(userId, title) {
  const ref = db.ref(`aiConversations/${userId}`).push();
  await ref.set({ title, createdAt: Date.now() });
  return ref.key;
}

async function generateTitle(groq, prompt) {
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Generate a short, concise title (3 to 5 words max) summarizing the user\'s request. Do NOT use quotes or punctuation.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 20,
    });
    return response.choices[0]?.message?.content?.trim() || 'New Chat';
  } catch {
    return 'New Chat';
  }
}

// ─── Search ────────────────────────────────────────────────────────
async function searchDuckDuckGo(query) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    let result = '';
    if (data.AbstractText) {
      result += `**Summary:** ${data.AbstractText}\n`;
      if (data.AbstractURL) result += `**Source:** ${data.AbstractURL}\n`;
    }
    if (data.RelatedTopics && data.RelatedTopics.length) {
      result += '\n**Related Resources:**\n';
      data.RelatedTopics.slice(0, 3).forEach((topic) => {
        if (topic.Text) {
          result += `- ${topic.Text}`;
          if (topic.FirstURL) result += ` (${topic.FirstURL})`;
          result += '\n';
        }
      });
    }
    if (!result) {
      result = `No direct summary found. Try:\nhttps://duckduckgo.com/?q=${encodeURIComponent(query)}`;
    }
    return result;
  } catch {
    return `Search failed. You can manually search:\nhttps://duckduckgo.com/?q=${encodeURIComponent(query)}`;
  }
}

// ─── System Prompt ──────────────────────────────────────────────
const ECHO_SYSTEM_PROMPT = `
You are **ECHO AI**, the friendly and knowledgeable assistant for the ECHO app.  
Always address the user by their name (if known). Keep responses concise, warm, and conversational.  
You may use Markdown formatting and emojis.  
Never include prefixes like "User:" or "Message:".  

You have deep knowledge about the ECHO app (founders, features, team, mission).  
If you don't know something, say so and suggest where to find it.

**Memory tokens:**  
- Session memory: \`[MEMORY: key=value]\`  
- Global memory: \`[USER_MEMORY: key=value]\`  
**Search:** \`[SEARCH: query]\` will fetch external info.

You may use Markdown tables to present structured data clearly. Use pipes and dashes for tables (e.g., | Header1 | Header2 |\\n|--------|--------|\\n| Cell1  | Cell2  |). You can also create simple ASCII bar charts if appropriate.
`;

// ─── Call Groq ────────────────────────────────────────────────────
async function callGroq(groq, messages) {
  try {
    const response = await groq.chat.completions.create({
      model: 'qwen/qwen3.6-27b',
      messages,
      temperature: 0.2,
      max_tokens: 4096,
    });
    return { response, model: 'Groq (qwen)' };
  } catch (err) {
    console.warn('Groq failed, trying fallback model...', err.message);
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.2,
      max_tokens: 4096,
    });
    return { response, model: 'Groq (llama)' };
  }
}

// ─── Call Gemini ──────────────────────────────────────────────────
async function callGemini(messages) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) throw new Error('Gemini API key missing');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`;
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const payload = {
    system_instruction: { parts: [{ text: ECHO_SYSTEM_PROMPT }] },
    contents,
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Gemini API error');
  }
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response');
  return { response: { choices: [{ message: { content: text } }] }, model: 'Gemini' };
}

// ─── Save AI response to regular chats ──────────────────────────
async function saveAIResponseToChats(userId, reply) {
  const chatId = [userId, ECHO_AI_ID].sort().join('_');
  const msgRef = db.ref(`chats/${chatId}/messages`).push();
  await msgRef.set({
    senderId: ECHO_AI_ID,
    receiverId: userId,
    type: 'text',
    text: reply,
    timestamp: Date.now(),
    isRead: true,
  });
  const userChatRef = db.ref(`userChats/${userId}/${ECHO_AI_ID}`);
  await userChatRef.set({
    id: ECHO_AI_ID,
    partnerName: 'ECHO AI',
    partnerAvatar: ECHO_AI_AVATAR,
    lastMessage: reply,
    lastSenderId: ECHO_AI_ID,
    lastUpdated: Date.now(),
    unreadCount: 0,
  });
}

// ─── Main Chat Endpoint ─────────────────────────────────────────
app.post('/api/chat', requireUser, async (req, res) => {
  const userId = req.user.uid;
  const { message, conversationId } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  try {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'Groq API key not configured.' });
    }
    const groq = new Groq({ apiKey: GROQ_API_KEY });

    let convId = conversationId;
    let title = null;
    if (!convId) {
      title = await generateTitle(groq, message);
      convId = await createConversation(userId, title);
    }

    await saveMessage(convId, 'user', message);

    const history = await getConversationMessages(convId);
    const recentHistory = history.slice(-20);
    const userMemories = await getUserMemories(userId);

    let systemPrompt = ECHO_SYSTEM_PROMPT;
    const userName = userMemories.name || 'User';
    systemPrompt = systemPrompt.replace(/\{name\}/g, userName);
    let memoryContext = '';
    if (Object.keys(userMemories).length) {
      memoryContext += '\n**User Memory (global):**\n';
      memoryContext += Object.entries(userMemories)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n');
    }
    systemPrompt += memoryContext;

    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory.map((msg) => ({ role: msg.role, content: msg.content })),
    ];

    let result;
    let modelUsed;
    try {
      console.log('🤖 Calling Groq...');
      result = await callGroq(groq, groqMessages);
      modelUsed = result.model;
    } catch (groqErr) {
      console.warn('Groq failed, falling back to Gemini:', groqErr.message);
      try {
        console.log('🤖 Falling back to Gemini...');
        result = await callGemini(groqMessages);
        modelUsed = result.model;
      } catch (geminiErr) {
        console.error('Both AI providers failed:', geminiErr.message);
        throw new Error('All AI services are currently unavailable.');
      }
    }

    const rawReply = result.response.choices[0]?.message?.content || 'I could not generate a reply.';
    let cleanReply = stripThinkTags(rawReply);

    // Process memory & search tokens
    const convMemoryRegex = /\[MEMORY:\s*([^\s=]+)\s*=\s*([^\]]+)\]/g;
    const userMemoryRegex = /\[USER_MEMORY:\s*([^\s=]+)\s*=\s*([^\]]+)\]/g;
    const searchRegex = /\[SEARCH:\s*([^\]]+)\]/g;

    let match;
    while ((match = convMemoryRegex.exec(cleanReply)) !== null) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (key && value) {
        await db.ref(`aiConversations/${convId}/memories/${key}`).set(value);
        cleanReply = cleanReply.replace(match[0], '');
      }
    }
    while ((match = userMemoryRegex.exec(cleanReply)) !== null) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (key && value) {
        await setUserMemory(userId, key, value);
        cleanReply = cleanReply.replace(match[0], '');
      }
    }

    let searchMatch;
    while ((searchMatch = searchRegex.exec(cleanReply)) !== null) {
      const query = searchMatch[1].trim();
      const searchResult = await searchDuckDuckGo(query);
      cleanReply = cleanReply.replace(
        searchMatch[0],
        `\n\n## 🔎 Search Results for "${query}"\n${searchResult}\n`
      );
    }

    await saveMessage(convId, 'assistant', cleanReply);
    await saveAIResponseToChats(userId, cleanReply);

    return res.json({
      reply: cleanReply,
      conversationId: convId,
      title: title,
      modelUsed: modelUsed,
    });
  } catch (err) {
    console.error('❌ Chat error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Enhanced Admin User Wipe Endpoint ─────────────────────────
app.post('/api/admin/delete-user', async (req, res) => {
  try {
    const { targetUid } = req.body;
    if (!targetUid) return res.status(400).json({ error: 'Missing targetUid' });

    // Verify admin token (support user)
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = await admin.auth().verifyIdToken(token);
    if (decoded.uid !== 'hD7tJzPVI1VSorhok8GToBC6VDy1') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 1. Delete Firebase Auth user
    await admin.auth().deleteUser(targetUid);

    // 2. Delete all user-specific database nodes
    const userNodes = [
      'profiles', 'userSkins', 'userChats', 'userMemories', 'aiConversations',
      'accounts', 'live', 'peerIds', 'presence/online', 'userCommunities',
      'liveChat', 'busy', 'notifications', 'channelMemberships', 'userDailyLogins',
      'adminNotifications', 'calls'
    ];
    await Promise.all(userNodes.map(node => db.ref(`${node}/${targetUid}`).remove().catch(() => {})));

    // 3. Remove references to this user from other users' chat lists and delete chat nodes
    const profilesSnap = await db.ref('profiles').once('value');
    const allUids = profilesSnap.val() ? Object.keys(profilesSnap.val()) : [];
    const updates = {};
    for (const uid of allUids) {
      if (uid !== targetUid) {
        updates[`userChats/${uid}/${targetUid}`] = null;
        const chatId = [uid, targetUid].sort().join('_');
        updates[`chats/${chatId}`] = null;
      }
    }
    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }

    // 4. Remove user from communities and decrement member counts
    const userCommsSnap = await db.ref(`userCommunities/${targetUid}`).once('value');
    if (userCommsSnap.exists()) {
      const comms = userCommsSnap.val();
      for (const commId of Object.keys(comms)) {
        await db.ref(`communities/${commId}/memberCount`).transaction(current => Math.max(0, (current || 0) - 1));
        await db.ref(`userCommunities/${targetUid}/${commId}`).remove();
      }
    }

    // 5. Remove community posts by this user
    const communityPostsSnap = await db.ref('communityPosts').once('value');
    if (communityPostsSnap.exists()) {
      const allPosts = communityPostsSnap.val();
      for (const [commId, posts] of Object.entries(allPosts)) {
        for (const [postId, post] of Object.entries(posts)) {
          if (post.uid === targetUid) {
            await db.ref(`communityPosts/${commId}/${postId}`).remove();
          }
        }
      }
    }

    res.json({ success: true, message: `User ${targetUid} fully wiped` });
  } catch (err) {
    console.error('Wipe user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin user deletion (legacy, kept for compatibility) ──────
app.post('/api/admin/delete-user-legacy', async (req, res) => {
  try {
    const { targetUid } = req.body;
    if (!targetUid) return res.status(400).json({ error: 'Missing targetUid' });
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = await admin.auth().verifyIdToken(token);
    if (decoded.uid !== 'hD7tJzPVI1VSorhok8GToBC6VDy1') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await admin.auth().deleteUser(targetUid);
    const nodesToDelete = ['profiles', 'userSkins', 'userChats', 'userMemories', 'aiConversations'];
    await Promise.all(nodesToDelete.map((node) => db.ref(`${node}/${targetUid}`).remove()));
    await db.ref(`accounts/${targetUid}`).remove();
    const profilesSnap = await db.ref('profiles').once('value');
    const allUids = profilesSnap.val() ? Object.keys(profilesSnap.val()) : [];
    const updates = {};
    for (const uid of allUids) {
      if (uid !== targetUid) updates[`userChats/${uid}/${targetUid}`] = null;
    }
    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }
    res.json({ success: true, message: `User ${targetUid} deleted` });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================================================
//  💰 SELAR PAYMENTS (pending orders + webhook + IMAP email poller)
// ==========================================================================

const PRODUCT_COINS = {
//  '014871867i': 10,
  '105w82207h': 500,
  '72a169f519': 1000,
  '1xc588p2uc': 1500,
  'b5377r174h': 2000,
  'n4s9l3yy02': 2500,
  '3x61201c46': 3000,
  '2g079jdyyd': 4000,
  '3363k13i67': 5000,
};

/** Create pending payment when user clicks a package */
app.post('/api/create-pending-payment', async (req, res) => {
  try {
    const { reference, uid, productId, coins, price } = req.body || {};
    if (!reference || !uid || !productId) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }
    const coinAmount = Number(coins) || PRODUCT_COINS[productId];
    if (!coinAmount) {
      return res.status(400).json({ success: false, message: 'Unknown product' });
    }

    const existing = await db.ref(`pendingPayments/${reference}`).once('value');
    if (existing.exists() && existing.val().status === 'completed') {
      return res.json({ success: true, message: 'Already completed' });
    }

    await db.ref(`pendingPayments/${reference}`).set({
      uid,
      productId,
      coins: coinAmount,
      price: Number(price) || 0,
      status: 'pending',
      createdAt: Date.now(),
    });

    console.log(`🧾 Pending payment created: ${reference} → ${uid} (+${coinAmount})`);
    res.json({ success: true, reference });
  } catch (err) {
    console.error('create-pending-payment', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Client polls this — NOT Selar */
app.get('/api/payment-status', async (req, res) => {
  try {
    const reference = req.query.reference;
    if (!reference) return res.status(400).json({ status: 'error', message: 'Missing reference' });

    const snap = await db.ref(`pendingPayments/${reference}`).once('value');
    if (!snap.exists()) return res.json({ status: 'unknown' });

    const data = snap.val();
    res.json({
      status: data.status || 'pending',
      coinsAdded: data.coinsAdded || null,
      message: data.message || null,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * Credit coins once. Idempotent on reference.
 */
async function fulfillPayment(reference, source = 'webhook') {
  if (!reference || typeof reference !== 'string') {
    return { ok: false, message: 'Invalid reference' };
  }
  reference = reference.trim();

  const pendingRef = db.ref(`pendingPayments/${reference}`);
  const snap = await pendingRef.once('value');
  if (!snap.exists()) {
    return { ok: false, message: 'Unknown reference' };
  }
  const pending = snap.val();
  if (pending.status === 'completed') {
    return { ok: true, already: true, coins: pending.coinsAdded || pending.coins };
  }

  const uid = pending.uid;
  const coins = Number(pending.coins) || PRODUCT_COINS[pending.productId];
  if (!uid || !coins) return { ok: false, message: 'Invalid pending data' };

  const coinsRef = db.ref(`userSkins/${uid}/coins`);
  const curSnap = await coinsRef.once('value');
  const current = Number(curSnap.val()) || 0;
  const newCoins = current + coins;
  await coinsRef.set(newCoins);

  await pendingRef.update({
    status: 'completed',
    coinsAdded: coins,
    newBalance: newCoins,
    completedAt: Date.now(),
    source,
  });

  await db.ref(`transactions/${uid}/${reference}`).set({
    amount: coins,
    productId: pending.productId || null,
    timestamp: Date.now(),
    status: 'completed',
    source,
  });

  console.log(`✅ [${source}] +${coins} coins → ${uid} (ref ${reference})`);
  return { ok: true, coins, newCoins };
}

/** Optional webhook (kept; not required if you only use IMAP) */
app.post('/api/selar-webhook', async (req, res) => {
  try {
    const secret = process.env.SELAR_WEBHOOK_SECRET;
    if (secret) {
      const got = req.headers['x-echo-secret'] || req.query.secret;
      if (got !== secret) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }
    }

    console.log('📩 Selar webhook body:', JSON.stringify(req.body));
    const body = req.body || {};
    let reference =
      body.reference ||
      body.echo_ref ||
      body.ref ||
      body.custom_fields?.ref ||
      body.custom_fields?.echo_ref ||
      body.meta?.reference;

    if (!reference && typeof body.notes === 'string') {
      const m = body.notes.match(/echo_[A-Za-z0-9]+_[A-Za-z0-9]+_[A-Za-z0-9]+/);
      if (m) reference = m[0];
    }
    if (!reference && typeof body === 'object') {
      const blob = JSON.stringify(body);
      const m = blob.match(/echo_[A-Za-z0-9_-]+_[A-Za-z0-9_-]+_[A-Za-z0-9_-]+/);
      if (m) reference = m[0];
    }

    if (!reference) {
      return res.status(400).json({ success: false, message: 'No reference in payload' });
    }

    const result = await fulfillPayment(reference, 'selar-webhook');
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.message });
    }
    res.json({ success: true, coins: result.coins, already: !!result.already });
  } catch (err) {
    console.error('selar-webhook error', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Admin / support manual complete */
app.post('/api/admin/complete-payment', async (req, res) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = await admin.auth().verifyIdToken(token);
    if (decoded.uid !== 'hD7tJzPVI1VSorhok8GToBC6VDy1') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { reference } = req.body || {};
    if (!reference) return res.status(400).json({ error: 'Missing reference' });
    const result = await fulfillPayment(reference, 'admin');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================================================
//  📬 IMAP EMAIL POLLER – auto-credit from Selar sale emails
// ==========================================================================

/** Extract product ID and buyer email from Selar receipt email */
function extractSaleDetails(text) {
  if (!text || typeof text !== 'string') return null;

  // 1. Find product ID from receipt URL: "?products=014871867i"
  const productMatch = text.match(/[?&]products=([A-Za-z0-9]+)/);
  const productId = productMatch ? productMatch[1] : null;

  // 2. Find buyer email (look for any email address in the text)
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  const buyerEmail = emailMatch ? emailMatch[0] : null;

  if (productId && buyerEmail) {
    return { productId, buyerEmail };
  }
  return null;
}

/** Strip HTML to plain text */
function htmlToText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

let imapBusy = false;

async function pollSelarEmails() {
  if (imapBusy) {
    console.log('📬 IMAP poll already running — skip');
    return;
  }

  const user = process.env.SELAR_EMAIL;
  const pass = process.env.SELAR_EMAIL_PASS;
  if (!user || !pass) {
    console.warn('⚠️ SELAR_EMAIL or SELAR_EMAIL_PASS not set. Email poller disabled.');
    return;
  }

  imapBusy = true;
  console.log('📬 Checking Selar payment emails...');

  const client = new ImapFlow({
    host: process.env.SELAR_IMAP_HOST || 'imap.gmail.com',
    port: Number(process.env.SELAR_IMAP_PORT || 993),
    secure: true,
    auth: { user, pass },
    logger: false,
    socketTimeout: 60000,
  });

  try {
    await client.connect();
    console.log('✅ IMAP connected');

    await client.mailboxOpen('INBOX');

    // ─── Search for "New Sale:" emails – include both seen and unseen ───
    let uids = await client.search({
      subject: 'New Sale:',
    });

    // If many, limit to recent 50 to avoid processing too many old ones
    if (uids && uids.length > 50) {
      uids = uids.slice(-50);
    }

    if (!uids || uids.length === 0) {
      console.log('📨 No new sale emails found');
      await client.logout();
      return;
    }

    console.log(`📨 Found ${uids.length} sale email(s)`);

    for (const uid of uids) {
      try {
        const msg = await client.fetchOne(uid, {
          source: true,
          envelope: true,
          uid: true,
        });
        if (!msg || !msg.source) continue;

        const parsed = await simpleParser(msg.source);
        const subject = parsed.subject || msg.envelope?.subject || '';
        const textBody = parsed.text || '';
        const htmlBody = htmlToText(parsed.html || '');
        const fullText = `${subject}\n${textBody}\n${htmlBody}`;

        const details = extractSaleDetails(fullText);
        if (!details) {
          console.warn(`⚠️ Could not extract productId/email from sale email (uid=${uid})`);
          try { await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true }); } catch (_) {}
          continue;
        }

        const { productId, buyerEmail } = details;
        console.log(`🔍 Sale: product=${productId}, email=${buyerEmail}`);

        // Find pending orders with this productId and status 'pending'
        const pendingSnap = await db.ref('pendingPayments')
          .orderByChild('productId')
          .equalTo(productId)
          .once('value');

        if (!pendingSnap.exists()) {
          console.warn(`⚠️ No pending orders found for productId ${productId}`);
          try { await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true }); } catch (_) {}
          continue;
        }

        const pendingData = pendingSnap.val();
        let matched = false;

        for (const [refKey, order] of Object.entries(pendingData)) {
          if (order.status !== 'pending') continue;

          // ─── Get user email from profile OR accounts ──────────────
          let userEmail = null;

          // Try profile first
          const profileSnap = await db.ref(`profiles/${order.uid}/email`).once('value');
          if (profileSnap.exists()) {
            userEmail = profileSnap.val();
          }

          // If not in profile, try accounts
          if (!userEmail) {
            const accountSnap = await db.ref(`accounts/${order.uid}/email`).once('value');
            if (accountSnap.exists()) {
              userEmail = accountSnap.val();
            }
          }

          // If still no email, try Firebase Auth (requires admin SDK)
          if (!userEmail) {
            try {
              const userRecord = await admin.auth().getUser(order.uid);
              if (userRecord.email) {
                userEmail = userRecord.email;
                // Save it to profile for future
                await db.ref(`profiles/${order.uid}/email`).set(userEmail);
              }
            } catch (_) {}
          }

          if (!userEmail) {
            console.warn(`⚠️ No email found for ${order.uid}`);
            continue;
          }

          // Compare emails (case-insensitive)
          if (userEmail.toLowerCase() === buyerEmail.toLowerCase()) {
            console.log(`✅ Found matching pending order: ${refKey} for ${order.uid}`);
            const result = await fulfillPayment(refKey, 'email-poller');
            if (result.ok) {
              console.log(`✅ Credited ${result.coins} coins to ${order.uid}`);
              matched = true;
            } else {
              console.warn(`⚠️ Fulfillment failed: ${result.message}`);
            }
            break; // Only one order per sale
          }
        }

        if (!matched) {
          console.warn(`⚠️ No matching pending order for product ${productId} and email ${buyerEmail}`);
        }

        // Mark as seen
        try {
          await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        } catch (flagErr) {
          console.warn('Could not mark seen:', flagErr.message);
        }
      } catch (err) {
        console.warn(`❌ Error processing sale email uid=${uid}:`, err.message);
      }
    }

    await client.logout();
    console.log('📬 Email poll complete');
  } catch (err) {
    console.error('❌ IMAP poller error:', err.message);
    try {
      await client.logout();
    } catch (_) {}
  } finally {
    imapBusy = false;
  }
}

// Run every 2 minutes
const IMAP_POLL_MS = Number(process.env.SELAR_IMAP_POLL_MS || 2 * 60 * 1000);
setInterval(pollSelarEmails, IMAP_POLL_MS);
// Startup
setTimeout(pollSelarEmails, 8000);

// Manual trigger for support/debug
app.post('/api/admin/poll-selar-emails', async (req, res) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = await admin.auth().verifyIdToken(token);
    if (decoded.uid !== 'hD7tJzPVI1VSorhok8GToBC6VDy1') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    pollSelarEmails().catch((e) => console.error(e));
    res.json({ success: true, message: 'Poll started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================================================
//  🚀 START SERVER
// ==========================================================================

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 ECHO backend running on port ${PORT}`);
});