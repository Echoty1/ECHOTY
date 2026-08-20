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
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  perMessageDeflate: true,
});

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

// ─── Push notifications ────────────────────────────────────────
const chatsRef = db.ref('messages');
chatsRef.on('child_added', (chatSnapshot) => {
  chatSnapshot.ref.on('child_added', async (msgSnapshot) => {
    const message = msgSnapshot.val();
    const chatId = chatSnapshot.key;
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
      messageId: msgSnapshot.key,
      url: `/chat/${senderId}`,
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
app.post('/api/chat', async (req, res) => {
  const { userId, message, conversationId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
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
    // ─── Strip <think> tags ─────────────────────────────────────
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

// ─── Admin user deletion ──────────────────────────────────────────
app.post('/api/admin/delete-user', async (req, res) => {
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

// ─── Start server ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 ECHO backend running on port ${PORT}`);
});