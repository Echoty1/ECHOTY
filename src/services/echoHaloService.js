// src/services/echoHaloService.js
import { ref, push, update, remove, onValue, serverTimestamp } from 'firebase/database';
import { db } from './firebase';

// 1. Send an Echo Halo (View Once)
export const sendEchoHalo = async (senderUid, receiverUid, { imageUrl, caption = '' }) => {
  if (!senderUid || !receiverUid) return;

  const chatId = [senderUid, receiverUid].sort().join('_');
  const haloRef = push(ref(db, `echoHalos/${chatId}`));

  await update(haloRef, {
    type: 'halo',
    imageUrl,
    caption,
    senderUid,
    receiverUid,
    chatId,
    createdAt: serverTimestamp(),
    viewed: false,
  });

  return haloRef.key;
};

// 2. Listen for Halos in a chat
export const listenToChatHalos = (chatId, callback) => {
  const halosRef = ref(db, `echoHalos/${chatId}`);
  return onValue(halosRef, (snap) => {
    const data = snap.val() || {};
    const halos = Object.keys(data).map(key => ({ ...data[key], haloId: key }));
    const visibleHalos = halos.filter(h => !h.viewed);
    callback(visibleHalos);
  });
};

// 3. Mark a Halo as Viewed
export const markHaloAsViewed = async (chatId, haloId) => {
  await update(ref(db, `echoHalos/${chatId}/${haloId}`), {
    viewed: true,
    viewedAt: serverTimestamp(),
  });
};

// 4. Delete the Halo (After 5 seconds)
export const deleteEchoHalo = async (chatId, haloId) => {
  await remove(ref(db, `echoHalos/${chatId}/${haloId}`));
};
