// src/services/spotlightService.js
import {
  ref, push, set, update, remove, get, onValue, runTransaction, serverTimestamp, query, orderByChild, limitToLast,
} from 'firebase/database';
import { db } from './firebase';

const ROOT = 'spotlight';

/* ─── Real-time feed listener ──────────────────────────────── */

export const listenToSpotlightFeed = ({ maxCount = 80 } = {}, cb) => {
  const postsQuery = query(
    ref(db, `${ROOT}/posts`),
    orderByChild('createdAt'),
    limitToLast(maxCount)
  );

  return onValue(
    postsQuery,
    (snap) => {
      if (!snap.exists()) {
        cb([]);
        return;
      }
      const all = Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
      const visible = all.filter((p) => !p.deleted);
      cb(visible);
    },
    (err) => {
      console.warn('[Spotlight] listener error:', err?.code || err?.message);
    }
  );
};

/* ─── Upload / publish ─────────────────────────────────────── */

export const publishSpotlightPost = async ({
  uid,
  authorName,
  authorAvatar,
  mediaUrl,
  mediaType,
  posterUrl,
  caption,
  duration,
  width,
  height,
}) => {
  if (!uid || !mediaUrl) throw new Error('Missing uid or mediaUrl');
  const postsRef = ref(db, `${ROOT}/posts`);
  const newRef = push(postsRef);
  const postId = newRef.key;

  const payload = {
    id: postId,
    uid,
    authorName: authorName || 'User',
    authorAvatar: authorAvatar || '',
    mediaUrl,
    mediaType: mediaType || 'video',
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
  };

  await set(newRef, payload);
  await set(ref(db, `${ROOT}/users/${uid}/posts/${postId}`), Date.now());
  console.log('[Spotlight] Published post:', postId);
  return postId;
};

export const deleteSpotlightPost = async (uid, postId) => {
  if (!uid || !postId) return;
  await update(ref(db, `${ROOT}/posts/${postId}`), { deleted: true, deletedAt: Date.now() });
  await remove(ref(db, `${ROOT}/users/${uid}/posts/${postId}`));
  await remove(ref(db, `${ROOT}/users/${uid}/reechoed/${postId}`)).catch(() => {});
};

/* ─── One-shot fetch (still used elsewhere) ────────────────── */

export const fetchSpotlightFeed = async ({ maxCount = 60 } = {}) => {
  try {
    const postsRef = query(ref(db, `${ROOT}/posts`), orderByChild('createdAt'), limitToLast(maxCount));
    const snap = await get(postsRef);
    if (!snap.exists()) {
      console.log('[Spotlight] Feed is empty (no /spotlight/posts node)');
      return [];
    }
    const all = Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
    const visible = all.filter((p) => !p.deleted);
    console.log(`[Spotlight] Feed fetched ${visible.length} posts (${all.length} total)`);
    return visible;
  } catch (err) {
    console.error('[Spotlight] fetchSpotlightFeed ERROR:', err?.code || '', err?.message || err);
    throw err;
  }
};

export const listenToSpotlightPost = (postId, cb) => {
  if (!postId) return () => {};
  return onValue(ref(db, `${ROOT}/posts/${postId}`), (snap) => {
    if (!snap.exists()) return cb(null);
    cb({ id: postId, ...snap.val() });
  });
};

