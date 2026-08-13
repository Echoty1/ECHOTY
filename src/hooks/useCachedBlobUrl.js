// src/hooks/useCachedBlobUrl.js
import { useState, useEffect } from 'react';

/**
 * Hook to fetch and cache a media file (video or image) in the Cache API.
 * Returns a blob URL that can be used as the src of a video or img element.
 * If caching fails, returns the original URL.
 */
export const useCachedBlobUrl = (originalUrl) => {
  const [blobUrl, setBlobUrl] = useState(originalUrl);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!originalUrl) {
      setIsLoading(false);
      return;
    }

    // If it's already a blob URL (upload preview), use it directly
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

        // 1. Check cache
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

        // 2. Fetch and cache
        const response = await fetch(originalUrl);
        if (!response.ok) throw new Error('Network response was not ok');

        const clonedResponse = response.clone();
        // Store in cache
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
        setBlobUrl(originalUrl); // fallback to original URL
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