// src/hooks/useGlobalMessageListener.js
import { useEffect, useRef } from 'react';
import { ref, onChildAdded, query, limitToLast } from 'firebase/database';
import { db } from '../services/firebase';
import { useAuth } from './useAuth';
import { useProfile } from '../contexts/ProfileContext';
import {
  playReceivedSound,
  getSoundEnabled,
  notifyMessage,
} from '../services/notificationService';
import { registerFcmToken } from '../services/fcmService';

const STORAGE_KEY = 'echo_last_seen_msg_ts';

// A per-chat map of last-seen timestamps to avoid replaying old messages on reload
const getLastSeenMap = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const setLastSeenMap = (map) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
};

/**
 * Subscribes to incoming messages across all userChats.
 * Fires a notification banner + sound for anything new.
 * Also registers this device for FCM push notifications.
 */
export const useGlobalMessageListener = () => {
  const { user } = useAuth();
  const { profiles, fetchProfile } = useProfile();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ─── Register FCM token once per login ───
  useEffect(() => {
    if (!user?.uid) return;
    registerFcmToken(user.uid).catch((err) =>
      console.warn('FCM registration skipped:', err)
    );
  }, [user?.uid]);

  // ─── Global message listener ───
  useEffect(() => {
    if (!user?.uid) return;

    // Track which chats we've already booted so the initial fetch doesn't fire notifications
    const bootstrapped = new Set();
    const unsubs = [];
    let cancelled = false;

    const attachListeners = async () => {
      // Import fresh userChats snapshot
      const { ref: dbRef, get } = await import('firebase/database');
      const userChatsRef = dbRef(db, `userChats/${user.uid}`);
      const snap = await get(userChatsRef);
      if (cancelled) return;

      const chats = snap.exists() ? Object.keys(snap.val()) : [];
      const lastSeen = getLastSeenMap();

      chats.forEach((partnerId) => {
        if (partnerId === 'echo_ai_assistant') return;

        const cId = [user.uid, partnerId].sort().join('_');
        const msgsRef = query(
          ref(db, `chats/${cId}/messages`),
          limitToLast(1)
        );

        // Use onChildAdded — fires for existing + new
        const unsub = onChildAdded(
          msgsRef,
          async (childSnap) => {
            const msg = childSnap.val();
            if (!msg) return;

            const msgId = childSnap.key;
            const ts = msg.timestamp || msg.clientTs || Date.now();

            // Skip if we're the sender
            if (msg.senderId === user.uid) return;

            // Skip empty/system messages
            if (msg.senderId === 'system' || msg.type === 'system') return;

            // Check if this message has already been seen
            const seenKey = `${cId}:${msgId}`;
            const seenTs = lastSeen[seenKey];

            // First time we see this chat, just record the latest message and skip firing
            const isFirstBoot = !bootstrapped.has(cId);
            bootstrapped.add(cId);

            // Skip old messages (>2 minutes old = probably from reload)
            const age = Date.now() - ts;
            const isStale = age > 120000;

            if (isFirstBoot || isStale || seenTs) {
              lastSeen[seenKey] = ts;
              setLastSeenMap(lastSeen);
              return;
            }

            lastSeen[seenKey] = ts;
            setLastSeenMap(lastSeen);

            // Don't notify if the user is already in that chat
            const currentPath = window.location.pathname;
            if (currentPath === `/chat/${partnerId}`) return;

            // Make sure we have the sender profile (avatar + name)
            let profile = profiles[partnerId];
            if (!profile?.name || !profile?.avatar) {
              try { await fetchProfile(partnerId); } catch {}
            }

            // Get fresh profile from the context after fetch
            const { ref: pRef, get: pGet } = await import('firebase/database');
            const pSnap = await pGet(pRef(db, `profiles/${partnerId}`));
            const pData = pSnap.exists() ? pSnap.val() : {};

            const senderName =
              pData.name || pData.displayName || profile?.name || 'New message';
            const senderAvatar = pData.avatar || profile?.avatar || '';

            const previewText =
              msg.type === 'media'
                ? msg.mediaType === 'video'
                  ? '🎬 Video'
                  : msg.mediaType === 'audio'
                  ? '🎤 Voice note'
                  : '📷 Image'
                : msg.type === 'echomoji'
                ? '😊 ECHOmoji'
                : msg.text || 'New message';

            // Fire the receive sound + banner
            if (getSoundEnabled()) playReceivedSound();

            notifyMessage({
              partnerId,
              name: senderName,
              avatar: senderAvatar,
              text: previewText,
              timestamp: ts,
            });
          },
          () => {}
        );

        unsubs.push(unsub);
      });
    };

    attachListeners().catch((err) => console.warn('global msg listener failed', err));

    return () => {
      cancelled = true;
      unsubs.forEach((u) => { try { u(); } catch {} });
    };
  }, [user?.uid, profiles, fetchProfile]);
};
