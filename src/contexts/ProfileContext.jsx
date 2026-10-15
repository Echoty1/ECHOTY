// src/contexts/ProfileContext.jsx
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../services/firebase';
import { ref, onValue, get, update } from 'firebase/database';
import { useAuth } from './AuthContext';
import { loadCache, getProfile, setProfile, clearCache } from '../services/cacheService';
import { cacheMedia } from '../utils/mediaCache';

const ProfileContext = createContext();

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used within ProfileProvider');
  return context;
};

const ECHO_AI_ID = 'echo_ai_assistant';
const SYSTEM_UIDS = new Set([ECHO_AI_ID, 'system']);

const VIRTUAL_PROFILES = {
  [ECHO_AI_ID]: {
    name: 'ECHO AI',
    avatar: '/videos/library/Artificial Intelligence Ai GIF by Abdi Slick.gif',
    mood: 'happy',
    bio: 'Your ECHO assistant',
    isVirtual: true,
  },
  system: {
    name: 'System',
    avatar: '',
    mood: 'neutral',
    isVirtual: true,
  },
};

/**
 * Derive a sensible display name from a Firebase Auth user.
 * Never returns the literal string "User" — we treat that as "no name".
 */
const deriveNameFromAuthUser = (authUser) => {
  if (!authUser) return '';
  const dn = (authUser.displayName || '').trim();
  if (dn) return dn;
  const email = (authUser.email || '').trim();
  if (email) {
    const local = email.split('@')[0];
    // Capitalize first letter, replace dots/underscores/dashes with spaces
    const cleaned = local.replace(/[._-]+/g, ' ').trim();
    if (cleaned) {
      return cleaned
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }
  }
  return '';
};

