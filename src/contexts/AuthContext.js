// src/contexts/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, set, onDisconnect, update, onValue } from 'firebase/database';
import { initPresence } from '../services/presenceService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const presenceCleanupRef = React.useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous presence if any
      if (presenceCleanupRef.current) {
        presenceCleanupRef.current();
        presenceCleanupRef.current = null;
      }

      if (firebaseUser) {
        try {
          const uid = firebaseUser.uid;
          console.log('👤 User authenticated:', uid);

          setLoading(false);

          // ✅ Initialize presence (robust)
          presenceCleanupRef.current = initPresence(uid);

          // ─── Set a basic user object immediately ──────────
          const baseUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            emailVerified: firebaseUser.emailVerified,
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            avatar: firebaseUser.photoURL || '',
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

          // ─── Load profile in the background ──────────────
          const unsubscribe = onValue(
            profileRef,
            (snapshot) => {
              if (snapshot.exists()) {
                const profileData = snapshot.val();
                console.log('📂 Existing profile loaded:', profileData);

                const googleName =
                  firebaseUser.displayName ||
                  firebaseUser.email?.split('@')[0] ||
                  'User';

                const currentName = profileData.name || profileData.displayName || profileData.username || '';
                const isUid = currentName.length >= 28;
                const isDefault = !currentName || currentName === 'User' || isUid;

                let needsUpdate = false;
                const updatedData = {};

                if (isDefault) {
                  updatedData.name = googleName;
                  updatedData.searchName = googleName.toLowerCase();
                  needsUpdate = true;
                  console.log(`🔄 Setting initial name from "${currentName}" to "${googleName}"`);
                } else {
                  const expectedSearch = (currentName || 'User').toLowerCase();
                  if (profileData.searchName !== expectedSearch) {
                    updatedData.searchName = expectedSearch;
                    needsUpdate = true;
                  }
                }

                if (needsUpdate) {
                  update(profileRef, updatedData)
                    .then(() => console.log('✅ Updated profile:', updatedData))
                    .catch((err) => console.warn('Could not update profile:', err));
                  Object.assign(profileData, updatedData);
                }

                setUser((prev) => ({
                  ...prev,
                  ...profileData,
                  displayName: firebaseUser.displayName || profileData.name || prev?.name || 'User',
                  photoURL: firebaseUser.photoURL || profileData.avatar || '',
                }));

              } else {
                const name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
                console.log('👤 Creating new profile for:', name);
                const newProfile = {
                  name,
                  searchName: name.toLowerCase(),
                  avatar: firebaseUser.photoURL || '',
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

                set(profileRef, newProfile).catch((err) => {
                  console.error('Error creating profile:', err);
                });

                Promise.all([
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
                ]).catch((err) =>
                  console.warn('Error creating auxiliary nodes:', err)
                );
              }
            },
            (error) => {
              console.error('❌ Profile listener error:', error);
            }
          );

          return () => unsubscribe();
        } catch (err) {
          console.error('❌ Auth error:', err);
          setLoading(false);
        }
      } else {
        console.log('🔴 User signed out');
        if (presenceCleanupRef.current) {
          presenceCleanupRef.current();
          presenceCleanupRef.current = null;
        }
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const handleLogout = async () => {
    if (presenceCleanupRef.current) {
      presenceCleanupRef.current();
      presenceCleanupRef.current = null;
    }
    if (user) {
      try {
        await set(ref(db, `presence/online/${user.uid}`), false);
      } catch (err) {}
    }
    await signOut(auth);
  };

  const value = { user, loading, logout: handleLogout };

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