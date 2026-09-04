// src/utils/api.js
// Local app  → http://localhost:3000
// Deployed   → https://echoty-pdcy.onrender.com
// Override with REACT_APP_API_URL if needed.

function stripSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

export function getApiBase() {
  if (typeof process !== 'undefined' && process.env.REACT_APP_API_URL) {
    return stripSlash(process.env.REACT_APP_API_URL);
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3000';
    }
  }

  return 'https://echoty-pdcy.onrender.com';
}

export function apiUrl(path = '') {
  const base = getApiBase();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}
