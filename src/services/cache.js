const CACHE_KEYS = {
  USERS: 'echo_users',
};

// Estimate size of a string (2 bytes per char)
const getSize = (str) => str.length * 2;

// Maximum safe size for localStorage (5MB)
const MAX_CACHE_SIZE = 4.5 * 1024 * 1024; // 4.5MB

export const cache = {
  getUsers: () => {
    try {
      const data = localStorage.getItem(CACHE_KEYS.USERS);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setUsers: (usersData) => {
    // usersData is an object keyed by userId
    // We'll store only essential fields to reduce size
    const stripped = {};
    let totalSize = 0;

    // Limit to 100 most recently active users (you can adjust)
    const entries = Object.entries(usersData);
    // Sort by last message or online status? We don't have that, so just take first 100.
    // For better sorting, we could use online status but we don't store that in cache.
    const limited = entries.slice(0, 100);

    for (const [id, user] of limited) {
      // Strip large avatar data to avoid quota issues
      let avatar = user.avatar || '';
      if (avatar && avatar.startsWith('data:') && avatar.length > 1000) {
        avatar = ''; // don't cache large images
      }
      const entry = {
        id: user.id || id,
        username: user.username || 'Unknown',
        avatar: avatar,
        online: user.online || false,
        bio: user.bio || '',
        location: user.location || '',
      };
      const entryStr = JSON.stringify(entry);
      totalSize += getSize(entryStr);
      stripped[id] = entry;
    }

    // If total size is too large, strip avatars entirely
    if (totalSize > MAX_CACHE_SIZE) {
      for (const id in stripped) {
        stripped[id].avatar = '';
      }
      // Recalculate size
      const newStr = JSON.stringify(stripped);
      if (getSize(newStr) > MAX_CACHE_SIZE) {
        // Still too large – only store essential fields
        for (const id in stripped) {
          const { id: uid, username, online } = stripped[id];
          stripped[id] = { id: uid, username, online };
        }
      }
    }

    try {
      localStorage.setItem(CACHE_KEYS.USERS, JSON.stringify(stripped));
    } catch (e) {
      // If quota exceeded, clear cache and try again
      localStorage.removeItem(CACHE_KEYS.USERS);
      try {
        // Retry with minimal data
        const minimal = {};
        for (const id in stripped) {
          minimal[id] = { id, username: stripped[id].username, online: stripped[id].online };
        }
        localStorage.setItem(CACHE_KEYS.USERS, JSON.stringify(minimal));
      } catch (_) {
        // ignore
      }
    }
  },

  clearUsers: () => {
    try {
      localStorage.removeItem(CACHE_KEYS.USERS);
    } catch {}
  },
};