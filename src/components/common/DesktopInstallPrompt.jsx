// src/components/common/DesktopInstallPrompt.jsx
import React, { useState, useEffect } from 'react';
import { isDesktop } from 'react-device-detect';

const DesktopInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (!isDesktop) return;

    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Listen for the beforeinstallprompt event (Chrome/Edge)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for successful installation
    const handleAppInstalled = () => {
      setShowBanner(false);
      setIsInstalled(true);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    // ✅ FALLBACK: If event doesn't fire after 2 seconds, show banner anyway
    const timeoutId = setTimeout(() => {
      if (!showBanner && !isInstalled) {
        setShowBanner(true);
      }
    }, 2000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(timeoutId);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Native install prompt
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      return;
    }

    // Fallback: Show instructions if native prompt isn't available
    alert(
      'To install ECHO on your desktop:\n\n' +
      '1. Look for the install icon (🔽) in your browser\'s address bar.\n' +
      '2. Click it and select "Install ECHO".\n\n' +
      'If you don\'t see it, make sure you are using Chrome or Edge.'
    );
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('desktop_install_dismissed', 'true');
  };

  // Check if user dismissed previously
  const isDismissed = localStorage.getItem('desktop_install_dismissed') === 'true';

  // Don't show if not desktop, already installed, banner hidden, or dismissed
  if (!isDesktop || isInstalled || !showBanner || isDismissed) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 8px 30px var(--shadow-color)',
        backdropFilter: 'blur(12px)',
        maxWidth: '520px',
        width: '90%',
        animation: 'slideUp 0.3s ease-out',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '18px',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          E
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
            Install ECHO
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Get the app for a better experience
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          onClick={handleInstallClick}
          style={{
            background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
            border: 'none',
            color: '#fff',
            padding: '8px 18px',
            borderRadius: '30px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'transform 0.15s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '18px',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default DesktopInstallPrompt;