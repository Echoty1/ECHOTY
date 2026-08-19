// src/components/pages/Other/Report.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import './LegalPages.css';

const Report = () => {
  const navigate = useNavigate();
  const GOOGLE_FORM_URL = 'https://forms.gle/WLfbUjc5MXip7QwE7';

  const openReportForm = () => {
    window.open(GOOGLE_FORM_URL, '_blank');
  };

  return (
    <>
      <SEO title="Report a User" description="Report inappropriate behavior on ECHO." />
      <StructuredData />
      <div className="legal-page">
        <div className="legal-header">
          <button className="legal-back" onClick={() => navigate('/other')}>
            ← Back
          </button>
          <h1>Report a User</h1>
          <span className="legal-badge">🔒 confidential</span>
        </div>

        <div className="legal-content report-content">
          <div className="legal-section">
            <h2><i className="fas fa-exclamation-triangle" /> Submit a report</h2>
            <p>
              If you've experienced or witnessed inappropriate behavior, harassment, or any violation of our
              <a href="/terms"> Terms of Service</a>, please let us know. All reports are confidential and
              reviewed within 24 hours.
            </p>
            <div className="legal-highlight">
              <i className="fas fa-shield-alt" /> <strong>Your identity is protected.</strong> We do not share
              reporter information with the reported user.
            </div>
          </div>

          <div className="legal-section">
            <h2><i className="fas fa-list" /> What to include</h2>
            <ul>
              <li><strong>Username or user ID</strong> of the person you're reporting</li>
              <li><strong>Reason</strong> for the report (harassment, spam, impersonation, etc.)</li>
              <li><strong>Detailed description</strong> of what happened</li>
              <li><strong>Screenshots or evidence</strong> (optional but helpful)</li>
            </ul>
          </div>

          <div className="legal-section">
            <h2><i className="fas fa-gavel" /> Consequences</h2>
            <ul>
              <li><strong>Warning:</strong> For first-time or minor infractions.</li>
              <li><strong>Temporary suspension:</strong> For repeated or moderate violations.</li>
              <li><strong>Permanent ban:</strong> For severe or repeated abuse, illegal activity, or harm to others.</li>
            </ul>
          </div>

          <div className="legal-section report-action">
            <button className="legal-primary-btn" onClick={openReportForm}>
              <i className="fas fa-paper-plane" /> Report via Google Form
            </button>
            <p className="report-note">
              You will be redirected to a secure Google Form. All data is encrypted.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Report;