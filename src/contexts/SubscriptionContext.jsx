import React, { createContext, useState, useContext, useEffect } from 'react';

const SubscriptionContext = createContext();

export const SubscriptionProvider = ({ children }) => {
  const [isEchoPlus, setIsEchoPlus] = useState(false); 
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  const [appTheme, setAppTheme] = useState('theme-default');
  const [chatStyle, setChatStyle] = useState(''); 
  const [ringStyle, setRingStyle] = useState('gold');

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
      appTheme, setAppTheme, chatStyle, setChatStyle, ringStyle, setRingStyle
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);
