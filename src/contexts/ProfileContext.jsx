// src/contexts/ProfileContext.jsx
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../services/firebase';
import { ref, onValue, get, set, update } from 'firebase/database';
import { useAuth } from '../hooks/useAuth';
import { getCache, setCache, clearCache } from '../services/cacheService';

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

  // ─── Clean up listeners on logout ──────────────────────────
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

  // ─── Fetch profile and presence with instant cache hydration ──
  const fetchProfile = useCallback((uid) => {
    if (!uid) return () => {};
    if (listenerRefs.current[uid]) return listenerRefs.current[uid];

    const cacheKey = `profile_${uid}`;

    // Cache hydration
    try {
      const cached = getCache(cacheKey);
      if (cached && cached.name) {
        setProfiles((prev) => ({ ...prev, [uid]: { ...(prev[uid] || {}), ...cached } }));
        setLoading(false);
      }
    } catch (err) { /* ignore */ }

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

        setCache(cacheKey, finalData, 300);
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
        setProfiles((prev) => ({ ...prev, [targetUid]: data }));
        setCache(cacheKey, data, 300);
      } catch (err) {
        console.error(`❌ ProfileProvider: Fallback error for ${targetUid}:`, err);
        setProfiles((prev) => ({
          ...prev,
          [targetUid]: prev[targetUid] || { name: 'User', avatar: '', mood: 'neutral' }
        }));
      }
      setLoading(false);
      if (timeoutId) clearTimeout(timeoutId);
    };

    // Presence listener
    const presenceRef = ref(db, `presence/online/${uid}`);
    const unsubPresence = onValue(presenceRef, (snapshot) => {
      const online = snapshot.val() === true;
      setPresence((prev) => ({ ...prev, [uid]: online }));
    }, (error) => {
      console.warn(`⚠️ ProfileProvider: Presence error for ${uid}:`, error);
      setPresence((prev) => ({ ...prev, [uid]: false }));
    });

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribe();
      unsubPresence();
      delete listenerRefs.current[uid];
    };

    listenerRefs.current[uid] = cleanup;
    return cleanup;
  }, [user]);

  // ─── Refresh profile ──────────────────────────────────────────
  const refreshProfile = useCallback(async (uid) => {
    if (!uid) return;
    const cacheKey = `profile_${uid}`;
    await clearCache(cacheKey);
    setProfiles((prev) => { const updated = { ...prev }; delete updated[uid]; return updated; });
    if (listenerRefs.current[uid]) {
      listenerRefs.current[uid]();
      delete listenerRefs.current[uid];
    }
    return fetchProfile(uid);
  }, [fetchProfile]);

  // ─── Get profile ──────────────────────────────────────────────
  const getProfile = useCallback((uid) => {
    if (!uid) return null;
    return profiles[uid] || null;
  }, [profiles]);

  // ─── Update profile ────────────────────────────────────────────
  const updateProfile = useCallback(async (uid, updates) => {
    if (!uid || !user) return;
    try {
      const profileRef = ref(db, `profiles/${uid}`);
      await update(profileRef, updates);
      setProfiles((prev) => ({ ...prev, [uid]: { ...prev[uid], ...updates } }));
    } catch (error) {
      console.error('❌ Failed to update profile:', error);
      throw error;
    }
  }, [user]);

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
    getProfile,
    updateProfile,
    isOnline: (uid) => presence[uid] || false,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};