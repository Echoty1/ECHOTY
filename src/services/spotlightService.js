// src/services/spotlightService.js
import {
  ref, push, set, update, remove, get, onValue, runTransaction, serverTimestamp, query, orderByChild, limitToLast,
} from 'firebase/database';
import { db } from './firebase';

const ROOT = 'spotlight';

/* ─── Hashtag helpers ──────────────────────────────────────── */

export const extractHashtags = (text) => {
  if (!text) return [];
  const matches = String(text).match(/#([a-zA-Z0-9_]{1,40})/g) || [];
  return matches
    .map((t) => t.slice(1).toLowerCase())
    .filter((v, i, arr) => arr.indexOf(v) === i);
};

export const indexPostHashtags = async (postId, caption) => {
  const tags = extractHashtags(caption);
  if (tags.length === 0) return;
  const updates = {};
  tags.forEach((tag) => {
    updates[`${ROOT}/hashtags/${tag}/${postId}`] = Date.now();
  });
  await update(ref(db), updates).catch(() => {});
};

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
  await indexPostHashtags(postId, payload.caption);
  console.log('[Spotlight] Published post:', postId);
  return postId;
};

export const deleteSpotlightPost = async (uid, postId) => {
  if (!uid || !postId) return;
  await update(ref(db, `${ROOT}/posts/${postId}`), { deleted: true, deletedAt: Date.now() });
  await remove(ref(db, `${ROOT}/users/${uid}/posts/${postId}`));
  await remove(ref(db, `${ROOT}/users/${uid}/reechoed/${postId}`)).catch(() => {});
};

/* ─── Soft delete + undo ───────────────────────────────────── */

export const softDeleteSpotlightPost = async (postId) => {
  if (!postId) return;
  await update(ref(db, `${ROOT}/posts/${postId}`), {
    deleted: true,
    softDeletedAt: Date.now(),
  });
};

export const restoreSpotlightPost = async (postId) => {
  if (!postId) return;
  await update(ref(db, `${ROOT}/posts/${postId}`), {
    deleted: false,
    softDeletedAt: null,
  });
};

export const hardDeleteSpotlightPost = async (postId, uid) => {
  if (!postId) return;
  await remove(ref(db, `${ROOT}/posts/${postId}`)).catch(() => {});
  if (uid) {
    await remove(ref(db, `${ROOT}/users/${uid}/posts/${postId}`)).catch(() => {});
    await remove(ref(db, `${ROOT}/users/${uid}/reechoed/${postId}`)).catch(() => {});
  }
};

/* ─── One-shot fetch ───────────────────────────────────────── */

