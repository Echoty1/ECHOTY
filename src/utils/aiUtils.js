// src/utils/aiUtils.js

import { ECHO_KNOWLEDGE } from '../constants/echoKnowledge';

const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY || '';
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';

// Trimmed knowledge – only key facts (under 500 characters)
const trimmedKnowledge = ECHO_KNOWLEDGE
  .split('\n')
  .filter(line => line.includes('ECHO') || line.includes('founder') || line.includes('features') || line.includes('mission'))
  .slice(0, 10)
  .join(' ')
  .substring(0, 500);

export const cleanAIResponse = (text) => {
  if (!text) return '';
  const str = String(text);
  let cleaned = str.replace(/\b(User|Message|Assistant)\s*:\s*/gi, '');
  cleaned = cleaned.replace(/^(User|Message|Assistant)\b/gim, '');
  cleaned = cleaned.replace(/,\s*$/, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
};

export const handleAIError = (error, responseData, provider = 'AI') => {
  console.error(`${provider} API error:`, error, responseData);
  if (responseData?.error?.message) {
    const msg = responseData.error.message;
    if (msg.includes('high demand') || msg.includes('503') || msg.includes('429')) {
      return `The ${provider} service is currently busy. Trying the other provider...`;
    }
    if (msg.includes('quota') || msg.includes('rate limit')) {
      return `The ${provider} quota has been exceeded. Trying the other provider...`;
    }
    return `Error from ${provider}: ${msg}`;
  }
  if (error?.message) {
    if (error.message.includes('503') || error.message.includes('429')) {
      return `${provider} is temporarily unavailable. Trying the other provider...`;
    }
    return `Network error: ${error.message}`;
  }
  return `An unexpected error occurred with ${provider}.`;
};

// ─── Groq API ─────────────────────────────────────────────────
export const callGroqAI = async (messageHistory, userMessage, userName) => {
  if (!GROQ_API_KEY) {
    console.warn('Groq API key missing. Set REACT_APP_GROQ_API_KEY in .env');
    return null;
  }

  try {
    const systemContent = `You are ECHO AI, a friendly assistant for the ECHO app. The user's name is "${userName || 'User'}". Always address them by name. Never include prefixes like "User:" or "Message:". Use Markdown and emojis. Key facts about ECHO: ${trimmedKnowledge}`;

    const messages = [
      { role: 'system', content: systemContent }
    ];

    const recentHistory = messageHistory.slice(-6);
    recentHistory.forEach((m) => {
      messages.push({
        role: m.senderId === 'echo_ai_assistant' ? 'assistant' : 'user',
        content: m.text,
      });
    });

    messages.push({ role: 'user', content: userMessage });

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: messages,
        temperature: 0.7,
        max_tokens: 512,
      }),
    });

    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      throw new Error('Invalid response from Groq API');
    }

    if (!response.ok) {
      const errorMsg = handleAIError(null, responseData, 'Groq');
      return cleanAIResponse(errorMsg);
    }

    if (responseData.choices && responseData.choices[0]?.message?.content) {
      const rawText = responseData.choices[0].message.content;
      return cleanAIResponse(rawText);
    } else {
      return null;
    }
  } catch (error) {
    const errorMsg = handleAIError(error, null, 'Groq');
    return cleanAIResponse(errorMsg);
  }
};

// ─── Gemini API (fallback) ────────────────────────────────────
export const callGeminiAI = async (messageHistory, userMessage, userName) => {
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key missing. Set REACT_APP_GEMINI_API_KEY in .env');
    return null;
  }

  try {
    const recentHistory = messageHistory.slice(-6);
    const history = recentHistory.map((m) => ({
      role: m.senderId === 'echo_ai_assistant' ? 'model' : 'user',
      parts: [{ text: m.text }],
    }));

    const systemInstruction = `You are ECHO AI, a friendly assistant for the ECHO app. User: ${userName || 'User'}. Never include "User:" or "Message:". Use Markdown and emojis. Key facts: ${trimmedKnowledge}`;

    const payload = {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [
        ...history,
        { role: 'user', parts: [{ text: userMessage }] },
      ],
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let responseData;
    try {
      responseData = await response.json();
    } catch (parseError) {
      throw new Error('Invalid response from Gemini API');
    }

    if (!response.ok) {
      const errorMsg = handleAIError(null, responseData, 'Gemini');
      return cleanAIResponse(errorMsg);
    }

    if (responseData.candidates && responseData.candidates[0]?.content?.parts[0]?.text) {
      const rawText = responseData.candidates[0].content.parts[0].text;
      return cleanAIResponse(rawText);
    } else {
      return null;
    }
  } catch (error) {
    const errorMsg = handleAIError(error, null, 'Gemini');
    return cleanAIResponse(errorMsg);
  }
};

// ─── Main AI caller ──────────────────────────────────────────
export const callAI = async (messageHistory, userMessage, userName) => {
  console.log('🤖 Calling Groq...');
  const groqResponse = await callGroqAI(messageHistory, userMessage, userName);
  if (groqResponse && !groqResponse.includes('trying the other provider') && !groqResponse.includes('Error')) {
    return cleanAIResponse(groqResponse);
  }

  console.log('🔄 Falling back to Gemini...');
  const geminiResponse = await callGeminiAI(messageHistory, userMessage, userName);
  if (geminiResponse && !geminiResponse.includes('trying the other provider') && !geminiResponse.includes('Error')) {
    return cleanAIResponse(geminiResponse);
  }

  return 'I am currently experiencing technical difficulties with both AI providers. Please try again in a few moments. 🙏';
};