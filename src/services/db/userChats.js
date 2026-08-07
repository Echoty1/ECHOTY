import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';

export const getUserChats = (uid, onUpdate) => {
  const userChatsRef = ref(db, `userChats/${uid}`);
  const unsub = onValue(userChatsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const convs = Object.entries(data).map(([partnerId, meta]) => ({
        partnerId,
        ...meta,
      }));
      onUpdate(convs);
    } else {
      onUpdate([]);
    }
  });
  return unsub;
};