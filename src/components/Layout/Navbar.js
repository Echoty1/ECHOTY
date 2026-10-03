// src/utils/echoTides.js

export const PRIVATE_TTL_MS = 24 * 60 * 60 * 1000;      // 24h fallback
export const COMMUNITY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7d

/**
 * Compute expiresAt from a base timestamp + TTL.
 * `ttl === 0` means "Never expire" → returns 0.
 */
export const expiresFromSentAt = (sentAt, ttl) => {
  if (ttl === 0) return 0;                              // Never
  const ts = Number(sentAt);
  const base = Number.isFinite(ts) && ts > 0 ? ts : Date.now();
  const safeTtl = Number.isFinite(Number(ttl)) ? Number(ttl) : PRIVATE_TTL_MS;
  return base + safeTtl;
};

/**
 * Build an expiresAt timestamp using the user's preferred TTL.
 * Callers should pass `userSettings.echo.defaultTideTTL`.
 * Falls back to 24h if ttl is missing or invalid.
 *   ttl = 0 → never expire (returns 0)
 */
export const privateExpiresAt = (from = Date.now(), ttl = PRIVATE_TTL_MS) => {
  return expiresFromSentAt(from, ttl);
};

export const communityExpiresAt = (from = Date.now()) =>
  expiresFromSentAt(from, COMMUNITY_TTL_MS);

/**
 * A tide is expired only if it has a positive expiresAt in the past.
 *   0  → never expires
 *   null/undefined → never expires
 */
export const isTideExpired = (msg) => {
  if (!msg || msg.pinned || msg.savedLocal || msg.bookmarked) return false;
  const exp = Number(msg.expiresAt || 0);
  if (!exp || exp <= 0) return false;                   // 0 = never
  return exp <= Date.now();
};

export const formatTideLeft = (msg) => {
  const exp = Number(msg?.expiresAt || 0);
  if (!exp) return '';                                  // never-expiring → no chip
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

/** Legacy: still used by some components that expect "tideProgress". */
export const tideProgress = (msg) => {
  const exp = Number(msg?.expiresAt || 0);
  if (!exp) return 0;
  const start = Number(msg?.timestamp || 0) || (exp - PRIVATE_TTL_MS);
  const total = exp - start;
  if (total <= 0) return 1;
  const elapsed = Date.now() - start;
  return Math.min(1, Math.max(0, elapsed / total));
};
