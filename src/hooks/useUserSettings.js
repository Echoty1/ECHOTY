// src/hooks/useUserSettings.js
import { useEffect, useState, useCallback } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../services/firebase';

const DEFAULTS = {
  chats: {
    enterToSend: true,
    fontSize: 'md',              // 'sm' | 'md' | 'lg'
    mediaAutoDownload: 'wifi',   // 'always' | 'wifi' | 'never'
    showTyping: true,
    sendReadReceipts: true,
  },
  notifications: {
    sound: true,
    vibrate: true,
    previewOnLock: true,
  },
  privacy: {
    lastSeen: 'everyone',        // 'everyone' | 'contacts' | 'nobody'
    profilePhoto: 'everyone',
    readReceipts: true,
    whoCanAddToGroups: 'everyone',
  },
  echo: {
    defaultTideTTL: 24 * 60 * 60 * 1000,  // 24h; 0 = never
    haloDefault: false,
    defaultMood: 'happy',
  },
};

/**
 * Reads/writes the signed-in user's OWN settings at userSettings/{uid}.
 * Updates are optimistic — UI flips instantly, then Firebase confirms.
 */
export const useUserSettings = (uid) => {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setSettings(DEFAULTS);
      setLoading(false);
      return undefined;
    }

    const r = ref(db, `userSettings/${uid}`);
    const unsub = onValue(
      r,
      (snap) => {
        const val = snap.val() || {};
        setSettings({
          chats: { ...DEFAULTS.chats, ...(val.chats || {}) },
          notifications: { ...DEFAULTS.notifications, ...(val.notifications || {}) },
          privacy: { ...DEFAULTS.privacy, ...(val.privacy || {}) },
          echo: { ...DEFAULTS.echo, ...(val.echo || {}) },
        });
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [uid]);

  const updateSection = useCallback(
    async (section, patch) => {
      if (!uid) return;
      setSettings((prev) => ({
        ...prev,
        [section]: { ...(prev[section] || {}), ...patch },
      }));

      try {
        await update(ref(db, `userSettings/${uid}/${section}`), patch);

        // ── Mirror privacy changes to the public node so other users can
        //    read them without exposing userSettings/{uid}.
        if (section === 'privacy') {
          await update(ref(db, `userPrivacy/${uid}`), patch).catch(() => {});
        }
      } catch (err) {
        console.warn('[useUserSettings] update failed:', err?.message || err);
      }
    },
    [uid]
  );

  return { settings, loading, updateSection };
};

export { DEFAULTS as USER_SETTINGS_DEFAULTS };
