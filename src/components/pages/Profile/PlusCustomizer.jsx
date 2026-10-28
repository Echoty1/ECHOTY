// src/components/pages/Profile/PlusCustomizer.jsx
import React from 'react';
import { useSubscription } from '../../../contexts/SubscriptionContext';

const PlusCustomizer = () => {
  const { 
    appTheme, setAppTheme, chatStyle, setChatStyle, 
    ringStyle, setRingStyle 
  } = useSubscription();

  return (
    <>
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
        </div>
      </div>
    </>
  );
};

export default PlusCustomizer;
