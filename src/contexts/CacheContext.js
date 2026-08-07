import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadCache } from '../services/cache/CacheManager';

const CacheContext = createContext();

export const CacheProvider = ({ children }) => {
  const [cacheReady, setCacheReady] = useState(false);

  useEffect(() => {
    loadCache().then(() => setCacheReady(true));
  }, []);

  return (
    <CacheContext.Provider value={{ cacheReady }}>
      {children}
    </CacheContext.Provider>
  );
};

export const useCache = () => useContext(CacheContext);