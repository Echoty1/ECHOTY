// src/contexts/SubscriptionContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { ref, update, onValue } from 'firebase/database';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';

const SubscriptionContext = createContext();

export const SubscriptionProvider = ({ children }) => {
  const { user } = useAuth();
  
  // 1. Initialize from Local Storage for instant load (no flash of non-premium UI)
  const [isEchoPlus, setIsEchoPlus] = useState(() => {
    return localStorage.getItem('echo_plus_status') === 'true';
  }); 
  
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // Customization States
  const [appTheme, setAppTheme] = useState('theme-default');
  const [chatStyle, setChatStyle] = useState(''); 
  const [ringStyle, setRingStyle] = useState('gold'); 

  // 2. Fetch from Firebase when user logs in
  useEffect(() => {
    if (!user?.uid) return;
    
    const profileRef = ref(db, `profiles/${user.uid}`);
    const unsub = onValue(profileRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        if (data.isEchoPlus) {
          setIsEchoPlus(true);
          localStorage.setItem('echo_plus_status', 'true');
          if (data.premiumChatStyle) setChatStyle(data.premiumChatStyle);
          if (data.premiumRingStyle) setRingStyle(data.premiumRingStyle);
        }
      }
    });
    
    return () => unsub();
  }, [user?.uid]);

  // 3. Save to Firebase AND Local Storage when upgrading
  const upgradeToPlus = async () => {
    setIsEchoPlus(true);
    setShowUpgradeModal(false);
    localStorage.setItem('echo_plus_status', 'true'); // Save locally
    
    if (user?.uid) {
      try {
        await update(ref(db, `profiles/${user.uid}`), { 
          isEchoPlus: true, 
          premiumChatStyle: chatStyle || 'gold', 
          premiumRingStyle: ringStyle || 'gold' 
        });
      } catch (e) {
        console.error("Failed to save Plus status", e);
      }
    }
  };

  // 4. Sync changes (e.g. if they change their bubble style)
  const syncPremiumSettings = async (newChatStyle, newRingStyle) => {
    if (!user?.uid || !isEchoPlus) return;
    try {
      await update(ref(db, `profiles/${user.uid}`), {
        premiumChatStyle: newChatStyle,
        premiumRingStyle: newRingStyle
      });
    } catch (e) {
      console.error("Failed to sync premium settings", e);
    }
  };

  const updateChatStyle = (style) => {
    setChatStyle(style);
    syncPremiumSettings(style, ringStyle);
  };

  const updateRingStyle = (style) => {
    setRingStyle(style);
    syncPremiumSettings(chatStyle, style);
  };

  useEffect(() => {
    document.body.classList.remove('theme-default', 'theme-midnight', 'theme-amoled', 'theme-ocean');
    document.body.classList.add(appTheme); 
  }, [appTheme]);

  return (
    <SubscriptionContext.Provider value={{ 
      isEchoPlus, showUpgradeModal, setShowUpgradeModal, upgradeToPlus,
      appTheme, setAppTheme, 
      chatStyle, setChatStyle: updateChatStyle, 
      ringStyle, setRingStyle: updateRingStyle
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);
