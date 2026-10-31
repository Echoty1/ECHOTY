// src/components/pages/Profile/PlusCustomizer.jsx
import React, { useState } from 'react';
import { useSubscription } from '../../../contexts/SubscriptionContext';

const PlusCustomizer = () => {
  const { 
    isPlus, 
    profileBg, setProfileBg, 
    accentColor, setAccentColor,
    chatStyle, setChatStyle,
    badgeText, setBadgeText,
    premiumMusic, setPremiumMusic,
    profileGlow, setProfileGlow,
    profileAura, setProfileAura,
    statusEmoji, setStatusEmoji,
    ghostMode, toggleGhostMode
  } = useSubscription();

  const [localBadge, setLocalBadge] = useState(badgeText || '');
  const [localMusic, setLocalMusic] = useState(premiumMusic || '');

  if (!isPlus) return <div>Upgrade to ECHO Plus to access this studio.</div>;

  return (
    <div className="plus-customizer">
      
      {/* ── Custom Text Inputs ── */}
      <div className="plus-section">
        <h3>👑 CUSTOM BADGE</h3>
        <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '10px' }}>Replace the default crown with your own text (e.g., CEO, VIP).</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            value={localBadge} 
            onChange={(e) => setLocalBadge(e.target.value)} 
            placeholder="e.g. ECHO VIP"
            maxLength={15}
            style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
          />
          <button 
            onClick={() => setBadgeText(localBadge)} 
            style={{ background: '#FFD700', color: '#000', border: 'none', padding: '0 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Save
          </button>
        </div>
      </div>

      <div className="plus-section">
        <h3>🎵 PROFILE MUSIC (SPOTIFY LINK)</h3>
        <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '10px' }}>Paste a Spotify track link to play music on your profile.</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            value={localMusic} 
            onChange={(e) => setLocalMusic(e.target.value)} 
            placeholder="https://open.spotify.com/track/..."
            style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
          />
          <button 
            onClick={() => setPremiumMusic(localMusic)} 
            style={{ background: '#1DB954', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Save
          </button>
        </div>
      </div>

      {/* ── Profile Backgrounds ── */}
      <div className="plus-section">
        <h3>📸 PROFILE BACKGROUND</h3>
        <div className="plus-options">
          {['default', 'aurora', 'matrix', 'galaxy', 'gold'].map(bg => (
            <button key={bg} className={profileBg === bg ? 'active' : ''} onClick={() => setProfileBg(bg)}>
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
            <button key={color} className={accentColor === color ? 'active' : ''} onClick={() => setAccentColor(color)}>
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
            <button key={style} className={chatStyle === style ? 'active' : ''} onClick={() => setChatStyle(style)}>
              {style.charAt(0).toUpperCase() + style.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Avatar Glow ── */}
      <div className="plus-section">
        <h3>✨ ANIMATED AVATAR GLOW</h3>
        <div className="plus-options">
          {['none', 'gold', 'pink', 'cyan', 'rainbow'].map(glow => (
            <button key={glow} className={profileGlow === glow ? 'active' : ''} onClick={() => setProfileGlow(glow)}>
              {glow.charAt(0).toUpperCase() + glow.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Ghost Mode ── */}
      <div className="plus-section" style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
        <h3>👻 GHOST MODE</h3>
        <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '10px' }}>View profiles without them knowing you were there.</p>
        <div className="plus-toggle-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#fff', fontWeight: 600 }}>Enable Ghost Mode</span>
          <button 
            onClick={toggleGhostMode}
            style={{ background: ghostMode ? '#34C759' : '#333', width: '50px', height: '28px', borderRadius: '15px', border: 'none', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
          >
            <div style={{ background: 'white', width: '22px', height: '22px', borderRadius: '50%', position: 'absolute', top: '3px', left: ghostMode ? '25px' : '3px', transition: '0.3s' }} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlusCustomizer;  
