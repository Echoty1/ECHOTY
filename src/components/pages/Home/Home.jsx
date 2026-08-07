// src/components/pages/Home/Home.jsx
import React from 'react';
import './Home.css';

const Home = () => {
  return (
    <div className="home-page">
      <div className="home-content">
        <div className="home-icon">🌊</div>
        <h1>Coming Soon</h1>
        <p>We're building something amazing.</p>
        <p className="home-sub">Stay tuned for updates.</p>
      </div>
    </div>
  );
};

export default Home;