export const listenToUserSpotlightPosts = (uid, cb) => {
  if (!uid) return () => {};
  return onValue(ref(db, `${ROOT}/users/${uid}/posts`), async (snap) => {
    if (!snap.exists()) return cb([]);
    const ids = Object.keys(snap.val());
    const results = await Promise.all(ids.map(async (id) => {
      const s = await get(ref(db, `${ROOT}/posts/${id}`));
      return s.exists() ? { id, ...s.val() } : null;
    }));
    cb(results.filter(Boolean).filter((p) => !p.deleted).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
  });
};

export const listenToUserReechoedPosts = (uid, cb) => {
  if (!uid) return () => {};
  return onValue(ref(db, `${ROOT}/users/${uid}/reechoed`), async (snap) => {
    if (!snap.exists()) return cb([]);
    const ids = Object.keys(snap.val());
    const results = await Promise.all(ids.map(async (id) => {
      const s = await get(ref(db, `${ROOT}/posts/${id}`));
      return s.exists() ? { id, ...s.val(), reechoedAt: snap.val()[id] } : null;
    }));
    cb(results.filter(Boolean).filter((p) => !p.deleted).sort((a, b) => (b.reechoedAt || 0) - (a.reechoedAt || 0)));
  });
};

/* ─── Likes ────────────────────────────────────────────────── */

export const toggleSpotlightLike = async (postId, uid) => {
  if (!postId || !uid) return false;
  const likeRef = ref(db, `${ROOT}/posts/${postId}/likes/${uid}`);
  const countRef = ref(db, `${ROOT}/posts/${postId}/likeCount`);
  let nowLiked = false;

  await runTransaction(likeRef, (current) => {
    if (current) { nowLiked = false; return null; }
    nowLiked = true;
    return true;
  });

  await runTransaction(countRef, (current) => {
    const next = Math.max(0, (current || 0) + (nowLiked ? 1 : -1));
    return next;
  });

  return nowLiked;
};

export const listenToSpotlightLike = (postId, uid, cb) => {
  if (!postId || !uid) return () => {};
  return onValue(ref(db, `${ROOT}/posts/${postId}/likes/${uid}`), (snap) => cb(!!snap.val()));
};

/* ─── Comments ─────────────────────────────────────────────── */

export const addSpotlightComment = async (postId, uid, authorName, authorAvatar, text) => {
  if (!postId || !uid || !text?.trim()) return null;
  const commentsRef = ref(db, `${ROOT}/posts/${postId}/comments`);
  const newRef = push(commentsRef);
  const payload = {
    id: newRef.key,
    uid,
    authorName: authorName || 'User',
    authorAvatar: authorAvatar || '',
    text: text.trim().slice(0, 500),
    createdAt: Date.now(),
  };
  await set(newRef, payload);
  await runTransaction(ref(db, `${ROOT}/posts/${postId}/commentCount`), (c) => (c || 0) + 1);
  return payload;
};

export const listenToSpotlightComments = (postId, cb) => {
  if (!postId) return () => {};
  return onValue(ref(db, `${ROOT}/posts/${postId}/comments`), (snap) => {
    if (!snap.exists()) return cb([]);
    const list = Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
    list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    cb(list);
  });
};

export const deleteSpotlightComment = async (postId, commentId) => {
  if (!postId || !commentId) return;
  await remove(ref(db, `${ROOT}/posts/${postId}/comments/${commentId}`));
  await runTransaction(ref(db, `${ROOT}/posts/${postId}/commentCount`), (c) => Math.max(0, (c || 0) - 1));
};

/* ─── Reecho ──────────────────────────────────────────────── */

export const toggleSpotlightReecho = async (postId, uid) => {
  if (!postId || !uid) return false;
  const reechoRef = ref(db, `${ROOT}/posts/${postId}/reechoes/${uid}`);
  const userRef = ref(db, `${ROOT}/users/${uid}/reechoed/${postId}`);
  const countRef = ref(db, `${ROOT}/posts/${postId}/reechoCount`);
  let nowReechoed = false;

  await runTransaction(reechoRef, (current) => {
    if (current) { nowReechoed = false; return null; }
    nowReechoed = true;
    return Date.now();
  });

  if (nowReechoed) await set(userRef, Date.now());
  else await remove(userRef);

  await runTransaction(countRef, (current) => {
    const next = Math.max(0, (current || 0) + (nowReechoed ? 1 : -1));
    return next;
  });

  return nowReechoed;
};

export const listenToSpotlightReecho = (postId, uid, cb) => {
  if (!postId || !uid) return () => {};
  return onValue(ref(db, `${ROOT}/posts/${postId}/reechoes/${uid}`), (snap) => cb(!!snap.val()));
};

/* ─── Echo (follow author) ─────────────────────────────────── */

export const toggleEchoAuthor = async (authorUid, myUid) => {
  if (!authorUid || !myUid || authorUid === myUid) return false;
  const fwd = ref(db, `${ROOT}/echoes/${myUid}/${authorUid}`);
  const rev = ref(db, `${ROOT}/echoers/${authorUid}/${myUid}`);
  let nowEchoed = false;

  await runTransaction(fwd, (current) => {
    if (current) { nowEchoed = false; return null; }
    nowEchoed = true;
    return Date.now();
  });

  if (nowEchoed) await set(rev, Date.now());
  else await remove(rev);

  return nowEchoed;
};

export const listenToEchoAuthor = (authorUid, myUid, cb) => {
  if (!authorUid || !myUid) return () => {};
  return onValue(ref(db, `${ROOT}/echoes/${myUid}/${authorUid}`), (snap) => cb(!!snap.val()));
};

export const fetchEchoersCount = async (authorUid) => {
  if (!authorUid) return 0;
  const snap = await get(ref(db, `${ROOT}/echoers/${authorUid}`));
  return snap.exists() ? Object.keys(snap.val()).length : 0;
};

/* ─── Views ────────────────────────────────────────────────── */

export const markSpotlightSeen = async (uid, postId) => {
  if (!uid || !postId) return;
  await set(ref(db, `${ROOT}/views/${uid}/${postId}`), Date.now());
  runTransaction(ref(db, `${ROOT}/posts/${postId}/viewCount`), (c) => (c || 0) + 1).catch(() => {});
};

export const fetchSeenSpotlightIds = async (uid) => {
  if (!uid) return new Set();
  try {
    const snap = await get(ref(db, `${ROOT}/views/${uid}`));
    if (!snap.exists()) return new Set();
    return new Set(Object.keys(snap.val()));
  } catch (err) {
    console.warn('[Spotlight] fetchSeenSpotlightIds failed:', err?.code);
    return new Set();
  }
};

/* ─── Ranking ──────────────────────────────────────────────── */

export const rankSpotlightFeed = (posts, seenSet = new Set()) => {
  const now = Date.now();
  return posts
    .map((p) => {
      const likes = p.likeCount || 0;
      const comments = p.commentCount || 0;
      const reechoes = p.reechoCount || 0;
      const views = p.viewCount || 0;
      const ageHrs = Math.max(0, (now - (p.createdAt || now)) / 3600000);
      const recencyBoost = Math.max(0, 72 - ageHrs) / 6;
      const seenPenalty = seenSet.has(p.id) ? -6 : 0;
      const engagement = likes * 2 + comments * 1.5 + reechoes * 2.5 + Math.min(views, 100) * 0.2;
      const score = engagement + recencyBoost + seenPenalty;
      return { post: p, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.post);
};
