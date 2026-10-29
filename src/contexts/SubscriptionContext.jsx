// src/contexts/SubscriptionContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { ref, onValue, update } from 'firebase/database';
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
  const { user } = useAuth();
  const [isPlus, setIsPlus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ringStyle, setRingStyle] = useState('gold');
  const [profileBg, setProfileBg] = useState('gold');

  useEffect(() => {
    if (!user) {
      setIsPlus(false);
      setLoading(false);
      return;
    }

    const profileRef = ref(db, `profiles/${user.uid}`);
    
    const unsubscribe = onValue(profileRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setIsPlus(data.isEchoPlus || false); 
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
  }, [user]);

  const upgradeToPlus = async () => {
    if (!user) return;
    try {
      setIsPlus(true); 
      
      const profileRef = ref(db, `profiles/${user.uid}`);
      await update(profileRef, {
        isEchoPlus: true,
        premiumChatStyle: profileBg, 
        premiumRingStyle: ringStyle
      });
    } catch (error) {
      console.error("Failed to upgrade to Plus:", error);
      setIsPlus(false); 
      throw error;
    }
  };

  return (
    <SubscriptionContext.Provider value={{ 
      isPlus, 
      loading, 
      upgradeToPlus,
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
