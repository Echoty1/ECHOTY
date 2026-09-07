import { ref, set, onValue, off, remove, serverTimestamp } from 'firebase/database';
import { db } from './firebase';

export const generateDropCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const createDropSession = async (userId, code, peerId) => {
  await set(ref(db, `echoDrop/${code}`), {
    hostId: userId,
    hostPeerId: peerId,
    createdAt: serverTimestamp(),
    status: 'waiting',
  });
};

export const joinDropSession = (code) => {
  return new Promise((resolve, reject) => {
    const sessionRef = ref(db, `echoDrop/${code}`);
    onValue(
      sessionRef,
      (snap) => {
        const data = snap.val();
        if (!data) {
          reject(new Error('Invalid or expired code'));
          return;
        }
        resolve(data);
      },
      { onlyOnce: true }
    );
  });
};

export const endDropSession = (code) => {
  if (!code) return;
  return remove(ref(db, `echoDrop/${code}`));
};
