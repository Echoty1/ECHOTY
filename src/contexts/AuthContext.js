// src/contexts/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, set, onDisconnect, update, onValue } from 'firebase/database';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const uid = firebaseUser.uid;
          console.log('👤 User authenticated:', uid);

          // ✅ Set loading to false immediately – let the user in!
          setLoading(false);

          // Presence
          const onlineRef = ref(db, `presence/online/${uid}`);
          set(onlineRef, true).catch(() => {});
          onDisconnect(onlineRef).set(false);

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

                // ─── Get correct Google name for fallback ──
                const googleName =
                  firebaseUser.displayName ||
                  firebaseUser.email?.split('@')[0] ||
                  'User';

                // ─── Extract current name from profile ────
                const currentName = profileData.name || profileData.displayName || profileData.username || '';

                // ─── Only update name if it's missing or a placeholder ──
                const isUid = currentName.length >= 28; // typical Firebase UID length
                const isDefault = !currentName || currentName === 'User' || isUid;

                let needsUpdate = false;
                const updatedData = {};

                // Only set name if it's missing or a placeholder
                if (isDefault) {
                  updatedData.name = googleName;
                  updatedData.searchName = googleName.toLowerCase();
                  needsUpdate = true;
                  console.log(`🔄 Setting initial name from "${currentName}" to "${googleName}"`);
                } else {
                  // Ensure searchName is correct (but don't change name)
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
                  // Immediately merge changes for UI
                  Object.assign(profileData, updatedData);
                }

                // ─── Merge profile data into user ──────────
                setUser((prev) => ({
                  ...prev,
                  ...profileData,
                  // Ensure displayName is preserved from firebase
                  displayName: firebaseUser.displayName || profileData.name || prev?.name || 'User',
                  photoURL: firebaseUser.photoURL || profileData.avatar || '',
                }));

              } else {
                // ─── New user: create profile ────────────────
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

                // Update user immediately with new profile data
                setUser((prev) => ({
                  ...prev,
                  ...newProfile,
                }));

                // Save to Firebase (non-blocking)
                set(profileRef, newProfile).catch((err) => {
                  console.error('Error creating profile:', err);
                });

                // Create auxiliary nodes (non-blocking)
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
              // Keep the base user even if profile fails
            }
          );

          return () => unsubscribe();
        } catch (err) {
          console.error('❌ Auth error:', err);
          setLoading(false);
        }
      } else {
        console.log('🔴 User signed out');
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const handleLogout = async () => {
    if (user) {
      try {
        const onlineRef = ref(db, `presence/online/${user.uid}`);
        await set(onlineRef, false);
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