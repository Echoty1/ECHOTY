import React, { createContext, useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue, set, update } from 'firebase/database';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch user data from Realtime Database
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        onValue(userRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            setUser({ ...data, uid: firebaseUser.uid });
          } else {
            // Create user if not exists
            const newUser = {
              username: firebaseUser.displayName || firebaseUser.email.split('@')[0],
              avatar: firebaseUser.displayName ? firebaseUser.displayName[0].toUpperCase() : firebaseUser.email[0].toUpperCase(),
              email: firebaseUser.email,
              photoURL: firebaseUser.photoURL || null,
              bio: 'New to ECHO! 🌍',
              location: 'Unknown',
              joined: new Date().toISOString().split('T')[0],
              online: true,
              uid: firebaseUser.uid
            };
            set(ref(db, `users/${firebaseUser.uid}`), newUser);
            setUser({ ...newUser, uid: firebaseUser.uid });
          }
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = { user, loading };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};