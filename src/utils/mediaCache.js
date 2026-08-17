// src/utils/mediaCache.js
import { useState, useEffect } from 'react';
import { getMedia, storeMedia } from '../services/indexedDBService';

// ─── Memory cache for preload tracking ──────────────────────────
const preloadedSet = new Set();

export const preloadMedia = (url) => {
  if (!url || typeof url !== 'string' || preloadedSet.has(url)) return;
  try {
    const img = new Image();
    img.src = url;
    preloadedSet.add(url);
  } catch (err) {
    // quiet fallback
  }
};

export const useCachedBlobUrl = (originalUrl) => {
  const [blobUrl, setBlobUrl] = useState(originalUrl);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!originalUrl) {
      setIsLoading(false);
      return;
    }
    if (originalUrl.startsWith('blob:')) {
      setBlobUrl(originalUrl);
      setIsLoading(false);
      return;
    }

    let objectUrl = null;
    let isMounted = true;

    const load = async () => {
      try {
        // Check IndexedDB
        const blob = await getMedia(originalUrl);
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          if (isMounted) {
            setBlobUrl(objectUrl);
            setIsLoading(false);
            return;
          }
        }

        // Fetch from network
        const response = await fetch(originalUrl);
        if (!response.ok) throw new Error('Network response not ok');
        const blobFromNetwork = await response.blob();
        await storeMedia(originalUrl, blobFromNetwork);
        objectUrl = URL.createObjectURL(blobFromNetwork);
        if (isMounted) {
          setBlobUrl(objectUrl);
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('Media caching failed:', err);
        setError(true);
        setBlobUrl(originalUrl);
        setIsLoading(false);
      }
    };
    load();

    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [originalUrl]);

  return { blobUrl, isLoading, error };
};

export const useCachedImage = (url, placeholder = null) => {
  const { blobUrl, isLoading, error } = useCachedBlobUrl(url);
  if (isLoading) return placeholder || url;
  if (error) return url;
  return blobUrl;
};

/**
 * Background‑cache a media URL (image, video, audio) in IndexedDB
 * @param {string} url - The media URL to fetch and store
 * @returns {Promise<void>}
 */
export const cacheMedia = async (url) => {
  if (!url || !url.startsWith('http')) return; // skip blob: or invalid
  try {
    // Check if already cached
    const existing = await getMedia(url);
    if (existing) return; // already cached

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
    const blob = await response.blob();
    await storeMedia(url, blob);
    console.log(`✅ Cached media: ${url.substring(0, 60)}...`);
  } catch (err) {
    // Silently fail – media will load from network when needed
    console.debug(`⚠️ Could not pre‑cache media: ${err.message}`);
  }
};