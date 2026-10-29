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
  const { user, loading: authLoading } = useAuth();
  const [isPlus, setIsPlus] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [profileBg, setProfileBg] = useState('default');
  const [chatStyle, setChatStyle] = useState('standard');
  const [auraStyle, setAuraStyle] = useState('gold');
  const [ringStyle, setRingStyle] = useState('gold');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsPlus(false);
      setLoading(false);
      return;
    }

    const profileRef = ref(db, `profiles/${user.uid}`);
    
    const unsubscribe = onValue(profileRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setIsPlus(data.isEchoPlus === true); 
        
        if (data.premiumProfileBg) setProfileBg(data.premiumProfileBg);
        if (data.premiumChatStyle) setChatStyle(data.premiumChatStyle);
        if (data.premiumRingStyle) {
          setAuraStyle(data.premiumRingStyle);
          setRingStyle(data.premiumRingStyle);
        }
      } else {
        setIsPlus(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading]);

  // This function saves the changes to Firebase so other users can see them!
  const updatePlusFeature = async (feature, value) => {
    if (!user) return;
    try {
      const profileRef = ref(db, `profiles/${user.uid}`);
      await update(profileRef, { [`premium${feature}`]: value });
    } catch (error) {
      console.error("Failed to save plus feature:", error);
    }
  };

  return (
    <SubscriptionContext.Provider value={{ 
      isPlus, 
      loading, 
      updatePlusFeature,
      profileBg, setProfileBg: (val) => { setProfileBg(val); updatePlusFeature('ProfileBg', val); },
      chatStyle, setChatStyle: (val) => { setChatStyle(val); updatePlusFeature('ChatStyle', val); },
      auraStyle, setAuraStyle: (val) => { setAuraStyle(val); updatePlusFeature('RingStyle', val); },
      ringStyle, setRingStyle: (val) => { setRingStyle(val); updatePlusFeature('RingStyle', val); }
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export default SubscriptionContext;
