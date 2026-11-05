// src/components/pages/Home/Home.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../contexts/ProfileContext';
import { useCall } from '../../../contexts/CallContext';
import { db } from '../../../services/firebase';
import { ref, set, onValue, onDisconnect, remove, off, get, update } from 'firebase/database';
import Peer from 'peerjs';
import Avatar from '../../common/Avatar';
import UserPreviewModal from '../../common/UserPreviewModal';
import LiveViewModal from '../../VideoChat/LiveViewModal';
import BroadcastView from '../../VideoChat/BroadcastView';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import StoriesBar from '../../Stories/StoriesBar';
import './Home.css';
import { isRealDisplayName, filterVisibleUsers } from '../../../utils/userIntegrity';

// ★ Spotlight feed for Home page
import SpotlightHomeCard from '../../common/SpotlightHomeCard';
import { listenToSpotlightFeed } from '../../../services/spotlightService';

const DEMO_UID = 'k9Cs6QPfDRNTputzic7V3xRUof63';
const SUPPORT_UID = 'hD7tJzPVI1VSorhok8GToBC6VDy1';

const HomeSkeleton = () => (
  <div className="home-page">
    <div className="home-container">
      <div className="home-header-skeleton">
        <div className="skeleton-block" style={{ width: 40, height: 40, borderRadius: '50%' }} />
        <div className="skeleton-block" style={{ width: 90, height: 24, borderRadius: 8 }} />
        <div className="skeleton-block" style={{ width: 40, height: 40, borderRadius: '50%' }} />
      </div>
      <div className="skeleton-block" style={{ width: '100%', height: 90, borderRadius: 18, marginBottom: 16 }} />
      <section className="home-section">
        <div className="section-header">
          <div className="skeleton-block" style={{ width: 110, height: 20, borderRadius: 8 }} />
          <div className="skeleton-block" style={{ width: 70, height: 22, borderRadius: 12 }} />
        </div>
        <div className="live-users-scroll">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton-block" style={{ width: 80, height: 95, borderRadius: 16, flexShrink: 0 }} />
          ))}
        </div>
      </section>
    </div>
  </div>
);

