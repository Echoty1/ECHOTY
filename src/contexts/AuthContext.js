import React, { createContext, useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue, set } from 'firebase/database';
import { cache } from '../services/cache';

export const AuthContext = createContext();

const fetchLocationFromIP = async () => {
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    if (data && data.city && data.region && data.country_name) {
      return `${data.city}, ${data.region}, ${data.country_name}`;
    }
    return 'Unknown';
  } catch {
    return 'Unknown';
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [bannedUser, setBannedUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        onValue(userRef, async (snapshot) => {
          const data = snapshot.val();
          if (data) {
            if (data.banned === true) {
              setUser(null);
              setBannedUser({ ...data, uid: firebaseUser.uid });
              setLoading(false);
              return;
            }
            // Update cache with user data
            const cachedUsers = cache.getUsers() || {};
            cachedUsers[firebaseUser.uid] = { ...data, uid: firebaseUser.uid };
            cache.setUsers(cachedUsers);
            setUser({ ...data, uid: firebaseUser.uid });
          } else {
            const location = await fetchLocationFromIP();
            const newUser = {
              username: firebaseUser.displayName || firebaseUser.email.split('@')[0],
              avatar: firebaseUser.displayName ? firebaseUser.displayName[0].toUpperCase() : firebaseUser.email[0].toUpperCase(),
              email: firebaseUser.email,
              bio: 'New to ECHO! 🌍',
              location: location,
              joined: new Date().toISOString().split('T')[0],
              online: true,
              uid: firebaseUser.uid,
              banned: false,
            };
            set(ref(db, `users/${firebaseUser.uid}`), newUser);
            const MALIK_ID = 'dyvblcReUPZzRc99KDdjImpvs4I2';
            set(ref(db, `following/${firebaseUser.uid}/${MALIK_ID}`), true);
            // Cache new user
            const cachedUsers = cache.getUsers() || {};
            cachedUsers[firebaseUser.uid] = { ...newUser, uid: firebaseUser.uid };
            cache.setUsers(cachedUsers);
            setUser({ ...newUser, uid: firebaseUser.uid });
          }
          setLoading(false);
        });
      } else {
        setUser(null);
        setBannedUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value = { user, bannedUser, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};