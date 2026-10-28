import React from 'react';
import { useSubscription } from '../../../contexts/SubscriptionContext';

const PlusCustomizer = () => {
  const { 
    isEchoPlus, appTheme, setAppTheme, chatStyle, setChatStyle, 
    ringStyle, setRingStyle, appIcon, setAppIcon 
  } = useSubscription();

  if (!isEchoPlus) return null; 

  return (
    <div className="plus-customizer">
      <div className="premium-header">
        <h2 className="customizer-title">⚡ ECHO Plus Lab</h2>
        <p className="customizer-subtitle">Exclusive customization for premium members</p>
      </div>
      
      {/* 1. App Theme Selection */}
      <div className="custom-section">
        <h3>App Themes</h3>
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

      {/* 2. Chat Bubble Styles */}
      <div className="custom-section">
        <h3>Chat Bubbles</h3>
        <div className="option-row">
          <button className={`pill-btn ${chatStyle === '' ? 'active' : ''}`} onClick={() => setChatStyle('')}>Standard</button>
          <button className={`pill-btn ${chatStyle === 'neon' ? 'active' : ''}`} onClick={() => setChatStyle('neon')}>Neon</button>
          <button className={`pill-btn ${chatStyle === 'glass' ? 'active' : ''}`} onClick={() => setChatStyle('glass')}>Glass</button>
          <button className={`pill-btn ${chatStyle === 'gold' ? 'active' : ''}`} onClick={() => setChatStyle('gold')}>Gold</button>
        </div>
      </div>

      {/* 3. Profile Rings */}
      <div className="custom-section">
        <h3>Profile Aura</h3>
        <div className="option-row">
          <button className={`pill-btn ring-gold ${ringStyle === 'gold' ? 'active' : ''}`} onClick={() => setRingStyle('gold')}>Gold</button>
          <button className={`pill-btn ring-neon ${ringStyle === 'neon' ? 'active' : ''}`} onClick={() => setRingStyle('neon')}>Neon</button>
          <button className={`pill-btn ring-fire ${ringStyle === 'fire' ? 'active' : ''}`} onClick={() => setRingStyle('fire')}>Fire</button>
        </div>
      </div>

      {/* 4. App Icons */}
      <div className="custom-section">
        <h3>App Icon</h3>
        <div className="option-row">
          <button className={`pill-btn ${appIcon === 'default' ? 'active' : ''}`} onClick={() => setAppIcon('default')}>Default</button>
          <button className={`pill-btn ${appIcon === 'gold' ? 'active' : ''}`} onClick={() => setAppIcon('gold')}>Gold Logo</button>
          <button className={`pill-btn ${appIcon === 'neon' ? 'active' : ''}`} onClick={() => setAppIcon('neon')}>Neon Logo</button>
        </div>
      </div>
    </div>
  );
};

export default PlusCustomizer;
