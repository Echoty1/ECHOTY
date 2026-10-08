// src/hooks/useAppBadge.js
import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../services/firebase';
import { useAuth } from './useAuth';

/**
 * Sets the app icon badge to the total unread message count across all chats.
 * Works on:
 *  - PWA-installed apps (Chrome Android, Safari iOS 16.4+, Edge)
 *  - Chrome desktop (shows a dot on the tab if permitted)
 *
 * Silent no-op elsewhere.
 */
export const useAppBadge = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) {
      setUnreadCount(0);
      return;
    }

    const userChatsRef = ref(db, `userChats/${user.uid}`);

    const unsub = onValue(userChatsRef, (snap) => {
      if (!snap.exists()) {
        setUnreadCount(0);
        return;
      }
      const chats = snap.val() || {};
      let total = 0;
      Object.values(chats).forEach((chat) => {
        const count = Number(chat?.unreadCount) || 0;
        if (count > 0) total += count;
      });
      setUnreadCount(total);
    });

    return () => unsub();
  }, [user?.uid]);

  // Sync count to app icon
  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    const setBadge = async () => {
      try {
        if ('setAppBadge' in navigator) {
          if (unreadCount > 0) {
            await navigator.setAppBadge(unreadCount);
          } else {
            await navigator.clearAppBadge();
          }
        }
      } catch (_) {
        // Unsupported or permission denied — silent
      }
    };

    setBadge();
  }, [unreadCount]);

  return { unreadCount };
};
