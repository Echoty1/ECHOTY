// src/utils/groupId.js

/**
 * Generates a unique group ID.
 * Format: grp_<timestamp>_<random6>
 */
export const generateGroupId = () => {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `grp_${ts}_${rand}`;
};

/**
 * Turns a groupId into a chatId usable with existing chat infrastructure.
 * This keeps group chats separate from 1-1 chats (which use sorted uids joined by _).
 */
export const groupIdToChatId = (groupId) => `group_${groupId}`;

/**
 * Checks if a given chatId belongs to a group chat.
 */
export const isGroupChatId = (chatId) => {
  if (!chatId || typeof chatId !== 'string') return false;
  return chatId.startsWith('group_');
};

/**
 * Extracts the group ID from a chatId.
 * Returns null if not a group chat.
 */
export const chatIdToGroupId = (chatId) => {
  if (!isGroupChatId(chatId)) return null;
  return chatId.substring(6); // strip 'group_'
};

/**
 * Formats a group name for display.
 */
export const formatGroupName = (name, maxLen = 40) => {
  if (!name) return 'Untitled Group';
  const trimmed = String(name).trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen - 1) + '…';
};

/**
 * Default group emojis to pick from.
 */
export const GROUP_EMOJIS = [
  '👥', '🎮', '🎵', '💬', '🔥', '🌟', '🍕', '☕',
  '🏀', '⚽', '🎨', '📚', '🎬', '✈️', '🏖️', '🌍',
  '💪', '🧠', '🎯', '🎉', '🚀', '💜', '🐶', '🐱',
];

/**
 * Validates a group name.
 */
export const validateGroupName = (raw) => {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, error: 'Group name is required' };
  }
  const name = raw.trim();
  if (name.length < 1) {
    return { valid: false, error: 'Group name is required' };
  }
  if (name.length > 40) {
    return { valid: false, error: 'Group name must be 40 characters or less' };
  }
  return { valid: true, normalized: name };
};

/**
 * Max members per group.
 */
export const MAX_GROUP_MEMBERS = 100;

/**
 * Min members to create a group (creator + at least 1 other).
 */
export const MIN_GROUP_MEMBERS = 2;
