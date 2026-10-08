// src/hooks/useUsername.js
import { useState, useEffect, useCallback } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../services/firebase';
import {
  checkUsernameAvailability,
  claimUsername,
} from '../services/usernameService';

/**
 * Reads the current user's username from their profile (live).
 * Returns { username, loading }.
 */
export const useMyUsername = (uid) => {
  const [username, setUsername] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setUsername(null);
      setLoading(false);
      return;
    }
    const usernameRef = ref(db, `profiles/${uid}/username`);
    const unsub = onValue(usernameRef, (snap) => {
      setUsername(snap.exists() ? snap.val() : null);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  return { username, loading };
};

/**
 * Reads any user's username (live).
 */
export const useUserUsername = (uid) => {
  const [username, setUsername] = useState(null);
  useEffect(() => {
    if (!uid) return undefined;
    const usernameRef = ref(db, `profiles/${uid}/username`);
    const unsub = onValue(usernameRef, (snap) => {
      setUsername(snap.exists() ? snap.val() : null);
    });
    return () => unsub();
  }, [uid]);
  return username;
};

/**
 * Live-check availability with debounce.
 * Usage: const { status, loading, error } = useUsernameAvailability(input);
 * status: 'idle' | 'checking' | 'available' | 'taken' | 'invalid'
 */
export const useUsernameAvailability = (input) => {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!input || !input.trim()) {
      setStatus('idle');
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const t = setTimeout(async () => {
      const result = await checkUsernameAvailability(input);
      if (cancelled) return;

      if (result.available) {
        setStatus('available');
        setError(null);
      } else if (result.reason === 'taken') {
        setStatus('taken');
        setError('That username is taken');
      } else if (result.reason === 'invalid') {
        setStatus('invalid');
        setError(result.error);
      } else {
        setStatus('idle');
        setError('Could not check. Try again.');
      }
      setLoading(false);
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(t);
      setLoading(false);
    };
  }, [input]);

  return { status, loading, error };
};

/**
 * Action hook to claim a username.
 * Returns { claim, claiming, result }.
 */
export const useClaimUsername = (uid) => {
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState(null);

  const claim = useCallback(async (username) => {
    if (!uid) {
      setResult({ ok: false, error: 'Not logged in' });
      return { ok: false, error: 'Not logged in' };
    }
    setClaiming(true);
    const res = await claimUsername(uid, username);
    setClaiming(false);
    setResult(res);
    return res;
  }, [uid]);

  return { claim, claiming, result };
};
