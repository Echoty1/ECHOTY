// src/contexts/ProfileContext.jsx
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../services/firebase';
import { ref, onValue, get, set, update } from 'firebase/database';
import { useAuth } from '../hooks/useAuth';
import { getCache, setCache } from '../services/cacheService';

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

  // ─── Fetch profile and presence with instant cache hydration ─────────────────
  const fetchProfile = useCallback((uid) => {
    if (!uid) return;
    if (listenerRefs.current[uid]) {
      return;
    }

    const cacheKey = `profile_${uid}`;

    // 1. INSTANT HYDRATION FROM CACHE (0ms Delay)
    getCache(cacheKey).then((cached) => {
      if (cached) {
        setProfiles((prev) => ({
          ...prev,
          [uid]: { ...(prev[uid] || {}), ...cached },
        }));
        setLoading(false);
      }
    }).catch((err) => console.warn('Cache read error:', err));

    console.log(`🔍 ProfileProvider: Listening to profile for ${uid}`);
    const profileRef = ref(db, `profiles/${uid}`);
    let timeoutId = null;
    let didReceiveData = false;

    const isOwnProfile = user && user.uid && uid === user.uid;

    const unsubscribe = onValue(
      profileRef,
      (snapshot) => {
        const data = snapshot.val();
        didReceiveData = true;
        if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }

        let finalData = data || {};

        if (!finalData.name && isOwnProfile) {
          console.warn(`⚠️ ProfileProvider: Missing name for own profile (${uid}), fixing...`);
          const fallbackName = 'User';
          finalData.name = fallbackName;
          update(profileRef, { name: fallbackName }).catch(err => console.error('Update failed:', err));
        } else if (!finalData.name) {
          finalData.name = 'User';
        }

        // Cache fresh data locally
        setCache(cacheKey, finalData);

        setProfiles((prev) => ({
          ...prev,
          [uid]: finalData,
        }));
        setLoading(false);
      },
      (error) => {
        console.error(`❌ ProfileProvider: Error for ${uid}:`, error);
        if (!didReceiveData) fallbackFetch(uid);
      }
    );

    timeoutId = setTimeout(() => {
      if (!didReceiveData) {
        console.warn(`⚠️ ProfileProvider: Timeout for ${uid}, using fallback`);
        fallbackFetch(uid);
      }
    }, 2000);

    const fallbackFetch = async (targetUid) => {
      try {
        const snapshot = await get(profileRef);
        let data = snapshot.val();
        const isOwn = user && user.uid && targetUid === user.uid;

        if (!data) {
          if (isOwn) {
            data = { name: targetUid, avatar: '', mood: 'neutral', activeSkin: null };
            await set(profileRef, data);
          } else {
            data = { name: 'User', avatar: '', mood: 'neutral', activeSkin: null };
          }
        } else if (!data.name) {
          if (isOwn) {
            data.name = targetUid;
            await update(profileRef, { name: targetUid });
          } else {
            data.name = 'User';
          }
        }
        setProfiles((prev) => ({ ...prev, [targetUid]: data }));
        setCache(cacheKey, data);
      } catch (err) {
        console.error(`❌ ProfileProvider: Fallback error for ${targetUid}:`, err);
        setProfiles((prev) => ({
          ...prev,
          [targetUid]: prev[targetUid] || { name: 'User', avatar: '', mood: 'neutral', activeSkin: null }
        }));
      }
      setLoading(false);
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
    };

    // Presence listener
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

    listenerRefs.current[uid] = () => {
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribe();
      unsubPresence();
      delete listenerRefs.current[uid];
    };
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
    getProfile: (uid) => profiles[uid] || null,
    isOnline: (uid) => presence[uid] || false,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};