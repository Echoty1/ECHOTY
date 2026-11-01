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
    <>
      <style>{`
        .plus-customizer { padding: 10px; }
        .plus-section { 
          margin-bottom: 24px; 
          background: rgba(255,255,255,0.03); 
          padding: 16px; 
          border-radius: 16px; 
          border: 1px solid rgba(255,255,255,0.08); 
        }
        
        .plus-section h3 { 
          font-size: 14px; 
          font-weight: 800; 
          color: #FFD700; 
          margin-bottom: 4px; 
          letter-spacing: 0.5px; 
        }

        .plus-desc {
          font-size: 12px; 
          color: #aaa; 
          margin-bottom: 10px;
        }

        .plus-input {
          flex: 1; 
          padding: 12px; 
          border-radius: 12px; 
          background: rgba(255,255,255,0.05); 
          border: 1px solid rgba(255,255,255,0.1); 
          color: #fff; 
          outline: none;
        }

        .plus-toggle-label {
          color: #fff; 
          font-weight: 600;
        }

        .plus-options { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        
        .plus-options button { 
          background: rgba(255,255,255,0.05); 
          border: 1px solid rgba(255,255,255,0.1); 
          color: #fff; 
          padding: 8px 16px; 
          border-radius: 10px; 
          font-size: 13px; 
          font-weight: 600; 
          cursor: pointer; 
          transition: all 0.2s; 
        }
        
        .plus-options button:hover { background: rgba(255,255,255,0.1); }
        
        .plus-options button.active { 
          background: #FFD700; 
          color: #000; 
          border-color: #FFD700; 
          box-shadow: 0 4px 12px rgba(255,215,0,0.3); 
        }

        /* =========================================
           LIGHT THEME OVERRIDES
           ========================================= */
        html[data-theme="light"] .plus-section,
        body.light .plus-section {
          background: rgba(0, 0, 0, 0.02) !important;
          border-color: rgba(0, 0, 0, 0.08) !important;
        }

        html[data-theme="light"] .plus-section h3,
        body.light .plus-section h3 {
          color: #B45309 !important; /* Dark gold */
        }

        html[data-theme="light"] .plus-desc,
        body.light .plus-desc {
          color: #4B5563 !important; /* Dark gray */
        }

        html[data-theme="light"] .plus-input,
        body.light .plus-input {
          background: #ffffff !important;
          border-color: rgba(0, 0, 0, 0.15) !important;
          color: #000000 !important;
        }

        html[data-theme="light"] .plus-input::placeholder,
        body.light .plus-input::placeholder {
          color: #9CA3AF !important;
        }

        html[data-theme="light"] .plus-toggle-label,
        body.light .plus-toggle-label {
          color: #111827 !important;
        }

        html[data-theme="light"] .plus-options button,
        body.light .plus-options button {
          background: rgba(0, 0, 0, 0.04) !important;
          border-color: rgba(0, 0, 0, 0.08) !important;
          color: #111827 !important;
        }

        html[data-theme="light"] .plus-options button:hover,
        body.light .plus-options button:hover {
          background: rgba(0, 0, 0, 0.08) !important;
        }

        html[data-theme="light"] .plus-options button.active,
        body.light .plus-options button.active {
          background: #FFD700 !important;
          color: #000000 !important;
          border-color: #FFD700 !important;
        }
      `}</style>

      <div className="plus-customizer">
        
        {/* ── Custom Text Inputs ── */}
        <div className="plus-section">
          <h3>👑 CUSTOM BADGE</h3>
          <p className="plus-desc">Replace the default crown with your own text (e.g., CEO, VIP).</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              className="plus-input"
              value={localBadge} 
              onChange={(e) => setLocalBadge(e.target.value)} 
              placeholder="e.g. ECHO VIP"
              maxLength={15}
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
          <p className="plus-desc">Paste a Spotify track link to play music on your profile.</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              className="plus-input"
              value={localMusic} 
              onChange={(e) => setLocalMusic(e.target.value)} 
              placeholder="https://open.spotify.com/track/..."
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
          <p className="plus-desc">View profiles without them knowing you were there.</p>
          <div className="plus-toggle-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="plus-toggle-label">Enable Ghost Mode</span>
            <button 
              onClick={toggleGhostMode}
              style={{ background: ghostMode ? '#34C759' : '#333', width: '50px', height: '28px', borderRadius: '15px', border: 'none', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
            >
              <div style={{ background: 'white', width: '22px', height: '22px', borderRadius: '50%', position: 'absolute', top: '3px', left: ghostMode ? '25px' : '3px', transition: '0.3s' }} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default PlusCustomizer;
