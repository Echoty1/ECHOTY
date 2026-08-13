// src/contexts/VideoAudioContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';

const VideoAudioContext = createContext();

export const VideoAudioProvider = ({ children }) => {
  const [activeUnmutedId, setActiveUnmutedId] = useState(null);

  const requestUnmute = useCallback((videoId) => {
    setActiveUnmutedId(videoId);
  }, []);

  const clearActive = useCallback(() => {
    setActiveUnmutedId(null);
  }, []);

  const muteAll = useCallback(() => {
    setActiveUnmutedId(null);
  }, []);

  return (
    <VideoAudioContext.Provider value={{ activeUnmutedId, requestUnmute, clearActive, muteAll }}>
      {children}
    </VideoAudioContext.Provider>
  );
};

export const useVideoAudio = () => {
  const context = useContext(VideoAudioContext);
  if (!context) {
    throw new Error('useVideoAudio must be used within a VideoAudioProvider');
  }
  return context;
};