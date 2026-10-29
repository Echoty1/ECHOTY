// src/components/pages/Profile/PlusCustomizer.jsx
import React, { useState, useEffect } from 'react';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { useAuth } from '../../../hooks/useAuth';
import { ref, get, update } from 'firebase/database';
import { db } from '../../../services/firebase';
import Toast from '../../Toast/Toast';

const PlusCustomizer = () => {
  const { 
    chatStyle, setChatStyle, 
    ringStyle, setRingStyle, 
    profileBg, setProfileBg,
    profileMusic, setProfileMusic,
    badgeText, setBadgeText,
    ghostMode, setGhostMode,
    accentColor, setAccentColor
  } = useSubscription();
  
  const { user } = useAuth();
  const [passes, setPasses] = useState(5);
  const [toast, setToast] = useState(null);
  const [musicInput, setMusicInput] = useState(profileMusic || '');
  const [badgeInput, setBadgeInput] = useState(badgeText || '');

  useEffect(() => {
    if (!user?.uid) return;
    const fetchPasses = async () => {
      const passRef = ref(db, `profiles/${user.uid}/buddyPasses`);
      const snap = await get(passRef);
      if (snap.exists()) setPasses(snap.val());
      else { setPasses(5); await update(ref(db, `profiles/${user.uid}`), { buddyPasses: 5 }); }
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

  const saveMusic = () => {
    setProfileMusic(musicInput);
    setToast({ message: 'Profile music saved!', type: 'success' });
  };

  const saveBadge = () => {
    if (badgeInput.length > 15) {
      return setToast({ message: 'Badge text is too long (max 15 chars).', type: 'error' });
    }
    setBadgeText(badgeInput);
    setToast({ message: 'Custom badge saved!', type: 'success' });
  };

  return (
    <>
      <div className="plus-section">
        <div className="plus-section-title"><i className="fas fa-image" style={{ color: '#FFD700' }}/> Profile Background</div>
        <div className="option-row">
          {['default', 'aurora', 'matrix', 'galaxy', 'gold'].map(bg => (
            <button key={bg} className={`pill-btn ${profileBg === bg ? 'active' : ''}`} onClick={() => setProfileBg(bg)}>
              {bg.charAt(0).toUpperCase() + bg.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="plus-section">
        <div className="plus-section-title"><i className="fas fa-palette" style={{ color: '#FFD700' }}/> Profile Accent Color</div>
        <div className="option-row">
          {['default', 'gold', 'neon', 'purple'].map(color => (
            <button key={color} className={`pill-btn ${accentColor === color ? 'active' : ''}`} onClick={() => setAccentColor(color)}>
              {color.charAt(0).toUpperCase() + color.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="plus-section">
        <div className="plus-section-title"><i className="fas fa-comment-dots" style={{ color: '#FFD700' }}/> Chat Bubble Style</div>
        <div className="option-row">
          {['', 'neon', 'glass', 'gold'].map(style => (
            <button key={style || 'standard'} className={`pill-btn ${chatStyle === style ? 'active' : ''}`} onClick={() => setChatStyle(style)}>
              {style === '' ? 'Standard' : style.charAt(0).toUpperCase() + style.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="plus-section">
        <div className="plus-section-title"><i className="fas fa-ring" style={{ color: '#FFD700' }}/> Profile Aura</div>
        <div className="option-row">
          {['gold', 'neon', 'fire', 'rainbow'].map(aura => (
            <button key={aura} className={`pill-btn ${ringStyle === aura ? 'active' : ''}`} onClick={() => setRingStyle(aura)}>
              {aura.charAt(0).toUpperCase() + aura.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="plus-section">
        <div className="plus-section-title"><i className="fas fa-certificate" style={{ color: '#FFD700' }}/> Custom Profile Badge</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="text" value={badgeInput} onChange={(e) => setBadgeInput(e.target.value)} placeholder="e.g. 👑 Founder" maxLength={15} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff' }} />
          <button onClick={saveBadge} className="pill-btn active">Save</button>
        </div>
      </div>

      <div className="plus-section">
        <div className="plus-section-title"><i className="fas fa-music" style={{ color: '#FFD700' }}/> Profile Music</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="url" value={musicInput} onChange={(e) => setMusicInput(e.target.value)} placeholder="https://open.spotify.com/track/..." style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff' }} />
          <button onClick={saveMusic} className="pill-btn active">Save</button>
        </div>
      </div>

      <div className="plus-section">
        <div className="plus-section-title"><i className="fas fa-ghost" style={{ color: '#FFD700' }}/> Ghost Mode</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '12px', color: '#aaa', margin: 0, flex: 1 }}>Hide your view when checking other profiles.</p>
          <button onClick={() => setGhostMode(!ghostMode)} style={{ background: ghostMode ? '#FFD700' : 'var(--bg-input)', color: ghostMode ? '#000' : '#fff', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}>
            {ghostMode ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="plus-section buddy-pass-section">
        <div className="plus-section-title"><i className="fas fa-ticket-alt" style={{ color: '#FFD700' }}/> Buddy Passes</div>
        <div className="buddy-pass-display">
          <div className="pass-count">{passes} <span>/ 5 left</span></div>
          <p className="pass-desc">Gift ECHO Plus to a friend.</p>
          <button className={`btn-copy-pass ${passes <= 0 ? 'disabled' : ''}`} onClick={handleCopyLink} disabled={passes <= 0}>
            {passes <= 0 ? <>All Passes Used</> : <><i className="fas fa-link" /> Copy Buddy Link</>}
          </button>
        </div>
      </div>
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </>
  );
};

export default PlusCustomizer;
