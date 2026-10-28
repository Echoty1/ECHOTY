import React, { createContext, useState, useContext, useEffect } from 'react';

const SubscriptionContext = createContext();

export const SubscriptionProvider = ({ children }) => {
  // Default to false (User is not Plus)
  const [isEchoPlus, setIsEchoPlus] = useState(false); 
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // Customization States
  const [appTheme, setAppTheme] = useState('theme-default');
  const [chatStyle, setChatStyle] = useState(''); // '', 'neon', or 'glass'
  const [ringStyle, setRingStyle] = useState('gold');

  const upgradeToPlus = () => {
    setIsEchoPlus(true);
    setShowUpgradeModal(false);
  };

  // This applies the theme to the body dynamically!
  useEffect(() => {
    // Remove old themes
    document.body.classList.remove('theme-default', 'theme-midnight', 'theme-amoled', 'theme-ocean');
    // Add new theme
    document.body.classList.add(appTheme); 
  }, [appTheme]);

  return (
    <SubscriptionContext.Provider value={{ 
      isEchoPlus, showUpgradeModal, setShowUpgradeModal, upgradeToPlus,
      appTheme, setAppTheme, chatStyle, setChatStyle, ringStyle, setRingStyle
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);
