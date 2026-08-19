// src/components/pages/Other/Privacy.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getItem, setItem } from '../../../services/storageService';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import './LegalPages.css';

const Privacy = () => {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [locationPrecise, setLocationPrecise] = useState(true);
  const [friendsSuggest, setFriendsSuggest] = useState(true);
  const [storiesPersonalized, setStoriesPersonalized] = useState(true);

  const handleSave = async () => {
    await setItem('echo_privacy_analytics', String(analytics));
    await setItem('echo_privacy_marketing', String(marketing));
    await setItem('echo_privacy_location', locationPrecise ? 'precise' : 'approximate');
    await setItem('echo_privacy_friends', friendsSuggest ? 'enabled' : 'disabled');
    await setItem('echo_privacy_stories', storiesPersonalized ? 'personalized' : 'standard');
    alert('Preferences saved!');
  };

  useEffect(() => {
    const loadSettings = async () => {
      const a = await getItem('echo_privacy_analytics');
      if (a !== null) setAnalytics(a === 'true');
      const m = await getItem('echo_privacy_marketing');
      if (m !== null) setMarketing(m === 'true');
      const l = await getItem('echo_privacy_location');
      if (l !== null) setLocationPrecise(l === 'precise');
      const f = await getItem('echo_privacy_friends');
      if (f !== null) setFriendsSuggest(f === 'enabled');
      const s = await getItem('echo_privacy_stories');
      if (s !== null) setStoriesPersonalized(s === 'personalized');
    };
    loadSettings();
  }, []);

  return (
    <>
      <SEO title="Privacy Policy" description="How we handle your data on ECHO." />
      <StructuredData />
      <div className="legal-page">
        <div className="legal-header">
          <button className="legal-back" onClick={() => navigate('/other')}>
            ← Back
          </button>
          <h1>Privacy Policy</h1>
          <span className="legal-badge">v4.0</span>
        </div>

        <div className="legal-content">
          <div className="legal-section">
            <h2><i className="fas fa-lock" /> Our covenant</h2>
            <p>
              At echoty.xyz, we treat your data like our own — with respect, encryption, and zero exploitation.
              This policy outlines our transparent approach to information handling in the echoty ecosystem.
            </p>
            <div className="legal-highlight">
              <i className="fas fa-check-circle" /> <strong>Zero data selling.</strong> Ever. We believe trust is the only currency that matters.
            </div>
          </div>

          <div className="legal-section">
            <h2><i className="fas fa-wave-square" /> Echo Features · Rules & Bans</h2>
            <div className="legal-grid">
              <div className="legal-card">
                <h5><i className="fas fa-comment-dots" /> Echo Chat</h5>
                <p>No harassment, hate speech, or spam. Keep it civil.</p>
                <span className="ban-tag"><i className="fas fa-ban" /> Ban: repeated abuse</span>
              </div>
              <div className="legal-card">
                <h5><i className="fas fa-film" /> Echo Stories</h5>
                <p>No explicit content, bullying, or copyrighted material.</p>
                <span className="ban-tag"><i className="fas fa-ban" /> Ban: prohibited content</span>
              </div>
              <div className="legal-card">
                <h5><i className="fas fa-camera" /> Echo Snap</h5>
                <p>No nudity, violence, or illegal acts. Respect privacy.</p>
                <span className="ban-tag"><i className="fas fa-ban" /> Ban: privacy violations</span>
              </div>
              <div className="legal-card">
                <h5><i className="fas fa-map-pin" /> Echo Location</h5>
                <p>Only share your own location. No stalking or tracking.</p>
                <span className="ban-tag"><i className="fas fa-ban" /> Ban: misuse to harass</span>
              </div>
              <div className="legal-card">
                <h5><i className="fas fa-user-friends" /> Echo Friends</h5>
                <p>Add only people you know. No botting or fake accounts.</p>
                <span className="ban-tag"><i className="fas fa-ban" /> Ban: fake profiles</span>
              </div>
              <div className="legal-card">
                <h5><i className="fas fa-database" /> Echo Data</h5>
                <p>You own your data. We only use it to improve echoty.</p>
                <span className="ban-tag"><i className="fas fa-ban" /> Ban: data exploitation</span>
              </div>
            </div>
          </div>

          <div className="legal-section">
            <h2><i className="fas fa-database" /> What we collect</h2>
            <ul>
              <li><strong>Anonymized usage</strong> — to improve echoty's performance and user experience.</li>
              <li><strong>Essential cookies</strong> — for session integrity and preferences.</li>
              <li><strong>Contact data</strong> — only when you voluntarily reach out to us.</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2><i className="fas fa-cog" /> How we use it</h2>
            <p>We process your information exclusively to:</p>
            <ul>
              <li>Operate, maintain, and enhance echoty.xyz</li>
              <li>Respond to your inquiries and provide support</li>
              <li>Send occasional updates — only if you opt in</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2><i className="fas fa-sliders-h" /> Your preferences</h2>
            <div className="privacy-toggle-group">
              <label>
                <i className="fas fa-chart-line" /> Analytics
                <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
              </label>
              <label>
                <i className="fas fa-bullhorn" /> Marketing
                <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
              </label>
              <label>
                <i className="fas fa-location-dot" /> Precise location
                <input type="checkbox" checked={locationPrecise} onChange={(e) => setLocationPrecise(e.target.checked)} />
              </label>
              <label>
                <i className="fas fa-user-plus" /> Friend suggestions
                <input type="checkbox" checked={friendsSuggest} onChange={(e) => setFriendsSuggest(e.target.checked)} />
              </label>
              <label>
                <i className="fas fa-adjust" /> Personalized stories
                <input type="checkbox" checked={storiesPersonalized} onChange={(e) => setStoriesPersonalized(e.target.checked)} />
              </label>
            </div>
            <button className="legal-save-btn" onClick={handleSave}>
              <i className="fas fa-save" /> Save preferences
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Privacy;