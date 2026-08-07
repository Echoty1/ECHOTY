// src/components/pages/Other/About.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LegalPages.css';

const About = () => {
  const navigate = useNavigate();

  return (
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
          <h2><i className="fas fa-bullseye" /> Our Goal</h2>
          <p>
            We believe conversations should be <strong>fun, meaningful, and effortless</strong>.
            Our goal is to make chatting <em>funner</em> and <em>better</em> — 
            a place where every interaction feels alive, every connection matters,
            and every echo starts something new.
          </p>
        </div>

        <div className="legal-section">
          <h2><i className="fas fa-heart" /> What We Stand For</h2>
          <ul>
            <li><strong>Simplicity</strong> – Clean, intuitive design that puts people first.</li>
            <li><strong>Authenticity</strong> – Real conversations, real connections, no noise.</li>
            <li><strong>Innovation</strong> – Features that make chatting feel like magic.</li>
            <li><strong>Community</strong> – A safe, respectful space for everyone.</li>
          </ul>
        </div>

        <div className="legal-section">
          <h2><i className="fas fa-rocket" /> Why ECHO?</h2>
          <p>
            ECHO isn't just another chat app — it's a living network where ideas travel like waves.
            We start with curiosity, not contacts. Every Echo is an invitation to discover,
            connect, and create something meaningful together.
          </p>
        </div>

        <div className="legal-section">
          <h2><i className="fas fa-users" /> Built for You</h2>
          <p>
            We're a small team passionate about reimagining how people connect.
            Your feedback drives us. If you have ideas or suggestions, we'd love to hear them —
            reach out to us at <a href="mailto:legal@echoty.xyz">echoinfoteam@gmail.com</a>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default About;