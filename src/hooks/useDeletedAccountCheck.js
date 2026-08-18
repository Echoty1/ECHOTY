// src/hooks/useDeletedAccountCheck.js
import { useEffect, useRef } from 'react';
import { cleanDeletedChats } from '../services/accountCleanup';
import { useAuth } from './useAuth';

/**
 * Hook that periodically checks for deleted accounts and cleans up chats.
 * Now only runs per‑user cleanup (no global scan) to avoid permission errors.
 * @param {number} intervalMs - Interval in milliseconds (default: 5 minutes)
 */
export const useDeletedAccountCheck = (intervalMs = 5 * 60 * 1000) => {
  const { user } = useAuth();
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!user?.uid) return;

    // Run immediately on mount
    const initialCleanup = async () => {
      await cleanDeletedChats(user.uid);
    };
    initialCleanup();

    // Set up periodic check (only per‑user)
    intervalRef.current = setInterval(async () => {
      try {
        await cleanDeletedChats(user.uid);
      } catch (err) {
        console.warn('Periodic cleanup error:', err);
      }
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user?.uid, intervalMs]);
};