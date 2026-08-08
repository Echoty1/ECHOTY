// src/contexts/ProfileContext.jsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db } from '../services/firebase';
import { ref, onValue, get, set, update } from 'firebase/database';
import { useAuth } from '../hooks/useAuth';

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

  // ─── Fetch profile and presence ──────────────────────────────
  const fetchProfile = (uid) => {
    if (!uid) return;
    if (listenerRefs.current[uid]) {
      console.log(`📦 ProfileProvider: Already listening to ${uid}`);
      return;
    }

    console.log(`🔍 ProfileProvider: Fetching profile for ${uid}`);
    const profileRef = ref(db, `profiles/${uid}`);
    let timeoutId = null;
    let didReceiveData = false;

    const unsubscribe = onValue(
      profileRef,
      (snapshot) => {
        const data = snapshot.val();
        console.log(`📦 ProfileProvider: Raw data for ${uid}:`, data);
        didReceiveData = true;
        if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }

        let finalData = data || {};
        // ✅ Only fix name if user is authenticated
        if (!finalData.name && user && user.uid) {
          console.warn(`⚠️ ProfileProvider: Missing name for ${uid}, fixing...`);
          const fallbackName = 'User';
          finalData.name = fallbackName;
          update(profileRef, { name: fallbackName }).catch(err => console.error('Update failed:', err));
        } else if (!finalData.name) {
          console.warn(`⚠️ ProfileProvider: Missing name for ${uid}, but user not logged in. Skipping fix.`);
        }

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

    const fallbackFetch = async (uid) => {
      try {
        const snapshot = await get(profileRef);
        let data = snapshot.val();
        if (!data) {
          data = { name: uid, avatar: '', mood: 'neutral', activeSkin: null };
          if (user && user.uid) {
            await set(profileRef, data);
          }
        } else if (!data.name) {
          data.name = uid;
          if (user && user.uid) {
            await update(profileRef, { name: uid });
          }
        }
        setProfiles((prev) => ({ ...prev, [uid]: data }));
      } catch (err) {
        console.error(`❌ ProfileProvider: Fallback error for ${uid}:`, err);
        setProfiles((prev) => ({ ...prev, [uid]: { name: uid, avatar: '', mood: 'neutral', activeSkin: null } }));
      }
      // ✅ Always set loading to false
      setLoading(false);
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
    };

    // Presence listener (no write needed)
    const presenceRef = ref(db, `presence/online/${uid}`);
    const unsubPresence = onValue(
      presenceRef,
      (snapshot) => {
        const online = snapshot.val() === true;
        console.log(`📡 ProfileProvider: Presence for ${uid}:`, online);
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
  };

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