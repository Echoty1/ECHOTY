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
            // Fix existing avatar...
            if (data.avatar && data.avatar.length === 1 && !data.avatar.startsWith('data:')) {
              set(ref(db, `users/${firebaseUser.uid}/avatar`), '');
              data.avatar = '';
            }
            // Check ban
            if (data.banned === true) {
              setUser(null);
              setBannedUser({ ...data, uid: firebaseUser.uid });
              setLoading(false);
              return;
            }
            // Set user immediately
            setUser({ ...data, uid: firebaseUser.uid });
            // Update cache
            const allUsers = cache.getUsers() || {};
            allUsers[firebaseUser.uid] = { ...data, uid: firebaseUser.uid };
            cache.setUsers(allUsers);
            setLoading(false);

            // Update location in the background (don't await)
            if (data.location === 'Unknown' || !data.location) {
              fetchLocationFromIP().then(location => {
                if (location && location !== 'Unknown') {
                  set(ref(db, `users/${firebaseUser.uid}/location`), location);
                  setUser(prev => prev ? { ...prev, location } : prev);
                }
              }).catch(() => {});
            }
          } else {
            // ✅ NEW USER – default offline
            const newUser = {
              username: firebaseUser.displayName || firebaseUser.email.split('@')[0],
              avatar: '',
              email: firebaseUser.email,
              bio: 'New to ECHO! 🌍',
              location: 'Unknown',
              joined: new Date().toISOString().split('T')[0],
              online: false,   // ⬅️ start offline
              status: 'offline', // ⬅️ add status field
              uid: firebaseUser.uid,
              banned: false,
            };
            set(ref(db, `users/${firebaseUser.uid}`), newUser);
            // Auto-follow Malik
            const MALIK_ID = 'dyvblcReUPZzRc99KDdjImpvs4I2';
            set(ref(db, `following/${firebaseUser.uid}/${MALIK_ID}`), true);
            setUser({ ...newUser, uid: firebaseUser.uid });
            // Cache new user
            const allUsers = cache.getUsers() || {};
            allUsers[firebaseUser.uid] = { ...newUser, uid: firebaseUser.uid };
            cache.setUsers(allUsers);
            setLoading(false);

            // 🔄 Update location in the background
            fetchLocationFromIP().then(location => {
              if (location && location !== 'Unknown') {
                set(ref(db, `users/${firebaseUser.uid}/location`), location);
                setUser(prev => prev ? { ...prev, location } : prev);
              }
            }).catch(() => {});
          }
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