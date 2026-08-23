// src/utils/userIntegrity.js
/**
 * Rules that keep Home / presence / profiles clean.
 * - Hide placeholder or wiped accounts from "online"
 * - Decide if a profile is complete enough to show
 */

/** Names we never show as real users on Home */
const PLACEHOLDER_NAMES = new Set([
  'user',
  'someone',
  'demo',
  'demo user',
  'unknown',
  'guest',
  'null',
  'undefined',
]);

/**
 * True if this looks like a real display name (not wiped / placeholder).
 */
export function isRealDisplayName(name) {
  if (!name || typeof name !== 'string') return false;
  const n = name.trim();
  if (n.length < 2) return false;
  if (PLACEHOLDER_NAMES.has(n.toLowerCase())) return false;
  // UID-looking fragments (e.g. first 8 of a Firebase uid)
  if (/^[A-Za-z0-9]{6,12}$/.test(n) && !/[aeiou]/i.test(n)) {
    // still allow real short names like "Alex" – they have vowels or spaces elsewhere
  }
  return true;
}

/**
 * True if profile is complete enough to appear in online / live lists.
 */
export function isVisibleProfile(profile, uid) {
  if (!uid) return false;
  if (!profile || typeof profile !== 'object') return false;
  return isRealDisplayName(profile.name);
}

/**
 * Filter a list of user objects ({ uid, name, ... }) for Home.
 */
export function filterVisibleUsers(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((u) => isRealDisplayName(u?.name));
}

/**
 * Database paths that belong to a single user and should be cleared on wipe.
 */
export const USER_DATA_PATHS = [
  'profiles',
  'userSkins',
  'userChats',
  'presence/online',
  'live',
  'peerIds',
  'busy',
  'userDailyLogins',
  'adminNotifications',
  'aiConversations',
  'call',
  'chats',
  'userMemories',
  
];

export default {
  isRealDisplayName,
  isVisibleProfile,
  filterVisibleUsers,
  USER_DATA_PATHS,
};
