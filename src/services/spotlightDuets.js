// src/services/spotlightDuets.js
import { ref, push, set, remove, update, get, onValue, runTransaction, serverTimestamp } from 'firebase/database';
import { db } from './firebase';

const ROOT = 'spotlight';

/**
 * Publish a duet post.
 *
 * A duet is stored as a normal Spotlight post with `type: 'duet'` plus a
 * `duet` object referencing the source post. The feed renders duets as a
 * split-screen card (original on top, recording on bottom).
 */
export const publishSpotlightDuet = async ({
  uid,
  authorName,
  authorAvatar,
  mediaUrl,        // your reaction video (uploaded to Cloudinary)
  posterUrl,
  caption,
  duration,
  width,
  height,
  // Source post fields (copied at publish time so the duet survives even if
  // the source is later deleted — we keep a soft reference)
  sourcePostId,
  sourceUid,
  sourceAuthorName,
  sourceAuthorAvatar,
  sourceMediaUrl,
  sourceMediaType,
  sourcePosterUrl,
  sourceCaption,
}) => {
  if (!uid || !mediaUrl || !sourcePostId) {
    throw new Error('Missing uid, mediaUrl, or sourcePostId');
  }

  const postsRef = ref(db, `${ROOT}/posts`);
  const newRef = push(postsRef);
  const postId = newRef.key;

  const payload = {
    id: postId,
    uid,
    authorName: authorName || 'User',
    authorAvatar: authorAvatar || '',
    mediaUrl,
    mediaType: 'video',
    posterUrl: posterUrl || '',
    caption: (caption || '').slice(0, 300),
    duration: duration || 0,
    width: width || 0,
    height: height || 0,
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
    likeCount: 0,
    commentCount: 0,
    reechoCount: 0,
    viewCount: 0,
    deleted: false,
    type: 'duet',
    duet: {
      sourcePostId,
      sourceUid: sourceUid || '',
      sourceAuthorName: sourceAuthorName || 'User',
      sourceAuthorAvatar: sourceAuthorAvatar || '',
      sourceMediaUrl: sourceMediaUrl || '',
      sourceMediaType: sourceMediaType || 'video',
      sourcePosterUrl: sourcePosterUrl || '',
      sourceCaption: (sourceCaption || '').slice(0, 200),
    },
  };

  await set(newRef, payload);
  await set(ref(db, `${ROOT}/users/${uid}/posts/${postId}`), Date.now());

  // Track duets count on the source post
  await runTransaction(
    ref(db, `${ROOT}/posts/${sourcePostId}/duetCount`),
    (c) => (c || 0) + 1
  ).catch(() => {});

  // Index the duet under the source so we can show "N duets" on the original
  await set(
    ref(db, `${ROOT}/duets/${sourcePostId}/${postId}`),
    {
      duetId: postId,
      uid,
      authorName: authorName || 'User',
      authorAvatar: authorAvatar || '',
      createdAt: Date.now(),
    }
  ).catch(() => {});

  console.log('[Spotlight] Published duet:', postId, 'on', sourcePostId);
  return postId;
};

export const fetchDuetsForPost = async (sourcePostId) => {
  if (!sourcePostId) return [];
  try {
    const snap = await get(ref(db, `${ROOT}/duets/${sourcePostId}`));
    if (!snap.exists()) return [];
    return Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
  } catch (_) {
    return [];
  }
};

export const listenToDuetCount = (sourcePostId, cb) => {
  if (!sourcePostId) return () => {};
  return onValue(
    ref(db, `${ROOT}/posts/${sourcePostId}/duetCount`),
    (snap) => cb(snap.val() || 0)
  );
};

export const removeDuetIndex = async (sourcePostId, duetId) => {
  if (!sourcePostId || !duetId) return;
  await remove(ref(db, `${ROOT}/duets/${sourcePostId}/${duetId}`)).catch(() => {});
  await runTransaction(
    ref(db, `${ROOT}/posts/${sourcePostId}/duetCount`),
    (c) => Math.max(0, (c || 0) - 1)
  ).catch(() => {});
};
