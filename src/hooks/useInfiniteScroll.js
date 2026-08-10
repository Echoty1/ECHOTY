// src/hooks/useInfiniteScroll.js
import { useEffect, useRef, useCallback } from 'react';

export const useInfiniteScroll = (loadMore, threshold = 200, dependencies = []) => {
  const containerRef = useRef(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);

  const handleScroll = useCallback(() => {
    if (!containerRef.current || !hasMoreRef.current || loadingRef.current) return;

    const container = containerRef.current;
    const bottom = container.scrollHeight - container.scrollTop - container.clientHeight;

    if (bottom < threshold) {
      loadingRef.current = true;
      loadMore().finally(() => {
        loadingRef.current = false;
      });
    }
  }, [loadMore, threshold]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll, ...dependencies]);

  return { containerRef, setHasMore: (value) => { hasMoreRef.current = value; } };
};