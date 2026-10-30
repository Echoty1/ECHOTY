// src/components/common/RegionGuard.jsx
import React, { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../../services/firebase';
import './RegionGuard.css';

const CACHE_KEY = 'echo_region_check';
const CACHE_TTL = 1000 * 60 * 60 * 24; // Re-check once every 24 hours

const RegionGuard = ({ children }) => {
  const [status, setStatus] = useState('loading'); // 'loading' | 'allowed' | 'banned' | 'error'
  const [banReason, setBanReason] = useState('');

  useEffect(() => {
    const checkRegion = async () => {
      try {
        // ── 1. Check cache first so we don't spam the IP API ──
        try {
          const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
          if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            if (cached.banned) {
              setBanReason(cached.reason);
              setStatus('banned');
              return;
            }
            setStatus('allowed');
            return;
          }
        } catch {}

        // ── 2. Get location via free ipwho.is API (no key, no signup) ──
        // Falls back to ipapi.co if ipwho.is is down
        let locationData;
        try {
          const res = await fetch('https://ipwho.is/');
          locationData = await res.json();
          if (!locationData.success) throw new Error('ipwho failed');
        } catch {
          const fallbackRes = await fetch('https://ipapi.co/json/');
          locationData = await fallbackRes.json();
          // Normalize field names for the fallback
          locationData.country_code = locationData.country_code;
          locationData.region = locationData.region;
        }

        const countryCode = (locationData.country_code || '').toUpperCase();
        const regionName = locationData.region || '';

        if (!countryCode) throw new Error('No country detected');

        // ── 3. Check Firebase for country-wide OR state-wide ban ──
        const countryBanRef = ref(db, `bannedRegions/${countryCode}`);
        const countrySnap = await get(countryBanRef);

        let isBanned = false;
        let reason = '';

        if (countrySnap.exists()) {
          const val = countrySnap.val();

          // Case A: Country-wide ban (value is `true`)
          if (val === true) {
            isBanned = true;
            reason = `ECHO is currently unavailable in ${countryCode}.`;
          }
          // Case B: State-level ban (value is an object like { "Lagos": true })
          else if (typeof val === 'object' && regionName && val[regionName] === true) {
            isBanned = true;
            reason = `ECHO is currently unavailable in ${regionName}, ${countryCode}.`;
          }
        }

        // ── 4. Cache the result ──
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          banned: isBanned,
          reason,
          timestamp: Date.now(),
        }));

        if (isBanned) {
          setBanReason(reason);
          setStatus('banned');
        } else {
          setStatus('allowed');
        }
      } catch (err) {
        console.warn('Region check failed:', err.message);
        // Fail-open: if IP lookup fails, let the user in.
        // (Change to 'banned' if you want to be stricter.)
        setStatus('allowed');
      }
    };

    checkRegion();
  }, []);

  if (status === 'loading') {
    return (
      <div className="region-loading-screen">
        <div className="region-spinner" />
        <p>Checking availability...</p>
      </div>
    );
  }

  if (status === 'banned') {
    return (
      <div className="region-banned-screen">
        <div className="banned-icon">🚫</div>
        <h1>Access Restricted</h1>
        <p>{banReason}</p>
        <p className="banned-subtext">
          If you believe this is a mistake, contact support.
        </p>
        <a href="mailto:support@echoty.xyz" className="banned-btn">
          Contact Support
        </a>
      </div>
    );
  }

  return <>{children}</>;
};

export default RegionGuard;
