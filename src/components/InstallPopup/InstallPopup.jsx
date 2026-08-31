// src/components/InstallPopup/InstallPopup.jsx
import React from 'react';
import './InstallPopup.css';
import { isAndroid, isIOS } from 'react-device-detect';

const InstallPopup = ({ playStoreUrl, onClose }) => {
  // ✅ This component has no hooks, so it's safe to return early
  if (!playStoreUrl) return null;
  if (!isAndroid && !isIOS) return null;

  const handleInstall = () => {
    if (playStoreUrl) {
      window.open(playStoreUrl, '_blank');
    }
  };

  return (
    <div className="install-popup-overlay">
      <div className="install-popup-content">
        <div className="install-popup-icon">📱</div>
        <h2>Get the ECHO App</h2>
        <p className="install-popup-desc">
          Enjoy the best experience with the native ECHO app – faster, smoother, and always up‑to‑date.
        </p>
        <div className="install-popup-actions">
          <button className="install-popup-btn install" onClick={handleInstall}>
            Install Now
          </button>
          <button className="install-popup-btn later" onClick={onClose}>
            Later
          </button>
        </div>
        <p className="install-popup-note">You can also install it later from the bottom banner.</p>
      </div>
    </div>
  );
};

export default InstallPopup;