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
    defaultTideTTL: 24 * 60 * 60 * 1000,  // 24h
    haloDefault: false,
    defaultMood: 'happy',
  },
};

export const useUserSettings = (uid) => {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const r = ref(db, `userSettings/${uid}`);
    const unsub = onValue(r, (snap) => {
      const val = snap.val() || {};
      setSettings({
        chats: { ...DEFAULTS.chats, ...(val.chats || {}) },
        notifications: { ...DEFAULTS.notifications, ...(val.notifications || {}) },
        privacy: { ...DEFAULTS.privacy, ...(val.privacy || {}) },
        echo: { ...DEFAULTS.echo, ...(val.echo || {}) },
      });
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [uid]);

  const updateSection = useCallback(async (section, patch) => {
    if (!uid) return;
    const next = { ...(settings[section] || {}), ...patch };
    setSettings((prev) => ({ ...prev, [section]: next })); // optimistic
    await update(ref(db, `userSettings/${uid}/${section}`), patch);
  }, [uid, settings]);

  return { settings, loading, updateSection };
};

export { DEFAULTS as USER_SETTINGS_DEFAULTS };
