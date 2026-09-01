// src/components/pages/Other/Legal.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import './Legal.css';

const Legal = () => {
  const navigate = useNavigate();

  return (
    <>
      <SEO
        title="Legal & Policies – ECHO"
        description="Terms of Service, Privacy Policy, and Reporting guidelines for ECHO."
      />
      <StructuredData />
      <div className="legal-page">
        {/* ─── Back Button ───────────────────────────────────────── */}
        <button className="legal-back-btn" onClick={() => navigate('/other')}>
          <i className="fas fa-arrow-left" /> Back to More
        </button>

        <div className="legal-header">
          <h1>Legal &amp; Policies</h1>
          <p className="legal-subtitle">
            Terms of Service, Privacy Policy, and Reporting guidelines for ECHO.
          </p>
          <p className="legal-updated">Last Updated: August 31, 2026</p>
        </div>

        {/* ─── Terms of Service ──────────────────────────────────── */}
        <section className="legal-section">
          <h2>1. Terms of Service</h2>
          <p>
            By accessing and using the ECHO platform, you accept and agree to be
            bound by these Terms of Service. If you do not agree, please do not
            use our platform.
          </p>

          <h3>1.1 General Terms</h3>
          <p>
            We reserve the right to update these terms at any time. It is your
            responsibility to check this page periodically for changes. Continued
            use constitutes acceptance of the new terms.
          </p>

          <h3>1.2 Account &amp; Content</h3>
          <ul>
            <li>You must be at least 13 years old to use ECHO.</li>
            <li>
              You are responsible for your account and all activity under it.
            </li>
            <li>
              You retain rights to your content, but grant ECHO a license to
              display and distribute it on the platform.
            </li>
            <li>
              You may not use ECHO for illegal activities, to spread malware, or
              to infringe on others' rights.
            </li>
          </ul>

          <h3>1.3 Prohibited Conduct</h3>
          <ul>
            <li>
              <strong>No harassment, hate speech, or bullying.</strong>
            </li>
            <li>
              <strong>No explicit content, nudity, or violence.</strong>
            </li>
            <li>
              <strong>No spam, scams, or impersonation.</strong>
            </li>
            <li>
              <strong>No sharing of others' private information (doxxing).</strong>
            </li>
            <li>
              <strong>No botting, fake accounts, or mass following.</strong>
            </li>
          </ul>

          <h3>1.4 Enforcement &amp; Termination</h3>
          <p>
            We may suspend or terminate your account at our sole discretion for
            violations of these terms. Consequences include:
          </p>
          <ul>
            <li>
              <strong>Warning:</strong> For first-time or minor infractions.
            </li>
            <li>
              <strong>Temporary suspension:</strong> For repeated or moderate
              violations.
            </li>
            <li>
              <strong>Permanent ban:</strong> For severe or repeated abuse,
              illegal activity, or harm to others.
            </li>
          </ul>

          <h3>1.5 Disclaimer &amp; Liability</h3>
          <p>
            ECHO is provided &quot;as is&quot; without warranties. We are not liable
            for any damages arising from use of the platform.
          </p>

          <h3>1.6 Governing Law</h3>
          <p>
            These Terms of Service shall be governed by and construed in
            accordance with the laws of the Federal Republic of Nigeria.
          </p>
        </section>

        {/* ─── Privacy Policy ────────────────────────────────────── */}
        <section className="legal-section">
          <h2>2. Privacy Policy</h2>

          <h3>2.1 Our Covenant</h3>
          <p>
            At ECHO, we treat your data like our own — with respect, encryption,
            and zero exploitation. We believe trust is the only currency that
            matters.
          </p>
          <div className="legal-highlight">
            <i className="fas fa-check-circle" /> <strong>Zero data selling.</strong>{' '}
            Ever.
          </div>

          <h3>2.2 What We Collect</h3>
          <ul>
            <li>
              <strong>Anonymized usage</strong> — to improve ECHO's performance
              and user experience.
            </li>
            <li>
              <strong>Essential cookies</strong> — for session integrity and
              preferences.
            </li>
            <li>
              <strong>Contact data</strong> — only when you voluntarily reach out
              to us.
            </li>
          </ul>

          <h3>2.3 How We Use It</h3>
          <p>We process your information exclusively to:</p>
          <ul>
            <li>Operate, maintain, and enhance ECHO.</li>
            <li>Respond to your inquiries and provide support.</li>
            <li>Send occasional updates — only if you opt in.</li>
          </ul>

          <h3>2.4 Data Security</h3>
          <p>
            All data is stored in Firebase with security rules ensuring users can
            only read/write their own data. Authentication is handled by Firebase
            Auth with support for Google and email/password.
          </p>

          <h3>2.5 Your Rights</h3>
          <ul>
            <li>You own your data.</li>
            <li>
              You can delete your account at any time from Settings.
            </li>
            <li>We do not sell or share your data with third parties.</li>
          </ul>
        </section>

        {/* ─── Report a User ─────────────────────────────────────── */}
        <section className="legal-section">
          <h2>3. Report a User</h2>

          <h3>3.1 Submit a Report</h3>
          <p>
            If you've experienced or witnessed inappropriate behavior,
            harassment, or any violation of our Terms of Service, please let us
            know. All reports are confidential and reviewed within 24 hours.
          </p>
          <div className="legal-highlight">
            <i className="fas fa-shield-alt" />{' '}
            <strong>Your identity is protected.</strong> We do not share reporter
            information with the reported user.
          </div>

          <h3>3.2 What to Include</h3>
          <ul>
            <li>
              <strong>Username or user ID</strong> of the person you're reporting
            </li>
            <li>
              <strong>Reason</strong> for the report (harassment, spam,
              impersonation, etc.)
            </li>
            <li>
              <strong>Detailed description</strong> of what happened
            </li>
            <li>
              <strong>Screenshots or evidence</strong> (optional but helpful)
            </li>
          </ul>

          <div className="legal-report-action">
            <button
              className="legal-report-btn"
              onClick={() =>
                window.open('https://forms.gle/WLfbUjc5MXip7QwE7', '_blank')
              }
            >
              <i className="fas fa-paper-plane" /> Report via Google Form
            </button>
            <p className="legal-report-note">
              You will be redirected to a secure Google Form. All data is
              encrypted.
            </p>
          </div>
        </section>

        {/* ─── Footer ────────────────────────────────────────────── */}
        <div className="legal-footer">
          <p>© 2026 ECHO. All rights reserved.</p>
          <p>
            <a href="/">echoty.xyz</a> · Discover. Connect. Echo.
          </p>
        </div>
      </div>
    </>
  );
};

export default Legal;