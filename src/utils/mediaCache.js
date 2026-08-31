// src/utils/mediaCache.js
import { useState, useEffect } from 'react';
import { getMedia, storeMedia } from '../services/indexedDBService';
import { resolveAssetUrl, isCrossOriginAsset } from './assetUrl';

const preloadedSet = new Set();
const failedSet = new Set();
const memoryUrls = new Map();
const inflight = new Map();

async function blobFromIdbOrNetwork(url) {
  const resolved = resolveAssetUrl(url);
  if (!resolved || resolved.startsWith('blob:') || resolved.startsWith('data:')) {
    return { display: resolved, fromCache: true };
  }
  if (memoryUrls.has(resolved)) {
    return { display: memoryUrls.get(resolved), fromCache: true };
  }
  if (failedSet.has(resolved)) {
    return { display: resolved, fromCache: false };
  }
  if (inflight.has(resolved)) return inflight.get(resolved);

  const job = (async () => {
    try {
      const cached = await getMedia(resolved);
      if (cached) {
        const obj = URL.createObjectURL(cached);
        memoryUrls.set(resolved, obj);
        return { display: obj, fromCache: true };
      }
    } catch (_) {}

    try {
      const response = await fetch(resolved, { mode: 'cors', credentials: 'omit' });
      if (!response.ok) throw new Error('bad status');
      const blob = await response.blob();
      try { await storeMedia(resolved, blob); } catch (_) {}
      const obj = URL.createObjectURL(blob);
      memoryUrls.set(resolved, obj);
      return { display: obj, fromCache: false };
    } catch (_) {
      failedSet.add(resolved);
      return { display: resolved, fromCache: false };
    }
  })();

  inflight.set(resolved, job);
  try {
    return await job;
  } finally {
    inflight.delete(resolved);
  }
}

export const preloadMedia = (url) => {
  const resolved = resolveAssetUrl(url);
  if (!resolved || preloadedSet.has(resolved)) return;
  preloadedSet.add(resolved);
  blobFromIdbOrNetwork(resolved).catch(() => {});
};

export const useCachedBlobUrl = (originalUrl) => {
  const resolved = resolveAssetUrl(originalUrl);
  const [blobUrl, setBlobUrl] = useState(memoryUrls.get(resolved) || resolved);
  const [isLoading, setIsLoading] = useState(!!resolved);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!resolved) {
      setIsLoading(false);
      return undefined;
    }
    if (resolved.startsWith('blob:') || resolved.startsWith('data:')) {
      setBlobUrl(resolved);
      setIsLoading(false);
      return undefined;
    }
    let alive = true;
    setIsLoading(true);
    blobFromIdbOrNetwork(resolved).then((res) => {
      if (!alive) return;
      setBlobUrl(res.display || resolved);
      setIsLoading(false);
      setError(false);
    });
    return () => { alive = false; };
  }, [resolved]);

  return { blobUrl, isLoading, error };
};

export const useCachedImage = (url, placeholder = null) => {
  const { blobUrl, isLoading } = useCachedBlobUrl(url);
  if (isLoading) return placeholder || resolveAssetUrl(url);
  return blobUrl;
};

export const cacheMedia = async (url) => {
  const resolved = resolveAssetUrl(url);
  if (!resolved || resolved.startsWith('blob:') || resolved.startsWith('data:')) return;
  await blobFromIdbOrNetwork(resolved);
};
