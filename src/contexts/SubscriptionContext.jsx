import React, { createContext, useState, useContext, useEffect } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';

const SubscriptionContext = createContext();

export const SubscriptionProvider = ({ children }) => {
  const { user } = useAuth();
  const [isEchoPlus, setIsEchoPlus] = useState(false); 
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // Customization States
  const [appTheme, setAppTheme] = useState('theme-default');
  const [chatStyle, setChatStyle] = useState(''); // '', 'neon', 'glass', 'gold'
  const [ringStyle, setRingStyle] = useState('gold'); // 'gold', 'neon', 'fire'

  const upgradeToPlus = () => {
    setIsEchoPlus(true);
    setShowUpgradeModal(false);
    // In a real app, this would save to Firebase. For now, we just set local state.
  };

  // Sync settings to Firebase so others can see your premium status
  const syncPremiumSettings = async (newChatStyle, newRingStyle) => {
    if (!user?.uid || !isEchoPlus) return;
    try {
      await update(ref(db, `profiles/${user.uid}`), {
        isEchoPlus: true,
        premiumChatStyle: newChatStyle,
        premiumRingStyle: newRingStyle
      });
    } catch (e) {
      console.error("Failed to sync premium settings", e);
    }
  };

  // Wrapper functions to update state AND sync to database
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
