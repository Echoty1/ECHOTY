// src/components/pages/Other/Legal.jsx
import React, { useEffect, useRef } from 'react';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import './Legal.css';

const legalIcons = {
  document: (
    <>
      <path d="M7 3.75h7l4 4v12.5H7z" />
      <path d="M14 3.75v4h4M10 12h5M10 15.5h5" />
    </>
  ),
  shield: (
    <>
      <path d="m12 3.5 7 2.5v5.2c0 4.3-2.9 7.5-7 9.3-4.1-1.8-7-5-7-9.3V6z" />
      <path d="m9 11.5 2 2 4-4" />
    </>
  ),
  flag: (
    <>
      <path d="M6 20V4" />
      <path d="M6 5h11l-2 3 2 3H6" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </>
  ),
  plane: <path d="m21 3-7.2 18-3.7-7.1L3 10.2 21 3Zm0 0L10.1 13.9" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 2" />
    </>
  )
};

const LegalIcon = ({ name, className = '' }) => (
  <svg
    className={`legal-icon ${className}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {legalIcons[name]}
  </svg>
);

const Legal = () => {
  const pageRef = useRef(null);

  useEffect(() => {
    const page = pageRef.current;
    const cards = page?.querySelectorAll('.legal-card');

    if (
      !page ||
      !cards?.length ||
      typeof IntersectionObserver === 'undefined' ||
      (typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    ) {
      return undefined;
    }

    page.classList.add('legal-page--reveal');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('legal-section-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -32px 0px' }
    );

    cards.forEach((card) => observer.observe(card));

    return () => {
      observer.disconnect();
      page.classList.remove('legal-page--reveal');
    };
  }, []);

  const sections = [
    {
      id: 'terms',
      icon: 'document',
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
      icon: 'shield',
      title: 'Privacy Policy',
      color: '#10B981',
      content: (
        <>
          <div className="legal-highlight">
            <LegalIcon name="check" /> We do not sell your data. Ever.
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
      icon: 'flag',
      title: 'Report a User',
      color: '#EF4444',
      content: (
        <>
          <p>
            Reports are reviewed by the ECHO team within 24 hours. Include the username or ID, what happened, and screenshots if you have them.
          </p>
          <p>
            <strong>Your identity is protected.</strong> We do not share reporter information with the reported user.
          </p>
          <div className="legal-report-action">
            <button
              className="legal-report-btn"
              type="button"
              onClick={() => window.open('https://forms.gle/WLfbUjc5MXip7QwE7', '_blank', 'noopener,noreferrer')}
            >
              <LegalIcon name="plane" /> Open Report Form
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
      <main className="legal-page" ref={pageRef}>
        <header className="legal-hero">
          <p className="legal-kicker"><span aria-hidden="true" /> ECHO · LEGAL</p>
          <h1>Legal <span>&amp; Policies</span></h1>
          <p className="legal-intro">Clear, straightforward information about using ECHO.</p>
          <p className="legal-updated">
            <LegalIcon name="clock" />
            <span>Last updated <time dateTime="2026-09-01">September 1, 2026</time></span>
          </p>
        </header>

        <div className="legal-grid">
          {sections.map((section) => (
            <section
              key={section.id}
              className="legal-card"
              aria-labelledby={`legal-${section.id}-title`}
              style={{ '--card-color': section.color }}
            >
              <div className="legal-card-header">
                <span className="legal-card-icon">
                  <LegalIcon name={section.icon} />
                </span>
                <h2 id={`legal-${section.id}-title`}>{section.title}</h2>
              </div>
              <div className="legal-card-body">
                {section.content}
              </div>
            </section>
          ))}
        </div>

        <footer className="legal-footer">
          <p>ECHO <span aria-hidden="true">·</span> echoty.xyz</p>
        </footer>
      </main>
    </>
  );
};

export default Legal;
