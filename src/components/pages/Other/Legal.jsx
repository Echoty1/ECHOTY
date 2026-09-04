// src/components/pages/Other/Legal.jsx
import React, { useEffect, useRef } from 'react';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import './Legal.css';

const Legal = () => {
  const sectionRefs = useRef([]);
  const timeoutRef = useRef(null);

  // ─── Intersection Observer for scroll animations ──────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('legal-section-visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
    );

    sectionRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    // ─── Fallback: show all cards after 1.5s if observer fails ──
    timeoutRef.current = setTimeout(() => {
      sectionRefs.current.forEach((ref) => {
        if (ref) ref.classList.add('legal-section-visible');
      });
    }, 1500);

    return () => {
      observer.disconnect();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const sections = [
    {
      id: 'terms',
      icon: 'fa-file-contract',
      title: 'Terms of Service',
      color: '#8B5CF6',
      content: (
        <>
          <p>
            ECHO (echoty.xyz) is a visual-identity chat app: private chats, communities, live, ECHOMOJI, and ECHO AI.
          </p>
          <ul>
            <li>You must be at least 13 years old to use ECHO.</li>
            <li>You are responsible for what you send and how you behave.</li>
            <li>
              <strong>Prohibited:</strong> harassment, hate speech, explicit content, spam, scams, impersonation, or sharing others' private information.
            </li>
            <li>We may warn, suspend, or permanently ban accounts that violate these rules.</li>
            <li>Private and community messages can expire (ECHO Tides) unless bookmarked.</li>
            <li>Communities are created on <a href="https://brand.echoty.xyz" target="_blank" rel="noopener noreferrer">brand.echoty.xyz</a>, then joined in the app.</li>
          </ul>
          <p>These terms follow the laws of the Federal Republic of Nigeria. ECHO is provided as-is.</p>
        </>
      )
    },
    {
      id: 'privacy',
      icon: 'fa-shield-alt',
      title: 'Privacy Policy',
      color: '#10B981',
      content: (
        <>
          <div className="legal-highlight">
            <i className="fas fa-check-circle" /> We do not sell your data. Ever.
          </div>
          <ul>
            <li>We store profiles, chats, communities, and live session data in Firebase so the app works.</li>
            <li>Sign-in uses Firebase Auth (email and Google).</li>
            <li>Bookmarks stay on your device. Expired Tide messages are deleted from the shared chat.</li>
            <li>You can delete your account at any time from <strong>Settings</strong>.</li>
            <li>We use essential cookies for session integrity and preferences.</li>
          </ul>
        </>
      )
    },
    {
      id: 'report',
      icon: 'fa-flag',
      title: 'Report a User',
      color: '#EF4444',
      content: (
        <>
          <p>
            Reports are reviewed by the ECHO team within 24 hours. Include the username or ID, what happened, and screenshots if you have them.
          </p>
          <p style={{ marginTop: '12px' }}>
            <strong>Your identity is protected.</strong> We do not share reporter information with the reported user.
          </p>
          <div className="legal-report-action">
            <button
              className="legal-report-btn"
              type="button"
              onClick={() => window.open('https://forms.gle/WLfbUjc5MXip7QwE7', '_blank')}
            >
              <i className="fas fa-paper-plane" /> Open Report Form
            </button>
          </div>
        </>
      )
    }
  ];

  return (
    <>
      <SEO title="Legal & Policies – ECHO" description="Terms, privacy, and reporting for ECHO." />
      <StructuredData />
      <div className="legal-page">
        <header className="legal-hero">
          <p className="legal-kicker">Legal</p>
          <h1>Policies</h1>
          <p>Terms, privacy, and reporting – transparent and simple.</p>
          <p className="legal-updated">Last updated September 1, 2026</p>
        </header>

        <div className="legal-grid">
          {sections.map((section, index) => (
            <div
              key={section.id}
              className="legal-card"
              ref={(el) => (sectionRefs.current[index] = el)}
              style={{ '--card-color': section.color }}
            >
              <div className="legal-card-header">
                <span className="legal-card-icon" style={{ background: `${section.color}20`, color: section.color }}>
                  <i className={`fas ${section.icon}`} />
                </span>
                <h2>{section.title}</h2>
              </div>
              <div className="legal-card-body">
                {section.content}
              </div>
            </div>
          ))}
        </div>

        <div className="legal-footer">
          <p>ECHO · echoty.xyz</p>
        </div>
      </div>
    </>
  );
};

export default Legal;