// src/utils/echoWatermark.js
//
// Echo watermark utility.
// - For videos: build a Cloudinary URL that stamps the ECHO logo onto the file
//   so the download/share has the watermark baked in.
// - For images: burn the watermark onto a canvas and download as PNG.
//
// Cloudinary overlay syntax:
//   https://res.cloudinary.com/<cloud>/video/upload/l_text:Arial_40_bold:ECHO,co_white,g_south_west,x_20,y_20/<publicId>.mp4
//
// For a real logo overlay you'd first upload the ECHO logo PNG to your
// Cloudinary account, then use:
//   l_<publicId-of-logo>,w_120,g_south_west,x_20,y_20
//
// This utility assumes the mediaUrl is already a Cloudinary secure_url.

const CLOUD_NAME = 'rjlscgan';

/* ─── Video: build watermarked Cloudinary URL ─────────────── */

export const buildWatermarkedVideoUrl = (mediaUrl, { logoPublicId } = {}) => {
  if (!mediaUrl || !mediaUrl.includes('res.cloudinary.com')) return mediaUrl;
  // Insert transformation between /upload/ and the rest of the path.
  const marker = '/video/upload/';
  if (!mediaUrl.includes(marker)) return mediaUrl;

  const [base, tail] = mediaUrl.split(marker);
  if (!tail) return mediaUrl;

  // Simple text overlay; swap for logoPublicId when you upload the ECHO mark.
  const overlay = logoPublicId
    ? `l_${logoPublicId},w_140,g_south_west,x_24,y_24,o_90`
    : `l_text:Arial_44_bold:ECHO,co_rgb:FFFFFF,g_south_west,x_24,y_24,o_90`;

  const transform = `${overlay}/fl_layer_apply`;

  // Skip if already has an overlay
  if (tail.includes('l_') || tail.startsWith(transform)) return mediaUrl;

  return `${base}${marker}${transform}/${tail}`;
};

export const isCloudinaryUrl = (url) => typeof url === 'string' && url.includes('res.cloudinary.com');

/* ─── Image: canvas burn-in ───────────────────────────────── */

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
      const metrics = ctx.measureText(text);
      const tx = padding;
      const ty = canvas.height - padding;

      ctx.fillText(text, tx, ty);
      // Small purple tick before the wordmark
      const tickSize = fontSize * 0.6;
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#a78bfa';
      ctx.beginPath();
      ctx.roundRect(tx - tickSize * 0.55, ty - tickSize * 0.95, tickSize * 0.2, tickSize * 1.2, tickSize * 0.1);
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

/* ─── Watermark an entire post (video URL or image blob) ─── */

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

/* ─── Share text / link ───────────────────────────────────── */

export const spotlightShareUrl = (postId) =>
  `${typeof window !== 'undefined' ? window.location.origin : 'https://echoty.xyz'}/spotlight?post=${postId}`;

export const spotlightShareText = (post, authorName = 'Someone') =>
  `${authorName} on ECHO Spotlight 🎬\n${spotlightShareUrl(post?.id)}`;