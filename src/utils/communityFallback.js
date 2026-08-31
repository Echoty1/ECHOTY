// src/utils/communityFallback.js
// Inline placeholder so a missing /images/communities/default.png cannot 404-loop.
export const COMMUNITY_FALLBACK =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#6C3CE1"/>
          <stop offset="1" stop-color="#EC4899"/>
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="28" fill="url(#g)"/>
      <text x="64" y="80" text-anchor="middle" font-size="54" fill="white" font-family="Inter,Arial,sans-serif" font-weight="800">E</text>
    </svg>`
  );

export function handleCommunityImgError(e) {
  const img = e.currentTarget;
  if (!img || img.dataset.fallbackApplied === '1') return;
  img.dataset.fallbackApplied = '1';
  img.src = COMMUNITY_FALLBACK;
}
