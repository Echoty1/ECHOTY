// src/contexts/ThemeContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../services/firebase';
import { ref, onValue, update } from 'firebase/database';
import { SKINS } from '../constants/echomoji';

const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '108, 60, 225';
};

const defaultTheme = {
  id: 'default',
  name: 'ECHO Default',
  bgStart: '#6C3CE1',
  bgEnd: '#EC4899',
  ledColor: '#6C3CE1',
  glowColor: '#6C3CE1',
};

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const { user } = useAuth();
  const [currentTheme, setCurrentTheme] = useState(defaultTheme);
  const [availableThemes, setAvailableThemes] = useState([defaultTheme]);
  const [loading, setLoading] = useState(true);

  const applyTheme = (theme) => {
    document.documentElement.style.setProperty('--theme-bg-start', theme.bgStart);
    document.documentElement.style.setProperty('--theme-bg-end', theme.bgEnd);
    document.documentElement.style.setProperty('--theme-led-color', theme.ledColor);
    document.documentElement.style.setProperty('--theme-glow-color', theme.glowColor);
    document.documentElement.style.setProperty('--primary-gradient', `linear-gradient(135deg, ${theme.bgStart}, ${theme.bgEnd})`);
    document.documentElement.style.setProperty('--theme-led-color-rgb', hexToRgb(theme.bgStart));
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let unsubSkins = null;
    let unsubProfile = null;

    const skinsRef = ref(db, `userSkins/${user.uid}`);
    unsubSkins = onValue(skinsRef, (snap) => {
      const data = snap.val() || {};
      const owned = data.owned || [];

      const ownedThemes = owned
        .map(id => SKINS.find(s => s.id === id))
        .filter(skin => skin)
        .map(skin => ({
          id: skin.id,
          name: skin.name,
          bgStart: skin.bgStart,
          bgEnd: skin.bgEnd,
          ledColor: skin.ledColor,
          glowColor: skin.glowColor,
        }));

      const allThemes = [defaultTheme, ...ownedThemes];
      setAvailableThemes(allThemes);
    }, (error) => {
      console.error('❌ Theme: skins listener error:', error);
    });

    const profileRef = ref(db, `profiles/${user.uid}`);
    unsubProfile = onValue(profileRef, (snap) => {
      const data = snap.val() || {};
      const activeThemeId = data.activeTheme || 'default';
      const theme = availableThemes.find(t => t.id === activeThemeId) || defaultTheme;
      setCurrentTheme(theme);
      applyTheme(theme);
      setLoading(false);
    }, (error) => {
      console.error('❌ Theme: profile listener error:', error);
      setLoading(false);
    });

    return () => {
      if (unsubSkins) unsubSkins();
      if (unsubProfile) unsubProfile();
    };
  }, [user]);

  const setTheme = async (themeId) => {
    if (!user) return;
    const theme = availableThemes.find(t => t.id === themeId) || defaultTheme;
    setCurrentTheme(theme);
    applyTheme(theme);
    try {
      await update(ref(db, `profiles/${user.uid}`), { activeTheme: themeId });
    } catch (err) {
      console.error('❌ Theme: save error:', err);
    }
  };

  const value = {
    currentTheme,
    availableThemes,
    setTheme,
    loading,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};