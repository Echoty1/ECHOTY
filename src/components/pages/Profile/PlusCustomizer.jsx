// src/components/pages/Profile/PlusCustomizer.jsx
import React, { useState, useEffect } from 'react';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { useAuth } from '../../../hooks/useAuth';
import { ref, get, update } from 'firebase/database';
import { db } from '../../../services/firebase';
import Toast from '../../Toast/Toast';

const PlusCustomizer = () => {
  const { 
    appTheme, setAppTheme, chatStyle, setChatStyle, 
    ringStyle, setRingStyle, profileBg, setProfileBg
  } = useSubscription();
  
  const { user } = useAuth();
  const [passes, setPasses] = useState(5);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    const fetchPasses = async () => {
      const passRef = ref(db, `profiles/${user.uid}/buddyPasses`);
      const snap = await get(passRef);
      if (snap.exists()) {
        setPasses(snap.val());
      } else {
        setPasses(5);
        await update(ref(db, `profiles/${user.uid}`), { buddyPasses: 5 });
      }
    };
    fetchPasses();
  }, [user?.uid]);

  const handleCopyLink = () => {
    if (!user?.uid || passes <= 0) return;
    const link = `${window.location.origin}/redeem?code=${user.uid}`;
    navigator.clipboard.writeText(link).then(() => {
      setToast({ message: 'Buddy Pass link copied!', type: 'success' });
    }).catch(() => {
      setToast({ message: 'Failed to copy link', type: 'error' });
    });
  };

  return (
    <>
      <div className="plus-section">
        <div className="plus-section-title"><i className="fas fa-image" style={{ color: '#FFD700' }}/> Profile Background</div>
        <div className="option-row">
          <button className={`pill-btn ${profileBg === 'default' ? 'active' : ''}`} onClick={() => setProfileBg('default')}>Default</button>
          <button className={`pill-btn ${profileBg === 'aurora' ? 'active' : ''}`} onClick={() => setProfileBg('aurora')}>Aurora</button>
          <button className={`pill-btn ${profileBg === 'matrix' ? 'active' : ''}`} onClick={() => setProfileBg('matrix')}>Matrix</button>
          <button className={`pill-btn ${profileBg === 'galaxy' ? 'active' : ''}`} onClick={() => setProfileBg('galaxy')}>Galaxy</button>
          <button className={`pill-btn ${profileBg === 'gold' ? 'active' : ''}`} onClick={() => setProfileBg('gold')}>Gold</button>
        </div>
      </div>

      <div className="plus-section">
        <div className="plus-section-title"><i className="fas fa-palette" style={{ color: '#FFD700' }}/> App Theme</div>
        <div className="theme-grid">
          <div className={`theme-card ${appTheme === 'theme-default' ? 'active' : ''}`} onClick={() => setAppTheme('theme-default')}>
            <div className="theme-preview default-preview"></div><span>Default</span>
          </div>
          <div className={`theme-card ${appTheme === 'theme-midnight' ? 'active' : ''}`} onClick={() => setAppTheme('theme-midnight')}>
            <div className="theme-preview midnight-preview"></div><span>Midnight</span>
          </div>
          <div className={`theme-card ${appTheme === 'theme-amoled' ? 'active' : ''}`} onClick={() => setAppTheme('theme-amoled')}>
            <div className="theme-preview amoled-preview"></div><span>AMOLED</span>
          </div>
          <div className={`theme-card ${appTheme === 'theme-ocean' ? 'active' : ''}`} onClick={() => setAppTheme('theme-ocean')}>
            <div className="theme-preview ocean-preview"></div><span>Ocean</span>
          </div>
        </div>
      </div>

      <div className="plus-section">
        <div className="plus-section-title"><i className="fas fa-comment-dots" style={{ color: '#FFD700' }}/> Chat Bubble Style</div>
        <div className="option-row">
          <button className={`pill-btn ${chatStyle === '' ? 'active' : ''}`} onClick={() => setChatStyle('')}>Standard</button>
          <button className={`pill-btn ${chatStyle === 'neon' ? 'active' : ''}`} onClick={() => setChatStyle('neon')}>Neon</button>
          <button className={`pill-btn ${chatStyle === 'glass' ? 'active' : ''}`} onClick={() => setChatStyle('glass')}>Glass</button>
          <button className={`pill-btn ${chatStyle === 'gold' ? 'active' : ''}`} onClick={() => setChatStyle('gold')}>Gold</button>
        </div>
      </div>

      <div className="plus-section">
        <div className="plus-section-title"><i className="fas fa-ring" style={{ color: '#FFD700' }}/> Profile Aura</div>
        <div className="option-row">
          <button className={`pill-btn ${ringStyle === 'gold' ? 'active' : ''}`} onClick={() => setRingStyle('gold')}>Gold</button>
          <button className={`pill-btn ${ringStyle === 'neon' ? 'active' : ''}`} onClick={() => setRingStyle('neon')}>Neon</button>
          <button className={`pill-btn ${ringStyle === 'fire' ? 'active' : ''}`} onClick={() => setRingStyle('fire')}>Fire</button>
          <button className={`pill-btn ${ringStyle === 'rainbow' ? 'active' : ''}`} onClick={() => setRingStyle('rainbow')}>Rainbow</button>
        </div>
      </div>

      <div className="plus-section buddy-pass-section">
        <div className="plus-section-title">
          <i className="fas fa-ticket-alt" style={{ color: '#FFD700' }}/> Buddy Passes
        </div>
        <div className="buddy-pass-display">
          <div className="pass-count">{passes} <span>/ 5 left</span></div>
          <p className="pass-desc">Gift ECHO Plus to a friend. They join for free and you lose one pass.</p>
          <button 
            className={`btn-copy-pass ${passes <= 0 ? 'disabled' : ''}`}
            onClick={handleCopyLink}
            disabled={passes <= 0}
          >
            {passes <= 0 ? <>All Passes Used</> : <><i className="fas fa-link" /> Copy Buddy Link</>}
          </button>
        </div>
      </div>
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
};

export default PlusCustomizer;
