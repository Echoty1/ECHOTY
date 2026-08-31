// src/utils/aiUtils.js
// AI provider calls belong on the backend. This module only formats replies
// and normalizes errors for the UI.

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
      return `The ${provider} service is currently busy. Please try again shortly.`;
    }
    if (msg.includes('quota') || msg.includes('rate limit')) {
      return `The ${provider} quota has been exceeded. Please try again later.`;
    }
    return `Error from ${provider}: ${msg}`;
  }
  if (error?.message) {
    if (error.message.includes('503') || error.message.includes('429')) {
      return `${provider} is temporarily unavailable. Please try again shortly.`;
    }
    return `Network error: ${error.message}`;
  }
  return `An unexpected error occurred with ${provider}.`;
};

// Kept so existing imports do not break. Always use /api/chat instead.
export const callGroqAI = async () => {
  console.warn('callGroqAI is disabled in the client. Use the backend /api/chat endpoint.');
  return null;
};

export const callGeminiAI = async () => {
  console.warn('callGeminiAI is disabled in the client. Use the backend /api/chat endpoint.');
  return null;
};

export const callAI = async () => {
  return 'Please use ECHO AI chat so replies go through the secure backend.';
};
