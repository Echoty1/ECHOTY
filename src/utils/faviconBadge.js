// src/utils/faviconBadge.js

/**
 * Use the same favicon the browser/device already loaded from index.html
 * (icon, shortcut icon, apple-touch-icon — first usable one).
 */
function getCurrentFaviconHref() {
  const nodes = [
    ...document.querySelectorAll('link[rel="icon"]'),
    ...document.querySelectorAll('link[rel="shortcut icon"]'),
    ...document.querySelectorAll('link[rel="apple-touch-icon"]'),
  ];

  for (const link of nodes) {
    const href = link.getAttribute('href');
    if (!href) continue;
    // Skip data URLs we already wrote (badge versions)
    if (href.startsWith('data:')) continue;
    return href;
  }

  // Fallback if index.html has nothing (rare)
  return '/favicon.ico';
}

let baseHref = null;
let baseImage = null;
let loadingPromise = null;

function loadBaseIcon() {
  const href = getCurrentFaviconHref();

  // Reuse if same source already loaded
  if (baseImage && baseHref === href) {
    return Promise.resolve(baseImage);
  }

  if (loadingPromise && baseHref === href) {
    return loadingPromise;
  }

  baseHref = href;
  loadingPromise = new Promise((resolve) => {
    const img = new Image();
    // Same-origin public/ assets: usually fine without CORS
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      baseImage = img;
      resolve(img);
    };
    img.onerror = () => {
      baseImage = null;
      resolve(null);
    };
    // Cache-bust only for file paths so we always get the real asset
    const src =
      href.startsWith('data:') || href.startsWith('blob:')
        ? href
        : href.includes('?')
        ? href
        : `${href}${href.includes('#') ? '' : ''}?v=favicon`;
    img.src = href.startsWith('data:') ? href : href;
  });

  return loadingPromise;
}

function ensureIconLink() {
  let link =
    document.querySelector('link[rel="icon"]') ||
    document.querySelector('link[rel="shortcut icon"]');

  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    document.head.appendChild(link);
  }
  return link;
}

/**
 * @param {number} count - chats with unread (same as BottomNav badge)
 */
export async function setFaviconBadge(count) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const img = await loadBaseIcon();

  if (img) {
    ctx.drawImage(img, 0, 0, size, size);
  } else {
    // Last-resort fallback if icon fails to load
    ctx.fillStyle = '#6C3CE1';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('E', size / 2, size / 2 + 1);
  }

  if (count > 0) {
    const label = count > 9 ? '9+' : String(count);
    const r = 14;
    const cx = size - r - 2;
    const cy = r + 2;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#EF4444';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#111';
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${label.length > 1 ? 16 : 18}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + 1);
  }

  const url = canvas.toDataURL('image/png');

  // Only update rel="icon" / shortcut icon (keep apple-touch as original file)
  document
    .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]')
    .forEach((link) => {
      link.setAttribute('type', 'image/png');
      link.setAttribute('href', url);
    });

  // If page had no icon link at all
  if (!document.querySelector('link[rel="icon"]')) {
    const link = ensureIconLink();
    link.type = 'image/png';
    link.href = url;
  }
}

export async function clearFaviconBadge() {
  // Redraw with 0 = original icon, no badge
  await setFaviconBadge(0);
}