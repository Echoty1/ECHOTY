// src/contexts/SubscriptionContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../services/firebase'; 
import { useAuth } from '../hooks/useAuth'; 

const SubscriptionContext = createContext();

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error('useSubscription must be used within a SubscriptionProvider');
  return context;
};

export const SubscriptionProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [isPlus, setIsPlus] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [profileBg, setProfileBgState] = useState('default');
  const [chatStyle, setChatStyleState] = useState('standard');
  const [ringStyle, setRingStyleState] = useState('gold');
  const [profileMusic, setProfileMusicState] = useState('');
  const [badgeText, setBadgeTextState] = useState('');
  const [ghostMode, setGhostModeState] = useState(false);
  const [accentColor, setAccentColorState] = useState('default');
  const [profileViews, setProfileViewsState] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsPlus(false);
      setLoading(false);
      return;
    }

    const profileRef = ref(db, `profiles/${user.uid}`);
    
    const unsubscribe = onValue(profileRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setIsPlus(data.isEchoPlus === true); 
        
        if (data.premiumProfileBg) setProfileBgState(data.premiumProfileBg);
        if (data.premiumChatStyle) setChatStyleState(data.premiumChatStyle);
        if (data.premiumRingStyle) setRingStyleState(data.premiumRingStyle);
        if (data.premiumMusic) setProfileMusicState(data.premiumMusic);
        if (data.premiumBadgeText) setBadgeTextState(data.premiumBadgeText);
        if (data.ghostMode) setGhostModeState(data.ghostMode);
        if (data.premiumAccentColor) setAccentColorState(data.premiumAccentColor);
        if (data.profileViews) setProfileViewsState(data.profileViews);
      } else {
        setIsPlus(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading]);

  const setProfileBg = async (val) => { setProfileBgState(val); if (user) await update(ref(db, `profiles/${user.uid}`), { premiumProfileBg: val }); };
  const setChatStyle = async (val) => { setChatStyleState(val); if (user) await update(ref(db, `profiles/${user.uid}`), { premiumChatStyle: val }); };
  const setRingStyle = async (val) => { setRingStyleState(val); if (user) await update(ref(db, `profiles/${user.uid}`), { premiumRingStyle: val }); };
  const setProfileMusic = async (val) => { setProfileMusicState(val); if (user) await update(ref(db, `profiles/${user.uid}`), { premiumMusic: val }); };
  const setBadgeText = async (val) => { setBadgeTextState(val); if (user) await update(ref(db, `profiles/${user.uid}`), { premiumBadgeText: val }); };
  const setGhostMode = async (val) => { setGhostModeState(val); if (user) await update(ref(db, `profiles/${user.uid}`), { ghostMode: val }); };
  const setAccentColor = async (val) => { setAccentColorState(val); if (user) await update(ref(db, `profiles/${user.uid}`), { premiumAccentColor: val }); };

  return (
    <SubscriptionContext.Provider value={{ 
      isPlus, loading,
      profileBg, setProfileBg,
      chatStyle, setChatStyle,
      ringStyle, setRingStyle,
      profileMusic, setProfileMusic,
      badgeText, setBadgeText,
      ghostMode, setGhostMode,
      accentColor, setAccentColor,
      profileViews
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export default SubscriptionContext;
