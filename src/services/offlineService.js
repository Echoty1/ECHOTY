// src/services/offlineService.js
// Placeholder for v2 – full caching will be implemented later

export const getCachedUsers = () => {
  return Promise.resolve([]);
};

export const localDB = {
  users: {
    bulkPut: () => Promise.resolve(),
    clear: () => Promise.resolve(),
  },
};