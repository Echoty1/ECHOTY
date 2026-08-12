// src/utils/mediaCache.js
const memoryCache = new Set();

/**
 * Preloads image/GIF files safely across origins without triggering CORS errors.
 */
export const preloadMedia = (url) => {
  if (!url || typeof url !== 'string' || memoryCache.has(url)) return;

  try {
    const img = new Image();
    img.src = url;
    memoryCache.add(url);
  } catch (err) {
    // Quiet fallback
  }
};

export const getCachedMediaUrl = async (url) => {
  preloadMedia(url);
  return url;
};