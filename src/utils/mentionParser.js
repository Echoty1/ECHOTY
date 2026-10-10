// src/utils/mentionParser.js

/**
 * Finds all @mentions in a text string.
 * Returns array of unique usernames (lowercase, without @).
 * Example: "Hey @malik and @zara!" → ["malik", "zara"]
 */
export const extractMentions = (text) => {
  if (!text || typeof text !== 'string') return [];
  const regex = /@([a-z][a-z0-9_]{2,19})/gi;
  const matches = text.match(regex) || [];
  const unique = new Set();
  matches.forEach((m) => unique.add(m.slice(1).toLowerCase()));
  return Array.from(unique);
};

/**
 * Checks if text mentions @everyone (case-insensitive).
 */
export const mentionsEveryone = (text) => {
  if (!text || typeof text !== 'string') return false;
  return /@everyone\b/i.test(text);
};

/**
 * Renders a text string as an array of { text, isMention, isEveryone, handle }.
 * Use this to render messages with highlighted mentions.
 *
 * Example output:
 * [
 *   { text: 'Hey ', isMention: false },
 *   { text: '@malik', isMention: true, handle: 'malik' },
 *   { text: ' and ', isMention: false },
 *   { text: '@everyone', isMention: false, isEveryone: true, handle: 'everyone' },
 * ]
 */
export const parseMentions = (text) => {
  if (!text || typeof text !== 'string') return [{ text: text || '', isMention: false }];

  const parts = [];
  const regex = /(@everyone\b|@[a-z][a-z0-9_]{2,19})/gi;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), isMention: false });
    }
    const token = match[0];
    const isEveryone = token.toLowerCase() === '@everyone';
    parts.push({
      text: token,
      isMention: !isEveryone,
      isEveryone,
      handle: token.slice(1).toLowerCase(),
    });
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isMention: false });
  }

  return parts;
};

/**
 * Detects if the current typing context is inside an "@..." token.
 * If yes, returns { query, startIndex } — the text after @ and where it started.
 * Used by MentionAutocomplete.
 */
export const getActiveMentionQuery = (text, cursorPos) => {
  if (!text) return null;
  const upToCursor = text.slice(0, cursorPos);
  // Find the last '@' that isn't preceded by a word character
  const match = upToCursor.match(/(^|[^a-z0-9_])@([a-z0-9_]*)$/i);
  if (!match) return null;
  const atIndex = upToCursor.lastIndexOf('@');
  return {
    query: match[2],
    startIndex: atIndex,
  };
};

/**
 * Replaces an active mention query with a chosen username.
 * Returns the new full text + new cursor position.
 */
export const insertMention = (text, startIndex, cursorPos, username) => {
  const before = text.slice(0, startIndex);
  const after = text.slice(cursorPos);
  const mentionText = `@${username} `;
  return {
    text: before + mentionText + after,
    cursor: startIndex + mentionText.length,
  };
};
