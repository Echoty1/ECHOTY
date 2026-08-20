// src/components/UpdatePopup/UpdatePopup.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { ref, get } from 'firebase/database';
import { isAndroid, isIOS } from 'react-device-detect';
import './UpdatePopup.css';

const UpdatePopup = ({ currentVersion, onClose }) => {
  const [updateData, setUpdateData] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Only show on mobile
  if (!isAndroid && !isIOS) return null;

  useEffect(() => {
    const fetchUpdate = async () => {
      try {
        const snapshot = await get(ref(db, 'appConfig/version'));
        if (snapshot.exists()) {
          setUpdateData(snapshot.val());
        }
      } catch (err) {
        console.error('Failed to fetch version:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUpdate();
  }, []);

  // ─── Fix: handle both string and number for latest ──────────
  const isUpdateAvailable = () => {
    if (!updateData || !updateData.latest) return false;
    
    // Convert to string safely
    const latestStr = String(updateData.latest);
    const currentStr = String(currentVersion);
    
    const current = currentStr.split('.').map(Number);
    const latest = latestStr.split('.').map(Number);
    
    for (let i = 0; i < Math.max(current.length, latest.length); i++) {
      const c = current[i] || 0;
      const l = latest[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }
    return false;
  };

  const handleUpdate = () => {
    const url = updateData?.playStoreUrl || 
                'https://play.google.com/store/apps/details?id=com.echo.app';
    window.open(url, '_blank');
  };

  if (loading) return null;
  if (!isUpdateAvailable()) return null;

  return (
    <div className="update-popup-overlay">
      <div className="update-popup-content">
        <div className="update-popup-icon">📱</div>
        <h3>New Version Available</h3>
        <p className="update-popup-version">
          Version {String(updateData.latest)} is now available.
        </p>
        {updateData.whatsNew && (
          <div className="update-popup-changelog">
            <strong>What's new:</strong>
            <pre>{updateData.whatsNew}</pre>
          </div>
        )}
        <div className="update-popup-actions">
          <button className="update-popup-btn update" onClick={handleUpdate}>
            Update Now
          </button>
          <button className="update-popup-btn later" onClick={onClose}>
            Later
          </button>
        </div>
        <p className="update-popup-note">Update to enjoy the latest features.</p>
      </div>
    </div>
  );
};

export default UpdatePopup;