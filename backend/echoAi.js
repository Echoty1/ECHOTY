// backend/echoAi.js
// In backend/server.js:
//   import { registerEchoAi } from './echoAi.js';
//   registerEchoAi(app, db);
// Delete the old app.post('/api/chat', ...) block.

const ECHO_AI_ID = 'echo_ai_assistant';
const ECHO_AI_AVATAR = 'https://echoty.xyz/videos/library/Artificial Intelligence Ai GIF by Abdi Slick.gif';

const SITE_KEYWORDS = [
  'echo', 'echoty', 'this app', 'this site', 'website', 'community', 'communities',
  'live', 'broadcast', 'coin', 'shop', 'gif', 'skin', 'avatar', 'profile',
  'how do i', 'how to', 'feature', 'founder', 'sign up', 'login', 'verify',
  'rules', 'ban', 'report', 'privacy', 'terms', 'android', 'install', 'echomoji',
];

const SITE_KNOWLEDGE = `ECHO (https://echoty.xyz) is a real-time chat app with GIF avatars, DMs, communities, live video, coins, and ECHO AI.`;

function stripThinkTags(text = '') {
  return String(text).replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

function isWebsiteQuestion(text = '') {
  const t = String(text).toLowerCase();
  return SITE_KEYWORDS.some((k) => t.includes(k));
}

async function callGroq(messages) {
  const Groq = (await import('groq-sdk')).default;
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY missing');
  const groq = new Groq({ apiKey: key });
  const models = [process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
  let lastErr;
  for (const model of models) {
    try {
      const response = await groq.chat.completions.create({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 2048,
      });
      const text = stripThinkTags(response.choices?.[0]?.message?.content || '');
      if (text) return { text, model: `Groq (${model})` };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Groq failed');
}

async function callGemini(messages) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY missing');
  const models = [process.env.GEMINI_MODEL || 'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  const system = messages.find((m) => m.role === 'system')?.content || 'You are ECHO AI.';
  let lastErr;
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Gemini ${res.status}`);
      const text = stripThinkTags(data.candidates?.[0]?.content?.parts?.[0]?.text || '');
      if (text) return { text, model: `Gemini (${model})` };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Gemini failed');
}

export function registerEchoAi(app, db) {
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, userId, conversationId } = req.body || {};
      if (!message || !userId) {
        return res.status(400).json({ error: 'message and userId are required' });
      }

      let convoId = conversationId;
      if (!convoId) {
        const ref = db.ref(`aiConversations/${userId}`).push();
        await ref.set({ title: String(message).slice(0, 40), createdAt: Date.now() });
        convoId = ref.key;
      }

      const historySnap = await db.ref(`aiConversations/${convoId}/messages`).once('value');
      const history = historySnap.val()
        ? Object.values(historySnap.val()).sort((a, b) => a.timestamp - b.timestamp)
        : [];

      await db.ref(`aiConversations/${convoId}/messages`).push({
        role: 'user',
        content: message,
        timestamp: Date.now(),
      });

      const aboutSite = isWebsiteQuestion(message);
      const system = aboutSite
        ? `You are ECHO AI. Answer using this product knowledge:\n${SITE_KNOWLEDGE}`
        : 'You are ECHO AI, a helpful assistant. Be concise.';

      const llmMessages = [
        { role: 'system', content: system },
        ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: message },
      ];

      let reply = '';
      let modelUsed = '';
      try {
        const g = await callGroq(llmMessages);
        reply = g.text;
        modelUsed = g.model;
      } catch (_) {
        const gem = await callGemini(llmMessages);
        reply = gem.text;
        modelUsed = gem.model;
      }

      if (!reply) {
        return res.status(502).json({ error: 'All AI providers failed.' });
      }

      await db.ref(`aiConversations/${convoId}/messages`).push({
        role: 'assistant',
        content: reply,
        timestamp: Date.now(),
        model: modelUsed,
      });

      const chatId = [userId, ECHO_AI_ID].sort().join('_');
      await db.ref(`chats/${chatId}/messages`).push({
        senderId: ECHO_AI_ID,
        receiverId: userId,
        type: 'text',
        text: reply,
        timestamp: Date.now(),
        isRead: true,
      });
      await db.ref(`userChats/${userId}/${ECHO_AI_ID}`).update({
        id: ECHO_AI_ID,
        partnerName: 'ECHO AI',
        partnerAvatar: ECHO_AI_AVATAR,
        lastMessage: reply.slice(0, 80),
        lastSenderId: ECHO_AI_ID,
        lastUpdated: Date.now(),
        unreadCount: 0,
      });

      res.json({ reply, conversationId: convoId, model: modelUsed });
    } catch (err) {
      res.status(500).json({ error: err.message || 'AI error' });
    }
  });
}