export const ProfileProvider = ({ children }) => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState({ ...VIRTUAL_PROFILES });
  const [presence, setPresence] = useState({});
  const [loading, setLoading] = useState(true);
  const listenerRefs = useRef({});

  useEffect(() => {
    const initCache = async () => {
      try {
        await loadCache();
        setLoading(false);
      } catch (err) {
        console.warn('Failed to load cache:', err);
        setLoading(false);
      }
    };
    initCache();
  }, []);

  useEffect(() => {
    if (!user) {
      Object.values(listenerRefs.current).forEach((cleanup) => cleanup());
      listenerRefs.current = {};
      setProfiles({ ...VIRTUAL_PROFILES });
      setPresence({});
      setLoading(false);
    }
  }, [user]);

  const fetchProfile = useCallback((uid) => {
    if (!uid) return () => {};

    if (SYSTEM_UIDS.has(uid)) {
      const virtual = VIRTUAL_PROFILES[uid] || { name: 'ECHO AI', avatar: '', isVirtual: true };
      setProfiles((prev) => (prev[uid] ? prev : { ...prev, [uid]: virtual }));
      return () => {};
    }

    if (listenerRefs.current[uid]) return listenerRefs.current[uid];

    const cached = getProfile(uid);
    if (cached && cached.name) {
      setProfiles((prev) => ({ ...prev, [uid]: { ...(prev[uid] || {}), ...cached } }));
      setLoading(false);
    }

    const profileRef = ref(db, `profiles/${uid}`);
    let timeoutId = null;
    let didReceiveData = false;
    const isOwnProfile = user?.uid === uid;

    const fallbackFetch = async (targetUid) => {
      try {
        const snapshot = await get(ref(db, `profiles/${targetUid}`));
        let data = snapshot.val();

        if (!data) {
          // Profile node missing entirely
          const derivedName = isOwnProfile ? deriveNameFromAuthUser(user) : '';
          data = {
            name: derivedName,        // may be '' — that's fine
            avatar: '',
            mood: 'neutral',
          };
          // Only create the profile node if we have a real name to write
          if (isOwnProfile && user?.uid === targetUid && derivedName) {
            await update(profileRef, data).catch(() => {});
          }
        } else if ((!data.name || data.name === 'User') && isOwnProfile && user?.uid === targetUid) {
          // Heal an existing broken profile with a derived name (if we have one)
          const derivedName = deriveNameFromAuthUser(user);
          if (derivedName) {
            data.name = derivedName;
            await update(profileRef, { name: derivedName }).catch(() => {});
          }
        }

        if (data.avatar) cacheMedia(data.avatar);
        if (data.videoUrl) cacheMedia(data.videoUrl);
        await setProfile(targetUid, data);
        setProfiles((prev) => ({ ...prev, [targetUid]: data }));
      } catch (err) {
        if (!SYSTEM_UIDS.has(targetUid)) {
          console.warn(`ProfileProvider: could not load ${targetUid}:`, err?.message || err);
        }
        setProfiles((prev) => ({
          ...prev,
          [targetUid]: prev[targetUid] || { name: '', avatar: '', mood: 'neutral' },
        }));
      }
      setLoading(false);
      if (timeoutId) clearTimeout(timeoutId);
    };

    const unsubscribe = onValue(
      profileRef,
      (snapshot) => {
        const data = snapshot.val();
        didReceiveData = true;
        if (timeoutId) clearTimeout(timeoutId);

        let finalData = data || {};

        // Only heal the profile of the signed-in user, and only if we have a real name
        if ((!finalData.name || finalData.name === 'User') && isOwnProfile) {
          const derivedName = deriveNameFromAuthUser(user);
          if (derivedName) {
            finalData = { ...finalData, name: derivedName };
            update(profileRef, { name: derivedName }).catch(() => {});
          }
        }

        if (finalData.avatar) cacheMedia(finalData.avatar);
        if (finalData.videoUrl) cacheMedia(finalData.videoUrl);

        setProfile(uid, finalData);
        setProfiles((prev) => ({ ...prev, [uid]: finalData }));
        setLoading(false);
      },
      (error) => {
        console.warn(`ProfileProvider: listener error for ${uid}:`, error?.message || error);
        if (!didReceiveData) fallbackFetch(uid);
      }
    );

    timeoutId = setTimeout(() => {
      if (!didReceiveData) fallbackFetch(uid);
    }, 2000);

    const presenceRef = ref(db, `presence/online/${uid}`);
    const unsubPresence = onValue(
      presenceRef,
      (snapshot) => {
        setPresence((prev) => ({ ...prev, [uid]: snapshot.val() === true }));
      },
      () => {
        setPresence((prev) => ({ ...prev, [uid]: false }));
      }
    );

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribe();
      unsubPresence();
      delete listenerRefs.current[uid];
    };

    listenerRefs.current[uid] = cleanup;
    return cleanup;
  }, [user]);

  const refreshProfile = useCallback(async (uid) => {
    if (!uid) return;
    if (SYSTEM_UIDS.has(uid)) return VIRTUAL_PROFILES[uid];
    await clearCache();
    setProfiles((prev) => {
      const updated = { ...prev };
      delete updated[uid];
      return updated;
    });
    if (listenerRefs.current[uid]) {
      listenerRefs.current[uid]();
      delete listenerRefs.current[uid];
    }
    return fetchProfile(uid);
  }, [fetchProfile]);

  const getProfileFromContext = useCallback((uid) => {
    if (!uid) return null;
    if (SYSTEM_UIDS.has(uid)) return VIRTUAL_PROFILES[uid];
    return profiles[uid] || null;
  }, [profiles]);

  const updateProfile = useCallback(async (uid, updates) => {
    if (!uid || !user) return;
    if (SYSTEM_UIDS.has(uid)) return;
    if (uid !== user.uid) {
      console.warn('Blocked profile write for another user:', uid);
      return;
    }
    try {
      const profileRef = ref(db, `profiles/${uid}`);
      await update(profileRef, updates);
      const updatedProfile = { ...(profiles[uid] || {}), ...updates };
      await setProfile(uid, updatedProfile);
      setProfiles((prev) => ({ ...prev, [uid]: updatedProfile }));
      if (updates.avatar) cacheMedia(updates.avatar);
      if (updates.videoUrl) cacheMedia(updates.videoUrl);
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  }, [user, profiles]);

  useEffect(() => {
    return () => {
      Object.values(listenerRefs.current).forEach((cleanup) => cleanup());
      listenerRefs.current = {};
    };
  }, []);

  const value = {
    profiles,
    presence,
    loading,
    fetchProfile,
    refreshProfile,
    getProfile: getProfileFromContext,
    updateProfile,
    isOnline: (uid) => presence[uid] === true,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};
