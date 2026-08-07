// src/contexts/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { ref, get, set, onDisconnect, update } from 'firebase/database';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Set online presence
          const onlineRef = ref(db, `presence/online/${firebaseUser.uid}`);
          await set(onlineRef, true);
          const disconnectRef = ref(db, `presence/online/${firebaseUser.uid}`);
          await onDisconnect(disconnectRef).set(false);

          const profileRef = ref(db, `profiles/${firebaseUser.uid}`);
          const snapshot = await get(profileRef);

          if (!snapshot.exists()) {
            // ✅ New user: create profile with correct name
            const name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
            const newProfile = {
              name: name,
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
            await set(profileRef, newProfile);
            await set(ref(db, `accounts/${firebaseUser.uid}`), {
              email: firebaseUser.email,
              joined: Date.now(),
              banned: false,
            });
            await set(ref(db, `userSkins/${firebaseUser.uid}`), {
              owned: [],
              active: null,
              coins: 350,
              purchases: {},
            });
            setUser({ ...firebaseUser, ...newProfile });
          } else {
            // ✅ Existing user: ensure name is correct
            const profileData = snapshot.val();
            let needsUpdate = false;

            // If name is missing or is "User" (default), fix it
            if (!profileData.name || profileData.name === 'User') {
              const correctName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
              if (profileData.name !== correctName) {
                await update(profileRef, { name: correctName });
                profileData.name = correctName;
                needsUpdate = true;
              }
            }

            // Also ensure other fields exist if needed
            if (!profileData.interests) {
              await update(profileRef, { interests: [] });
              profileData.interests = [];
              needsUpdate = true;
            }
            if (!profileData.skills) {
              await update(profileRef, { skills: [] });
              profileData.skills = [];
              needsUpdate = true;
            }

            setUser({ ...firebaseUser, ...profileData });
          }
          setLoading(false);
        } catch (err) {
          console.error('Error setting up user:', err);
          setLoading(false);
        }
      } else {
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
      } catch (err) {
        console.error('Error setting offline:', err);
      }
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