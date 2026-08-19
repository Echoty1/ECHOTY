// src/components/pages/Other/Terms.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import './LegalPages.css';

const Terms = () => {
  const navigate = useNavigate();

  return (
    <>
      <SEO title="Terms of Service" description="Read ECHO's terms of service." />
      <StructuredData />
      <div className="legal-page">
        <div className="legal-header">
          <button className="legal-back" onClick={() => navigate('/other')}>
            ← Back
          </button>
          <h1>Terms of Service</h1>
          <span className="legal-badge">v2.0</span>
        </div>

        <div className="legal-content">
          <div className="legal-section">
            <h2><i className="fas fa-handshake" /> Agreement</h2>
            <p>
              By using echoty.xyz ("we", "our", "us"), you agree to these Terms of Service.
              If you do not agree, please do not use our platform. These terms apply to all users, visitors, and anyone who accesses echoty.xyz.
            </p>
            <div className="legal-highlight">
              <i className="fas fa-check-circle" /> <strong>Acceptance:</strong> Using echoty.xyz means you accept these terms and our <a href="/privacy">Privacy Policy</a>.
            </div>
          </div>

          <div className="legal-section">
            <h2><i className="fas fa-wave-square" /> Echo Features · Rules</h2>
            <p>All echoty.xyz features are governed by these rules. Violations may result in warnings, suspension, or permanent ban.</p>
            <div className="legal-grid">
              <div className="legal-card">
                <h5><i className="fas fa-comment-dots" /> Echo Chat</h5>
                <p>No harassment, hate speech, spam, or impersonation.</p>
                <span className="ban-tag"><i className="fas fa-ban" /> Ban: abuse or threats</span>
              </div>
              <div className="legal-card">
                <h5><i className="fas fa-film" /> Echo Stories</h5>
                <p>No explicit content, bullying, or copyrighted material.</p>
                <span className="ban-tag"><i className="fas fa-ban" /> Ban: prohibited content</span>
              </div>
              <div className="legal-card">
                <h5><i className="fas fa-camera" /> Echo Snap</h5>
                <p>No nudity, violence, or non‑consensual intimate content.</p>
                <span className="ban-tag"><i className="fas fa-ban" /> Ban: privacy violations</span>
              </div>
              <div className="legal-card">
                <h5><i className="fas fa-map-pin" /> Echo Location</h5>
                <p>Share only your own location. No stalking or tracking.</p>
                <span className="ban-tag"><i className="fas fa-ban" /> Ban: misuse to harass</span>
              </div>
              <div className="legal-card">
                <h5><i className="fas fa-user-friends" /> Echo Friends</h5>
                <p>Add only real people. No bots, fake accounts, or mass following.</p>
                <span className="ban-tag"><i className="fas fa-ban" /> Ban: fake profiles</span>
              </div>
              <div className="legal-card">
                <h5><i className="fas fa-database" /> Echo Data</h5>
                <p>You own your data. No scraping or exploiting other users.</p>
                <span className="ban-tag"><i className="fas fa-ban" /> Ban: data abuse</span>
              </div>
            </div>
          </div>

          <div className="legal-section">
            <h2><i className="fas fa-scroll" /> Terms of Use</h2>
            <ul>
              <li><strong>Account:</strong> You must be at least 13 years old. You are responsible for your account and all activity under it.</li>
              <li><strong>Content:</strong> You retain rights to your content, but grant echoty.xyz a license to display and distribute it on the platform.</li>
              <li><strong>Prohibited Conduct:</strong> You may not use echoty.xyz for illegal activities, to spread malware, or to infringe on others' rights.</li>
              <li><strong>Termination:</strong> We may suspend or terminate your account at our sole discretion for violations of these terms.</li>
              <li><strong>Disclaimer:</strong> echoty.xyz is provided "as is" without warranties. We are not liable for any damages arising from use.</li>
              <li><strong>Changes:</strong> We may update these terms at any time. Continued use after changes means you accept the new terms.</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2><i className="fas fa-flag" /> Enforcement & Reporting</h2>
            <p>We take violations seriously. If you see something that breaks these terms, please <a href="/report">report it here</a>. We review all reports within 24 hours.</p>
            <ul>
              <li><strong>Warning:</strong> For first-time or minor infractions.</li>
              <li><strong>Temporary suspension:</strong> For repeated or moderate violations.</li>
              <li><strong>Permanent ban:</strong> For severe or repeated abuse, illegal activity, or harm to others.</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

export default Terms;