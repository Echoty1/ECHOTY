import React, { createContext, useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue, set } from 'firebase/database';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [bannedUser, setBannedUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        onValue(userRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            // 🔥 CHECK IF USER IS BANNED
            if (data.banned === true) {
              setUser(null);
              setBannedUser({ ...data, uid: firebaseUser.uid });
              setLoading(false);
              return;
            }
            setUser({ ...data, uid: firebaseUser.uid });
          } else {
            // New user – create profile
            const newUser = {
              username: firebaseUser.displayName || firebaseUser.email.split('@')[0],
              avatar: firebaseUser.displayName ? firebaseUser.displayName[0].toUpperCase() : firebaseUser.email[0].toUpperCase(),
              email: firebaseUser.email,
              bio: 'New to ECHO! 🌍',
              location: 'Unknown',
              joined: new Date().toISOString().split('T')[0],
              online: true,
              uid: firebaseUser.uid,
              banned: false, // not banned
            };
            set(ref(db, `users/${firebaseUser.uid}`), newUser);
            // Auto-follow Malik
            const MALIK_ID = 'dyvblcReUPZzRc99KDdjImpvs4I2';
            set(ref(db, `following/${firebaseUser.uid}/${MALIK_ID}`), true);
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

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};