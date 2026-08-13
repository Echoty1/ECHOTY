// src/components/pages/Home/Home.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../contexts/ProfileContext';
import { db } from '../../../services/firebase';
import { ref, onValue } from 'firebase/database';
import { useCachedImage } from '../../../utils/mediaCache';
import './Home.css';

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profiles, fetchProfile } = useProfile();
  const [onlineUids, setOnlineUids] = useState([]);
  const [loading, setLoading] = useState(true);

  // ─── Listen to presence updates ──────────────────────────────
  useEffect(() => {
    if (!user) return;
    const presenceRef = ref(db, 'presence/online');
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val() || {};
      const uids = Object.keys(data).filter(uid => data[uid] === true && uid !== user.uid);
      setOnlineUids(uids);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // ─── Fetch profiles for online users (real-time listeners) ──
  useEffect(() => {
    if (onlineUids.length === 0) return;
    onlineUids.forEach(uid => {
      if (!profiles[uid]) {
        fetchProfile(uid); // sets up listener, updates profiles
      }
    });
  }, [onlineUids, profiles, fetchProfile]);

  // ─── Build online users list from profiles ───────────────────
  const onlineUsers = useMemo(() => {
    return onlineUids.map(uid => ({
      uid,
      ...(profiles[uid] || { name: 'User', avatar: '' })
    }));
  }, [onlineUids, profiles]);

  // ─── Render avatar with caching ──────────────────────────────
  const AvatarWithCache = ({ profile }) => {
    const cachedImage = useCachedImage(profile.avatar, null);
    const name = profile.name || 'User';

    if (cachedImage) {
      return <img src={cachedImage} alt={name} className="live-avatar-img" />;
    }
    return (
      <div className="live-avatar-placeholder">
        {name[0]?.toUpperCase() || 'U'}
      </div>
    );
  };

  // ─── Start chat ──────────────────────────────────────────────
  const startChat = (uid, name) => {
    navigate(`/chat/${uid}`, {
      state: {
        userName: name || 'User',
        userAvatar: profiles[uid]?.avatar || '',
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
                  <div className="live-username skeleton-text" style={{ width: '60px', height: '14px' }} />
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
                    <AvatarWithCache profile={profile} />
                    <span className="online-indicator" />
                  </div>
                  <span className="live-username">{profile.name || 'User'}</span>
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