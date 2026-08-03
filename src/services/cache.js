// src/services/cache.js

const CACHE_KEYS = {
  USERS: 'echo_users',
};

// Maximum size check (approximate)
const MAX_CACHE_SIZE = 4.5 * 1024 * 1024; // ~4.5MB (5MB limit, leave room)

const getStorageSize = () => {
  let total = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length * 2; // UTF-16
    }
  }
  return total;
};

export const cache = {
  getUsers: () => {
    try {
      const data = localStorage.getItem(CACHE_KEYS.USERS);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setUsers: (users) => {
    try {
      // Avoid storing large base64 images – we can strip avatar if too large
      const cleanUsers = {};
      for (let key in users) {
        const user = users[key];
        // If avatar is base64 and too large, remove it from cache
        if (user.avatar && user.avatar.startsWith('data:') && user.avatar.length > 50000) {
          cleanUsers[key] = { ...user, avatar: '' };
        } else {
          cleanUsers[key] = user;
        }
      }
      const serialized = JSON.stringify(cleanUsers);
      // Check if size is within limit
      if (serialized.length * 2 > MAX_CACHE_SIZE) {
        console.warn('Cache size exceeds limit, not storing');
        return;
      }
      localStorage.setItem(CACHE_KEYS.USERS, serialized);
    } catch (error) {
      if (error.name === 'QuotaExceededError' || error.code === 22) {
        console.warn('Cache quota exceeded, clearing old cache');
        cache.clearUsers();
        // Try again with smaller data (just usernames and IDs)
        try {
          const minimal = {};
          for (let key in users) {
            const user = users[key];
            minimal[key] = {
              id: user.id,
              username: user.username,
              avatar: '', // no avatars
              online: user.online,
            };
          }
          localStorage.setItem(CACHE_KEYS.USERS, JSON.stringify(minimal));
        } catch (e) {
          console.warn('Could not cache even minimal data');
        }
      } else {
        console.warn('Cache write error:', error);
      }
    }
  },

  clearUsers: () => {
    try {
      localStorage.removeItem(CACHE_KEYS.USERS);
    } catch {}
  },
};