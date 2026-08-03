import React, { createContext, useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, onValue, set } from 'firebase/database';

export const AuthContext = createContext();

// Helper to fetch location from IP address (no user permission needed)
const fetchLocationFromIP = async () => {
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    if (data && data.city && data.region && data.country_name) {
      return `${data.city}, ${data.region}, ${data.country_name}`;
    }
    return 'Unknown';
  } catch (error) {
    console.error('Failed to fetch location:', error);
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
            // Check if banned
            if (data.banned === true) {
              setUser(null);
              setBannedUser({ ...data, uid: firebaseUser.uid });
              setLoading(false);
              return;
            }
            // If location is "Unknown", try to fetch and update (for existing users)
            if (data.location === 'Unknown' || !data.location) {
              const location = await fetchLocationFromIP();
              if (location !== 'Unknown') {
                set(ref(db, `users/${firebaseUser.uid}/location`), location);
                data.location = location;
              }
            }
            setUser({ ...data, uid: firebaseUser.uid });
          } else {
            // New user – create profile with location
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