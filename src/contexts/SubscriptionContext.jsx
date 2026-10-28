import React, { createContext, useState, useContext, useEffect } from 'react';

const SubscriptionContext = createContext();

export const SubscriptionProvider = ({ children }) => {
  const [isEchoPlus, setIsEchoPlus] = useState(false); 
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // Customization States
  const [appTheme, setAppTheme] = useState('theme-default');
  const [chatStyle, setChatStyle] = useState(''); // '', 'neon', 'glass', 'gold'
  const [ringStyle, setRingStyle] = useState('gold'); // 'gold', 'neon', 'fire'
  const [appIcon, setAppIcon] = useState('default'); // 'default', 'gold', 'neon'

  const upgradeToPlus = () => {
    setIsEchoPlus(true);
    setShowUpgradeModal(false);
  };

  useEffect(() => {
    document.body.classList.remove('theme-default', 'theme-midnight', 'theme-amoled', 'theme-ocean');
    document.body.classList.add(appTheme); 
  }, [appTheme]);

  return (
    <SubscriptionContext.Provider value={{ 
      isEchoPlus, showUpgradeModal, setShowUpgradeModal, upgradeToPlus,
      appTheme, setAppTheme, chatStyle, setChatStyle, ringStyle, setRingStyle, appIcon, setAppIcon
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);
