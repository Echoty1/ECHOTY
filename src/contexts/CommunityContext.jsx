import React, { createContext, useContext, useState } from 'react';

const CommunityContext = createContext(null);

export const CommunityProvider = ({ children }) => {
  const [currentCommunity, setCurrentCommunity] = useState(null);

  const clearCommunity = () => {
    setCurrentCommunity(null);
  };

  return (
    <CommunityContext.Provider
      value={{
        currentCommunity,
        setCurrentCommunity,
        clearCommunity,
      }}
    >
      {children}
    </CommunityContext.Provider>
  );
};

export const useCommunity = () => {
  const context = useContext(CommunityContext);

  if (!context) {
    throw new Error(
      'useCommunity must be used inside a CommunityProvider'
    );
  }

  return context;
};
