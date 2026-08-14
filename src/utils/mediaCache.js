// src/utils/mediaCache.js
import React, { useState, useEffect } from 'react';
import { getMediaCache, setMediaCache } from '../services/cacheService';

const memoryCache = new Set();

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

export const loadAndCacheImage = async (url) => {
  if (!url) return null;
  try {
    const cached = getMediaCache(url);
    if (cached) return cached;
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

export const useCachedImage = (url, placeholder = null) => {
  const [image, setImage] = useState(() => {
    if (!url) return placeholder;
    // ✅ If it's a blob URL, return it immediately
    if (url.startsWith('blob:')) return url;
    const cached = getMediaCache(url);
    return cached || url;
  });

  useEffect(() => {
    if (!url) {
      setImage(placeholder);
      return;
    }
    // ✅ If blob URL, just set it and skip caching
    if (url.startsWith('blob:')) {
      setImage(url);
      return;
    }

    let isMounted = true;
    const cached = getMediaCache(url);
    if (cached) {
      if (isMounted) setImage(cached);
      return;
    }

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

// ─── YouTube‑style caching with Cache API (for videos) ─────────
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

    const loadAndCache = async () => {
      try {
        const cache = await caches.open('echo-media-v1');
        const cachedResponse = await cache.match(originalUrl);
        if (cachedResponse && cachedResponse.ok) {
          const blob = await cachedResponse.blob();
          objectUrl = URL.createObjectURL(blob);
          if (isMounted) {
            setBlobUrl(objectUrl);
            setIsLoading(false);
            return;
          }
        }
        const response = await fetch(originalUrl);
        if (!response.ok) throw new Error('Network response was not ok');
        const clonedResponse = response.clone();
        await cache.put(originalUrl, clonedResponse);
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (isMounted) {
          setBlobUrl(objectUrl);
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('Media caching failed, using fallback:', err);
        setError(true);
        setBlobUrl(originalUrl);
        setIsLoading(false);
      }
    };

    loadAndCache();

    return () => {
      isMounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [originalUrl]);

  return { blobUrl, isLoading, error };
};