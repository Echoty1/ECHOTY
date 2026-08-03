// src/services/cache.js

const CACHE_KEYS = {
  USERS: 'echo_users',
  CHATS: 'echo_chats', // optional
};

export const cache = {
  getUsers: () => {
    const data = localStorage.getItem(CACHE_KEYS.USERS);
    return data ? JSON.parse(data) : null;
  },
  setUsers: (users) => {
    localStorage.setItem(CACHE_KEYS.USERS, JSON.stringify(users));
  },
  clearUsers: () => {
    localStorage.removeItem(CACHE_KEYS.USERS);
  },
  getChatMessages: (chatId) => {
    const key = `echo_chat_${chatId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  },
  setChatMessages: (chatId, messages) => {
    const key = `echo_chat_${chatId}`;
    localStorage.setItem(key, JSON.stringify(messages));
  },
};