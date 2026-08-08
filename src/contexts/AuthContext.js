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

                // ─── Ensure searchName exists (migration) ──
                const name = profileData.name || profileData.displayName || profileData.username || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
                const searchName = name.toLowerCase();
                if (!profileData.searchName || profileData.searchName !== searchName) {
                  update(profileRef, { searchName })
                    .then(() => console.log('✅ Updated searchName for existing user'))
                    .catch(err => console.warn('Could not update searchName:', err));
                  profileData.searchName = searchName;
                }

                setUser({ ...firebaseUser, ...profileData });
                setLoading(false);
              } else {
                // ─── New user: create profile with searchName ──
                const name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
                console.log('👤 Creating new profile for:', name);
                const newProfile = {
                  name,
                  searchName: name.toLowerCase(), // ✅ for search
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
                  .catch(err => {
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
                ]).catch(err => console.warn('Error creating auxiliary nodes:', err));
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