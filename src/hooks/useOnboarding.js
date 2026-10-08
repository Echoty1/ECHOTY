// src/hooks/useOnboarding.js
import { useState, useCallback } from 'react';

const KEY = 'echo_onboarding_complete_v1';

export const useOnboarding = () => {
  const [done, setDone] = useState(() => {
    try {
      return localStorage.getItem(KEY) === 'true';
    } catch (_) {
      return false;
    }
  });

  const completeOnboarding = useCallback(() => {
    try {
      localStorage.setItem(KEY, 'true');
    } catch (_) {}
    setDone(true);
  }, []);

  const resetOnboarding = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch (_) {}
    setDone(false);
  }, []);

  return { done, completeOnboarding, resetOnboarding };
};
