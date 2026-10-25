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

const SAVED_ACCOUNTS_KEY = 'echo_saved_accounts';

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [banInfo, setBanInfo] = useState({ isBanned: false });
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);

  const profileUnsubRef = useRef(null);
  const banUnsubRef = useRef(null);
  const presenceUnsubRef = useRef(null);

  // Save/update the active account in localStorage for the switcher
  useEffect(() => {
    if (currentUser) {
      try {
        const saved = JSON.parse(localStorage.getItem(SAVED_ACCOUNTS_KEY) || '[]');
        const filtered = saved.filter((a) => a.uid !== currentUser.uid);
        const newEntry = {
          uid: currentUser.uid,
          name: userProfile?.name || currentUser.displayName || 'User',
          email: currentUser.email || '',
          avatar: userProfile?.avatar || currentUser.photoURL || '',
          sessionExpired: false,
        };
        localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify([newEntry, ...filtered]));
      } catch (_) {}
    }
  }, [currentUser, userProfile]);

  const getSavedAccounts = useCallback(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_ACCOUNTS_KEY) || '[]');
      return saved.filter((a) => a.uid !== currentUser?.uid);
    } catch (_) {
      return [];
    }
  }, [currentUser]);

  const markAccountExpired = useCallback((uid) => {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED_ACCOUNTS_KEY) || '[]');
      const updated = saved.map((a) =>
        a.uid === uid ? { ...a, sessionExpired: true } : a
      );
      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updated));
    } catch (_) {}
  }, []);

  const switchAccount = useCallback(async (account) => {
    if (!account || account.sessionExpired) {
      throw new Error('This account session has expired. Please sign in again.');
    }
    try {
      // Firebase handles session switching natively if the token is still valid.
      // Because Firebase persists multiple tokens in IndexedDB, we just need to 
      // trigger a reload after setting a "switch target" so onAuthStateChanged picks it up.
      localStorage.setItem('echo_switch_target', account.email);
      window.location.reload();
    } catch (err) {
      markAccountExpired(account.uid);
      throw err;
    }
  }, [markAccountExpired]);

  const signOutAll = useCallback(async () => {
    try {
      if (currentUser?.uid) {
        await remove(ref(db, `status/${currentUser.uid}`)).catch(() => {});
      }
      await signOut(auth);
      localStorage.removeItem(SAVED_ACCOUNTS_KEY);
      localStorage.removeItem('echo_switch_target');
    } catch (e) {
      console.error('[Auth] sign out all error:', e);
      throw e;
    }
  }, [currentUser]);

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
    } catch (e) {}
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
          try { await applyWelcomeFollow(user.uid); } catch (e) {}
        } else {
          if (presenceUnsubRef.current) { presenceUnsubRef.current(); presenceUnsubRef.current = null; }
          if (profileUnsubRef.current) { profileUnsubRef.current(); profileUnsubRef.current = null; }
          if (banUnsubRef.current) { banUnsubRef.current(); banUnsubRef.current = null; }
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
      if (currentUser?.uid) await cleanupPresence(currentUser.uid);
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
    getSavedAccounts,
    switchAccount,
    signOutAll,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
