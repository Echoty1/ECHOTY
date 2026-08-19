// src/components/pages/Home/Home.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../contexts/ProfileContext';
import { db } from '../../../services/firebase';
import { ref, onValue } from 'firebase/database';
import Avatar from '../../common/Avatar';
import UserPreviewModal from '../../common/UserPreviewModal';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import './Home.css';

const DEMO_UID = 'k9Cs6QPfDRNTputzic7V3xRUof63';
const SUPPORT_UID = 'hD7tJzPVI1VSorhok8GToBC6VDy1';

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profiles, fetchProfile } = useProfile();
  const [onlineUids, setOnlineUids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);

  const isDemoUser = user?.uid === DEMO_UID;
  const isSupportUser = user?.uid === SUPPORT_UID;

  // ─── Real‑time presence listener ──────────────────────────────
  useEffect(() => {
    if (!user) return;

    const presenceRef = ref(db, 'presence/online');
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val() || {};
      let online = Object.keys(data).filter(uid => data[uid] === true && uid !== user.uid);

      if (isDemoUser) {
        online = online.filter(uid => uid === SUPPORT_UID);
      } else if (!isSupportUser) {
        online = online.filter(uid => uid !== DEMO_UID);
      }

      setOnlineUids(online);
      setLoading(false);

      // Fetch profiles for any online users we don't have yet
      online.forEach(uid => {
        if (!profiles[uid]) {
          fetchProfile(uid);
        }
      });
    });

    return () => unsubscribe();
  }, [user, isDemoUser, isSupportUser, profiles, fetchProfile]);

  const openUserPreview = (uid) => {
    const profile = profiles[uid];
    if (profile) {
      setSelectedUser({ uid, ...profile });
    }
  };

  const closeUserPreview = () => {
    setSelectedUser(null);
  };

  const startChat = (uid, name, avatar) => {
    closeUserPreview();
    navigate(`/chat/${uid}`, {
      state: {
        userName: name || 'User',
        userAvatar: avatar || '',
      },
    });
  };

  // Build user list from onlineUids and profiles
  const onlineUsers = onlineUids
    .map(uid => {
      const profile = profiles[uid];
      if (!profile) return null;
      return { uid, ...profile, online: true };
    })
    .filter(Boolean);

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
    <>
      <SEO
        title="Live Now – Chat with Friends"
        description="See who's online and start a conversation instantly on ECHO. Connect with friends and make new ones."
      />
      <StructuredData />
      <div className="home-page">
        <div className="home-container">
          <section className="home-section live-section">
            <div className="section-header">
              <span className="live-dot" />
              <h3>Live Now</h3>
              <span className="live-count">{onlineUsers.length} online</span>
            </div>
            <p className="live-hint">Tap any profile to view and chat</p>
            <div className="live-users-scroll">
              {onlineUsers.length === 0 ? (
                <p className="live-empty">No one online right now</p>
              ) : (
                onlineUsers.map((profile) => (
                  <div
                    key={profile.uid}
                    className="live-user-card"
                    onClick={() => openUserPreview(profile.uid)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="live-avatar">
                      <Avatar src={profile.avatar} name={profile.name} size={72} />
                      <span className="online-indicator" />
                    </div>
                    <span className="live-username">{profile.name}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {selectedUser && (
          <UserPreviewModal
            user={selectedUser}
            onClose={closeUserPreview}
            onChat={() => startChat(selectedUser.uid, selectedUser.name, selectedUser.avatar)}
          />
        )}
      </div>
    </>
  );
};

export default Home;