export const PRIVATE_TTL_MS = 24 * 60 * 60 * 1000;
export const COMMUNITY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const expiresFromSentAt = (sentAt, ttl) => {
  const ts = Number(sentAt);
  const base = Number.isFinite(ts) && ts > 0 ? ts : Date.now();
  return base + ttl;
};

export const privateExpiresAt = (from = Date.now()) => expiresFromSentAt(from, PRIVATE_TTL_MS);
export const communityExpiresAt = (from = Date.now()) => expiresFromSentAt(from, COMMUNITY_TTL_MS);

export const isTideExpired = (msg) => {
  if (!msg || msg.pinned || msg.savedLocal || msg.bookmarked) return false;
  const exp = Number(msg.expiresAt || 0);
  return exp > 0 && exp <= Date.now();
};

export const formatTideLeft = (msg) => {
  const exp = Number(msg?.expiresAt || 0);
  if (!exp) return '';
  const left = Math.max(0, exp - Date.now());
  if (left <= 0) return '0s';
  const totalMin = Math.floor(left / 60000);
  const totalSec = Math.floor(left / 1000);
  const d = Math.floor(totalMin / (60 * 24));
  const h = Math.floor(totalMin / 60);
  if (d >= 1) return `${d}d`;
  if (h >= 1) return `${h}h`;
  if (totalMin >= 1) return `${totalMin}m`;
  return `${totalSec}s`;
};
