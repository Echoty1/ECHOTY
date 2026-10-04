// src/utils/echoWatermark.js
//
// Echo watermark utility.
// - Videos: Cloudinary transform URL for baked-in watermark on download/share.
// - Images: canvas burn-in for download/share.
// - NEW: getShareableFile(post) → returns a File for Web Share API.

const CLOUD_NAME = 'rjlscgan';

/* ─── Cloudinary transform URL for videos ──────────────────── */

export const buildWatermarkedVideoUrl = (mediaUrl, { logoPublicId } = {}) => {
  if (!mediaUrl || !mediaUrl.includes('res.cloudinary.com')) return mediaUrl;
  const marker = '/video/upload/';
  if (!mediaUrl.includes(marker)) return mediaUrl;

  const [base, tail] = mediaUrl.split(marker);
  if (!tail) return mediaUrl;

  const overlay = logoPublicId
    ? `l_${logoPublicId},w_140,g_south_west,x_24,y_24,o_90`
    : `l_text:Arial_44_bold:ECHO,co_rgb:FFFFFF,g_south_west,x_24,y_24,o_90`;

  const transform = `${overlay}/fl_layer_apply`;

  if (tail.includes('l_') || tail.startsWith(transform)) return mediaUrl;

  return `${base}${marker}${transform}/${tail}`;
};

export const isCloudinaryUrl = (url) =>
  typeof url === 'string' && url.includes('res.cloudinary.com');

/* ─── Canvas burn-in for images ────────────────────────────── */

export const burnWatermarkOnImage = async (imageUrl, { text = 'ECHO', opacity = 0.85 } = {}) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const fontSize = Math.max(24, Math.round(canvas.width * 0.045));
      ctx.font = `900 ${fontSize}px "Inter", system-ui, -apple-system, sans-serif`;
      ctx.globalAlpha = opacity;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = Math.round(fontSize * 0.25);
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      const padding = Math.round(canvas.width * 0.04);
      const ty = canvas.height - padding;
      ctx.fillText(text, padding, ty);

      // Purple tick before the wordmark
      const tickSize = fontSize * 0.6;
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#a78bfa';
      ctx.beginPath();
      ctx.roundRect(
        padding - tickSize * 0.55,
        ty - tickSize * 0.95,
        tickSize * 0.2,
        tickSize * 1.2,
        tickSize * 0.1
      );
      ctx.fill();

      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Canvas toBlob failed'));
        resolve(blob);
      }, 'image/png', 0.92);
    };
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = imageUrl;
  });
};

/* ─── Download helpers ─────────────────────────────────────── */

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

/* ─── Watermark any post for download ──────────────────────── */

export const prepareWatermarkedMedia = async (post, { logoPublicId } = {}) => {
  if (!post) return null;
  if (post.mediaType === 'video') {
    return {
      kind: 'url',
      url: buildWatermarkedVideoUrl(post.mediaUrl, { logoPublicId }),
      filename: `echo_spotlight_${post.id}.mp4`,
    };
  }
  const blob = await burnWatermarkOnImage(post.mediaUrl);
  return { kind: 'blob', blob, filename: `echo_spotlight_${post.id}.png` };
};

/* ─── NEW: return a File for Web Share API ─────────────────── */

/**
 * Build a File object ready for navigator.share({ files: [...] }).
 * - Images: canvas-burned PNG with the ECHO watermark
 * - Videos: the Cloudinary-transformed MP4 (watermark already applied)
 *
 * Returns { file, mediaType } on success, or null on failure.
 */
export const getShareableFile = async (post) => {
  if (!post?.mediaUrl) return null;

  try {
    if (post.mediaType === 'video') {
      const url = buildWatermarkedVideoUrl(post.mediaUrl);
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const blob = await res.blob();
      const file = new File(
        [blob],
        `echo_spotlight_${post.id}.mp4`,
        { type: blob.type || 'video/mp4' }
      );
      return { file, mediaType: 'video' };
    }

    // Image
    const blob = await burnWatermarkOnImage(post.mediaUrl);
    const file = new File(
      [blob],
      `echo_spotlight_${post.id}.png`,
      { type: 'image/png' }
    );
    return { file, mediaType: 'image' };
  } catch (err) {
    console.warn('[Watermark] getShareableFile failed:', err);
    return null;
  }
};

/* ─── Share text / link ───────────────────────────────────── */

export const spotlightShareUrl = (postId) =>
  `${typeof window !== 'undefined' ? window.location.origin : 'https://echoty.xyz'}/spotlight?focus=${postId}&w=1`;

export const spotlightShareText = (post, authorName = 'Someone') =>
  `${authorName} on ECHO Spotlight 🎬\n${spotlightShareUrl(post?.id)}`;
