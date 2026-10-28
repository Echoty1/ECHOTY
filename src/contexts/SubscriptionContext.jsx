import React, { createContext, useState, useContext, useEffect } from 'react';

const SubscriptionContext = createContext();

export const SubscriptionProvider = ({ children }) => {
  const [isEchoPlus, setIsEchoPlus] = useState(false); 
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // Customization States
  const [appTheme, setAppTheme] = useState('default');
  const [chatStyle, setChatStyle] = useState('default');
  const [ringStyle, setRingStyle] = useState('gold');

  const upgradeToPlus = () => {
    setIsEchoPlus(true);
    setShowUpgradeModal(false);
  };

  // This applies the theme to the entire app dynamically!
  useEffect(() => {
    // Note: If you are using React Native, use React Native styling, not document.body.
    // If this is a Web app (React), document.body is fine.
    if (typeof document !== 'undefined') {
      document.body.className = appTheme; 
    }
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
