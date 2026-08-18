// src/components/pages/Home/Home.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../contexts/ProfileContext';
import { db } from '../../../services/firebase';
import { ref, onValue, get } from 'firebase/database';
import Avatar from '../../common/Avatar';
import './Home.css';

// ─── Demo constants ────────────────────────────────────────────
const DEMO_UID = 'k9Cs6QPfDRNTputzic7V3xRUof63';
const SUPPORT_UID = 'hD7tJzPVI1VSorhok8GToBC6VDy1';

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profiles, fetchProfile } = useProfile();
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  const isDemoUser = user?.uid === DEMO_UID;
  const isSupportUser = user?.uid === SUPPORT_UID;

  // ─── Listen to presence and fetch profiles ──────────────────
  useEffect(() => {
    if (!user) return;

    const presenceRef = ref(db, 'presence/online');
    let isMounted = true;

    const unsubscribe = onValue(presenceRef, async (snapshot) => {
      if (!isMounted) return;
      const data = snapshot.val() || {};
      let onlineUids = Object.keys(data).filter(uid => data[uid] === true && uid !== user.uid);

      // ─── Demo user: only show support if online ──────────────
      if (isDemoUser) {
        const supportOnline = data[SUPPORT_UID] === true;
        if (supportOnline) {
          if (!profiles[SUPPORT_UID]) {
            await fetchProfile(SUPPORT_UID);
          }
          const supportProfile = profiles[SUPPORT_UID];
          if (supportProfile) {
            setOnlineUsers([{ uid: SUPPORT_UID, ...supportProfile, online: true }]);
          } else {
            setOnlineUsers([]);
          }
        } else {
          setOnlineUsers([]);
        }
        setLoading(false);
        setFetching(false);
        return;
      }

      // ─── Support user: show all users (including demo if online) ──
      if (isSupportUser) {
        if (onlineUids.length === 0) {
          setOnlineUsers([]);
          setLoading(false);
          setFetching(false);
          return;
        }

        setFetching(true);
        setLoading(true);

        const profilePromises = onlineUids.map(async (uid) => {
          if (profiles[uid] && profiles[uid].name) {
            return profiles[uid];
          }
          const profileRef = ref(db, `profiles/${uid}`);
          const snapshot = await get(profileRef);
          if (snapshot.exists()) {
            const data = snapshot.val();
            fetchProfile(uid);
            return data;
          }
          return null;
        });

        const profileResults = await Promise.all(profilePromises);
        const list = onlineUids.map((uid, index) => ({
          uid,
          ...(profileResults[index] || { name: null, avatar: '' })
        }));

        const hasAllNames = list.every(p => p.name !== null);
        if (isMounted) {
          setOnlineUsers(list);
          setLoading(!hasAllNames);
          setFetching(false);
        }
        return;
      }

      // ─── Normal users: show everyone except demo ──────────────
      onlineUids = onlineUids.filter(uid => uid !== DEMO_UID);

      if (onlineUids.length === 0) {
        setOnlineUsers([]);
        setLoading(false);
        setFetching(false);
        return;
      }

      setFetching(true);
      setLoading(true);

      const profilePromises = onlineUids.map(async (uid) => {
        if (profiles[uid] && profiles[uid].name) {
          return profiles[uid];
        }
        const profileRef = ref(db, `profiles/${uid}`);
        const snapshot = await get(profileRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          fetchProfile(uid);
          return data;
        }
        return null;
      });

      const profileResults = await Promise.all(profilePromises);
      const list = onlineUids.map((uid, index) => ({
        uid,
        ...(profileResults[index] || { name: null, avatar: '' })
      }));

      const hasAllNames = list.every(p => p.name !== null);
      if (isMounted) {
        setOnlineUsers(list);
        setLoading(!hasAllNames);
        setFetching(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user, profiles, fetchProfile, isDemoUser, isSupportUser]);

  const startChat = (uid, name, avatar) => {
    navigate(`/chat/${uid}`, {
      state: {
        userName: name || 'User',
        userAvatar: avatar || '',
      },
    });
  };

  if (loading || fetching) {
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
              onlineUsers.map((profile) => {
                if (!profile.name) return null;
                return (
                  <div
                    key={profile.uid}
                    className="live-user-card"
                    onClick={() => startChat(profile.uid, profile.name, profile.avatar)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="live-avatar">
                      <Avatar src={profile.avatar} name={profile.name} size={72} />
                      <span className={`online-indicator ${profile.online ? '' : 'offline'}`} />
                    </div>
                    <span className="live-username">{profile.name}</span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;