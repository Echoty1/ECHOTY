import React from 'react';
import { useSubscription } from '../../../contexts/SubscriptionContext';

const PlusCustomizer = () => {
  const { isEchoPlus, appTheme, setAppTheme, chatStyle, setChatStyle, ringStyle, setRingStyle } = useSubscription();

  if (!isEchoPlus) return null; 

  return (
    <div className="plus-customizer">
      <h2 className="customizer-title">⚡ Plus Customizer</h2>
      
      <div className="custom-section">
        <h3>App Theme</h3>
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

      <div className="custom-section">
        <h3>Chat Bubble Style</h3>
        <div className="option-row">
          <button className={`pill-btn ${chatStyle === '' ? 'active' : ''}`} onClick={() => setChatStyle('')}>Standard</button>
          <button className={`pill-btn ${chatStyle === 'neon' ? 'active' : ''}`} onClick={() => setChatStyle('neon')}>Neon</button>
          <button className={`pill-btn ${chatStyle === 'glass' ? 'active' : ''}`} onClick={() => setChatStyle('glass')}>Glass</button>
        </div>
      </div>

      <div className="custom-section">
        <h3>Profile Ring</h3>
        <div className="option-row">
          <button className={`pill-btn ${ringStyle === 'gold' ? 'active' : ''}`} onClick={() => setRingStyle('gold')}>Gold</button>
          <button className={`pill-btn ${ringStyle === 'neon' ? 'active' : ''}`} onClick={() => setRingStyle('neon')}>Neon</button>
          <button className={`pill-btn ${ringStyle === 'fire' ? 'active' : ''}`} onClick={() => setRingStyle('fire')}>Fire</button>
        </div>
      </div>
    </div>
  );
};

export default PlusCustomizer;
