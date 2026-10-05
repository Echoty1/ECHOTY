// src/services/spotlightNotifications.js
import { ref, push, set, get, update, remove, onValue, query, orderByChild, limitToLast } from 'firebase/database';
import { db } from './firebase';

const ROOT = 'spotlightNotifications';
const UNREAD_ROOT = 'spotlightUnread';

/**
 * Push a notification to `toUid`'s inbox.
 * `actorUid` is the person who performed the action.
 * Never notify yourself.
 *
 * type: 'like' | 'comment' | 'reecho' | 'duet' | 'echo' | 'mention' | 'spotlight_share'
 */
export const pushSpotlightNotification = async ({
  toUid,
  actorUid,
  actorName,
  actorAvatar,
  type,
  postId,
  postThumb,
  text = '',
}) => {
  if (!toUid || !actorUid || toUid === actorUid || !type) return null;

  try {
    const notifsRef = ref(db, `${ROOT}/${toUid}`);
    const newRef = push(notifsRef);
    const payload = {
      id: newRef.key,
      type,
      actorUid,
      actorName: actorName || 'Someone',
      actorAvatar: actorAvatar || '',
      postId: postId || '',
      postThumb: postThumb || '',
      text: (text || '').slice(0, 200),
      createdAt: Date.now(),
      read: false,
    };
    await set(newRef, payload);

    // Bump unread counter for badge
    const countRef = ref(db, `${UNREAD_ROOT}/${toUid}`);
    const snap = await get(countRef);
    const current = snap.exists() ? Number(snap.val()) || 0 : 0;
    await set(countRef, current + 1);

    return payload;
  } catch (err) {
    console.warn('[Spotlight notif] push failed:', err?.code || err?.message);
    return null;
  }
};

/**
 * Fire a "shared with you" notification for a Spotlight sent into a chat.
 * Reuses pushSpotlightNotification so the unread badge bumps correctly.
 */
export const notifySpotlightShare = async ({
  recipientUid,
  senderUid,
  senderName,
  senderAvatar,
  postId,
  postThumbnail,
  postCaption,
  // postAuthorName / chatId are accepted for API compatibility but
  // aren't stored on the notification payload (we don't render them yet).
}) => {
  if (!recipientUid || !senderUid || !postId) return null;
  return pushSpotlightNotification({
    toUid: recipientUid,
    actorUid: senderUid,
    actorName: senderName || 'Someone',
    actorAvatar: senderAvatar || '',
    type: 'spotlight_share',
    postId,
    postThumb: postThumbnail || '',
    text: (postCaption || '').slice(0, 140),
  });
};

export const listenToSpotlightNotifications = (uid, cb) => {
  if (!uid) return () => {};
  const q = query(ref(db, `${ROOT}/${uid}`), orderByChild('createdAt'), limitToLast(50));
  return onValue(q, (snap) => {
    if (!snap.exists()) return cb([]);
    const list = Object.entries(snap.val()).map(([id, val]) => ({ id, ...val }));
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    cb(list);
  });
};

export const listenToSpotlightUnreadCount = (uid, cb) => {
  if (!uid) return () => {};
  return onValue(ref(db, `${UNREAD_ROOT}/${uid}`), (snap) => {
    cb(Number(snap.val()) || 0);
  });
};

export const markAllSpotlightNotificationsRead = async (uid, notifs = []) => {
  if (!uid) return;
  try {
    const updates = {};
    notifs.forEach((n) => {
      if (!n.read) updates[`${ROOT}/${uid}/${n.id}/read`] = true;
    });
    if (Object.keys(updates).length > 0) {
      await update(ref(db), updates);
    }
    await set(ref(db, `${UNREAD_ROOT}/${uid}`), 0);
  } catch (err) {
    console.warn('[Spotlight notif] markAllRead failed:', err?.code || err?.message);
  }
};

export const clearSpotlightNotifications = async (uid) => {
  if (!uid) return;
  await remove(ref(db, `${ROOT}/${uid}`)).catch(() => {});
  await remove(ref(db, `${UNREAD_ROOT}/${uid}`)).catch(() => {});
};
