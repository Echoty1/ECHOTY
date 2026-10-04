// src/utils/linkPreview.js

/**
 * Extract the first URL from a text string.
 * Returns null if no URL is found.
 */
export const extractFirstUrl = (text) => {
  if (!text || typeof text !== 'string') return null;
  const urlRegex = /(https?:\/\/[^\s<>"']+)/i;
  const match = text.match(urlRegex);
  if (!match) return null;
  // Strip trailing punctuation that often gets glued on
  let url = match[1].replace(/[.,;:!?)\]}]+$/g, '');
  // Upgrade http to https for security
  if (url.startsWith('http://')) url = 'https://' + url.slice(7);
  return url;
};

/**
 * Determine the origin for favicon lookup.
 */
export const getOrigin = (url) => {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return null;
  }
};

/**
 * Fetch Open Graph / meta tag metadata for a URL.
 * Uses a public CORS-friendly proxy since most sites block direct browser fetches.
 *
 * If the proxy ever dies, deploy your own (see Part 3 fallback below) and swap
 * PROXY_PREFIX to your server's URL.
 */
const PROXY_PREFIX = 'https://api.allorigins.win/raw?url=';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;  // 24h
const CACHE_KEY = 'echo_link_previews_v1';

// In-memory cache to avoid re-parsing the same URL within a session
const memoryCache = new Map();

const readDiskCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // prune expired
    const now = Date.now();
    const fresh = {};
    Object.entries(parsed).forEach(([k, v]) => {
      if (v && typeof v.fetchedAt === 'number' && now - v.fetchedAt < CACHE_TTL_MS) {
        fresh[k] = v;
      }
    });
    return fresh;
  } catch {
    return {};
  }
};

const writeDiskCache = (cache) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage might be full — silently ignore
  }
};

/**
 * Parse an HTML string for OG / meta tags.
 */
const parseMeta = (html, url) => {
  const result = {
    url,
    title: '',
    description: '',
    image: '',
    siteName: '',
    favicon: '',
  };

  if (!html || typeof html !== 'string') return result;

  const getMeta = (prop) => {
    // matches both name="..." and property="..." in either attribute order
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m && m[1]) return decodeHtml(m[1].trim());
    }
    return '';
  };

  result.title = getMeta('og:title') || getMeta('twitter:title') || (() => {
    const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return m ? decodeHtml(m[1].trim()) : '';
  })();

  result.description = getMeta('og:description') || getMeta('twitter:description') || getMeta('description');
  result.image = getMeta('og:image') || getMeta('twitter:image');
  result.siteName = getMeta('og:site_name') || getMeta('application-name');

  // favicon — try to find <link rel="icon"> first
  const iconMatch = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["']/i);
  if (iconMatch && iconMatch[1]) {
    result.favicon = absolutize(iconMatch[1].trim(), url);
  } else {
    // default to /favicon.ico
    const origin = getOrigin(url);
    if (origin) result.favicon = `${origin}/favicon.ico`;
  }

  // absolutize image if it's relative
  if (result.image) result.image = absolutize(result.image, url);

  // Cap lengths so we don't blow up Firestore / RTDB
  if (result.title.length > 200) result.title = result.title.slice(0, 200) + '…';
  if (result.description.length > 300) result.description = result.description.slice(0, 300) + '…';

  return result;
};

const decodeHtml = (str) => {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
};

const absolutize = (maybeRelative, baseUrl) => {
  if (!maybeRelative) return '';
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
  try {
    const base = new URL(baseUrl);
    return new URL(maybeRelative, base).href;
  } catch {
    return maybeRelative;
  }
};

/**
 * Fetch + parse link preview for a URL.
 * Returns:
 *   { url, title, description, image, favicon, siteName }
 * or null on failure.
 */
export const fetchLinkPreview = async (url) => {
  if (!url) return null;

  // Memory cache first
  if (memoryCache.has(url)) return memoryCache.get(url);

  // Disk cache second
  const disk = readDiskCache();
  if (disk[url]) {
    memoryCache.set(url, disk[url]);
    return disk[url];
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${PROXY_PREFIX}${encodeURIComponent(url)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Proxy returned ${res.status}`);
    const html = await res.text();
    const preview = parseMeta(html, url);

    // Reject if we got literally nothing — treat as failure
    if (!preview.title && !preview.description && !preview.image) {
      return null;
    }

    preview.fetchedAt = Date.now();
    memoryCache.set(url, preview);
    disk[url] = preview;
    writeDiskCache(disk);
    return preview;
  } catch (err) {
    console.warn('[linkPreview] fetch failed:', err?.message || err);
    // Still return a minimal preview with just the favicon so we have something
    const origin = getOrigin(url);
    if (origin) {
      const fallback = {
        url,
        title: '',
        description: '',
        image: '',
        siteName: '',
        favicon: `${origin}/favicon.ico`,
        fetchedAt: Date.now(),
      };
      memoryCache.set(url, fallback);
      return fallback;
    }
    return null;
  }
};

/**
 * Render a URL's hostname prettily: "www.example.com/path" → "example.com"
 */
export const prettyHost = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
