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
          {/* ... existing themes ... */}
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
        <p style={{ fontSize: '11px', color: '#aaa', marginTop: '8px' }}>Your bubble style will be visible to the person you are chatting with.</p>
      </div>

      <div className="plus-section">
        <div className="plus-section-title"><i className="fas fa-ring" style={{ color: '#FFD700' }}/> Profile Aura</div>
        <div className="option-row">
          <button className={`pill-btn ${ringStyle === 'gold' ? 'active' : ''}`} onClick={() => setRingStyle('gold')}>Gold</button>
          <button className={`pill-btn ${ringStyle === 'neon' ? 'active' : ''}`} onClick={() => setRingStyle('neon')}>Neon</button>
          <button className={`pill-btn ${ringStyle === 'fire' ? 'active' : ''}`} onClick={() => setRingStyle('fire')}>Fire</button>
        </div>
        <p style={{ fontSize: '11px', color: '#aaa', marginTop: '8px' }}>Your aura will be visible to everyone who visits your profile.</p>
      </div>
    </>
  );
};

export default PlusCustomizer;
