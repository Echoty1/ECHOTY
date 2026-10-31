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

  // Customization states
  const [profileBg, setProfileBgState] = useState('default');
  const [chatStyle, setChatStyleState] = useState('standard');
  const [ringStyle, setRingStyleState] = useState('gold');
  const [accentColor, setAccentColorState] = useState('default');
  const [badgeText, setBadgeTextState] = useState('');
  const [premiumMusic, setPremiumMusicState] = useState('');
  const [buddyPasses, setBuddyPassesState] = useState(5);
  
  // New Premium Features
  const [profileGlow, setProfileGlowState] = useState('none');
  const [profileAura, setProfileAuraState] = useState('none');
  const [statusEmoji, setStatusEmojiState] = useState('none');
  const [ghostMode, setGhostModeState] = useState(false);

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
        setProfileBgState(data.premiumProfileBg || 'default');
        setChatStyleState(data.premiumChatStyle || 'standard');
        setRingStyleState(data.premiumRingStyle || 'gold');
        setAccentColorState(data.premiumAccentColor || 'default');
        setBadgeTextState(data.premiumBadgeText || '');
        setPremiumMusicState(data.premiumMusic || '');
        setBuddyPassesState(typeof data.buddyPasses === 'number' ? data.buddyPasses : 5);
        setGhostModeState(data.ghostMode === true);
        
        // Load new features
        setProfileGlowState(data.premiumProfileGlow || 'none');
        setProfileAuraState(data.premiumProfileAura || 'none');
        setStatusEmojiState(data.premiumStatusEmoji || 'none');
      } else {
        setIsPlus(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading]);

  // Setters that save to Firebase
  const setProfileBg = async (val) => { setProfileBgState(val); if (user) await update(ref(db, `profiles/${user.uid}`), { premiumProfileBg: val }); };
  const setChatStyle = async (val) => { setChatStyleState(val); if (user) await update(ref(db, `profiles/${user.uid}`), { premiumChatStyle: val }); };
  const setRingStyle = async (val) => { setRingStyleState(val); if (user) await update(ref(db, `profiles/${user.uid}`), { premiumRingStyle: val }); };
  const setAccentColor = async (val) => { setAccentColorState(val); if (user) await update(ref(db, `profiles/${user.uid}`), { premiumAccentColor: val }); };
  const setBadgeText = async (val) => { setBadgeTextState(val); if (user) await update(ref(db, `profiles/${user.uid}`), { premiumBadgeText: val }); };
  const setPremiumMusic = async (val) => { setPremiumMusicState(val); if (user) await update(ref(db, `profiles/${user.uid}`), { premiumMusic: val }); };
  
  const setProfileGlow = async (val) => { setProfileGlowState(val); if (user) await update(ref(db, `profiles/${user.uid}`), { premiumProfileGlow: val }); };
  const setProfileAura = async (val) => { setProfileAuraState(val); if (user) await update(ref(db, `profiles/${user.uid}`), { premiumProfileAura: val }); };
  const setStatusEmoji = async (val) => { setStatusEmojiState(val); if (user) await update(ref(db, `profiles/${user.uid}`), { premiumStatusEmoji: val }); };

  const toggleGhostMode = async () => {
    const nextVal = !ghostMode;
    setGhostModeState(nextVal);
    if (user) await update(ref(db, `profiles/${user.uid}`), { ghostMode: nextVal });
  };

  const decrementBuddyPass = async () => {
    if (!user) return;
    const next = Math.max(0, buddyPasses - 1);
    setBuddyPassesState(next);
    await update(ref(db, `profiles/${user.uid}`), { buddyPasses: next });
  };

  return (
    <SubscriptionContext.Provider
      value={{
        isPlus, loading,
        profileBg, setProfileBg,
        chatStyle, setChatStyle,
        ringStyle, setRingStyle,
        accentColor, setAccentColor,
        badgeText, setBadgeText,
        premiumMusic, setPremiumMusic,
        profileGlow, setProfileGlow,
        profileAura, setProfileAura,
        statusEmoji, setStatusEmoji,
        buddyPasses, decrementBuddyPass,
        ghostMode, toggleGhostMode,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export default SubscriptionContext;
