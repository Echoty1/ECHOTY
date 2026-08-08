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

          // Presence
          const onlineRef = ref(db, `presence/online/${uid}`);
          set(onlineRef, true).catch(() => {});
          onDisconnect(onlineRef).set(false);

          const profileRef = ref(db, `profiles/${uid}`);

          const unsubscribe = onValue(
            profileRef,
            (snapshot) => {
              if (snapshot.exists()) {
                const profileData = snapshot.val();
                console.log('📂 Existing profile loaded:', profileData);

                // ─── Determine current name ──────────────────
                const suggestedName =
                  firebaseUser.displayName ||
                  firebaseUser.email?.split('@')[0] ||
                  'User';

                let currentName = profileData.name ||
                  profileData.displayName ||
                  profileData.username ||
                  suggestedName;

                let needsUpdate = false;
                const updatedData = {};

                // ─── Fix name if it's still the default fallback ──
                const isDefaultName = !profileData.name ||
                  profileData.name === 'User' ||
                  profileData.name === uid;

                if (isDefaultName && suggestedName !== profileData.name) {
                  updatedData.name = suggestedName;
                  updatedData.searchName = suggestedName.toLowerCase();
                  needsUpdate = true;
                  currentName = suggestedName;
                }

                // ─── Ensure searchName is correct ────────────
                const searchName = (currentName || 'User').toLowerCase();
                if (!profileData.searchName || profileData.searchName !== searchName) {
                  updatedData.searchName = searchName;
                  needsUpdate = true;
                }

                if (needsUpdate) {
                  update(profileRef, updatedData)
                    .then(() => console.log('✅ Updated profile:', updatedData))
                    .catch((err) =>
                      console.warn('Could not update profile:', err)
                    );
                  // Merge changes into profileData for the user object
                  Object.assign(profileData, updatedData);
                }

                setUser({ ...firebaseUser, ...profileData });
                setLoading(false);
              } else {
                // ─── New user: create profile ──────────────
                const name =
                  firebaseUser.displayName ||
                  firebaseUser.email?.split('@')[0] ||
                  'User';
                console.log('👤 Creating new profile for:', name);
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
                set(profileRef, newProfile)
                  .then(() => {
                    setUser({ ...firebaseUser, ...newProfile });
                    setLoading(false);
                  })
                  .catch((err) => {
                    console.error('Error creating profile:', err);
                    setLoading(false);
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
              setLoading(false);
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