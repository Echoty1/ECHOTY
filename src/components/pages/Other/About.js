// src/components/pages/Other/About.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import './LegalPages.css';

const BRAND_DESCRIPTION =
  'ECHO is a visual identity app where every user can express who they are and how they feel through animated avatars (ECHOMOJI), custom skins, real‑time presence, and communities. Discover, connect, and echo.';

const About = () => {
  const navigate = useNavigate();

  return (
    <>
      <SEO
        title="About ECHO – Our Story & Mission"
        description={`${BRAND_DESCRIPTION} Founded by Lawal Abdul Malik and Abdullah Bashir, we’re building the future of conversations.`}
        keywords="ECHO, chat app, animated avatars, echomoji, visual identity, community, expression, real-time presence, founders, team"
      />
      <StructuredData />
      <div className="legal-page">
        <div className="legal-header">
          <button className="legal-back" onClick={() => navigate('/other')}>
            ← Back
          </button>
          <h1>About ECHO</h1>
          <span className="legal-badge">v2.0</span>
        </div>

        <div className="legal-content">
          <div className="legal-section">
            <h2><i className="fas fa-bullhorn" /> The Future of Conversations</h2>
            <p>
              <strong>ECHO – The future of conversations.</strong><br />
              <span style={{ fontSize: '1.1em' }}>🔊 <em>Discover. Connect. Echo.</em></span>
            </p>
            <p>
              We believe every person has something worth sharing, and every conversation
              has the potential to become something more.
            </p>
            <p>
              So we built <strong>ECHO</strong>, a space centred on helping you express,
              connect, discover and belong. A place where voices can meet, ideas can grow,
              identities can be felt beyond the screen, and communities can take shape.
            </p>
            <p>
              This is your call to be a <em>Voice</em>.<br />
              <strong>Where every voice is given a space to ECHO.</strong>
            </p>
            <p style={{ fontStyle: 'italic' }}>
              Because ECHO isn’t just a place to talk –<br />
              It's a place to be heard.
            </p>
          </div>

          <div className="legal-section">
            <h2><i className="fas fa-history" /> Our Story</h2>
            <p>
              <strong>ECHO</strong> was started by <strong>Lawal Abdul Malik</strong>, who coded the very first version of the app himself using <strong>HTML, CSS, JavaScript, and Node.js</strong>.
            </p>
            <p>
              As the company grew, <strong>Abdullah Bashir</strong> joined as Co‑Founder &amp; CTO. Also a full‑stack developer, Abdullah rebuilt the app with <strong>React</strong> to make it faster, more scalable, and better for our users.
            </p>
            <p>
              Today, we’re an <strong>11‑person team</strong> with <strong>50+ users</strong> and counting. Our mission is simple: build products that solve real problems, ship fast, and keep the code close to the founders. This is just the beginning.
            </p>
            <p style={{ color: '#8B5CF6', fontWeight: 600 }}>
              🚀 <a href="https://echoty.xyz" target="_blank" rel="noopener noreferrer">echoty.xyz</a> – together, we echo.
            </p>
          </div>

          <div className="legal-section">
            <h2><i className="fas fa-users" /> More Than a Chat App</h2>
            <p>
              We're more than your average chatting app; we bring value to your conversations
              and give you access to build communities at an international level,
              allowing your thoughts to <strong>ECHO</strong>.
            </p>
            <p>
              We aim to build an app where users can express themselves and build a community;
              we want our subscribers to have the ability to interact freely in an environment
              that's built for productivity and togetherness.
            </p>
          </div>

          <div className="legal-section">
            <h2><i className="fas fa-paint-brush" /> Your Visual Identity</h2>
            <p>
              ECHO is a visual identity app where every user can communicate who they are
              and how they feel, seamlessly. This is possible through:
            </p>
            <ul>
              <li><strong>A living animated avatar (ECHOMOJI)</strong> that changes with your mood</li>
              <li><strong>Custom skins and GIFs</strong> that make your profile unique</li>
              <li><strong>Real‑time presence</strong> that makes interactions feel alive!</li>
              <li>And so much more that we're planning</li>
            </ul>
            <p>
              Follow our accounts for more info: <strong>@officialechoteam</strong> on TikTok.
            </p>
          </div>

          <div className="legal-section">
            <h2><i className="fas fa-heart" /> Every Voice Matters</h2>
            <p style={{ fontStyle: 'italic', fontSize: '1.05em', lineHeight: '1.8' }}>
              Every voice has a story.<br />
              Every thought deserves a place to land.<br />
              … And that place is <strong>ECHO</strong>.
            </p>
            <p>
              Sign up on our web app through <a href="https://echoty.xyz" target="_blank" rel="noopener noreferrer">echoty.xyz</a>.
            </p>
            <p style={{ color: '#8B5CF6', fontWeight: 600 }}>
              We're stoked to help your voices be heard!
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default About;