// src/components/pages/Profile/PlusCustomizer.jsx
import React from 'react';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { db } from '../../../services/firebase';
import { ref, update } from 'firebase/database';
import { useAuth } from '../../../hooks/useAuth';

const PlusCustomizer = () => {
  const { user } = useAuth();
  const { 
    isPlus, 
    profileBg, setProfileBg, 
    ringStyle, setRingStyle, 
    accentColor, setAccentColor,
    chatStyle, setChatStyle,
    ghostMode, setGhostMode // New
  } = useSubscription();

  if (!isPlus) return <div>Upgrade to ECHO Plus to access this studio.</div>;

  const handleToggleGhostMode = async () => {
    const newVal = !ghostMode;
    setGhostMode(newVal);
    // Save to Firebase so it persists across devices
    await update(ref(db, 'profiles/' + user.uid), { ghostMode: newVal });
  };

  return (
    <div className="plus-customizer">
      {/* ── Profile Backgrounds ── */}
      <div className="plus-section">
        <h3>📸 PROFILE BACKGROUND</h3>
        <div className="plus-options">
          {['default', 'aurora', 'matrix', 'galaxy', 'gold'].map(bg => (
            <button 
              key={bg} 
              className={profileBg === bg ? 'active' : ''} 
              onClick={() => setProfileBg(bg)}
            >
              {bg.charAt(0).toUpperCase() + bg.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Profile Accent Color ── */}
      <div className="plus-section">
        <h3>🎨 PROFILE ACCENT COLOR</h3>
        <div className="plus-options">
          {['default', 'gold', 'neon', 'purple', 'red'].map(color => (
            <button 
              key={color} 
              className={accentColor === color ? 'active' : ''} 
              onClick={() => setAccentColor(color)}
            >
              {color.charAt(0).toUpperCase() + color.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chat Bubble Style ── */}
      <div className="plus-section">
        <h3>💬 CHAT BUBBLE STYLE</h3>
        <div className="plus-options">
          {['standard', 'neon', 'glass', 'gold', 'holographic'].map(style => (
            <button 
              key={style} 
              className={chatStyle === style ? 'active' : ''} 
              onClick={() => setChatStyle(style)}
            >
              {style.charAt(0).toUpperCase() + style.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Ghost Mode (New Feature) ── */}
      <div className="plus-section" style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
        <h3>👻 GHOST MODE</h3>
        <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '10px' }}>
          View profiles without them knowing you were there.
        </p>
        <div className="plus-toggle-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Enable Ghost Mode</span>
          <button 
            onClick={handleToggleGhostMode}
            style={{
              background: ghostMode ? '#34C759' : '#333',
              width: '50px', height: '28px', borderRadius: '15px',
              border: 'none', position: 'relative', cursor: 'pointer', transition: '0.3s'
            }}
          >
            <div style={{
              background: 'white', width: '22px', height: '22px', borderRadius: '50%',
              position: 'absolute', top: '3px', left: ghostMode ? '25px' : '3px', transition: '0.3s'
            }} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlusCustomizer;