export const fetchSpotlightFeed = async ({ maxCount = 60 } = {}) => {
  try {
    const postsRef = query(ref(db, `${ROOT}/posts`), orderByChild('createdAt'), limitToLast(maxCount));
    const snap = await get(postsRef);
    if (!snap.exists()) return [];
    const all = Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
    return all.filter((p) => !p.deleted);
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

/* ─── Hashtag fetch + follow helpers ───────────────────────── */

export const fetchPostsByHashtag = async (tag, { maxCount = 60 } = {}) => {
  if (!tag) return [];
  const clean = String(tag).replace(/^#/, '').toLowerCase();
  try {
    const snap = await get(ref(db, `${ROOT}/hashtags/${clean}`));
    if (!snap.exists()) return [];
    const ids = Object.keys(snap.val())
      .sort((a, b) => (snap.val()[b] || 0) - (snap.val()[a] || 0))
      .slice(0, maxCount);
    const results = await Promise.all(
      ids.map(async (id) => {
        const s = await get(ref(db, `${ROOT}/posts/${id}`));
        return s.exists() && !s.val().deleted ? { id, ...s.val() } : null;
      })
    );
    return results.filter(Boolean);
  } catch (err) {
    console.warn('[Spotlight] fetchPostsByHashtag failed:', err);
    return [];
  }
};

export const listenToMyEchoing = (uid, cb) => {
  if (!uid) return () => {};
  return onValue(ref(db, `${ROOT}/echoes/${uid}`), (snap) => {
    cb(snap.exists() ? Object.keys(snap.val()) : []);
  });
};

/* ─── Post likes ───────────────────────────────────────────── */

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

/* ─── Comment likes ────────────────────────────────────────── */

export const toggleCommentLike = async (postId, commentId, uid, emoji) => {
  if (!postId || !commentId || !uid) return false;
  const likeRef = ref(db, `${ROOT}/posts/${postId}/comments/${commentId}/likes/${uid}`);
  const countRef = ref(db, `${ROOT}/posts/${postId}/comments/${commentId}/likeCount`);

  let wasActive = false;
  let nowActive = false;

  await runTransaction(likeRef, (current) => {
    if (current && current === emoji) {
      wasActive = true;
      nowActive = false;
      return null;
    }
    wasActive = !!current;
    nowActive = true;
    return emoji;
  });

  if (!wasActive && nowActive) {
    await runTransaction(countRef, (c) => (c || 0) + 1);
  } else if (wasActive && !nowActive) {
    await runTransaction(countRef, (c) => Math.max(0, (c || 0) - 1));
  }

  return nowActive;
};

export const listenToCommentLike = (postId, commentId, uid, cb) => {
  if (!postId || !commentId || !uid) return () => {};
  return onValue(
    ref(db, `${ROOT}/posts/${postId}/comments/${commentId}/likes/${uid}`),
    (snap) => cb(snap.val() || null)
  );
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
    likeCount: 0,
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

/* ─── Echo (follow) ───────────────────────────────────────── */

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

export const fetchEchoingCount = async (uid) => {
  if (!uid) return 0;
  const snap = await get(ref(db, `${ROOT}/echoes/${uid}`));
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

/* ─── Fresh-feed rotation ──────────────────────────────────── */

const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const seededShuffle = (arr, seed) => {
  const rng = mulberry32(seed);
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const getOrCreateSessionSeed = (forceNew = false) => {
  const KEY = 'spotlight_rotation_seed';
  try {
    if (!forceNew) {
      const existing = sessionStorage.getItem(KEY);
      if (existing) return Number(existing);
    }
    const fresh = (Math.floor(Math.random() * 0xFFFFFFFF) >>> 0) || 1;
    sessionStorage.setItem(KEY, String(fresh));
    return fresh;
  } catch (_) {
    return (Math.floor(Math.random() * 0xFFFFFFFF) >>> 0) || 1;
  }
};

export const rankFreshFeed = (posts, seenIds = new Set(), seed = 1) => {
  if (!Array.isArray(posts) || posts.length === 0) return [];

  const seen = seenIds instanceof Set ? seenIds : new Set(seenIds || []);
  const unseen = [];
  const seenList = [];

  for (const p of posts) {
    if (!p || p.deleted) continue;
    if (seen.has(p.id)) seenList.push(p);
    else unseen.push(p);
  }

  const byAuthor = new Map();
  for (const p of unseen) {
    if (!byAuthor.has(p.uid)) byAuthor.set(p.uid, []);
    byAuthor.get(p.uid).push(p);
  }
  for (const list of byAuthor.values()) {
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
  const interleaved = [];
  let added = true;
  while (added) {
    added = false;
    for (const list of byAuthor.values()) {
      if (list.length) {
        interleaved.push(list.shift());
        added = true;
      }
    }
  }

  seenList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const ordered = [...interleaved, ...seenList];
  return seededShuffle(ordered, seed);
};

export const rotateArray = (arr, n = 0) => {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const k = ((n % arr.length) + arr.length) % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
};

/* ─── Comment replies ──────────────────────────────────────── */

export const addCommentReply = async (postId, commentId, uid, authorName, authorAvatar, text) => {
  if (!postId || !commentId || !uid || !text?.trim()) return null;
  const repliesRef = ref(db, `${ROOT}/posts/${postId}/comments/${commentId}/replies`);
  const newRef = push(repliesRef);
  const payload = {
    id: newRef.key,
    uid,
    authorName: authorName || 'User',
    authorAvatar: authorAvatar || '',
    text: text.trim().slice(0, 500),
    createdAt: Date.now(),
    likeCount: 0,
  };
  await set(newRef, payload);
  runTransaction(
    ref(db, `${ROOT}/posts/${postId}/comments/${commentId}/replyCount`),
    (c) => (c || 0) + 1
  ).catch(() => {});
  return payload;
};

export const listenToCommentReplies = (postId, commentId, cb) => {
  if (!postId || !commentId) return () => {};
  return onValue(
    ref(db, `${ROOT}/posts/${postId}/comments/${commentId}/replies`),
    (snap) => {
      if (!snap.exists()) return cb([]);
      const list = Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
      list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      cb(list);
    }
  );
};

export const deleteCommentReply = async (postId, commentId, replyId) => {
  if (!postId || !commentId || !replyId) return;
  await remove(ref(db, `${ROOT}/posts/${postId}/comments/${commentId}/replies/${replyId}`));
  runTransaction(
    ref(db, `${ROOT}/posts/${postId}/comments/${commentId}/replyCount`),
    (c) => Math.max(0, (c || 0) - 1)
  ).catch(() => {});
};

/* ─── Watch history ────────────────────────────────────────── */

export const fetchWatchHistory = async (uid, { maxCount = 60 } = {}) => {
  if (!uid) return [];
  try {
    const snap = await get(ref(db, `${ROOT}/views/${uid}`));
    if (!snap.exists()) return [];
    const rows = Object.entries(snap.val())
      .map(([postId, val]) => ({
        postId,
        viewedAt: typeof val === 'number' ? val : (val?.ts || 0),
      }))
      .sort((a, b) => b.viewedAt - a.viewedAt)
      .slice(0, maxCount);

    const posts = await Promise.all(
      rows.map(async ({ postId, viewedAt }) => {
        const s = await get(ref(db, `${ROOT}/posts/${postId}`));
        return s.exists() && !s.val().deleted
          ? { id: postId, ...s.val(), viewedAt }
          : null;
      })
    );
    return posts.filter(Boolean);
  } catch (err) {
    console.warn('[Spotlight] fetchWatchHistory failed:', err?.code);
    return [];
  }
};

export const clearWatchHistory = async (uid) => {
  if (!uid) return;
  await remove(ref(db, `${ROOT}/views/${uid}`)).catch(() => {});
};

/* ─── Trending hashtags ────────────────────────────────────── */

export const fetchTrendingHashtags = async ({
  maxCount = 20,
  windowMs = 7 * 24 * 60 * 60 * 1000,
} = {}) => {
  try {
    const snap = await get(ref(db, `${ROOT}/hashtags`));
    if (!snap.exists()) return [];
    const cutoff = Date.now() - windowMs;
    const rows = [];
    for (const [tag, posts] of Object.entries(snap.val())) {
      const recent = Object.values(posts).filter((ts) => (Number(ts) || 0) >= cutoff);
      if (recent.length > 0) rows.push({ tag, count: recent.length });
    }
    rows.sort((a, b) => b.count - a.count);
    return rows.slice(0, maxCount);
  } catch (err) {
    console.warn('[Spotlight] fetchTrendingHashtags failed:', err?.code);
    return [];
  }
};

/* ─── Search: authors + hashtags ───────────────────────────── */

export const searchAuthorsAndHashtags = async (query, { maxCount = 8 } = {}) => {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return { authors: [], hashtags: [] };
  const cleanQ = q.replace(/^[@#]/, '');

  try {
    const [profilesSnap, hashtagsSnap] = await Promise.all([
      get(ref(db, 'profiles')),
      get(ref(db, `${ROOT}/hashtags`)),
    ]);

    const authors = [];
    if (profilesSnap.exists()) {
      for (const [uid, val] of Object.entries(profilesSnap.val())) {
        const name = (val?.name || '').toLowerCase();
        const handle = (val?.username || '').toLowerCase();
        if (name.includes(cleanQ) || handle.includes(cleanQ)) {
          authors.push({
            uid,
            name: val.name || 'User',
            username: val.username || '',
            avatar: val.avatar || '',
          });
          if (authors.length >= maxCount) break;
        }
      }
    }

    const hashtags = [];
    if (hashtagsSnap.exists()) {
      for (const [tag, posts] of Object.entries(hashtagsSnap.val())) {
        if (tag.includes(cleanQ)) {
          hashtags.push({ tag, count: Object.keys(posts).length });
          if (hashtags.length >= maxCount) break;
        }
      }
      hashtags.sort((a, b) => b.count - a.count);
    }

    return { authors, hashtags };
  } catch (err) {
    console.warn('[Spotlight] searchAuthorsAndHashtags failed:', err?.code);
    return { authors: [], hashtags: [] };
  }
};

export const fetchPostsByAuthor = async (uid, { maxCount = 60 } = {}) => {
  if (!uid) return [];
  try {
    const idsSnap = await get(ref(db, `${ROOT}/users/${uid}/posts`));
    if (!idsSnap.exists()) return [];
    const ids = Object.keys(idsSnap.val()).slice(0, maxCount);
    const posts = await Promise.all(
      ids.map(async (id) => {
        const s = await get(ref(db, `${ROOT}/posts/${id}`));
        return s.exists() && !s.val().deleted ? { id, ...s.val() } : null;
      })
    );
    return posts
      .filter(Boolean)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (err) {
    console.warn('[Spotlight] fetchPostsByAuthor failed:', err?.code);
    return [];
  }
};
