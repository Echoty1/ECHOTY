// src/hooks/useOnboarding.js
import { useState, useEffect, useCallback } from 'react';
import { ref, get, update } from 'firebase/database';
import { db } from '../services/firebase';
import { useAuth } from './useAuth';

const LEGACY_KEY = 'echo_onboarding_complete_v1'; // old shared key — we clean it up

export const useOnboarding = () => {
  const { user } = useAuth();
  const [done, setDone] = useState(true); // default true to avoid flash
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // One-time cleanup of the old shared key
    try { localStorage.removeItem(LEGACY_KEY); } catch (_) {}

    async function check() {
      if (!user?.uid) {
        if (!cancelled) { setDone(true); setLoading(false); }
        return;
      }

      const localKey = `echo_onboarding_done_${user.uid}`;

      // 1) Local cache (fast path)
      try {
        if (localStorage.getItem(localKey) === '1') {
          if (!cancelled) { setDone(true); setLoading(false); }
          return;
        }
      } catch (_) {}

      // 2) Server flag (survives reinstall / new browser)
      try {
        const snap = await get(ref(db, `profiles/${user.uid}/onboardingCompleted`));
        if (snap.exists() && snap.val() === true) {
          try { localStorage.setItem(localKey, '1'); } catch (_) {}
          if (!cancelled) { setDone(true); setLoading(false); }
          return;
        }
      } catch (_) {}

      // New user — show onboarding
      if (!cancelled) { setDone(false); setLoading(false); }
    }

    check();
    return () => { cancelled = true; };
  }, [user?.uid]);

  const completeOnboarding = useCallback(async () => {
    if (!user?.uid) return;
    const localKey = `echo_onboarding_done_${user.uid}`;
    try { localStorage.setItem(localKey, '1'); } catch (_) {}
    try {
      await update(ref(db, `profiles/${user.uid}`), {
        onboardingCompleted: true,
        onboardingCompletedAt: Date.now(),
      });
    } catch (err) {
      console.warn('Failed to persist onboarding flag', err);
    }
    setDone(true);
  }, [user?.uid]);

  const resetOnboarding = useCallback(async () => {
    if (!user?.uid) return;
    const localKey = `echo_onboarding_done_${user.uid}`;
    try { localStorage.removeItem(localKey); } catch (_) {}
    try {
      await update(ref(db, `profiles/${user.uid}`), {
        onboardingCompleted: false,
        onboardingCompletedAt: null,
      });
    } catch (_) {}
    setDone(false);
  }, [user?.uid]);

  return { done, loading, completeOnboarding, resetOnboarding };
};
