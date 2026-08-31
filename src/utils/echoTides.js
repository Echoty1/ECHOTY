export const PRIVATE_TTL_MS = 24 * 60 * 60 * 1000;
export const COMMUNITY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const privateExpiresAt = (from = Date.now()) => from + PRIVATE_TTL_MS;
export const communityExpiresAt = (from = Date.now()) => from + COMMUNITY_TTL_MS;

export const isTideExpired = (msg) => {
  if (!msg || msg.pinned || msg.savedLocal) return false;
  const exp = Number(msg.expiresAt || 0);
  return exp > 0 && exp <= Date.now();
};

export const tideProgress = (msg, ttl = PRIVATE_TTL_MS) => {
  const exp = Number(msg?.expiresAt || 0);
  if (!exp) return 1;
  const left = exp - Date.now();
  if (left <= 0) return 0;
  return Math.max(0, Math.min(1, left / ttl));
};

export const formatTideLeft = (msg) => {
  const exp = Number(msg?.expiresAt || 0);
  if (!exp) return '';
  const left = exp - Date.now();
  if (left <= 0) return '0m';
  const h = Math.floor(left / 3600000);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d}d`;
  if (h >= 1) return `${h}h`;
  return `${Math.max(1, Math.floor(left / 60000))}m`;
};
