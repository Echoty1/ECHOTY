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

  useEffect(() => {
    if (!user?.uid) return;

    const bootstrapped = new Set();
    const unsubs = [];
    let cancelled = false;

    const attachListeners = async () => {
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

        const unsub = onChildAdded(
          msgsRef,
          async (childSnap) => {
            const msg = childSnap.val();
            if (!msg) return;

            const msgId = childSnap.key;
            const ts = msg.timestamp || msg.clientTs || Date.now();

            if (msg.senderId === user.uid) return;
            if (msg.senderId === 'system' || msg.type === 'system') return;

            const seenKey = `${cId}:${msgId}`;
            const seenTs = lastSeen[seenKey];

            const isFirstBoot = !bootstrapped.has(cId);
            bootstrapped.add(cId);

            const age = Date.now() - ts;
            const isStale = age > 120000;

            if (isFirstBoot || isStale || seenTs) {
              lastSeen[seenKey] = ts;
              setLastSeenMap(lastSeen);
              return;
            }

            lastSeen[seenKey] = ts;
            setLastSeenMap(lastSeen);

            const currentPath = window.location.pathname;
            if (currentPath === `/chat/${partnerId}`) return;

            let profile = profiles[partnerId];
            if (!profile?.name || !profile?.avatar) {
              try { await fetchProfile(partnerId); } catch {}
            }

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
