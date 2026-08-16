// src/contexts/ProfileContext.jsx
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../services/firebase';
import { ref, onValue, get, set, update } from 'firebase/database';
import { useAuth } from '../hooks/useAuth';
import { loadCache, getProfile, setProfile, clearCache } from '../services/cacheService';

const ProfileContext = createContext();

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfile must be used within ProfileProvider');
  return context;
};

export const ProfileProvider = ({ children }) => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState({});
  const [presence, setPresence] = useState({});
  const [loading, setLoading] = useState(true);
  const listenerRefs = useRef({});

  // ─── Load cache on mount ──────────────────────────────────────
  useEffect(() => {
    const initCache = async () => {
      try {
        await loadCache();
        // Populate profiles from memory cache
        // We don't set all profiles here; we'll fetch on demand
        setLoading(false);
      } catch (err) {
        console.warn('Failed to load cache:', err);
        setLoading(false);
      }
    };
    initCache();
  }, []);

  // ─── Clean up listeners on logout ────────────────────────────
  useEffect(() => {
    if (!user) {
      console.log('🧹 ProfileProvider: User logged out, cleaning up listeners');
      Object.values(listenerRefs.current).forEach(cleanup => cleanup());
      listenerRefs.current = {};
      setProfiles({});
      setPresence({});
      setLoading(false);
    }
  }, [user]);

  // ─── Fetch profile with cache + real‑time listener ──────────
  const fetchProfile = useCallback((uid) => {
    if (!uid) return () => {};
    if (listenerRefs.current[uid]) return listenerRefs.current[uid];

    // 1. Check memory cache first (fast)
    const cached = getProfile(uid);
    if (cached && cached.name) {
      setProfiles((prev) => ({ ...prev, [uid]: { ...(prev[uid] || {}), ...cached } }));
      setLoading(false);
    }

    // 2. Real‑time listener for updates
    const profileRef = ref(db, `profiles/${uid}`);
    let timeoutId = null;
    let didReceiveData = false;
    const isOwnProfile = user?.uid === uid;

    const unsubscribe = onValue(
      profileRef,
      (snapshot) => {
        const data = snapshot.val();
        didReceiveData = true;
        if (timeoutId) clearTimeout(timeoutId);

        let finalData = data || {};
        if (!finalData.name && isOwnProfile) {
          finalData.name = 'User';
          update(profileRef, { name: 'User' }).catch(() => {});
        } else if (!finalData.name) {
          finalData.name = 'User';
        }

        // Update both context state and IndexedDB cache
        setProfile(uid, finalData);
        setProfiles((prev) => ({ ...prev, [uid]: finalData }));
        setLoading(false);
      },
      (error) => {
        console.error(`❌ ProfileProvider: Error for ${uid}:`, error);
        if (!didReceiveData) fallbackFetch(uid);
      }
    );

    timeoutId = setTimeout(() => {
      if (!didReceiveData) fallbackFetch(uid);
    }, 2000);

    const fallbackFetch = async (targetUid) => {
      try {
        const snapshot = await get(profileRef);
        let data = snapshot.val();
        const isOwn = user?.uid === targetUid;
        if (!data) {
          data = isOwn ? { name: targetUid, avatar: '', mood: 'neutral' } : { name: 'User', avatar: '', mood: 'neutral' };
          await set(profileRef, data);
        } else if (!data.name) {
          data.name = isOwn ? targetUid : 'User';
          await update(profileRef, { name: data.name });
        }
        await setProfile(targetUid, data);
        setProfiles((prev) => ({ ...prev, [targetUid]: data }));
      } catch (err) {
        console.error(`❌ ProfileProvider: Fallback error for ${targetUid}:`, err);
        setProfiles((prev) => ({
          ...prev,
          [targetUid]: prev[targetUid] || { name: 'User', avatar: '', mood: 'neutral' },
        }));
      }
      setLoading(false);
      if (timeoutId) clearTimeout(timeoutId);
    };

    // ─── Presence listener (real‑time) ──────────────────────────
    const presenceRef = ref(db, `presence/online/${uid}`);
    const unsubPresence = onValue(
      presenceRef,
      (snapshot) => {
        const online = snapshot.val() === true;
        setPresence((prev) => ({ ...prev, [uid]: online }));
      },
      (error) => {
        console.warn(`⚠️ ProfileProvider: Presence error for ${uid}:`, error);
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

  // ─── Refresh profile (clear cache + re‑fetch) ────────────────
  const refreshProfile = useCallback(async (uid) => {
    if (!uid) return;
    await clearCache();
    setProfiles((prev) => { const updated = { ...prev }; delete updated[uid]; return updated; });
    if (listenerRefs.current[uid]) {
      listenerRefs.current[uid]();
      delete listenerRefs.current[uid];
    }
    return fetchProfile(uid);
  }, [fetchProfile]);

  // ─── Get profile from context state ───────────────────────────
  const getProfileFromContext = useCallback((uid) => {
    if (!uid) return null;
    return profiles[uid] || null;
  }, [profiles]);

  // ─── Update profile (Firebase + cache) ────────────────────────
  const updateProfile = useCallback(async (uid, updates) => {
    if (!uid || !user) return;
    try {
      const profileRef = ref(db, `profiles/${uid}`);
      await update(profileRef, updates);
      const updatedProfile = { ...(profiles[uid] || {}), ...updates };
      await setProfile(uid, updatedProfile);
      setProfiles((prev) => ({ ...prev, [uid]: updatedProfile }));
    } catch (error) {
      console.error('❌ Failed to update profile:', error);
      throw error;
    }
  }, [user, profiles]);

  // ─── Clean up on unmount ──────────────────────────────────────
  useEffect(() => {
    return () => {
      Object.values(listenerRefs.current).forEach(cleanup => cleanup());
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
    isOnline: (uid) => presence[uid] || false,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};