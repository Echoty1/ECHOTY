// src/utils/assetUrl.js
// GIFs / community images live on production, not on localhost:3001.
const ASSET_ORIGIN = (process.env.REACT_APP_ASSET_ORIGIN || 'https://echoty.xyz').replace(/\/+$/, '');

const LOCAL_PREFIXES = ['/videos/library/', '/images/communities/', '/videos/', '/images/'];

export function resolveAssetUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;

  const path = url.startsWith('/') ? url : `/${url}`;
  const isPackagedAsset = LOCAL_PREFIXES.some((p) => path.startsWith(p));
  if (isPackagedAsset) return `${ASSET_ORIGIN}${path}`;

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

export function isCrossOriginAsset(url) {
  if (!url || typeof window === 'undefined') return false;
  try {
    const resolved = resolveAssetUrl(url);
    const u = new URL(resolved, window.location.origin);
    return u.origin !== window.location.origin;
  } catch {
    return true;
  }
}
