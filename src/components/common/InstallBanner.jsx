// src/components/common/InstallBanner.jsx
import React, { useState, useEffect } from 'react';
import { isAndroid, isIOS } from 'react-device-detect';

const InstallBanner = ({ playStoreUrl }) => {
  const [dismissed, setDismissed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // ✅ Hooks must be called unconditionally at the top
  useEffect(() => {
    setIsMobile(isAndroid || isIOS);

    // Check if dismissed recently (5 days)
    const dismissedUntil = localStorage.getItem('install_banner_dismissed_until');
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
      setDismissed(true);
    }
  }, []);

  // ✅ Now we can conditionally return after hooks
  if (!playStoreUrl) return null;
  if (dismissed || !isMobile) return null;

  const handleDismiss = () => {
    const until = Date.now() + 5 * 24 * 60 * 60 * 1000;
    localStorage.setItem('install_banner_dismissed_until', String(until));
    setDismissed(true);
  };

  let message, action, buttonText;

  if (isAndroid) {
    message = '🚀 Get the best experience with the ECHO app!';
    action = playStoreUrl;
    buttonText = 'Install on Google Play';
  } else if (isIOS) {
    message = '📱 Add ECHO to your Home Screen for a faster experience.';
    action = null;
    buttonText = 'Tap Share → Add to Home Screen';
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
        padding: '14px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'fixed',
        bottom: '80px',
        left: '5%',
        right: '5%',
        borderRadius: '16px',
        zIndex: 9999,
        boxShadow: '0 8px 30px rgba(108,60,225,0.4)',
        backdropFilter: 'blur(8px)',
        maxWidth: '500px',
        margin: '0 auto',
      }}
    >
      <span style={{ color: '#fff', fontSize: '13px', fontWeight: 500, flex: 1 }}>
        {message}
      </span>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginLeft: '12px' }}>
        {isAndroid ? (
          <a
            href={action}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'rgba(255,255,255,0.2)',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: '20px',
              textDecoration: 'none',
              fontSize: '12px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            {buttonText}
          </a>
        ) : (
          <span
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            {buttonText}
          </span>
        )}
        <button
          onClick={handleDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '0 4px',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default InstallBanner;