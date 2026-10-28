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

  const upgradeToPlus = async () => {
    setIsEchoPlus(true);
    setShowUpgradeModal(false);
    if (user?.uid) {
      await update(ref(db, `profiles/${user.uid}`), { 
        isEchoPlus: true, 
        premiumChatStyle: chatStyle, 
        premiumRingStyle: ringStyle 
      }).catch(console.error);
    }
  };

  // Sync settings to Firebase whenever they change
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
