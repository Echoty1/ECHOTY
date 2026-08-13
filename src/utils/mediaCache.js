// src/utils/mediaCache.js
import React from 'react';
import { getMediaCache, setMediaCache } from '../services/cacheService';

const memoryCache = new Set();

/**
 * Preloads image/GIF files safely (no CORS issues)
 */
export const preloadMedia = (url) => {
  if (!url || typeof url !== 'string' || memoryCache.has(url)) return;
  try {
    const img = new Image();
    img.src = url;
    memoryCache.add(url);
  } catch (err) {
    // quiet fallback
  }
};

/**
 * Load an image and store as Base64 in cache.
 * Always returns a Promise that resolves with base64 string or null.
 */
export const loadAndCacheImage = async (url) => {
  if (!url) return null;

  try {
    // 1. Check cache
    const cached = getMediaCache(url);
    if (cached) return cached;

    // 2. Fetch and convert to base64
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    const blob = await response.blob();

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;
        setMediaCache(url, base64);
        resolve(base64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    return null;
  }
};

/**
 * React hook to get a cached image.
 * Returns the cached Base64 if available, otherwise the original URL,
 * or the placeholder if URL is empty.
 * Background fetch updates to Base64 when ready.
 */
export const useCachedImage = (url, placeholder = null) => {
  const [image, setImage] = React.useState(() => {
    if (!url) return placeholder;
    const cached = getMediaCache(url);
    return cached || url; // fallback to original URL
  });

  React.useEffect(() => {
    if (!url) {
      setImage(placeholder);
      return;
    }

    let isMounted = true;

    // Check cache again (in case it was updated)
    const cached = getMediaCache(url);
    if (cached) {
      if (isMounted) setImage(cached);
      return;
    }

    // Fetch and cache in background, then update
    const loadImage = async () => {
      const base64 = await loadAndCacheImage(url);
      if (isMounted && base64) setImage(base64);
    };
    loadImage();

    return () => {
      isMounted = false;
    };
  }, [url, placeholder]);

  return image;
};