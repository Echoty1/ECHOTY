import React from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import './PlusCustomizer.css';

const PlusCustomizer = () => {
  const { isEchoPlus, appTheme, setAppTheme, chatStyle, setChatStyle, ringStyle, setRingStyle } = useSubscription();

  if (!isEchoPlus) {
    return (
      <div className="locked-overlay">
        <h3>🔒 ECHO Plus Required</h3>
        <p>Upgrade to unlock custom themes, chat bubbles, and profile rings.</p>
      </div>
    );
  }

  return (
    <div className="plus-customizer">
      <h2 className="customizer-title">⚡ Plus Customizer</h2>
      
      {/* 1. App Theme Selection */}
      <div className="custom-section">
        <h3>App Theme</h3>
        <div className="theme-grid">
          <div className={`theme-card ${appTheme === 'default' ? 'active' : ''}`} onClick={() => setAppTheme('default')}>
            <div className="theme-preview default-preview"></div>
            <span>Default Dark</span>
          </div>
          <div className={`theme-card ${appTheme === 'midnight' ? 'active' : ''}`} onClick={() => setAppTheme('midnight')}>
            <div className="theme-preview midnight-preview"></div>
            <span>Midnight Blue</span>
          </div>
          <div className={`theme-card ${appTheme === 'amoled' ? 'active' : ''}`} onClick={() => setAppTheme('amoled')}>
            <div className="theme-preview amoled-preview"></div>
            <span>Pure Black</span>
          </div>
          <div className={`theme-card ${appTheme === 'ocean' ? 'active' : ''}`} onClick={() => setAppTheme('ocean')}>
            <div className="theme-preview ocean-preview"></div>
            <span>Ocean Breeze</span>
          </div>
        </div>
      </div>

      {/* 2. Chat Bubble Styles */}
      <div className="custom-section">
        <h3>Chat Bubble Style</h3>
        <div className="option-row">
          <button className={`pill-btn ${chatStyle === 'default' ? 'active' : ''}`} onClick={() => setChatStyle('default')}>Standard</button>
          <button className={`pill-btn ${chatStyle === 'neon' ? 'active' : ''}`} onClick={() => setChatStyle('neon')}>Neon Glow</button>
          <button className={`pill-btn ${chatStyle === 'glass' ? 'active' : ''}`} onClick={() => setChatStyle('glass')}>Glassmorphism</button>
        </div>
      </div>

      {/* 3. Profile Ring Styles */}
      <div className="custom-section">
        <h3>Profile Ring</h3>
        <div className="option-row">
          <button className={`ring-btn ring-gold ${ringStyle === 'gold' ? 'active' : ''}`} onClick={() => setRingStyle('gold')}>Gold</button>
          <button className={`ring-btn ring-neon ${ringStyle === 'neon' ? 'active' : ''}`} onClick={() => setRingStyle('neon')}>Neon</button>
          <button className={`ring-btn ring-fire ${ringStyle === 'fire' ? 'active' : ''}`} onClick={() => setRingStyle('fire')}>Fire</button>
        </div>
      </div>

    </div>
  );
};

export default PlusCustomizer;