const Home = ({ onOpenRecorder, onOpenStory }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profiles, fetchProfile } = useProfile();
  const { startVideoCall, activeVideoCall } = useCall();
  const [onlineUids, setOnlineUids] = useState([]);
  const [bannedUids, setBannedUids] = useState(new Set());
  const [liveUids, setLiveUids] = useState([]);
  const [liveMeta, setLiveMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [viewingLive, setViewingLive] = useState(null);

  // Spotlight posts shown below Live Now on Home
  const [spotlightPosts, setSpotlightPosts] = useState([]);

  const [isLive, setIsLive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [peerError, setPeerError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const peerRef = useRef(null);
  const peerIdSet = useRef(false);
  const [broadcastStream, setBroadcastStream] = useState(null);

  const isDemoUser = user?.uid === DEMO_UID;
  const isSupportUser = user?.uid === SUPPORT_UID;

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Subscribe to Spotlight
  useEffect(() => {
    const unsub = listenToSpotlightFeed({ maxCount: 12 }, (rawPosts) => {
      setSpotlightPosts(Array.isArray(rawPosts) ? rawPosts.slice(0, 12) : []);
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  useEffect(() => {
    if (!user) return;
    let peerInstance = null;
    let attempt = 0;
    const maxAttempts = 3;
    let timeoutId = null;

    const createPeer = () => {
      const config = {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
          ],
        },
      };
      const peer = new Peer(undefined, config);
      peerInstance = peer;
      peerRef.current = peer;

      peer.on('open', (id) => {
        peerIdSet.current = true;
        set(ref(db, `peerIds/${user.uid}`), id).catch((err) => console.warn('Failed to store peer ID:', err));
        if (streamRef.current) {
          update(ref(db, 'live/' + user.uid), { peerId: id }).catch(() => {});
        }
        setPeerError(null);
      });

      peer.on('call', (call) => {
        if (streamRef.current) {
          call.answer(streamRef.current);
        } else {
          const wait = setInterval(() => {
            if (streamRef.current) {
              clearInterval(wait);
              try { call.answer(streamRef.current); } catch (_) {}
            }
          }, 250);
          setTimeout(() => clearInterval(wait), 12000);
        }
      });

      peer.on('error', (err) => {
        const code = err?.type || err?.message || '';
        if (attempt < maxAttempts && peerInstance) {
          attempt++;
          try { peerInstance.destroy(); } catch (_) {}
          timeoutId = setTimeout(createPeer, 2000);
        } else {
          let msg = 'Connection problem. Please try again.';
          if (/network|fetch|server-error|socket-error|unavailable/i.test(String(code))) {
            msg = 'Network issue reaching the call server. Check your connection and try again.';
          } else if (/peer-unavailable/i.test(String(code))) {
            msg = 'The other person is unavailable. Try again in a moment.';
          } else if (/Could not get an ID|Failed to fetch|Aborting/i.test(String(err?.message || code))) {
            msg = 'Could not connect to the call server. Please try again.';
          }
          setPeerError(msg);
        }
      });
    };

    createPeer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (peerInstance) peerInstance.destroy();
      peerRef.current = null;
      remove(ref(db, `peerIds/${user.uid}`)).catch(() => {});
    };
  }, [user]);

  const startCamera = async () => {
    try {
      const constraints = {
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true,
      };
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (audioErr) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
      }
      streamRef.current = stream;
      setBroadcastStream(stream);
      setIsLive(true);
      setCameraError(null);

      if (user) {
        let name = user.displayName || profiles[user.uid]?.name || 'User';
        let avatar = user.photoURL || profiles[user.uid]?.avatar || '';
        try {
          const snap = await get(ref(db, `profiles/${user.uid}`));
          if (snap.exists()) {
            const p = snap.val() || {};
            if (p.name) name = p.name;
            if (p.avatar) avatar = p.avatar;
          }
        } catch (_) {}

        let peerId = peerRef.current?.id || null;
        for (let i = 0; i < 20 && !peerId; i += 1) {
          await new Promise((r) => setTimeout(r, 250));
          peerId = peerRef.current?.id || null;
        }

        sessionStorage.setItem('echo_live_active', user.uid);
        await set(ref(db, 'live/' + user.uid), {
          name,
          avatar,
          timestamp: Date.now(),
          peerId,
          viewers: 0,
        });
        onDisconnect(ref(db, 'live/' + user.uid)).remove();
      }
    } catch (err) {
      setCameraError('Allow camera access to go live.');
      setIsLive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setBroadcastStream(null);
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsLive(false);
    if (user) {
      remove(ref(db, 'live/' + user.uid)).catch(() => {});
      remove(ref(db, 'liveChat/' + user.uid)).catch(() => {});
      sessionStorage.removeItem('echo_live_active');
    }
  };

  useEffect(() => {
    if (!user?.uid) return;
    if (sessionStorage.getItem('echo_live_active') !== user.uid) return;
    const done = window.confirm('You refreshed while live. Are you done with this live stream?');
    if (done) {
      remove(ref(db, 'live/' + user.uid)).catch(() => {});
      remove(ref(db, 'liveChat/' + user.uid)).catch(() => {});
    }
    sessionStorage.removeItem('echo_live_active');
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const endLiveNow = () => {
      if (sessionStorage.getItem('echo_live_active') !== user.uid) return;
      remove(ref(db, 'live/' + user.uid)).catch(() => {});
      remove(ref(db, 'liveChat/' + user.uid)).catch(() => {});
      sessionStorage.removeItem('echo_live_active');
    };
    const onLeave = (e) => {
      if (!isLive) return;
      e.preventDefault();
      e.returnValue = 'You are live. Leave this page to end the stream for viewers.';
    };
    const onHide = () => {
      if (isLive) endLiveNow();
    };
    window.addEventListener('beforeunload', onLeave);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('beforeunload', onLeave);
      window.removeEventListener('pagehide', onHide);
    };
  }, [isLive, user?.uid]);

  const toggleLive = () => {
    if (isLive) stopCamera();
    else startCamera();
  };

  useEffect(() => {
    if (!user) return;
    const presenceRef = ref(db, 'presence/online');
    const unsubscribePresence = onValue(
      presenceRef,
      (snapshot) => {
        const data = snapshot.val() || {};
        let online = Object.keys(data).filter(
          (uid) => uid !== user.uid && data[uid] !== false && data[uid] != null && data[uid] !== 0
        );
        if (isDemoUser) {
          online = online.filter((uid) => uid === SUPPORT_UID);
        } else if (!isSupportUser) {
          online = online.filter((uid) => uid !== DEMO_UID);
        }
        setOnlineUids(online);
        setLoading(false);
        online.forEach((uid) => {
          if (!profiles[uid]) fetchProfile(uid);
        });
      },
      () => setLoading(false)
    );

    const timeout = setTimeout(() => setLoading(false), 5000);

    const accountsRef = ref(db, 'accounts');
    const unsubAccounts = onValue(accountsRef, (snap) => {
      const data = snap.val() || {};
      const banned = new Set();
      Object.keys(data).forEach((id) => {
        if (data[id] && data[id].banned === true) banned.add(id);
      });
      setBannedUids(banned);
    });

    return () => {
      unsubscribePresence();
      unsubAccounts();
      clearTimeout(timeout);
    };
  }, [user, isDemoUser, isSupportUser, profiles, fetchProfile]);

  useEffect(() => {
    if (!user) return;
    const liveRef = ref(db, 'live');
    const unsubLive = onValue(liveRef, (snapshot) => {
      const data = snapshot.val() || {};
      const live = Object.keys(data).filter((uid) => uid !== user.uid);
      setLiveUids(live);
      const meta = {};
      live.forEach((uid) => {
        const entry = data[uid] || {};
        meta[uid] = {
          name: entry.name || '',
          avatar: entry.avatar || '',
        };
        fetchProfile?.(uid);
      });
      setLiveMeta(meta);
    });
    return () => unsubLive();
  }, [user, fetchProfile]);

  const openUserPreview = (uid) => {
    const profile = profiles[uid];
    if (profile) {
      setSelectedUser({
        uid,
        ...profile,
        isLive: liveUids.includes(uid),
      });
    }
  };

  const closeUserPreview = () => setSelectedUser(null);

  useEffect(() => {
    if (activeVideoCall) setSelectedUser(null);
  }, [activeVideoCall]);

  const startChat = (uid, name, avatar) => {
    closeUserPreview();
    navigate(`/chat/${uid}`, {
      state: { userName: name || 'User', userAvatar: avatar || '' },
    });
  };

  const handleJoinLive = (uid, name) => {
    closeUserPreview();
    setViewingLive({ uid, name, avatar: profiles[uid]?.avatar || '' });
  };

  const closeLiveView = () => setViewingLive(null);

  const combinedUids = Array.from(new Set([...onlineUids, ...liveUids])).filter((id) => !bannedUids.has(id));
  const onlineUsers = filterVisibleUsers(
    combinedUids
      .map((uid) => {
        const profile = profiles[uid];
        const isLiveUser = liveUids.includes(uid);
        const fromLive = liveMeta[uid] || {};
        if (!profile) return null;
        const name = (profile.name || fromLive.name || '').trim();
        if (!isRealDisplayName(name)) return null;
        return {
          uid,
          ...profile,
          name,
          avatar: profile.avatar || fromLive.avatar || '',
          online: onlineUids.includes(uid),
          isLive: isLiveUser,
        };
      })
      .filter(Boolean)
  ).sort((a, b) => (b.isLive ? 1 : 0) - (a.isLive ? 1 : 0));

  if (isLive && broadcastStream) {
    return <BroadcastView onEnd={stopCamera} stream={broadcastStream} />;
  }

  if (loading) {
    return <HomeSkeleton />;
  }

  const liveCount = liveUids.length;
  const onlineCount = onlineUsers.filter((u) => u.online && !u.isLive).length;
  const totalCount = liveCount + onlineCount;

  const myProfile = profiles[user?.uid] || {};

  return (
    <>
      <SEO
        title="Home – Chat with Friends"
        description="See who's online and start a conversation instantly on ECHO."
      />
      <StructuredData />

      <div className="home-page">
        <div className="home-container">
          
          {/* ─── NEW: Top Header ─────────────────────────── */}
          <header className="home-top-header">
            <div className="header-left" onClick={() => navigate('/profile')}>
              <Avatar src={myProfile.avatar} name={myProfile.name || 'Me'} size={40} />
            </div>
            <div className="header-center">
              <h1 className="header-logo">ECHO</h1>
            </div>
            <div className="header-right">
              <button className="header-icon-btn" onClick={() => navigate('/chats')} aria-label="Messages">
                <i className="fas fa-comment-dots" />
              </button>
            </div>
          </header>

          {/* ─── NEW: Stories Bar (Moved to top) ───────────── */}
          <div className="home-stories-wrapper">
            <StoriesBar
              currentUserId={user?.uid}
              users={onlineUsers}
              ownStory={null}
              onAddStory={onOpenRecorder}
              onViewStories={(stories, ownerId) => {
                onOpenStory(stories, ownerId);
              }}
            />
          </div>

          {/* ─── Go Live Button (Prominent) ────────────────── */}
          <button
            type="button"
            className={`go-live-btn${isLive ? ' is-live' : ''}`}
            onClick={toggleLive}
          >
            <div className="go-live-icon-wrap">
              <i className={`fas ${isLive ? 'fa-stop-circle' : 'fa-video'}`} aria-hidden="true" />
            </div>
            <span>{isLive ? 'End Live Stream' : 'Go Live Now'}</span>
          </button>

          {cameraError && (
            <div className="home-error-inline" role="alert">
              {cameraError}
            </div>
          )}

          {/* ─── Live Now section (Redesigned Cards) ───────── */}
          <section className="home-section">
            <div className="section-header">
              <div className="section-title-group">
                <span className={`live-dot${liveCount > 0 ? ' is-live' : ''}`} aria-hidden="true" />
                <h3 className="section-title">Live Now</h3>
              </div>
              <span className="section-count">
                {liveCount > 0 ? `${liveCount} live` : `${totalCount} online`}
              </span>
            </div>

            <div className="live-users-scroll">
              {onlineUsers.length === 0 ? (
                <div className="live-empty">
                  <i className="fas fa-moon" aria-hidden="true" />
                  <span>It's quiet here right now</span>
                </div>
              ) : (
                onlineUsers.map((profile) => (
                  <button
                    key={profile.uid}
                    type="button"
                    className={`live-card-v2${profile.isLive ? ' is-live' : ''}`}
                    onClick={() => openUserPreview(profile.uid)}
                  >
                    <div className="live-card-avatar">
                      <Avatar src={profile.avatar} name={profile.name} size={56} />
                      {!profile.isLive && profile.online && <span className="online-dot-v2" />}
                    </div>
                    <div className="live-card-info">
                      <span className="live-card-name">{profile.name}</span>
                      {profile.isLive ? (
                        <span className="live-card-badge">● LIVE</span>
                      ) : (
                        <span className="live-card-status">Online</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          {/* ─── Spotlight feed ───────────────────────────── */}
          <section className="home-spotlight-section">
            <div className="section-header">
              <div className="section-title-group">
                <i className="fas fa-bolt home-spotlight-icon" aria-hidden="true" />
                <h3 className="section-title">Spotlight</h3>
              </div>
              <button
                type="button"
                className="home-spotlight-see-all"
                onClick={() => navigate('/spotlight')}
              >
                See all
              </button>
            </div>

            {spotlightPosts.length === 0 ? (
              <div className="home-spotlight-empty">
                <i className="fas fa-video" aria-hidden="true" />
                <span>No Spotlights yet — be the first!</span>
                <button
                  type="button"
                  className="home-spotlight-cta"
                  onClick={() => navigate('/spotlight/upload')}
                >
                  Create Spotlight
                </button>
              </div>
            ) : (
              <div className="home-spotlight-grid">
                {spotlightPosts.map((post) => (
                  <SpotlightHomeCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Modals */}
        {selectedUser && (
          <UserPreviewModal
            user={selectedUser}
            onClose={closeUserPreview}
            onChat={() => startChat(selectedUser.uid, selectedUser.name, selectedUser.avatar)}
            onVideoCall={() => {
              const u = selectedUser;
              setSelectedUser(null);
              startVideoCall(u.uid, u.name, u.avatar);
            }}
            callerIsLive={isLive}
            onJoinLive={() => handleJoinLive(selectedUser.uid, selectedUser.name)}
          />
        )}

        {viewingLive && (
          <LiveViewModal
            broadcasterId={viewingLive.uid}
            broadcasterName={viewingLive.name}
            broadcasterAvatar={viewingLive.avatar || profiles[viewingLive.uid]?.avatar || ''}
            onClose={closeLiveView}
          />
        )}

        {peerError && (
          <div className="peer-error-toast" role="alert">
            <span>{peerError}</span>
            <button
              type="button"
              onClick={() => {
                setPeerError(null);
                window.location.reload();
              }}
            >
              Try again
            </button>
            <button
              type="button"
              className="peer-error-dismiss"
              onClick={() => setPeerError(null)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default Home;
