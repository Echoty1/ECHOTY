// src/components/common/ScrollRestoration.jsx
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Store scroll positions keyed by pathname (with search)
const scrollPositions = new Map();

const ScrollRestoration = () => {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname + location.search);

  useEffect(() => {
    const currentPath = location.pathname + location.search;
    const prevPath = prevPathRef.current;

    // ─── Save scroll position of the PREVIOUS page ────────────
    if (prevPath && prevPath !== currentPath) {
      const mainContent = document.getElementById('main-content');
      const scrollPos = mainContent ? mainContent.scrollTop : window.scrollY;
      scrollPositions.set(prevPath, scrollPos);
    }

    // ─── Restore scroll position for the CURRENT page ──────────
    const savedPosition = scrollPositions.get(currentPath) || 0;
    requestAnimationFrame(() => {
      const mainContent = document.getElementById('main-content');
      if (mainContent) {
        mainContent.scrollTop = savedPosition;
      } else {
        window.scrollTo(0, savedPosition);
      }
    });

    prevPathRef.current = currentPath;
  }, [location]);

  // ─── Initial load: restore if saved, otherwise top ──────────
  useEffect(() => {
    const currentPath = location.pathname + location.search;
    const savedPosition = scrollPositions.get(currentPath) || 0;
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.scrollTop = savedPosition;
    } else {
      window.scrollTo(0, savedPosition);
    }
  }, []);

  return null;
};

export default ScrollRestoration;