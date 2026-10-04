// src/hooks/useSpotlightSEO.js
import { useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../services/firebase';

const SITE = 'https://echoty.xyz';

const upsertMeta = (attr, key, content) => {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const removeMeta = (attr, key) => {
  const el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (el) el.remove();
};

const useSpotlightSEO = (postId) => {
  useEffect(() => {
    if (!postId) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const snap = await get(ref(db, `spotlight/posts/${postId}`));
        if (!snap.exists() || cancelled) return;
        const post = snap.val();

        const title = `${post.authorName || 'Someone'} on ECHO Spotlight`;
        const description = (post.caption || 'Watch this on ECHO Spotlight').slice(0, 160);
        const image = post.posterUrl || post.mediaUrl || `${SITE}/logo.png`;
        const url = `${SITE}/spotlight?focus=${postId}&w=1`;

        document.title = title;

        upsertMeta('property', 'og:title', title);
        upsertMeta('property', 'og:description', description);
        upsertMeta('property', 'og:image', image);
        upsertMeta('property', 'og:url', url);
        upsertMeta('property', 'og:type', 'video.other');
        upsertMeta('property', 'og:site_name', 'ECHO');
        upsertMeta('property', 'og:video', post.mediaUrl || '');

        upsertMeta('name', 'twitter:card', post.mediaType === 'video' ? 'player' : 'summary_large_image');
        upsertMeta('name', 'twitter:title', title);
        upsertMeta('name', 'twitter:description', description);
        upsertMeta('name', 'twitter:image', image);

        let link = document.head.querySelector('link[rel="canonical"]');
        if (!link) {
          link = document.createElement('link');
          link.setAttribute('rel', 'canonical');
          document.head.appendChild(link);
        }
        link.setAttribute('href', url);
      } catch (err) {
        console.warn('[SEO] failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      ['og:title', 'og:description', 'og:image', 'og:url', 'og:type', 'og:site_name', 'og:video'].forEach((k) =>
        removeMeta('property', k)
      );
      ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'].forEach((k) =>
        removeMeta('name', k)
      );
    };
  }, [postId]);
};

export default useSpotlightSEO;
