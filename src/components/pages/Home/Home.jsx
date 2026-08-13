// src/components/pages/Home/Home.jsx
import React from 'react';
import './Home.css';

const Home = () => {
  return (
    <div className="home-page">
      <div className="home-container">
        {/* ─── News Section ────────────────────────────────────── */}
        <section className="home-news">
          <div className="news-header">
            <span className="news-badge">📢 What's New</span>
            <h2>Message Deletion is Here</h2>
          </div>
          <div className="news-content">
            <p>
              You can now <strong>permanently delete</strong> any message you've sent.
              Once deleted, it's gone forever – for both you and the person you were chatting with.
              <br /><br />
              <strong>How to delete:</strong>
              <br />
              A trash icon <span style={{ color: '#ef4444' }}>🗑️</span> appears at the bottom‑right of every message you send.
              Just tap or click it, and a confirmation popup will ask you to confirm the deletion.
              <br />
              It works the same way on <strong>phones, tablets, and laptops</strong> – no hovering or long‑pressing needed.
              <br /><br />
              <span className="news-note">
                ⚠️ Remember: you can only delete messages you sent yourself, and there's no way to recover them.
              </span>
            </p>
          </div>
        </section>

        {/* ─── Feed Section ────────────────────────────────────── */}
        <section className="home-feed">
          <div className="feed-header">
            <span className="feed-badge">📰 Feed</span>
            <h3>Coming Soon</h3>
          </div>
          <div className="feed-placeholder">
            <div className="feed-card">
              <div className="feed-card-icon">🌊</div>
              <p>We're building a live activity feed</p>
              <span>Stay tuned for updates ✨</span>
            </div>
            <div className="feed-card">
              <div className="feed-card-icon">💬</div>
              <p>Real‑time status updates</p>
              <span>Coming in the next release</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;