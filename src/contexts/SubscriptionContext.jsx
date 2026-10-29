// src/contexts/SubscriptionContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../services/firebase'; 
import { useAuth } from '../hooks/useAuth'; 

const SubscriptionContext = createContext();

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [isPlus, setIsPlus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ringStyle, setRingStyle] = useState('gold');
  const [profileBg, setProfileBg] = useState('gold');

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;

    if (!user) {
      setIsPlus(false);
      setLoading(false);
      return;
    }

    const profileRef = ref(db, `profiles/${user.uid}`);
    
    // Listen to real-time updates for the user's profile
    const unsubscribe = onValue(profileRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log("SubscriptionContext DB Check:", data.isEchoPlus); // Debug log
        
        // Update states
        setIsPlus(data.isEchoPlus === true); 
        if (data.premiumRingStyle) setRingStyle(data.premiumRingStyle);
        if (data.premiumChatStyle) setProfileBg(data.premiumChatStyle);
      } else {
        setIsPlus(false);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching subscription data:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading]);

  return (
    <SubscriptionContext.Provider value={{ 
      isPlus, 
      loading, 
      ringStyle, 
      setRingStyle,
      profileBg, 
      setProfileBg
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export default SubscriptionContext;
