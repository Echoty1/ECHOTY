// src/contexts/ThemeContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

const THEME_STORAGE_KEY = 'echo_theme_preference';
const SYSTEM_THEME_MEDIA = window.matchMedia('(prefers-color-scheme: dark)');

export const ThemeProvider = ({ children }) => {
  // Read stored preference or default to 'system'
  const getStoredTheme = () => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'system') {
      return stored;
    }
    return 'system'; // default
  };

  const [themePreference, setThemePreference] = useState(getStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState('dark'); // 'dark' or 'light'

  // Resolve actual theme based on preference and system
  const resolveTheme = useCallback((pref) => {
    if (pref === 'system') {
      return SYSTEM_THEME_MEDIA.matches ? 'dark' : 'light';
    }
    return pref;
  }, []);

  // Apply theme to DOM
  const applyTheme = useCallback((theme) => {
    const html = document.documentElement;
    // Remove any existing theme classes
    html.classList.remove('theme-dark', 'theme-light');
    // Add the resolved theme class
    html.classList.add(`theme-${theme}`);
    // Also set a data attribute for CSS hooks
    html.setAttribute('data-theme', theme);
  }, []);

  // Update resolved theme when preference or system changes
  useEffect(() => {
    const newResolved = resolveTheme(themePreference);
    setResolvedTheme(newResolved);
    applyTheme(newResolved);
    localStorage.setItem(THEME_STORAGE_KEY, themePreference);
  }, [themePreference, resolveTheme, applyTheme]);

  // Listen for system theme changes if preference is 'system'
  useEffect(() => {
    const handler = (e) => {
      if (themePreference === 'system') {
        const newResolved = e.matches ? 'dark' : 'light';
        setResolvedTheme(newResolved);
        applyTheme(newResolved);
      }
    };
    SYSTEM_THEME_MEDIA.addEventListener('change', handler);
    return () => SYSTEM_THEME_MEDIA.removeEventListener('change', handler);
  }, [themePreference, applyTheme]);

  const setTheme = (pref) => {
    if (pref === 'dark' || pref === 'light' || pref === 'system') {
      setThemePreference(pref);
    }
  };

  return (
    <ThemeContext.Provider value={{ themePreference, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};