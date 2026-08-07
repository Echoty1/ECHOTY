// src/hooks/useDeletedAccountCheck.js
import { useEffect, useRef } from 'react';
import { cleanDeletedChats, cleanAllDeletedChats } from '../services/accountCleanup';
import { useAuth } from './useAuth';

/**
 * Hook that periodically checks for deleted accounts and cleans up chats.
 * Runs per-user cleanup for the current user and a global cleanup every 5 minutes.
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
      await cleanAllDeletedChats();
    };
    initialCleanup();

    // Set up periodic check
    intervalRef.current = setInterval(async () => {
      try {
        // Clean current user's chats
        await cleanDeletedChats(user.uid);
        // Global cleanup (scans all userChats)
        await cleanAllDeletedChats();
      } catch (err) {
        console.error('Periodic cleanup error:', err);
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