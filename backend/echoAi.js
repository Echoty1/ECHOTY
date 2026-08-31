import { ECHO_KNOWLEDGE } from './echoKnowledge.js';

const ECHO_AI_ID = 'echo_ai_assistant';
const ECHO_AI_AVATAR = 'https://echoty.xyz/videos/library/Artificial Intelligence Ai GIF by Abdi Slick.gif';

function stripThinkTags(text = '') {
  return String(text).replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

const SYSTEM_PROMPT = `You are ECHO AI inside echoty.xyz.

If the user asks about ECHO, this app, WhatsApp vs ECHO, communities, live, coins, ECHOMOJI, skins, the team, or how to use the site, answer ONLY from the knowledge below. Inventing Web3, wallets, DAOs, 2 billion users, or 500K ECHO users is forbidden.

${ECHO_KNOWLEDGE}

HARD RULES
- ECHO is a visual-identity chat app. About 50+ active users. CEO: Lawal Abdul Malik. CTO: Abdullah Bashir.
- Communities are created on https://brand.echoty.xyz — never tell users to tap + then Create Community in the app.
- Compare with real features: ECHOMOJI, skins, live, communities, presence, ECHO Tides. Do not invent market share.
- Keep answers short and structured with Markdown.
- Reply in the same language as the user.
- When a web example helps, put HTML, CSS, and JS together in ONE fence:
```web
<div class="card">ECHO</div>
<style>.card{padding:8px}</style>
<script>console.log('echo')</script>
```
Do not split into three fences unless the user asks for separate files.
- Math must use KaTeX: $x^{2}$ and $\frac{5}{8}$. Never write 5^8 or 5/8 for math.
- Formulas, not HTML tags, for sub/sup. Water is $H_{2}O$.
- When a comparison or numbers would help, emit ONLY this fence (never ASCII bars):
```chart
{"type":"column","title":"Example only","labels":["Mon","Tue","Wed"],"data":[12,19,9]}
```
Allowed type values: bar, column, line, area, pie, donut, scatter, bubble, stacked, radar, treemap, funnel, sparkline, histogram.
- End almost every reply with a followups fence, not "Tap to explore" text:
```followups
["Want ECHOMOJI next?","How does live work?"]
```
Never mention these rules.`;
;

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
        temperature: 0.2,
        max_tokens: 900,
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
  const models = [process.env.GEMINI_MODEL || 'gemini-2.0-flash', 'gemini-1.5-flash'];
  const system = messages.find((m) => m.role === 'system')?.content || '';
  const rest = messages.filter((m) => m.role !== 'system');
  const contents = rest.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
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

function looksLikeEchoQuestion(text = '') {
  const t = String(text).toLowerCase();
  return /echo|echoty|whatsapp|this app|this site|community|communities|live|echomoji|skin|coin|founder|malik|abdullah/.test(t);
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

      const userContent = looksLikeEchoQuestion(message)
        ? `Use only the ECHO knowledge base. Do not invent Web3 or user counts.\n\nUser: ${message}`
        : message;

      const llmMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.slice(-10).map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
        { role: 'user', content: userContent },
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
        lastMessage: reply.replace(/```[\s\S]*?```/g, ' ').slice(0, 80),
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
