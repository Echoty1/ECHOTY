// src/contexts/AuthContext.js
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  ref,
  set,
  update,
  onDisconnect,
  onValue,
  remove,
  get,
  runTransaction,
} from 'firebase/database';
import { initPresence } from '../services/presenceService';
import { isUnverifiedPasswordUser } from '../utils/emailGate';
import { applyWelcomeFollow } from '../services/welcomeFollow';

export const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [banInfo, setBanInfo] = useState({ isBanned: false });
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);

  const profileUnsubRef = useRef(null);
  const banUnsubRef = useRef(null);
  const presenceUnsubRef = useRef(null);

  // Subscribe to user profile
  const subscribeToProfile = useCallback((uid) => {
    if (profileUnsubRef.current) {
      profileUnsubRef.current();
      profileUnsubRef.current = null;
    }
    const userRef = ref(db, `users/${uid}`);
    profileUnsubRef.current = onValue(userRef, (snapshot) => {
      setUserProfile(snapshot.exists() ? snapshot.val() : null);
    });
  }, []);

  // Subscribe to ban status
  const subscribeToBan = useCallback((uid) => {
    if (banUnsubRef.current) {
      banUnsubRef.current();
      banUnsubRef.current = null;
    }
    const banRef = ref(db, `bans/${uid}`);
    banUnsubRef.current = onValue(banRef, (snapshot) => {
      const val = snapshot.val();
      setBanInfo({
        isBanned: Boolean(val && val.active !== false),
        reason: val?.reason || '',
        until: val?.until || null,
      });
    });
  }, []);

  // Setup presence
  const setupPresence = useCallback((uid) => {
    if (presenceUnsubRef.current) {
      presenceUnsubRef.current();
      presenceUnsubRef.current = null;
    }
    try {
      const unsub = initPresence(uid);
      presenceUnsubRef.current = typeof unsub === 'function' ? unsub : null;
    } catch (e) {
      console.warn('[Auth] presence init failed:', e?.message || e);
    }
  }, []);

  const cleanupPresence = useCallback(async (uid) => {
    if (!uid) return;
    try {
      await remove(ref(db, `status/${uid}`));
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          if (isUnverifiedPasswordUser(user)) {
            setCurrentUser(user);
            setLoading(false);
            setInitializing(false);
            return;
          }

          setCurrentUser(user);
          subscribeToProfile(user.uid);
          subscribeToBan(user.uid);
          setupPresence(user.uid);

          try {
            await applyWelcomeFollow(user.uid);
          } catch (e) {
            console.warn('[Auth] welcome follow failed:', e?.message || e);
          }
        } else {
          if (presenceUnsubRef.current) {
            presenceUnsubRef.current();
            presenceUnsubRef.current = null;
          }
          if (profileUnsubRef.current) {
            profileUnsubRef.current();
            profileUnsubRef.current = null;
          }
          if (banUnsubRef.current) {
            banUnsubRef.current();
            banUnsubRef.current = null;
          }
          setCurrentUser(null);
          setUserProfile(null);
          setBanInfo({ isBanned: false });
        }
      } catch (err) {
        console.error('[Auth] state change error:', err);
      } finally {
        setLoading(false);
        setInitializing(false);
      }
    });

    return () => {
      unsubscribe();
      if (profileUnsubRef.current) profileUnsubRef.current();
      if (banUnsubRef.current) banUnsubRef.current();
      if (presenceUnsubRef.current) presenceUnsubRef.current();
    };
  }, [subscribeToProfile, subscribeToBan, setupPresence]);

  const logout = useCallback(async () => {
    try {
      if (currentUser?.uid) {
        await cleanupPresence(currentUser.uid);
      }
      await signOut(auth);
    } catch (e) {
      console.error('[Auth] logout error:', e);
      throw e;
    }
  }, [currentUser, cleanupPresence]);

  const value = {
    currentUser,
    user: currentUser,
    userProfile,
    profile: userProfile,
    banInfo,
    loading,
    initializing,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
