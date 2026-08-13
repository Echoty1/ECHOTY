// src/components/pages/Home/Home.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { db } from '../../../services/firebase';
import { ref, onValue, get } from 'firebase/database';
import { getCache, setCache } from '../../../services/cacheService';
import './Home.css';

// ─── Helper: fetch a profile (cached) ──────────────────────
const fetchProfile = async (uid) => {
  const cacheKey = `profile_${uid}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;
  try {
    const snapshot = await get(ref(db, `profiles/${uid}`));
    if (snapshot.exists()) {
      const data = snapshot.val();
      setCache(cacheKey, data, 300);
      return data;
    }
    return null;
  } catch {
    return null;
  }
};

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  // ─── Load online users ──────────────────────────────────────
  useEffect(() => {
    const presenceRef = ref(db, 'presence/online');
    const unsubscribe = onValue(presenceRef, async (snapshot) => {
      const data = snapshot.val() || {};
      const onlineUids = Object.keys(data).filter(uid => data[uid] === true && uid !== user?.uid);

      // Fetch profiles for each online uid
      const profilePromises = onlineUids.map(async (uid) => {
        const profile = await fetchProfile(uid);
        return { uid, ...(profile || { name: 'User', avatar: '' }) };
      });
      const profiles = await Promise.all(profilePromises);
      setOnlineUsers(profiles);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // ─── Update timestamps every minute ─────────────────────────
  useEffect(() => {
    const updateTimestamps = () => {
      // Force re‑render by updating a dummy state? Actually we can just
      // use a timeAgo function that reads Date.now() – it will update naturally.
      // We'll use a state tick to force re‑render.
      setOnlineUsers(prev => [...prev]); // trigger re‑render
    };
    timerRef.current = setInterval(updateTimestamps, 60000);
    return () => clearInterval(timerRef.current);
  }, []);

  // ─── Format time ago (updates dynamically) ──────────────────
  const timeAgo = (timestamp) => {
    if (!timestamp) return 'Just now';
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // ─── Render avatar ────────────────────────────────────────────
  const renderAvatar = (profile) => {
    const avatarUrl = profile.avatar || '';
    const name = profile.name || 'User';
    if (avatarUrl) {
      return <img src={avatarUrl} alt={name} className="live-avatar-img" />;
    }
    return <div className="live-avatar-placeholder">{name[0]?.toUpperCase() || 'U'}</div>;
  };

  // ─── Start chat ──────────────────────────────────────────────
  const startChat = (uid, name) => {
    navigate(`/chat/${uid}`, {
      state: {
        userName: name || 'User',
        userAvatar: onlineUsers.find(u => u.uid === uid)?.avatar || '',
      },
    });
  };

  // ─── Skeleton ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="home-page">
        <div className="home-container">
          <section className="home-section live-section">
            <div className="section-header">
              <span className="live-dot" />
              <h3>Live Now</h3>
              <span className="live-count skeleton-text">—</span>
            </div>
            <div className="live-users-scroll">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="live-user-card skeleton-card">
                  <div className="live-avatar skeleton-avatar" />
                  <div className="live-username skeleton-text" style={{ width: '50px', height: '12px' }} />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <div className="home-container">
        {/* ─── Live Now Section ────────────────────────────────── */}
        <section className="home-section live-section">
          <div className="section-header">
            <span className="live-dot" />
            <h3>Live Now</h3>
            <span className="live-count">{onlineUsers.length} online</span>
          </div>
          <p className="live-hint">Tap any profile to start a chat</p>
          <div className="live-users-scroll">
            {onlineUsers.length === 0 ? (
              <p className="live-empty">No one online right now</p>
            ) : (
              onlineUsers.map((profile) => (
                <div
                  key={profile.uid}
                  className="live-user-card"
                  onClick={() => startChat(profile.uid, profile.name)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="live-avatar">
                    {renderAvatar(profile)}
                    <span className="online-indicator" />
                  </div>
                  <span className="live-username">{profile.name || 'User'}</span>
                  <span className="live-joined">{timeAgo(profile.lastActive || Date.now())}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;