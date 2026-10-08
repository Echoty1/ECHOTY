// src/utils/usernameValidation.js

// Reserved names — cannot be claimed by users
export const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'root', 'system', 'official',
  'echo', 'echoty', 'echobot', 'support', 'help', 'staff',
  'moderator', 'mod', 'owner', 'founder',
  'api', 'www', 'mail', 'ftp', 'localhost',
  'about', 'login', 'signup', 'register', 'logout',
  'profile', 'settings', 'chat', 'chats', 'home', 'explore',
  'search', 'notifications', 'messages', 'groups',
  'privacy', 'terms', 'legal', 'dmca',
  'malik', 'lawal', 'abdulmalik',
  'ai', 'bot', 'assistant', 'echo_ai_assistant',
  'null', 'undefined', 'true', 'false',
  'test', 'demo', 'user', 'new', 'null',
]);

// Format rules
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_REGEX = /^[a-z][a-z0-9_]*$/;

/**
 * Validates a username. Returns { valid, error }.
 */
export const validateUsername = (raw) => {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, error: 'Username is required' };
  }

  const username = raw.trim().toLowerCase();

  if (username.length < USERNAME_MIN) {
    return { valid: false, error: `Username must be at least ${USERNAME_MIN} characters` };
  }

  if (username.length > USERNAME_MAX) {
    return { valid: false, error: `Username must be at most ${USERNAME_MAX} characters` };
  }

  if (!USERNAME_REGEX.test(username)) {
    return {
      valid: false,
      error: 'Username must start with a letter and contain only a-z, 0-9, and _',
    };
  }

  // Reject leading/trailing/consecutive underscores for cleanliness
  if (username.startsWith('_') || username.endsWith('_')) {
    return { valid: false, error: 'Username cannot start or end with _' };
  }

  if (username.includes('__')) {
    return { valid: false, error: 'Username cannot have consecutive underscores' };
  }

  if (RESERVED_USERNAMES.has(username)) {
    return { valid: false, error: 'This username is reserved' };
  }

  // Reject pure-number usernames
  if (/^[0-9_]+$/.test(username)) {
    return { valid: false, error: 'Username cannot be only numbers' };
  }

  return { valid: true, error: null, normalized: username };
};

/**
 * Suggests 3 alternate usernames when the desired one is taken.
 */
export const suggestAlternates = (base) => {
  const clean = (base || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 12) || 'user';

  return [
    `${clean}${Math.floor(100 + Math.random() * 900)}`,
    `${clean}_${Math.floor(10 + Math.random() * 90)}`,
    `the_${clean}`,
  ].filter((u) => !RESERVED_USERNAMES.has(u));
};
