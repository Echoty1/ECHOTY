// src/utils/faviconBadge.js
function getCurrentFaviconHref() {
  const nodes = [
    document.querySelector('link[rel="icon"]'),
    document.querySelector('link[rel="shortcut icon"]'),
    document.querySelector('link[rel="apple-touch-icon"]'),
  ];
  for (const link of nodes) {
    const href = link?.getAttribute('href');
    if (!href || href.startsWith('data:')) continue;
    return href;
  }
  return '/favicon.svg';
}

let baseHref = null;
let baseImage = null;
let loadingPromise = null;
let baseTitle = null;

function loadBaseIcon() {
  const href = getCurrentFaviconHref();
  if (baseImage && baseHref === href) return Promise.resolve(baseImage);
  if (loadingPromise && baseHref === href) return loadingPromise;
  baseHref = href;
  loadingPromise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { baseImage = img; resolve(img); };
    img.onerror = () => { baseImage = null; resolve(null); };
    img.src = href;
  });
  return loadingPromise;
}

export async function setFaviconBadge(count) {
  if (baseTitle == null) baseTitle = document.title.replace(/^\(\d+\+?\)\s/, '');
  const label = count > 9 ? '9+' : String(count);
  document.title = count > 0 ? `(${label}) ${baseTitle}` : baseTitle;

  const size = 96;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = await loadBaseIcon();
  if (img) ctx.drawImage(img, 0, 0, size, size);
  else {
    ctx.fillStyle = '#182830';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#6C3CE1';
    ctx.font = 'bold 48px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('E', size / 2, size / 2);
  }
  if (count > 0) {
    const r = 22;
    const cx = size - r - 4;
    const cy = r + 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#EF4444';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#111';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${label.length > 1 ? 22 : 26}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + 1);
  }
  const url = canvas.toDataURL('image/png');
  document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach((link) => {
    link.setAttribute('type', 'image/png');
    link.setAttribute('href', url);
  });
}

export async function clearFaviconBadge() {
  await setFaviconBadge(0);
}
