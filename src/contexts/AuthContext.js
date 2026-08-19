// src/contexts/AuthContext.js
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, set, update, onDisconnect, onValue, remove, get, runTransaction } from 'firebase/database';
import { initPresence } from '../services/presenceService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [banInfo, setBanInfo] = useState({ isBanned: false, reason: '', bannedAt: null });
  const presenceCleanupRef = useRef(null);
  const accountCleanupRef = useRef(null);
  const profileUnsubRef = useRef(null);

  // ─── Update daily login count using userDailyLogins path ────
  const updateDailyLogin = async (uid) => {
    if (!uid) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      const userLoginRef = ref(db, `userDailyLogins/${uid}/${today}`);
      const snap = await get(userLoginRef);
      if (snap.exists()) {
        console.log(`✅ ${uid} already logged in today (${today})`);
        return;
      }
      await set(userLoginRef, true);
      // Also update the profile's lastLoginDate for consistency
      await update(ref(db, `profiles/${uid}`), { lastLoginDate: today });
      console.log(`✅ Daily login marked for ${uid} (${today})`);
    } catch (err) {
      console.warn(`❌ Failed to mark daily login for ${uid}:`, err);
    }
  };

  // ─── Clean up all listeners ──────────────────────────────────
  const cleanupAll = () => {
    if (presenceCleanupRef.current) {
      presenceCleanupRef.current();
      presenceCleanupRef.current = null;
    }
    if (accountCleanupRef.current) {
      accountCleanupRef.current();
      accountCleanupRef.current = null;
    }
    if (profileUnsubRef.current) {
      profileUnsubRef.current();
      profileUnsubRef.current = null;
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      cleanupAll();

      if (firebaseUser) {
        try {
          const uid = firebaseUser.uid;
          console.log('👤 User authenticated:', uid);

          setLoading(false);
          presenceCleanupRef.current = initPresence(uid);

          const baseUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            emailVerified: firebaseUser.emailVerified,
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            avatar: '',
            mood: 'neutral',
            activeSkin: null,
            bio: '',
            interests: [],
            skills: [],
            country: '',
            city: '',
            status: '🟢 Active',
            lastActive: Date.now(),
          };
          setUser(baseUser);

          const profileRef = ref(db, `profiles/${uid}`);

          const unsubscribeProfile = onValue(
            profileRef,
            async (snapshot) => {
              if (snapshot.exists()) {
                const profileData = snapshot.val();
                console.log('📂 Existing profile loaded for:', uid);

                const googleName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
                const currentName = profileData.name || profileData.displayName || profileData.username || '';
                const isUid = currentName.length >= 28;
                const isDefault = !currentName || currentName === 'User' || isUid;

                let needsUpdate = false;
                const updatedData = {};

                if (isDefault) {
                  updatedData.name = googleName;
                  updatedData.searchName = googleName.toLowerCase();
                  needsUpdate = true;
                } else {
                  const expectedSearch = (currentName || 'User').toLowerCase();
                  if (profileData.searchName !== expectedSearch) {
                    updatedData.searchName = expectedSearch;
                    needsUpdate = true;
                  }
                }

                if (profileData.avatar && profileData.avatar.startsWith('https://lh3.googleusercontent.com')) {
                  updatedData.avatar = '';
                  needsUpdate = true;
                }

                if (needsUpdate) {
                  update(profileRef, updatedData)
                    .then(() => console.log('✅ Updated profile for:', uid))
                    .catch((err) => console.warn('Could not update profile:', err));
                  Object.assign(profileData, updatedData);
                }

                setUser((prev) => ({
                  ...prev,
                  ...profileData,
                  displayName: firebaseUser.displayName || profileData.name || prev?.name || 'User',
                  photoURL: firebaseUser.photoURL || profileData.avatar || '',
                }));

                // ✅ Count this login if not already counted today
                await updateDailyLogin(uid);

              } else {
                // Profile does not exist – create one
                const name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
                console.log('👤 Creating new profile for:', uid, name);
                const newProfile = {
                  name,
                  searchName: name.toLowerCase(),
                  avatar: '',
                  mood: 'neutral',
                  activeSkin: null,
                  bio: 'New to ECHO! 🌊',
                  interests: [],
                  skills: [],
                  country: '',
                  city: '',
                  status: '🟢 Active',
                  lastActive: Date.now(),
                  createdAt: Date.now(),
                };

                setUser((prev) => ({
                  ...prev,
                  ...newProfile,
                }));

                try {
                  await set(profileRef, newProfile);
                  await Promise.all([
                    set(ref(db, `accounts/${uid}`), {
                      email: firebaseUser.email,
                      joined: Date.now(),
                      banned: false,
                    }),
                    set(ref(db, `userSkins/${uid}`), {
                      owned: [],
                      active: null,
                      coins: 350,
                      purchases: {},
                    }),
                  ]);
                  await updateDailyLogin(uid);
                  console.log('✅ New profile created and daily login counted for:', uid);
                } catch (err) {
                  console.warn('Error creating profile or auxiliary nodes:', err);
                }
              }
            },
            (error) => {
              console.error('❌ Profile listener error for', uid, error);
            }
          );
          profileUnsubRef.current = unsubscribeProfile;

          const accountRef = ref(db, `accounts/${uid}`);
          const unsubAccount = onValue(accountRef, (snap) => {
            const data = snap.val();
            if (data?.forceLogout === true) {
              console.log(`🔴 Force logout for ${uid}`);
              signOut(auth).catch(() => {});
              remove(ref(db, `accounts/${uid}/forceLogout`)).catch(() => {});
            }
            if (data?.banned === true) {
              setBanInfo({
                isBanned: true,
                reason: data.banReason || 'Banned by admin',
                bannedAt: data.bannedAt || Date.now(),
              });
            } else {
              setBanInfo({ isBanned: false, reason: '', bannedAt: null });
            }
          });
          accountCleanupRef.current = unsubAccount;

        } catch (err) {
          console.error('❌ Auth error:', err);
          setLoading(false);
        }
      } else {
        console.log('🔴 User signed out');
        cleanupAll();
        setUser(null);
        setBanInfo({ isBanned: false, reason: '', bannedAt: null });
        setLoading(false);
      }
    });

    return () => {
      unsub();
      cleanupAll();
    };
  }, []);

  const handleLogout = async () => {
    cleanupAll();
    if (user) {
      try {
        await set(ref(db, `presence/online/${user.uid}`), false);
      } catch (err) {}
    }
    await signOut(auth);
  };

  const value = { user, loading, logout: handleLogout, banInfo };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};